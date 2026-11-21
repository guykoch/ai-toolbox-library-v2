// stub:server
var id = (d) => d;
var action = id;
var internalAction = id;

// convex/promptAdd.ts
import { v, ConvexError as ConvexError3 } from "convex/values";

// stub:api
var mk = (m) => new Proxy({}, { get: (_, f) => m + ":" + String(f) });
var internal = { items: mk("items"), ingest: mk("ingest"), install: mk("install"), advisor: mk("advisor"), pipeline: mk("pipeline"), enrich: mk("enrich"), credit: mk("credit"), hype: mk("hype"), alts: mk("alts"), promptFinder: mk("promptFinder"), promptLibs: mk("promptLibs"), promptImport: mk("promptImport"), promptAdd: mk("promptAdd"), snapshot: mk("snapshot"), siteCheck: mk("siteCheck"), webjobs: mk("webjobs"), webcopy: mk("webcopy"), promptGen: mk("promptGen"), tabs: mk("tabs"), tabImport: mk("tabImport"), tabAdd: mk("tabAdd"), playbooks: mk("playbooks"), playbookAi: mk("playbookAi"), addAny: mk("addAny") };

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

// convex/promptRows.ts
function parseRepoUrl(url) {
  const m = String(url || "").match(/github\.com\/([\w.-]+)\/([\w.-]+)(?:\/(?:tree|blob)\/([^/]+)\/?(.*))?/i);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/, ""), branch: m[3] || "", sub: (m[4] || "").replace(/\/+$/, "") };
}

