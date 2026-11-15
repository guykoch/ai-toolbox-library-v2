import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import { checkKey } from "./auth";
import { cleanUrl, norm, hostLabel, gatherUrl } from "./web";
import { callClaude, callGemini, parseJson, MODELS } from "./llm";

// ---------------------------------------------------------------------------
// "Add to library": takes anything you paste (a link, a tool name, a note),
// gathers context, asks Claude to write a card in the library's exact format,
// then validates every field in code before saving it.
// ---------------------------------------------------------------------------

const CATS = ["coding-agents", "agent-skills", "courses-guides", "productivity", "app-building", "video", "image", "audio", "ai-models", "news-analysis", "translation", "other"];
const TYPES = ["guide", "tool", "video", "course", "post", "news", "open-source-repo", "other"];
const LANGS = ["he", "en", "unknown"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function dateParts(isoToday: string) {
  const [y, m, d] = isoToday.split("-").map(Number);
  return { iso: isoToday, date: `${d} ${MONTHS[m - 1]} ${y}`, month: m };
}

// Screenshots per add (the page enforces the same limit).
const MAX_SHOTS = 20;

type AddResult = { status: "added" | "again" | "failed"; item: any; wasArchived?: boolean; reason?: string };
type AddResponse = AddResult & { results: AddResult[] };

const FORMAT_SPEC = `You file links into a personal "AI Toolbox Library" library. Return the card as a JSON object, nothing else (or {"cards": [...]} when there are several different tools — see below).

Fields (match the examples exactly in style and length):
- "title": the tool/post's real name. For GitHub repos use "owner/repo: <repo description>". For a social post about a tool, a short name for what it is (e.g. "TranslateGemma", "Five Claude Code tips"). Keep the original language of the title if the page title is Hebrew.
- "summary": ONE sentence, 14-22 words, in fresh English words (never copy the source), saying what it is and what it does.
- "cat": main shelf, one of: ${CATS.join(", ")}.
- "extra": array of other shelves it also clearly belongs to (usually []).
- "type": one of: ${TYPES.join(", ")}.
- "os": true if it is open source (public code repo / open licence), false if clearly not, "unknown" if you can't tell.
- "lang": language of the post/page the link opens: "he", "en" or "unknown".
- "author": the person who wrote/shared the social post (Facebook/LinkedIn/X) or "" for websites, repos and YouTube.
- "title"/"summary" describe the TOOL itself when "url" is the tool's page.
- "url": the TOOL's own page (official site, GitHub repo, store page, course page) — not the social post. If the user pasted a Facebook/LinkedIn/X post about a specific tool, find that tool's official page with search and use it. Only if the post itself is the content (tips, opinion, news, a prompt in the post) or the tool can't be identified confidently, use the post link. For a bare tool name, the official site or repo. Never guess URLs.
- "mentioned": a second important link referenced inside a post (e.g. the GitHub repo a Facebook post points to), else "".
- "docs": official docs link if clearly separate and useful, else "".
- "install": array of exact install commands if the source gives them (e.g. "npx skills add owner/repo"), else [].
- "pop": hype score 1-100 (90+ huge buzz, 70-89 widely talked about, 55-69 solid following, 40-54 niche but known, 25-39 small/local, under 25 very niche). Weigh: official source (Anthropic, Google, OpenAI, Microsoft, Vercel...), open-source repo stars, scale named in the post, how established the product is.
- "why": 1-4 short reasons for the score, in the same phrasing style as the examples, e.g. "About Claude — one of the most-talked-about AI platforms of 2026", "Official Google source — first-party, not a third-party tip", "It's a code repo, so GitHub stars and forks drive its buzz", "Open source — anyone can inspect, fork and reuse it", "Scale named in the post: 316 skills", "Lovable is an established, widely used name in this space", "Little wider buzz found — mostly a niche or local find". Do NOT include star counts; they are added automatically.
- "priv": true only if the user's text says the content is private / not to be shared, else false.

Screenshots may be attached: read them (they are usually the post itself — text, images, links shown in it).
ONE OR SEVERAL TOOLS: if the screenshots/text cover two or more DIFFERENT tools (e.g. two screenshots of two different posts), return {"cards": [card1, card2, ...]} with one card per distinct tool. Several screenshots of the SAME tool/post = one card. A single tool can be returned as a plain card object.
If there is NOT enough information to tell what this is (e.g. only a social-media link that couldn't be read, no text, no screenshot, and search can't find it), return exactly {"unreadable": true} instead of guessing.

If the input is only a name or description, use web search to identify the real tool and its official link. Never invent facts; if unsure, say less.`;

function pickExamples(all: any[]) {
  const pick = (f: (i: any) => boolean) => all.find(f);
  return [
    pick((i) => i.host === "Facebook" && i.os === true && i.mentioned),
    pick((i) => i.host === "GitHub" && i.type === "open-source-repo" && !i.again),
    pick((i) => i.host === "YouTube"),
    pick((i) => i.host !== "Facebook" && i.host !== "GitHub" && i.host !== "YouTube" && i.type === "tool"),
  ]
    .filter(Boolean)
    .map((i) => {
      const { id, again, date, iso, month, host, ...rest } = i;
      return rest;
    });
}

function fmt(n: number) {
  return n.toLocaleString("en-US");
}

export const addFromText = action({
  args: {
    key: v.string(),
    text: v.string(),
    today: v.string(),
    images: v.optional(v.array(v.object({ mime: v.string(), data: v.string() }))),
  },
  handler: async (ctx, { key, text, today, images }): Promise<AddResponse> => {
    checkKey(key);
    const input = text.trim();
    const pics = (images || []).filter((im) => /^image\/(png|jpeg|webp|gif)$/.test(im.mime)).slice(0, MAX_SHOTS);
    if (!input && !pics.length) throw new ConvexError("Paste a link, a tool name, some context or a screenshot first.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new ConvexError("Bad date.");
    const day = dateParts(today);

    const urls = Array.from(new Set((input.match(/https?:\/\/[^\s<>"')\]]+/g) || []).map((u) => u.replace(/[.,;]+$/, "")))).slice(0, 5);
    const rows: { status: string; data: any }[] = await ctx.runQuery(internal.items.allForIngest, {});

    // Prefer a card whose own link matches; fall back to a card that only mentions it.
    const findDup = (u: string) =>
      rows.find((r) => r.data.url && norm(r.data.url) === norm(u)) ||
      rows.find((r) => [r.data.mentioned, r.data.docs, r.data.savedFrom].filter(Boolean).some((x: string) => norm(x) === norm(u)));
    const again = async (dup: { data: any }): Promise<AddResult> => {
      const res = await ctx.runMutation(internal.items.markSavedAgain, { id: dup.data.id, date: day.date });
      return { status: "again", item: res.item, wasArchived: res.wasArchived };
    };
    const reply = (results: AddResult[]): AddResponse => ({ ...results[0], results });

    // 1. A single link that's already in the library: no AI needed.
    const single = urls.length === 1 && !pics.length;
    if (single && findDup(urls[0])) return reply([await again(findDup(urls[0])!)]);

    // 2. Gather context from every link.
    const fetched = await Promise.all(urls.map(gatherUrl));
    if (single && findDup(fetched[0].finalUrl)) return reply([await again(findDup(fetched[0].finalUrl)!)]);

    // 3. Ask the AI to write the card(s) in the library's format — one per distinct tool.
    const examples = pickExamples(rows.map((r) => r.data));
    const userMsg =
      `Today is ${day.date}.\n\nEXAMPLE CARDS FROM THE LIBRARY (copy their style):\n${JSON.stringify(examples, null, 1)}\n\n` +
      `WHAT THE USER PASTED:\n"""\n${input.slice(0, 9000) || "(nothing typed — see the attached screenshots)"}\n"""\n\n` +
      (pics.length ? `${pics.length} SCREENSHOT(S) ATTACHED — read every one of them.\n\n` : "") +
      (fetched.length ? `WHAT I FOUND AT THE LINKS:\n${fetched.map((f) => f.notes).join("\n---\n")}\n\n` : "") +
      `Return only the JSON.`;
    // Claude writes the card if you gave it a key; otherwise Gemini does (one key runs everything).
    const answer = process.env.ANTHROPIC_API_KEY
      ? await callClaude(FORMAT_SPEC, userMsg, true, pics)
      : (await callGemini({ model: MODELS.addGemini(), system: FORMAT_SPEC, turns: [{ role: "user", text: userMsg, images: pics }], search: true, thinking: "medium", maxTokens: 8192 })).text;
    const parsed = parseJson(answer);
    if (parsed.unreadable === true) {
      throw new ConvexError("I couldn't read that post — Facebook hides posts from servers. Paste the post's text or a screenshot here along with the link.");
    }
    const raws: any[] = (Array.isArray(parsed.cards) ? parsed.cards : [parsed]).filter((c: any) => c && typeof c === "object" && c.unreadable !== true).slice(0, 10);
    if (!raws.length) throw new ConvexError("I couldn't work out which tool this is. Add the tool's name, its website, or a bit more detail.");

    // 4. Validate and normalise every field so each card matches the others exactly.
    const str = (x: any) => (typeof x === "string" ? x.trim() : "");
    const social = urls.find((u) => /facebook\.com|fb\.watch|linkedin\.com|(^|\/\/)(www\.)?(x|twitter)\.com/i.test(u));
    const results: AddResult[] = [];
    const seenNow = new Set<string>();
    for (const raw of raws) {
      const url = cleanUrl(str(raw.url) || (raws.length === 1 ? fetched[0]?.finalUrl || urls[0] || "" : ""));
      if (!/^https?:\/\//.test(url)) {
        results.push({ status: "failed", item: { title: str(raw.title) || "Unknown tool" }, reason: "no link found" });
        continue;
      }
      if (seenNow.has(norm(url))) continue; // the AI listed the same tool twice
      seenNow.add(norm(url));
      const innerLink = str(raw.mentioned);
      const dup = findDup(url) || (/github\.com\//i.test(innerLink) ? rows.find((r) => r.data.url && norm(r.data.url) === norm(innerLink)) : undefined);
      if (dup) {
        results.push(await again(dup));
        continue;
      }
      const cat = CATS.includes(raw.cat) ? raw.cat : "other";
      const gh = fetched.find((f) => f.github && norm(f.finalUrl) === norm(url))?.github || (raws.length === 1 ? fetched.find((f) => f.github)?.github : undefined);
      const why: string[] = (Array.isArray(raw.why) ? raw.why : []).map(str).filter(Boolean).slice(0, 4);
      if (gh) why.push(`${fmt(gh.stars)} GitHub stars and ${fmt(gh.forks)} forks when checked on ${day.date}${gh.license ? ` \u2014 ${gh.license} licence` : ""}`);
      if (!why.length) why.push("Little wider buzz found \u2014 mostly a niche or local find");
      let os: boolean | "unknown" = raw.os === true ? true : raw.os === false ? false : "unknown";
      if (gh && gh.license) os = true;

      const item: any = {
        again: "",
        date: day.date,
        iso: day.iso,
        month: day.month,
        title: str(raw.title) || hostLabel(url),
        summary: str(raw.summary),
        cat,
        type: TYPES.includes(raw.type) ? raw.type : gh ? "open-source-repo" : "other",
        os,
        lang: LANGS.includes(raw.lang) ? raw.lang : "unknown",
        author: str(raw.author),
        url,
        host: hostLabel(url),
        mentioned: innerLink && norm(innerLink) !== norm(url) ? cleanUrl(innerLink) : "",
        priv: raw.priv === true,
        extra: (Array.isArray(raw.extra) ? raw.extra : []).filter((c: any) => CATS.includes(c) && c !== cat),
        pop: Math.max(1, Math.min(100, Math.round(Number(raw.pop) || 40))),
        why,
      };
      // Keep the social post the tool came from, when the card now links to the tool itself.
      if (social && norm(social) !== norm(url) && !/facebook\.com|fb\.watch|linkedin\.com/i.test(url)) item.savedFrom = cleanUrl(social);
      const docs = str(raw.docs);
      if (docs && /^https?:\/\//.test(docs) && norm(docs) !== norm(url)) item.docs = cleanUrl(docs);
      const install = (Array.isArray(raw.install) ? raw.install : []).map(str).filter(Boolean);
      if (install.length) item.install = install;

      const saved = await ctx.runMutation(internal.items.insertItem, { data: item });
      rows.push({ status: "active", data: saved }); // so a later card in this batch can't duplicate it
      // Write its install prompt in the background, so it's ready when you open it.
      await ctx.scheduler.runAfter(0, internal.pipeline.promptForNew, { id: saved.id, today: day.date });
      results.push({ status: "added", item: saved });
    }
    if (!results.some((r) => r.status !== "failed")) {
      throw new ConvexError("Couldn't find a link for this. Paste the link itself, or add more detail.");
    }
    return reply(results);
  },
});
