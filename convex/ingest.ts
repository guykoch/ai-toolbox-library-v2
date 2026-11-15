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

const FORMAT_SPEC = `You file links into a personal "AI Content Map" library. Return ONE card as a JSON object, nothing else.

Fields (match the examples exactly in style and length):
- "title": the tool/post's real name. For GitHub repos use "owner/repo: <repo description>". For a social post about a tool, a short name for what it is (e.g. "TranslateGemma", "Five Claude Code tips"). Keep the original language of the title if the page title is Hebrew.
- "summary": ONE sentence, 14-22 words, in fresh English words (never copy the source), saying what it is and what it does.
- "cat": main shelf, one of: ${CATS.join(", ")}.
- "extra": array of other shelves it also clearly belongs to (usually []).
- "type": one of: ${TYPES.join(", ")}.
- "os": true if it is open source (public code repo / open licence), false if clearly not, "unknown" if you can't tell.
- "lang": language of the post/page the link opens: "he", "en" or "unknown".
- "author": the person who wrote/shared the social post (Facebook/LinkedIn/X) or "" for websites, repos and YouTube.
- "url": the best link to open. Keep the link the user gave (tracking stripped) unless it is a share/redirect link that resolved to a cleaner URL. For a bare tool name, the official site or repo.
- "mentioned": a second important link referenced inside a post (e.g. the GitHub repo a Facebook post points to), else "".
- "docs": official docs link if clearly separate and useful, else "".
- "install": array of exact install commands if the source gives them (e.g. "npx skills add owner/repo"), else [].
- "pop": hype score 1-100 (90+ huge buzz, 70-89 widely talked about, 55-69 solid following, 40-54 niche but known, 25-39 small/local, under 25 very niche). Weigh: official source (Anthropic, Google, OpenAI, Microsoft, Vercel...), open-source repo stars, scale named in the post, how established the product is.
- "why": 1-4 short reasons for the score, in the same phrasing style as the examples, e.g. "About Claude — one of the most-talked-about AI platforms of 2026", "Official Google source — first-party, not a third-party tip", "It's a code repo, so GitHub stars and forks drive its buzz", "Open source — anyone can inspect, fork and reuse it", "Scale named in the post: 316 skills", "Lovable is an established, widely used name in this space", "Little wider buzz found — mostly a niche or local find". Do NOT include star counts; they are added automatically.
- "priv": true only if the user's text says the content is private / not to be shared, else false.

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
  args: { key: v.string(), text: v.string(), today: v.string() },
  handler: async (ctx, { key, text, today }): Promise<{ status: "added" | "again"; item: any; wasArchived?: boolean }> => {
    checkKey(key);
    const input = text.trim();
    if (!input) throw new ConvexError("Paste a link, a tool name or some context first.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new ConvexError("Bad date.");
    const day = dateParts(today);

    const urls = Array.from(new Set((input.match(/https?:\/\/[^\s<>"')\]]+/g) || []).map((u) => u.replace(/[.,;]+$/, "")))).slice(0, 3);
    const rows: { status: string; data: any }[] = await ctx.runQuery(internal.items.allForIngest, {});

    // 1. Already in the library? Mark it "saved again" instead of adding a duplicate.
    // Prefer a card whose own link matches; fall back to a card that only mentions it.
    const findDup = (u: string) =>
      rows.find((r) => r.data.url && norm(r.data.url) === norm(u)) ||
      rows.find((r) => [r.data.mentioned, r.data.docs].filter(Boolean).some((x: string) => norm(x) === norm(u)));
    for (const u of urls) {
      const dup = findDup(u);
      if (dup) {
        const res = await ctx.runMutation(internal.items.markSavedAgain, { id: dup.data.id, date: day.date });
        return { status: "again", item: res.item, wasArchived: res.wasArchived };
      }
    }

    // 2. Gather context from every link.
    const fetched = await Promise.all(urls.map(gatherUrl));
    for (const f of fetched) {
      const dup = findDup(f.finalUrl);
      if (dup) {
        const res = await ctx.runMutation(internal.items.markSavedAgain, { id: dup.data.id, date: day.date });
        return { status: "again", item: res.item, wasArchived: res.wasArchived };
      }
    }

    // 3. Ask Claude to write the card in the library's format.
    const examples = pickExamples(rows.map((r) => r.data));
    const userMsg =
      `Today is ${day.date}.\n\nEXAMPLE CARDS FROM THE LIBRARY (copy their style):\n${JSON.stringify(examples, null, 1)}\n\n` +
      `WHAT THE USER PASTED:\n"""\n${input.slice(0, 6000)}\n"""\n\n` +
      (fetched.length ? `WHAT I FOUND AT THE LINKS:\n${fetched.map((f) => f.notes).join("\n---\n")}\n\n` : "") +
      `Return only the JSON card.`;
    // Claude writes the card if you gave it a key; otherwise Gemini does (one key runs everything).
    const answer = process.env.ANTHROPIC_API_KEY
      ? await callClaude(FORMAT_SPEC, userMsg, true)
      : (await callGemini({ model: MODELS.addGemini(), system: FORMAT_SPEC, turns: [{ role: "user", text: userMsg }], search: true, thinking: "medium", maxTokens: 4096 })).text;
    const raw = parseJson(answer);

    // 4. Validate and normalise every field so the card matches the others exactly.
    const str = (x: any) => (typeof x === "string" ? x.trim() : "");
    const url = cleanUrl(str(raw.url) || fetched[0]?.finalUrl || urls[0] || "");
    if (!/^https?:\/\//.test(url)) throw new ConvexError("Couldn't find a link for this. Paste the link itself, or add more detail.");
    const dupAfter = findDup(url);
    if (dupAfter) {
      const res = await ctx.runMutation(internal.items.markSavedAgain, { id: dupAfter.data.id, date: day.date });
      return { status: "again", item: res.item, wasArchived: res.wasArchived };
    }
    const cat = CATS.includes(raw.cat) ? raw.cat : "other";
    const gh = fetched.find((f) => f.github)?.github;
    const why: string[] = (Array.isArray(raw.why) ? raw.why : []).map(str).filter(Boolean).slice(0, 4);
    if (gh) why.push(`${fmt(gh.stars)} GitHub stars and ${fmt(gh.forks)} forks when checked on ${day.date}${gh.license ? ` — ${gh.license} licence` : ""}`);
    if (!why.length) why.push("Little wider buzz found — mostly a niche or local find");
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
      mentioned: str(raw.mentioned) && norm(str(raw.mentioned)) !== norm(url) ? cleanUrl(str(raw.mentioned)) : "",
      priv: raw.priv === true,
      extra: (Array.isArray(raw.extra) ? raw.extra : []).filter((c: any) => CATS.includes(c) && c !== cat),
      pop: Math.max(1, Math.min(100, Math.round(Number(raw.pop) || 40))),
      why,
    };
    const docs = str(raw.docs);
    if (docs && /^https?:\/\//.test(docs) && norm(docs) !== norm(url)) item.docs = cleanUrl(docs);
    const install = (Array.isArray(raw.install) ? raw.install : []).map(str).filter(Boolean);
    if (install.length) item.install = install;

    const saved = await ctx.runMutation(internal.items.insertItem, { data: item });
    return { status: "added", item: saved };
  },
});
