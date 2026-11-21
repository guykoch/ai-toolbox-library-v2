// stub:server
var id = (d) => d;
var action = id;

// stub:api
var mk = (m) => new Proxy({}, { get: (_, f) => m + ":" + String(f) });
var internal = { items: mk("items"), ingest: mk("ingest"), install: mk("install"), advisor: mk("advisor"), pipeline: mk("pipeline"), enrich: mk("enrich"), credit: mk("credit"), hype: mk("hype"), alts: mk("alts"), promptFinder: mk("promptFinder"), promptLibs: mk("promptLibs"), promptImport: mk("promptImport"), promptAdd: mk("promptAdd"), snapshot: mk("snapshot"), siteCheck: mk("siteCheck"), webjobs: mk("webjobs"), webcopy: mk("webcopy"), promptGen: mk("promptGen"), tabs: mk("tabs"), tabImport: mk("tabImport"), tabAdd: mk("tabAdd"), playbooks: mk("playbooks"), playbookAi: mk("playbookAi"), addAny: mk("addAny") };

// convex/ingest.ts
import { v, ConvexError as ConvexError3 } from "convex/values";

// convex/auth.ts
import { ConvexError } from "convex/values";
function checkKey(key) {
  const expected = process.env.ADMIN_KEY;
  if (!expected) {
    throw new ConvexError("ADMIN_KEY is not set in the Convex dashboard (Settings \u2192 Environment Variables).");
  }
  if (key !== expected) {
    throw new ConvexError("Wrong access key.");
  }
}

// convex/kinds.ts
var KINDS = ["skill", "connector", "plugin", "webapp", "app", "devtool", "model", "learn", "news"];
function guessKind(it) {
  if (KINDS.includes(it?.kind)) return it.kind;
  const t = `${it?.title || ""} ${it?.summary || ""}`.toLowerCase();
  const url = String(it?.url || "").toLowerCase();
  const type = String(it?.type || "");
  if (type === "news") return "news";
  if (["guide", "course", "video", "post"].includes(type) || /youtube\.com|youtu\.be/.test(url)) return "learn";
  const gh = /github\.com/.test(url) || type === "open-source-repo";
  if (/\bskills?\b|skill\.md/.test(t)) return "skill";
  if (/desktop app|mac app|menu bar|iphone|android|ios app|app store|windows, macos|for windows|desktop meeting|video editor|image editor|on-device/.test(t)) return "app";
  if (/\bmcp server\b|\bconnector\b/.test(t) && !/\bcli\b/.test(t)) return "connector";
  if (/extension|plugin|add-on/.test(t) || /chromewebstore|marketplace\.visualstudio/.test(url)) return "plugin";
  if (/open-weight|open weights|text-to-speech model|image model|diarization model/.test(t) || /huggingface\.co/.test(url)) return "model";
  if (gh || /\bcli\b|library|sdk|self-hosted|framework|api\b|apis\b/.test(t)) return "devtool";
  if (/\bnews\b|report|benchmark/.test(t)) return "news";
  return "webapp";
}

// convex/web.ts
var TRACKING = /^(utm_\w+|fbclid|gclid|mibextid|rdid|share_url|si|igsh|igshid|ref|ref_src|ref_url|s|t_?id|__cft__\[0\]|__tn__|_rdr|feature)$/i;
function cleanUrl(raw) {
  try {
    const u = new URL(raw.trim());
    const keys = [];
    u.searchParams.forEach((_val, k) => keys.push(k));
    for (const k of keys) {
      if (TRACKING.test(k) || k.startsWith("utm_") || k.startsWith("__cft__")) u.searchParams.delete(k);
    }
    u.hash = "";
    let s = u.toString();
    if (s.endsWith("?")) s = s.slice(0, -1);
    return s.replace("://www.facebook.com/", "://facebook.com/").replace("://m.facebook.com/", "://facebook.com/");
  } catch {
    return raw.trim();
  }
}
function norm(u) {
  const gh = String(u || "").match(/github\.com\/([\w.-]+)\/([\w.-]+)/i);
  if (gh && !["orgs", "topics", "search", "marketplace", "features", "apps", "settings"].includes(gh[1].toLowerCase())) {
    return ("github.com/" + gh[1] + "/" + gh[2].replace(/\.git$/, "")).toLowerCase();
  }
  return cleanUrl(u).replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "").toLowerCase();
}
function hostLabel(u) {
  try {
    const h = new URL(u).hostname.replace(/^www\./, "").replace(/^m\./, "");
    if (/(^|\.)facebook\.com$|(^|\.)fb\.watch$/.test(h)) return "Facebook";
    if (/(^|\.)youtube\.com$|^youtu\.be$/.test(h)) return "YouTube";
    if (h === "github.com") return "GitHub";
    return h;
  } catch {
    return "";
  }
}
async function fetchWithTimeout(url, init = {}, ms = 12e3) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}
function decodeEntities(s) {
  return s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}
