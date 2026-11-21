// stub:server
var id = (d) => d;
var action = id;
var internalQuery = id;
var internalMutation = id;

// convex/promptFinder.ts
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

// convex/llm.ts
import { ConvexError as ConvexError2 } from "convex/values";

// convex/web.ts
async function fetchWithTimeout(url, init = {}, ms = 12e3) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}
function hostOf(u) {
  try {
    return new URL(u).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}
function pageText(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ").replace(/<(br|p|div|li|h\d|pre|tr|section|article)[^>]*>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&rsquo;|&lsquo;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&ldquo;|&rdquo;/g, '"').replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

// convex/llm.ts
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

// stub:api
var mk = (m) => new Proxy({}, { get: (_, f) => m + ":" + String(f) });
var internal = { items: mk("items"), ingest: mk("ingest"), install: mk("install"), advisor: mk("advisor"), pipeline: mk("pipeline"), enrich: mk("enrich"), credit: mk("credit"), hype: mk("hype"), alts: mk("alts"), promptFinder: mk("promptFinder"), promptLibs: mk("promptLibs"), promptImport: mk("promptImport"), promptAdd: mk("promptAdd"), snapshot: mk("snapshot"), siteCheck: mk("siteCheck"), webjobs: mk("webjobs"), webcopy: mk("webcopy"), promptGen: mk("promptGen"), tabs: mk("tabs"), tabImport: mk("tabImport"), tabAdd: mk("tabAdd"), playbooks: mk("playbooks"), playbookAi: mk("playbookAi"), addAny: mk("addAny") };

// convex/promptFinder.ts
var STOP = new Set("a an the and or for to of in on with my me i you your want need prompt prompts that this is be it as by from about how what which can please some any like".split(" "));
function words(s) {
  return s.toLowerCase().split(/[^a-z0-9À-ɏ]+/).filter((w) => w.length > 1 && !STOP.has(w));
}
function shortlist(catalog, keywords, n) {
  const kws = [...new Set(keywords.flatMap(words))].slice(0, 40);
  if (!kws.length) return [];
  const rows = catalog.map((r) => ({ r, title: r.title.toLowerCase(), desc: r.desc.toLowerCase() }));
  const df = /* @__PURE__ */ new Map();
  for (const k of kws) df.set(k, rows.filter((x) => x.title.includes(k) || x.desc.includes(k)).length);
  const N = rows.length;
  const scored = rows.map((x) => {
    let s = 0;
    for (const k of kws) {
      const d = df.get(k) || 0;
      if (!d) continue;
      const idf = Math.log(1 + N / d);
      if (x.title.includes(k)) s += 3 * idf;
      else if (x.desc.includes(k)) s += idf;
    }
    return { r: x.r, s };
  });
  return scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, n).map((x) => x.r);
}
var find = action({
  args: { key: v.string(), query: v.string() },
  handler: async (ctx, { key, query }) => {
    checkKey(key);
    const q = query.trim().slice(0, 500);
    if (!q) throw new ConvexError3("Type what kind of prompt you're looking for first.");
    let keywords = [q];
    try {
      const r1 = await callGemini({
        model: MODELS.advisor(),
        system: 'Someone is looking for a ready-made AI prompt. Turn their request into 8-15 short English search keywords and synonyms that would appear in the title or description of a matching prompt (e.g. "slide deck" -> slides, presentation, deck, pitch, keynote). Translate if needed. Reply JSON only: {"keywords": ["..."]}',
        turns: [{ role: "user", text: q }],
        json: true,
        thinking: "low",
        maxTokens: 1024
      });
      const k = parseJson(r1.text)?.keywords;
      if (Array.isArray(k)) keywords = [q, ...k.map(String)];
    } catch (e) {
    }
    const catalog = [];
    let cursor = null;
    for (; ; ) {
      const page = await ctx.runQuery(internal.promptLibs.indexPage, { cursor });
      catalog.push(...page.rows);
      if (page.done) break;
      cursor = page.cursor;
    }
    const libs = await ctx.runQuery(internal.promptLibs.libNames, {});
    const names = new Map(libs.map((l) => [l.libId, l.title]));
    const sites = libs.filter((l) => !l.imported);
    const siteList = sites.map((l) => `${l.libId} | ${l.title} | ${l.summary.slice(0, 140)}`).join("\n");
    const cands = shortlist(catalog.filter((r) => names.has(r.libId)), keywords, 60);
    const byId = new Map(cands.map((r) => [r.pid, r]));
    const list = cands.map((r) => `${r.pid} | ${names.get(r.libId)} | ${r.title} | ${r.desc}`).join("\n");
    const r2 = await callGemini({
      model: MODELS.advisor(),
      system: 'You help someone find a ready-made prompt. You get their REQUEST, CANDIDATES (prompts copied from open-source libraries: id | library | title | description) and OTHER LIBRARIES (prompt libraries in their list whose prompts are NOT searchable here, mostly websites: libId | name | what it has). matches: up to 5 candidates that genuinely match the request, most relevant first. Only include real matches (it is fine to return 1 or 0). Each match: id, fit ("full" = does what was asked, "partial" = close but missing something), why (one short sentence: what it does for this request). Never invent ids. coverage: "full" if at least one match fully fits, "partial" if only partial matches, "none" if no matches. message: one or two plain-English sentences for the user (when partial, say what is missing). trySites: when coverage is not full, up to 3 OTHER LIBRARIES most likely to have this prompt, most likely first, each with why (one short sentence); [] if none is a reasonable bet or coverage is full. Use only libIds from OTHER LIBRARIES. Reply JSON only: {"coverage":"full|partial|none","message":"...","matches":[{"id":0,"fit":"full|partial","why":"..."}],"trySites":[{"libId":"p7","why":"..."}]}',
      turns: [{ role: "user", text: `REQUEST: ${q}

CANDIDATES:
${list || "(none found)"}

OTHER LIBRARIES:
${siteList || "(none)"}` }],
      json: true,
      thinking: "low",
      maxTokens: 3e3
    });
    const raw = parseJson(r2.text) || {};
    const seen = /* @__PURE__ */ new Set();
    const matches = (Array.isArray(raw.matches) ? raw.matches : []).map((p) => {
      const r = byId.get(Number(p?.id));
      if (!r || seen.has(r.pid)) return null;
      seen.add(r.pid);
      return { pid: r.pid, libId: r.libId, libName: names.get(r.libId) || r.libId, title: r.title, desc: r.desc, why: String(p?.why || "").trim(), fit: p?.fit === "partial" ? "partial" : "full" };
    }).filter(Boolean).slice(0, 5);
    let coverage = ["full", "partial", "none"].includes(raw.coverage) ? raw.coverage : matches.length ? "full" : "none";
    if (!matches.length) coverage = "none";
    else if (coverage === "none") coverage = "partial";
    const siteById = new Map(sites.map((l) => [l.libId, l]));
    const seenSite = /* @__PURE__ */ new Set();
    const trySites = coverage === "full" ? [] : (Array.isArray(raw.trySites) ? raw.trySites : []).map((t) => {
      const l = siteById.get(String(t?.libId || ""));
      if (!l || seenSite.has(l.libId)) return null;
      seenSite.add(l.libId);
      return { libId: l.libId, title: l.title, url: l.links && l.links[0] && l.links[0][1] || "", why: String(t?.why || "").trim() };
    }).filter(Boolean).slice(0, 3);
    return {
      coverage,
      message: String(raw.message || (matches.length ? "" : "No prompt in the open-source libraries matches that.")).trim(),
      matches,
      trySites
    };
  }
});
var squash = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");
var web = action({
  args: { key: v.string(), query: v.string() },
  handler: async (ctx, { key, query }) => {
    checkKey(key);
    const q = query.trim().slice(0, 500);
    if (!q) throw new ConvexError3("Type what kind of prompt you're looking for first.");
    const libs = (await ctx.runQuery(internal.promptLibs.libNames, {})).filter((l) => !l.imported && l.links.length);
    if (!libs.length) return { results: [], searched: 0 };
    const sites = libs.map((l) => ({ ...l, hosts: [...new Set(l.links.map((x) => x[1]))] }));
    const ownerOf = (u) => {
      const h = hostOf(u);
      if (!h) return null;
      for (const l of sites) for (const s of l.hosts) {
        const sh = hostOf(s);
        if (sh === "github.com") {
          const m = s.match(/github\.com\/[\w.-]+\/[\w.-]+/i);
          if (m && u.toLowerCase().includes(m[0].toLowerCase())) return l;
        } else if (h === sh || h.endsWith("." + sh)) return l;
      }
      return null;
    };
    const norm = (s) => s.toLowerCase().replace(/%20/g, " ").replace(/[’']/g, "").replace(/[-_/.+]+/g, " ").replace(/\s+/g, " ").trim();
    let keywords = norm(q).split(" ").filter((w) => w.length >= 4 && !STOP.has(w));
    try {
      const rk = await callGemini({
        model: MODELS.advisor(),
        system: `Someone is looking for a ready-made AI prompt. Give 10-15 short English keywords or 2-word phrases, including synonyms, likely to appear in the title, web address or text of a matching prompt (e.g. "stress test" -> pre-mortem, premortem, devil's advocate, red team, risk, failure). Reply JSON only: {"keywords": ["..."]}`,
        turns: [{ role: "user", text: q }],
        json: true,
        thinking: "low",
        maxTokens: 512
      });
      const k = parseJson(rk.text)?.keywords;
      if (Array.isArray(k)) keywords = [...keywords, ...k.map((x) => norm(String(x)))];
    } catch {
    }
    keywords = [...new Set(keywords.filter((k) => k.length >= 4 && !STOP.has(k)))].slice(0, 30);
    const hits = (s) => {
      const t = " " + norm(s) + " ";
      return keywords.reduce((n, k) => n + (t.includes(k) ? 1 : 0), 0);
    };
    const UA = { "User-Agent": "Mozilla/5.0 (compatible; ai-toolbox)", Accept: "text/html,application/xml" };
    const getRaw = async (url, ms = 12e3) => {
      const res = await fetchWithTimeout(url, { headers: UA }, ms);
      if (!res.ok) return null;
      return { finalUrl: res.url || url, body: await res.text() };
    };
    const getPage = async (url) => {
      const r = await getRaw(url);
      return r ? { finalUrl: r.finalUrl, html: r.body, text: pageText(r.body) } : null;
    };
    const focus = (text) => {
      if (text.length <= 3e4) return text;
      const low = text.toLowerCase();
      const spans = [];
      for (const k of keywords) for (const variant of [k, k.replace(/ /g, "-"), k.replace(/ /g, "")]) {
        let at = low.indexOf(variant);
        let n = 0;
        while (at >= 0 && n++ < 6) {
          spans.push([Math.max(0, at - 1500), at + 2500]);
          at = low.indexOf(variant, at + variant.length);
        }
      }
      if (!spans.length) return text.slice(0, 3e4);
      spans.sort((a, b) => a[0] - b[0]);
      const merged = [];
      for (const s of spans) {
        const last = merged[merged.length - 1];
        if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]);
        else merged.push([...s]);
      }
      return merged.map(([a, b]) => text.slice(a, b)).join("\n\u2026\n").slice(0, 3e4);
    };
    const NEXT = /^(next|older|more|load more|›|»|→|>|\d+)$/i;
    const linksOf = (html, base, lib) => {
      const out2 = [];
      const seen = /* @__PURE__ */ new Set();
      for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
        let href = m[1];
        try {
          href = new URL(href, base).toString();
        } catch {
          continue;
        }
        if (seen.has(href) || href === base || !/^https?:/.test(href)) continue;
        seen.add(href);
        if (ownerOf(href) !== lib && hostOf(href) !== hostOf(base)) continue;
        if (/\.(png|jpe?g|gif|svg|webp|pdf|zip|mp4|css|js)(\?|$)/i.test(href)) continue;
        const label = pageText(m[2]).slice(0, 200);
        const next = NEXT.test(label.trim()) || /[?&]page=\d+|\/page\/\d+/i.test(href);
        out2.push({ url: href, title: label || href, score: hits(label) * 2 + hits(decodeURIComponent(href)), next });
      }
      return out2;
    };
    const sitemapUrls = async (startUrl) => {
      const host = hostOf(startUrl);
      if (!host || host === "github.com") return [];
      const cached = await ctx.runQuery(internal.promptFinder.getSitemap, { host });
      if (cached && Date.now() - cached.at < 7 * 24 * 3600 * 1e3) return cached.urls;
      const origin = new URL(startUrl).origin;
      const urls = [];
      try {
        const robots = await getRaw(origin + "/robots.txt", 8e3).catch(() => null);
        const listed = robots ? [...robots.body.matchAll(/^sitemap:\s*(\S+)/gim)].map((m) => m[1]) : [];
        const queue = listed.length ? listed : [origin + "/sitemap.xml", origin + "/sitemap_index.xml"];
        let opened = 0;
        while (queue.length && opened < 8 && urls.length < 8e3) {
          const sm = queue.shift();
          opened++;
          const r = await getRaw(sm, 1e4).catch(() => null);
          if (!r || !/<(urlset|sitemapindex)/i.test(r.body)) continue;
          const locs = [...r.body.matchAll(/<loc>\s*(?:<!\[CDATA\[)?([^<\]]+?)(?:\]\]>)?\s*<\/loc>/gi)].map((m) => m[1].trim());
          if (/<sitemapindex/i.test(r.body)) {
            locs.sort((a, b) => Number(/prompt|post|page|blog|article|library|resource/i.test(b)) - Number(/prompt|post|page|blog|article|library|resource/i.test(a)));
            queue.push(...locs.slice(0, 6));
          } else urls.push(...locs.filter((u) => hostOf(u) === host));
        }
      } catch {
      }
      const keep = [...new Set(urls)].slice(0, 8e3);
      await ctx.runMutation(internal.promptFinder.saveSitemap, { host, urls: keep });
      return keep;
    };
    const cands = [];
    const deeper = [];
    await Promise.all(sites.map(async (l) => {
      for (const start of l.hosts.slice(0, 2)) {
        if (/github\.com/i.test(start) && l.hosts.length > 1) continue;
        try {
          const [pg, sm] = await Promise.all([getPage(start).catch(() => null), sitemapUrls(start).catch(() => [])]);
          if (pg) {
            cands.push({ lib: l, url: pg.finalUrl, title: l.title, score: hits(pg.text), text: pg.text, depth: 0 });
            const links = linksOf(pg.html, pg.finalUrl, l);
            for (const k of links) if (k.score > 0) cands.push({ lib: l, url: k.url, title: k.title, score: k.score, depth: 1 });
            for (const k of links.filter((x) => x.next).slice(0, 2)) deeper.push({ lib: l, url: k.url, title: k.title, score: 0.5, depth: 1 });
          }
          for (const u of sm) {
            const s = hits(decodeURIComponent(u));
            if (s > 0) cands.push({ lib: l, url: u, title: decodeURIComponent(u.split("/").filter(Boolean).pop() || u).replace(/[-_]+/g, " "), score: s, depth: 1 });
          }
        } catch {
        }
      }
    }));
    const level1 = [...cands.filter((c) => c.depth === 1 && c.score > 0).sort((a, b) => b.score - a.score).slice(0, 6), ...deeper.slice(0, 6)];
    const seenDeep = /* @__PURE__ */ new Set();
    await Promise.all(level1.map(async (c) => {
      if (seenDeep.has(c.url)) return;
      seenDeep.add(c.url);
      try {
        const pg = await getPage(c.url);
        if (!pg) return;
        const pageScore = hits(pg.text);
        const sub = linksOf(pg.html, pg.finalUrl, c.lib).filter((k) => k.score > 0);
        const list = sub.length > 0 && pg.text.length < 400;
        for (const x of cands.filter((x2) => x2.url === c.url)) {
          x.text = pg.text;
          x.score = Math.max(x.score, pageScore);
          x.list = list;
        }
        if (!cands.some((x) => x.url === c.url) && pageScore > 0) cands.push({ ...c, text: pg.text, score: pageScore, depth: 1, list });
        for (const k of sub) cands.push({ lib: c.lib, url: k.url, title: k.title, score: k.score, depth: 2 });
      } catch {
      }
    }));
    const ranked = cands.filter((c) => c.score > 0 && !c.list && !(c.text !== void 0 && c.text.trim().length < 40)).sort((a, b) => b.score - a.score || b.depth - a.depth);
    const perLib = /* @__PURE__ */ new Map();
    const chosen = [];
    for (const c of ranked) {
      if (chosen.length >= 10) break;
      const n = perLib.get(c.lib.libId) || 0;
      if (n >= 4 || chosen.some((x) => x.url === c.url)) continue;
      perLib.set(c.lib.libId, n + 1);
      chosen.push(c);
    }
    const read = [];
    await Promise.all(chosen.map(async (c) => {
      try {
        const text = c.text ?? (await getPage(c.url))?.text;
        if (text && text.trim().length > 40) read.push({ lib: c.lib, url: c.url, title: c.title, text: focus(text) });
      } catch {
      }
    }));
    if (!read.length) return { results: [], searched: libs.length };
    const r2 = await callGemini({
      model: MODELS.advisor(),
      system: `You get a REQUEST and the text of web PAGES. For each page that contains a ready-made prompt matching the request, copy that prompt EXACTLY as written on the page (do not rewrite or shorten it; if it is longer than 4000 characters, copy the first 4000). If a page only describes prompts without showing one, set prompt to "". Skip pages that don't match. Return best first. Reply JSON only: {"results":[{"page":0,"title":"short name of the prompt","why":"one short sentence: what it does for this request","prompt":"..."}]}`,
      turns: [{ role: "user", text: `REQUEST: ${q}

` + read.map((r, i) => `PAGE ${i} (${r.url}):
${r.text}`).join("\n\n=====\n\n") }],
      json: true,
      thinking: "low",
      maxTokens: 8192
    });
    const out = parseJson(r2.text) || {};
    const results = (Array.isArray(out.results) ? out.results : []).map((x) => {
      const r = read[Number(x?.page)];
      if (!r) return null;
      let prompt = String(x?.prompt || "").trim();
      const verified = !!prompt && squash(r.text).includes(squash(prompt.slice(0, 300)).slice(0, 120));
      if (!verified) prompt = "";
      return { libId: r.lib.libId, libTitle: r.lib.title, url: r.url, title: String(x?.title || r.title || "").trim(), why: String(x?.why || "").trim(), prompt, verified };
    }).filter(Boolean).slice(0, 3);
    return { results, searched: libs.length };
  }
});
var getSitemap = internalQuery({
  args: { host: v.string() },
  handler: async (ctx, { host }) => {
    const r = await ctx.db.query("sitemaps").withIndex("by_host", (q) => q.eq("host", host)).first();
    return r ? { at: r.at, urls: r.urls } : null;
  }
});
var saveSitemap = internalMutation({
  args: { host: v.string(), urls: v.array(v.string()) },
  handler: async (ctx, { host, urls }) => {
    const r = await ctx.db.query("sitemaps").withIndex("by_host", (q) => q.eq("host", host)).first();
    if (r) await ctx.db.patch(r._id, { at: Date.now(), urls });
    else await ctx.db.insert("sitemaps", { host, at: Date.now(), urls });
  }
});
export {
  find,
  getSitemap,
  saveSitemap,
  web
};
