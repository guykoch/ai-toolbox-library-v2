import { internal } from "./_generated/api";
import { callGemini, parseJson, MODELS } from "./llm";
import { cleanUrl, norm, hostLabel, gatherUrl, fetchWithTimeout } from "./web";

// ---------------------------------------------------------------------------
// Turns a card that points at a social post (Facebook / LinkedIn) into a card
// about the tool itself, linking to the tool's own page. The post is kept as
// "savedFrom". If there is no specific tool behind the post (tips, opinions,
// news), or the tool can't be found with confidence, the card is left as is.
// ---------------------------------------------------------------------------

export const SOCIAL_HOSTS = ["Facebook", "LinkedIn", "linkedin.com"];
export const isSocial = (data: any) => SOCIAL_HOSTS.includes(data?.host) && !data?.savedFrom;

const TYPES = ["guide", "tool", "video", "course", "post", "news", "open-source-repo", "other"];

const SYSTEM = `You curate a personal library of AI tools. Each card below was saved as a link to a social-media POST (usually Facebook, often in Hebrew) about something. Your job: find the actual TOOL / product / repo / course the post is about, so the card can link to the tool itself instead of the post.

Use Google Search. Verify the official page (product site, GitHub repo, Chrome Web Store page, official docs, course page). Never guess a URL.

Decide:
- "tool": the post is about one specific, identifiable tool/product/repo/resource with its own page, and you found that page with good confidence.
- "keep": the post itself is the content (tips, a prompt written in the post, opinion, news roundup, a list of many tools, a question), OR you couldn't confidently identify the tool or its page.

Return ONLY JSON:
{"decision": "tool" | "keep",
 "confidence": "high" | "medium" | "low",
 "title": "the tool's real name (for GitHub repos: 'owner/repo: short description')",
 "summary": "ONE sentence, 14-22 words, fresh English words, what the tool is and does",
 "url": "official page of the tool",
 "docs": "official docs URL if separate and useful, else empty",
 "type": one of ${TYPES.join(", ")},
 "os": true | false | "unknown"  (open source?),
 "install": ["exact install command(s) from official docs, if any"],
 "note": "one short line on how you identified it"}`;

async function urlLooksAlive(url: string) {
  try {
    const r = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0 (Macintosh) AppleWebKit/537.36 Chrome/130 Safari/537.36" } }, 12000);
    return r.status !== 404 && r.status !== 410;
  } catch {
    return false;
  }
}

function fmt(n: number) {
  return n.toLocaleString("en-US");
}

export async function enrichItem(ctx: any, id: number, today: string): Promise<{ changed: boolean; note: string }> {
  const item: any = await ctx.runQuery(internal.items.getItem, { id });
  if (!item) return { changed: false, note: "missing" };

  const links = [item.url, item.mentioned].filter((u: string) => u && /^https?:\/\//.test(u));
  const fetched = await Promise.all(links.map(gatherUrl));
  const card = { title: item.title, summary: item.summary, type: item.type, shelf: item.cat, author: item.author, postUrl: item.url, linkInsidePost: item.mentioned || "", postLanguage: item.lang };
  const user =
    `Today is ${today}.\n\nSAVED CARD:\n${JSON.stringify(card, null, 1)}\n\n` +
    `WHAT I COULD READ AT ITS LINKS (Facebook usually blocks reading — rely on search):\n${fetched.map((f) => f.notes).join("\n---\n").slice(0, 8000)}`;
  const res = await callGemini({ model: MODELS.install(), system: SYSTEM, turns: [{ role: "user", text: user }], search: true, thinking: "medium", maxTokens: 4096 });
  const raw = parseJson(res.text);

  if (raw.decision !== "tool" || raw.confidence === "low") return { changed: false, note: "kept post: " + String(raw.note || raw.decision || "").slice(0, 160) };
  const url = cleanUrl(String(raw.url || ""));
  if (!/^https?:\/\//.test(url) || /vertexaisearch|google\.com\/search|facebook\.com|fb\.watch|linkedin\.com/i.test(url)) return { changed: false, note: "kept post: no usable tool link" };
  if (!(await urlLooksAlive(url))) return { changed: false, note: "kept post: tool link didn't open (" + url + ")" };

  // If another card already links to this tool, don't create a second card for it.
  const others: any[] = await ctx.runQuery(internal.items.activeForAdvisor, {});
  const twin = others.find((o) => o.id !== id && o.url && norm(o.url) === norm(url));
  if (twin) {
    return { changed: false, note: `kept post: tool already has its own card (#${twin.id})` };
  }

  const next: any = { ...item };
  next.savedFrom = item.url;
  next.url = url;
  next.host = hostLabel(url);
  if (raw.title) next.title = String(raw.title).trim();
  if (raw.summary) next.summary = String(raw.summary).trim();
  if (TYPES.includes(raw.type)) next.type = raw.type;
  if (raw.os === true || raw.os === false || raw.os === "unknown") next.os = raw.os;
  const docs = cleanUrl(String(raw.docs || ""));
  if (/^https?:\/\//.test(docs) && norm(docs) !== norm(url)) next.docs = docs;
  const install = (Array.isArray(raw.install) ? raw.install : []).map((x: any) => String(x).trim()).filter(Boolean);
  if (install.length && !(item.install && item.install.length)) next.install = install;
  if (next.mentioned && norm(next.mentioned) === norm(url)) next.mentioned = "";

  // GitHub repos get real star counts, like every other repo card.
  if (/github\.com\//i.test(url)) {
    const gh = (await gatherUrl(url)).github;
    if (gh) {
      next.why = [...(item.why || []).filter((w: string) => !/GitHub stars and/.test(w)), `${fmt(gh.stars)} GitHub stars and ${fmt(gh.forks)} forks when checked on ${today}${gh.license ? ` — ${gh.license} licence` : ""}`];
      if (gh.license) next.os = true;
      next.type = "open-source-repo";
    }
  }
  await ctx.runMutation(internal.items.replaceData, { id, data: next });
  return { changed: true, note: String(raw.note || "identified").slice(0, 160) };
}