function metaTag(html, name) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
  return content ? decodeEntities(content).trim() : "";
}
async function gatherUrl(raw) {
  const out = { input: raw, finalUrl: cleanUrl(raw), notes: "" };
  try {
    const gh = raw.match(/github\.com\/([\w.-]+)\/([\w.-]+)/i);
    if (gh && !["orgs", "topics", "search", "marketplace", "features"].includes(gh[1].toLowerCase())) {
      const repo = `${gh[1]}/${gh[2].replace(/\.git$/, "")}`;
      const headers = { "User-Agent": "ai-toolbox-library", Accept: "application/vnd.github+json" };
      if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
      const r2 = await fetchWithTimeout(`https://api.github.com/repos/${repo}`, { headers });
      if (r2.ok) {
        const j = await r2.json();
        out.github = { stars: j.stargazers_count, forks: j.forks_count, license: j.license?.spdx_id && j.license.spdx_id !== "NOASSERTION" ? j.license.spdx_id : "" };
        out.notes += `GitHub repo ${j.full_name}: "${j.description ?? ""}". Stars ${j.stargazers_count}, forks ${j.forks_count}, licence ${out.github.license || "none stated"}, homepage ${j.homepage || "none"}, language ${j.language || "?"}, topics ${(j.topics || []).join(", ")}.
`;
        const rm = await fetchWithTimeout(`https://api.github.com/repos/${repo}/readme`, { headers: { ...headers, Accept: "application/vnd.github.raw" } });
        if (rm.ok) out.notes += "README (start):\n" + (await rm.text()).slice(0, 5e3) + "\n";
        return out;
      }
    }
    const isFb = /facebook\.com|fb\.watch/i.test(raw);
    const r = await fetchWithTimeout(raw, {
      headers: {
        "User-Agent": isFb ? "facebookexternalhit/1.1" : "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9,he;q=0.8"
      }
    });
    out.finalUrl = cleanUrl(r.url || raw);
    const html = (await r.text()).slice(0, 6e5);
    const title = metaTag(html, "og:title") || decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();
    const desc = metaTag(html, "og:description") || metaTag(html, "description");
    const body = decodeEntities(
      html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")
    ).replace(/\s+/g, " ").trim().slice(0, 4e3);
    out.notes += `Fetched ${out.finalUrl} (HTTP ${r.status}).
Title: ${title}
Description: ${desc}
Page text (start): ${body}
`;
  } catch (e) {
    out.notes += `Could not fetch this link (${e?.message ?? e}).
`;
  }
  return out;
}