// convex/promptAdd.ts
function isOpenLicense(id2) {
  return /^(MIT|Apache|CC0|CC-BY|BSD|GPL|AGPL|LGPL|MPL|Unlicense|ISC|0BSD|WTFPL|Zlib)/i.test(String(id2 || "").trim());
}
var NEVER_COPY = /github\.com\/x1xhlol\/system-prompts-and-models-of-ai-tools/i;
var SECTIONS = ["general", "business", "coding", "design", "images", "patterns"];
var KINDS = ["official", "open", "community", "academic", "free"];
var SPEC = `You add one prompt library to the user's list. Reply with JSON only:
{"title": "name of the library", "summary": "one plain-English sentence: what prompts it has and who it's for (max 160 chars)",
 "bestFor": "one concise line (max 130 chars) giving the intuition of when to reach for this library and what it includes, e.g. "Making decks look designed: 120+ slide styles with colors, fonts and a ready prompt."",
 "sec": one of "general" (all-purpose collections), "business" (business & productivity), "coding" (coding assistants), "design" (slides, websites, app UI, DESIGN.md), "images" (image prompts: logos, products, posters), "patterns" (thinking patterns: stress-testing, extraction, interviews, grading, style, meta-prompts),
 "kind": one of "official" (by an AI company), "open" (open-source repo), "community", "academic", "free" (free website/tool),
 "license": "e.g. MIT, CC0, Apache-2.0, Free", "format": "e.g. Website, GitHub, Website + GitHub, Visual gallery",
 "how": "one sentence: how to browse it and see examples",
 "links": [["short label", "https://..."]] (the main link first; include the GitHub repo if there is one),
 "repo": "https://github.com/owner/repo of the open-source repo that holds the prompts, or empty",
 "openSource": true only if the prompts themselves are published under an open license in that repo}
If it isn't a prompt library at all, reply {"notALibrary": true, "why": "..."}. Never invent links: use only links you were given or found.`;
var add = action({
  args: { key: v.string(), text: v.string() },
  handler: async (ctx, { key, text }) => {
    checkKey(key);
    const input = text.trim();
    if (!input) throw new ConvexError3("Paste a link to a prompt library (a GitHub repo or a website) first.");
    const urls = Array.from(new Set((input.match(/https?:\/\/[^\s<>"')\]]+/g) || []).map((u) => u.replace(/[.,;]+$/, "")))).slice(0, 4);
    const libs = await ctx.runQuery(internal.promptLibs.libNames, {});
    const findDup = (u) => libs.find((l) => l.sec !== "patterns" && [l.repo, l.links[0] && l.links[0][1]].filter(Boolean).some((x) => norm(x) === norm(u)));
    for (const u of urls) {
      const d = findDup(u);
      if (d) return { status: "exists", libId: d.libId, title: d.title, importing: false };
    }
    const fetched = await Promise.all(urls.map(gatherUrl));
    const res = await callGemini({
      model: MODELS.addGemini(),
      system: SPEC,
      turns: [{ role: "user", text: `WHAT THE USER PASTED:
"""
${input.slice(0, 6e3)}
"""

` + (fetched.length ? `WHAT I FOUND AT THE LINKS:
${fetched.map((f) => f.notes).join("\n---\n")}

` : "") + "Return only the JSON." }],
      search: true,
      thinking: "medium",
      maxTokens: 4096
    });
    const c = parseJson(res.text) || {};
    if (c.notALibrary) throw new ConvexError3("That doesn't look like a prompt library" + (c.why ? ": " + String(c.why) : ".") + " To save a tool, use the Tools tab.");
    const str = (x) => typeof x === "string" ? x.trim() : "";
    let links = Array.isArray(c.links) ? c.links.filter((l) => Array.isArray(l) && /^https?:\/\//.test(String(l[1]))).map((l) => [str(l[0]) || "Link", str(l[1])]).slice(0, 4) : [];
    if (!links.length && urls.length) links = [["Link", urls[0]]];
    if (!links.length) throw new ConvexError3("I couldn't find a link for that library. Paste its website or GitHub link.");
    const ghFromInput = urls.find((u) => parseRepoUrl(u));
    const repo = str(c.repo) && parseRepoUrl(str(c.repo)) ? str(c.repo) : ghFromInput || "";
    if (repo && !links.some((l) => norm(l[1]) === norm(repo))) links.push(["GitHub", repo]);
    for (const u of [links[0][1], repo].filter(Boolean)) {
      const d = findDup(u);
      if (d) return { status: "exists", libId: d.libId, title: d.title, importing: false };
    }
    const ghInfo = repo ? fetched.find((f) => norm(f.finalUrl) === norm(repo) || norm(f.input) === norm(repo))?.github : void 0;
    const ghLicense = ghInfo ? ghInfo.license : "";
    let openSource = repo ? ghInfo ? isOpenLicense(ghLicense) : c.openSource === true || isOpenLicense(str(c.license)) : false;
    if (repo && NEVER_COPY.test(repo)) openSource = false;
    if (ghInfo && !ghLicense) c.license = "No license on GitHub";
    else if (ghLicense) c.license = ghLicense;
    const data = {
      title: str(c.title) || links[0][0],
      summary: str(c.summary),
      bestFor: str(c.bestFor).slice(0, 200),
      sec: SECTIONS.includes(c.sec) ? c.sec : "general",
      kind: repo && openSource && c.kind !== "official" ? "open" : KINDS.includes(c.kind) && c.kind !== "open" ? c.kind : repo && openSource ? "open" : "community",
      license: str(c.license) || (openSource ? "Open source" : "Not stated"),
      format: str(c.format) || (repo ? "GitHub" : "Website"),
      how: str(c.how),
      links,
      ...repo && openSource ? { repo } : {},
      added: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10)
    };
    const importing = !!(repo && openSource);
    const libId = await ctx.runMutation(internal.promptLibs.insertLib, { data, importing });
    if (!importing) await ctx.scheduler.runAfter(0, internal.siteCheck.run, { libIds: [libId] });
    if (!importing) await ctx.runMutation(internal.webjobs.enqueueLibs, { libIds: [libId] });
    const why = importing ? "" : repo && NEVER_COPY.test(repo) ? "excluded" : repo ? "nolicense" : "website";
    return { status: "added", libId, title: data.title, importing, why };
  }
});
var bestForMissing = internalAction({
  args: {},
  handler: async (ctx) => {
    const libs = await ctx.runQuery(internal.promptLibs.missingBestFor, {});
    if (!libs.length) return;
    try {
      const res = await callGemini({
        model: MODELS.advisor(),
        system: 'For each prompt library, write "bestFor": one concise line (max 130 chars) giving the intuition of when to reach for it and what it includes. Example: "Making decks look designed: 120+ slide styles with colors, fonts and a ready prompt." Reply JSON only: {"<libId>": "..."}',
        turns: [{ role: "user", text: libs.map((l) => `${l.libId} | ${l.title} | ${l.summary} | ${l.links.map((x) => x[1]).join(" ")}`).join("\n") }],
        json: true,
        thinking: "low",
        maxTokens: 2048
      });
      const out = parseJson(res.text) || {};
      for (const l of libs) if (typeof out[l.libId] === "string") await ctx.runMutation(internal.promptLibs.setBestFor, { libId: l.libId, bestFor: out[l.libId].trim().slice(0, 200) });
    } catch (e) {
      console.log("bestFor fill failed", String(e));
    }
  }
});
var recheck = action({
  args: { key: v.string(), libId: v.string() },
  handler: async (ctx, { key, libId }) => {
    checkKey(key);
    const libs = await ctx.runQuery(internal.promptLibs.libNames, {});
    const lib = libs.find((l) => l.libId === libId);
    const gh = lib && lib.links.map((x) => x[1]).find((u) => parseRepoUrl(u));
    if (!lib || !gh) throw new ConvexError3("This library has no GitHub repo.");
    if (NEVER_COPY.test(gh)) return { open: false, license: "Not copied: this repo collects other companies' prompts" };
    const f = await gatherUrl(gh);
    const license = f.github?.license || "";
    if (!isOpenLicense(license)) return { open: false, license: license || "No license on GitHub" };
    const r = parseRepoUrl(gh);
    await ctx.runMutation(internal.promptLibs.setRepo, { libId, repo: `https://github.com/${r.owner}/${r.repo}`, license });
    return { open: true, license };
  }
});
export {
  add,
  bestForMissing,
  isOpenLicense,
  recheck
};