// convex/llm.ts
import { ConvexError as ConvexError2 } from "convex/values";
var MODELS = {
  // Researches how to install a tool and writes the install prompt (uses Google Search).
  install: () => process.env.GEMINI_MODEL_INSTALL || "gemini-3.8-flash",
  // Answers "What would you like to do?" from your library.
  advisor: () => process.env.GEMINI_MODEL_ADVISOR || "gemini-3.8-flash",
  // Re-scores hype for "Update hype scores" (uses Google Search).
  hype: () => process.env.GEMINI_MODEL_HYPE || "gemini-3.8-flash",
  // Writes new cards from what you paste (Claude if ANTHROPIC_API_KEY is set, otherwise Gemini).
  addClaude: () => process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
  addGemini: () => process.env.GEMINI_MODEL_ADD || "gemini-3.8-flash"
};
async function callGemini(opts) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new ConvexError2("GEMINI_API_KEY is not set in the Convex dashboard (Settings \u2192 Environment Variables).");
  const generationConfig = { maxOutputTokens: opts.maxTokens ?? 8192 };
  if (opts.json) generationConfig.responseMimeType = "application/json";
  if (opts.thinking) generationConfig.thinkingConfig = { thinkingLevel: opts.thinking };
  const body = {
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: opts.turns.map((t) => ({ role: t.role, parts: [...(t.images || []).map((im) => ({ inline_data: { mime_type: im.mime, data: im.data } })), { text: t.text }] })),
    generationConfig
  };
  if (opts.search) body.tools = [{ google_search: {} }];
  const send = async (b) => {
    const r = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.model)}:generateContent`,
      { method: "POST", headers: { "x-goog-api-key": key, "content-type": "application/json" }, body: JSON.stringify(b) },
      24e4
    );
    const j2 = await r.json().catch(() => ({}));
    return { ok: r.ok, j: j2 };
  };
  let { ok, j } = await send(body);
  if (!ok && /thinking|responseMimeType|google_search|tool/i.test(JSON.stringify(j?.error ?? ""))) {
    const plain = { ...body, generationConfig: { maxOutputTokens: generationConfig.maxOutputTokens } };
    if (opts.json && !opts.search) plain.generationConfig.responseMimeType = "application/json";
    ({ ok, j } = await send(plain));
  }
  if (!ok) throw new ConvexError2("Gemini API error: " + (j?.error?.message || "unknown error"));
  const cand = j?.candidates?.[0];
  const text = (cand?.content?.parts || []).filter((p) => typeof p.text === "string" && !p.thought).map((p) => p.text).join("").trim();
  if (!text) throw new ConvexError2("Gemini returned an empty answer" + (cand?.finishReason ? ` (${cand.finishReason})` : "") + ". Try again.");
  const seen = /* @__PURE__ */ new Set();
  const sources = [];
  for (const c of cand?.groundingMetadata?.groundingChunks || []) {
    const url = c?.web?.uri;
    const title = c?.web?.title || "";
    if (url && !seen.has(title + url)) {
      seen.add(title + url);
      sources.push({ title, url });
    }
  }
  return { text, sources };
}
async function callClaude(system, user, withSearch, images = []) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new ConvexError2("ANTHROPIC_API_KEY is not set in the Convex dashboard (Settings \u2192 Environment Variables).");
  const body = {
    model: MODELS.addClaude(),
    max_tokens: 2e3,
    system,
    messages: [{ role: "user", content: [...images.map((im) => ({ type: "image", source: { type: "base64", media_type: im.mime, data: im.data } })), { type: "text", text: user }] }]
  };
  if (withSearch) body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }];
  const r = await fetchWithTimeout(
    "https://api.anthropic.com/v1/messages",
    { method: "POST", headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify(body) },
    18e4
  );
  const j = await r.json();
  if (!r.ok) {
    const msg = j?.error?.message || JSON.stringify(j).slice(0, 300);
    if (withSearch && /tool|web_search/i.test(msg)) return callClaude(system, user, false, images);
    throw new ConvexError2("Claude API error: " + msg);
  }
  return (j.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n");
}
function parseJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const src = fenced ? fenced[1] : text;
  const start = src.indexOf("{");
  const end = src.lastIndexOf("}");
  if (start < 0 || end < start) throw new ConvexError2("Couldn't read the AI's answer. Please try again.");
  try {
    return JSON.parse(src.slice(start, end + 1));
  } catch {
    throw new ConvexError2("Couldn't read the AI's answer. Please try again.");
  }
}

// convex/ingest.ts
var CATS = ["coding-agents", "agent-skills", "courses-guides", "productivity", "app-building", "video", "image", "audio", "ai-models", "news-analysis", "translation", "other"];
var TYPES = ["guide", "tool", "video", "course", "post", "news", "open-source-repo", "other"];
var LANGS = ["he", "en", "unknown"];
var MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function dateParts(isoToday) {
  const [y, m, d] = isoToday.split("-").map(Number);
  return { iso: isoToday, date: `${d} ${MONTHS[m - 1]} ${y}`, month: m };
}
var MAX_SHOTS = 20;
var FORMAT_SPEC = `You file links into a personal "AI Toolbox Library" library. Return the card as a JSON object, nothing else (or {"cards": [...]} when there are several different tools \u2014 see below).

Fields (match the examples exactly in style and length):
- "title": the tool/post's real name. For GitHub repos use "owner/repo: <repo description>". For a social post about a tool, a short name for what it is (e.g. "TranslateGemma", "Five Claude Code tips"). Keep the original language of the title if the page title is Hebrew.
- "summary": ONE sentence, 14-22 words, in fresh English words (never copy the source), saying what it is and what it does.
- "cat": main shelf, one of: ${CATS.join(", ")}.
- "extra": array of other shelves it also clearly belongs to (usually []).
- "type": one of: ${TYPES.join(", ")}.
- "kind": what kind of thing it is / how you'd use it, one of: skill (SKILL.md instruction folders for Claude & other agents), connector (MCP server / connector that links an AI to another service), plugin (browser/IDE/app extension or plugin), webapp (website or SaaS you sign up for), app (desktop or phone app you download), devtool (CLI, library, self-hosted repo you run yourself), model (AI model you call or run), learn (guide, course, video, prompt tips, post to learn from), news (announcement, roundup, report).
- "alternativeTo": array of up to 3 famous, widely known products on the market that this tool can replace or is an open/cheaper alternative to (e.g. ["Higgsfield","Runway","Krea"]). Most famous first. Use [] for guides, courses, news and announcements.
- "os": true if it is open source (public code repo / open licence), false if clearly not, "unknown" if you can't tell.
- "lang": language of the post/page the link opens: "he", "en" or "unknown".
- "author": the person who wrote/shared the social post (Facebook/LinkedIn/X) or "" for websites, repos and YouTube.
- "title"/"summary" describe the TOOL itself when "url" is the tool's page.
- "url": the TOOL's own page (official site, GitHub repo, store page, course page) \u2014 not the social post. If the user pasted a Facebook/LinkedIn/X post about a specific tool, find that tool's official page with search and use it. Only if the post itself is the content (tips, opinion, news, a prompt in the post) or the tool can't be identified confidently, use the post link. For a bare tool name, the official site or repo. Never guess URLs.
- "mentioned": a second important link referenced inside a post (e.g. the GitHub repo a Facebook post points to), else "".
- "docs": official docs link if clearly separate and useful, else "".
- "install": array of exact install commands if the source gives them (e.g. "npx skills add owner/repo"), else [].
- "pop": hype score 1-100 (90+ huge buzz, 70-89 widely talked about, 55-69 solid following, 40-54 niche but known, 25-39 small/local, under 25 very niche). Weigh: official source (Anthropic, Google, OpenAI, Microsoft, Vercel...), open-source repo stars, scale named in the post, how established the product is.
- "why": 1-4 short reasons for the score, in the same phrasing style as the examples, e.g. "About Claude \u2014 one of the most-talked-about AI platforms of 2026", "Official Google source \u2014 first-party, not a third-party tip", "It's a code repo, so GitHub stars and forks drive its buzz", "Open source \u2014 anyone can inspect, fork and reuse it", "Scale named in the post: 316 skills", "Lovable is an established, widely used name in this space", "Little wider buzz found \u2014 mostly a niche or local find". Do NOT include star counts; they are added automatically.
- "priv": true only if the user's text says the content is private / not to be shared, else false.

Screenshots may be attached: read them (they are usually the post itself \u2014 text, images, links shown in it).
ONE OR SEVERAL TOOLS: if the screenshots/text cover two or more DIFFERENT tools (e.g. two screenshots of two different posts), return {"cards": [card1, card2, ...]} with one card per distinct tool. Several screenshots of the SAME tool/post = one card. A single tool can be returned as a plain card object.
If there is NOT enough information to tell what this is (e.g. only a social-media link that couldn't be read, no text, no screenshot, and search can't find it), return exactly {"unreadable": true} instead of guessing.

If the input is only a name or description, use web search to identify the real tool and its official link. Never invent facts; if unsure, say less.`;
function pickExamples(all) {
  const pick = (f) => all.find(f);
  return [
    pick((i) => i.host === "Facebook" && i.os === true && i.mentioned),
    pick((i) => i.host === "GitHub" && i.type === "open-source-repo" && !i.again),
    pick((i) => i.host === "YouTube"),
    pick((i) => i.host !== "Facebook" && i.host !== "GitHub" && i.host !== "YouTube" && i.type === "tool")
  ].filter(Boolean).map((i) => {
    const { id: id2, again, date, iso, month, host, ...rest } = i;
    return rest;
  });
}
function fmt(n) {
  return n.toLocaleString("en-US");
}
var addFromText = action({
  args: {
    key: v.string(),
    text: v.string(),
    today: v.string(),
    images: v.optional(v.array(v.object({ mime: v.string(), data: v.string() })))
  },
  handler: async (ctx, { key, text, today, images }) => {
    checkKey(key);
    const input = text.trim();
    const pics = (images || []).filter((im) => /^image\/(png|jpeg|webp|gif)$/.test(im.mime)).slice(0, MAX_SHOTS);
    if (!input && !pics.length) throw new ConvexError3("Paste a link, a tool name, some context or a screenshot first.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) throw new ConvexError3("Bad date.");
    const day = dateParts(today);
    const urls = Array.from(new Set((input.match(/https?:\/\/[^\s<>"')\]]+/g) || []).map((u) => u.replace(/[.,;]+$/, "")))).slice(0, 5);
    const rows = await ctx.runQuery(internal.items.allForIngest, {});
    const findDup = (u) => rows.find((r) => r.data.url && norm(r.data.url) === norm(u)) || rows.find((r) => [r.data.mentioned, r.data.docs, r.data.savedFrom].filter(Boolean).some((x) => norm(x) === norm(u)));
    const again = async (dup) => {
      const res = await ctx.runMutation(internal.items.markSavedAgain, { id: dup.data.id, date: day.date });
      return { status: "again", item: res.item, wasArchived: res.wasArchived };
    };
    const reply = (results2) => ({ ...results2[0], results: results2 });
    const single = urls.length === 1 && !pics.length;
    if (single && findDup(urls[0])) return reply([await again(findDup(urls[0]))]);
    const fetched = await Promise.all(urls.map(gatherUrl));
    if (single && findDup(fetched[0].finalUrl)) return reply([await again(findDup(fetched[0].finalUrl))]);
    const examples = pickExamples(rows.map((r) => r.data));
    const userMsg = `Today is ${day.date}.

EXAMPLE CARDS FROM THE LIBRARY (copy their style):
${JSON.stringify(examples, null, 1)}

WHAT THE USER PASTED:
"""
${input.slice(0, 9e3) || "(nothing typed \u2014 see the attached screenshots)"}
"""

` + (pics.length ? `${pics.length} SCREENSHOT(S) ATTACHED \u2014 read every one of them.

` : "") + (fetched.length ? `WHAT I FOUND AT THE LINKS:
${fetched.map((f) => f.notes).join("\n---\n")}

` : "") + `Return only the JSON.`;
    const answer = process.env.ANTHROPIC_API_KEY ? await callClaude(FORMAT_SPEC, userMsg, true, pics) : (await callGemini({ model: MODELS.addGemini(), system: FORMAT_SPEC, turns: [{ role: "user", text: userMsg, images: pics }], search: true, thinking: "medium", maxTokens: 8192 })).text;
    const parsed = parseJson(answer);
    if (parsed.unreadable === true) {
      throw new ConvexError3("I couldn't read that post \u2014 Facebook hides posts from servers. Paste the post's text or a screenshot here along with the link.");
    }
    const raws = (Array.isArray(parsed.cards) ? parsed.cards : [parsed]).filter((c) => c && typeof c === "object" && c.unreadable !== true).slice(0, 10);
    if (!raws.length) throw new ConvexError3("I couldn't work out which tool this is. Add the tool's name, its website, or a bit more detail.");
    const str = (x) => typeof x === "string" ? x.trim() : "";
    const social = urls.find((u) => /facebook\.com|fb\.watch|linkedin\.com|(^|\/\/)(www\.)?(x|twitter)\.com/i.test(u));
    const results = [];
    const seenNow = /* @__PURE__ */ new Set();
    for (const raw of raws) {
      const url = cleanUrl(str(raw.url) || (raws.length === 1 ? fetched[0]?.finalUrl || urls[0] || "" : ""));
      if (!/^https?:\/\//.test(url)) {
        results.push({ status: "failed", item: { title: str(raw.title) || "Unknown tool" }, reason: "no link found" });
        continue;
      }
      if (seenNow.has(norm(url))) continue;
      seenNow.add(norm(url));
      const innerLink = str(raw.mentioned);
      const dup = findDup(url) || (/github\.com\//i.test(innerLink) ? rows.find((r) => r.data.url && norm(r.data.url) === norm(innerLink)) : void 0);
      if (dup) {
        results.push(await again(dup));
        continue;
      }
      const cat = CATS.includes(raw.cat) ? raw.cat : "other";
      const gh = fetched.find((f) => f.github && norm(f.finalUrl) === norm(url))?.github || (raws.length === 1 ? fetched.find((f) => f.github)?.github : void 0);
      const why = (Array.isArray(raw.why) ? raw.why : []).map(str).filter(Boolean).slice(0, 4);
      if (gh) why.push(`${fmt(gh.stars)} GitHub stars and ${fmt(gh.forks)} forks when checked on ${day.date}${gh.license ? ` \u2014 ${gh.license} licence` : ""}`);
      if (!why.length) why.push("Little wider buzz found \u2014 mostly a niche or local find");
      let os = raw.os === true ? true : raw.os === false ? false : "unknown";
      if (gh && gh.license) os = true;
      const item = {
        again: "",
        date: day.date,
        iso: day.iso,
        month: day.month,
        title: str(raw.title) || hostLabel(url),
        summary: str(raw.summary),
        cat,
        type: TYPES.includes(raw.type) ? raw.type : gh ? "open-source-repo" : "other",
        kind: KINDS.includes(raw.kind) ? raw.kind : "",
        alternativeTo: Array.isArray(raw.alternativeTo) ? raw.alternativeTo.map((x) => str(x)).filter(Boolean).slice(0, 3) : [],
        os,
        lang: LANGS.includes(raw.lang) ? raw.lang : "unknown",
        author: str(raw.author),
        url,
        host: hostLabel(url),
        mentioned: innerLink && norm(innerLink) !== norm(url) ? cleanUrl(innerLink) : "",
        priv: raw.priv === true,
        extra: (Array.isArray(raw.extra) ? raw.extra : []).filter((c) => CATS.includes(c) && c !== cat),
        pop: Math.max(1, Math.min(100, Math.round(Number(raw.pop) || 40))),
        why
      };
      if (!item.kind) item.kind = guessKind(item);
      if (social && norm(social) !== norm(url) && !/facebook\.com|fb\.watch|linkedin\.com/i.test(url)) item.savedFrom = cleanUrl(social);
      const docs = str(raw.docs);
      if (docs && /^https?:\/\//.test(docs) && norm(docs) !== norm(url)) item.docs = cleanUrl(docs);
      const install = (Array.isArray(raw.install) ? raw.install : []).map(str).filter(Boolean);
      if (install.length) item.install = install;
      const saved = await ctx.runMutation(internal.items.insertItem, { data: item });
      rows.push({ status: "active", data: saved });
      await ctx.scheduler.runAfter(0, internal.pipeline.promptForNew, { id: saved.id, today: day.date });
      results.push({ status: "added", item: saved });
    }
    if (!results.some((r) => r.status !== "failed")) {
      throw new ConvexError3("Couldn't find a link for this. Paste the link itself, or add more detail.");
    }
    return reply(results);
  }
});
export {
  addFromText
};
