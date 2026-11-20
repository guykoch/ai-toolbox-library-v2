// "Find a prompt": searches the prompts inside the open-source prompt libraries (see promptCatalog.ts).
// Step 1: Gemini turns the request into search words. Step 2: a fast word search picks ~40 candidates.
// Step 3: Gemini reads the candidates and picks the best one — or says nothing fits.
import { action, internalQuery, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { checkKey } from "./auth";
import { callGemini, MODELS, parseJson } from "./llm";
import { fetchWithTimeout, hostOf, pageText } from "./web";
import { internal } from "./_generated/api";

type Row = { pid: number; libId: string; title: string; desc: string };

const STOP = new Set("a an the and or for to of in on with my me i you your want need prompt prompts that this is be it as by from about how what which can please some any like".split(" "));

function words(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9À-ɏ]+/).filter((w) => w.length > 1 && !STOP.has(w));
}

function shortlist(catalog: Row[], keywords: string[], n: number): Row[] {
  const kws = [...new Set(keywords.flatMap(words))].slice(0, 40);
  if (!kws.length) return [];
  const rows = catalog.map((r) => ({ r, title: r.title.toLowerCase(), desc: r.desc.toLowerCase() }));
  // Rare words count more than common ones.
  const df = new Map<string, number>();
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

type Hit = { pid: number; libId: string; libName: string; title: string; desc: string };

export const find = action({
  args: { key: v.string(), query: v.string() },
  handler: async (ctx, { key, query }): Promise<{ coverage: "full" | "partial" | "none"; message: string; matches: (Hit & { why: string; fit: "full" | "partial" })[]; trySites: { libId: string; title: string; url: string; why: string }[] }> => {
    checkKey(key);
    const q = query.trim().slice(0, 500);
    if (!q) throw new ConvexError("Type what kind of prompt you're looking for first.");

    // 1. Turn the request into search words (synonyms included).
    let keywords: string[] = [q];
    try {
      const r1 = await callGemini({
        model: MODELS.advisor(),
        system:
          'Someone is looking for a ready-made AI prompt. Turn their request into 8-15 short English search keywords and synonyms that would appear in the title or description of a matching prompt (e.g. "slide deck" -> slides, presentation, deck, pitch, keynote). Translate if needed. Reply JSON only: {"keywords": ["..."]}',
        turns: [{ role: "user", text: q }],
        json: true,
        thinking: "low",
        maxTokens: 1024,
      });
      const k = parseJson(r1.text)?.keywords;
      if (Array.isArray(k)) keywords = [q, ...k.map(String)];
    } catch (e) {
      // Fall back to the user's own words; a credit/key problem will surface in step 3 anyway.
    }

    // 2. Fast word search over every copied prompt.
    const catalog: Row[] = [];
    let cursor: string | null = null;
    for (;;) {
      const page: { rows: Row[]; cursor: string; done: boolean } = await ctx.runQuery(internal.promptLibs.indexPage, { cursor });
      catalog.push(...page.rows);
      if (page.done) break;
      cursor = page.cursor;
    }
    const libs = (await ctx.runQuery(internal.promptLibs.libNames, {})) as { libId: string; title: string; summary: string; imported: boolean; links: [string, string][] }[];
    const names = new Map<string, string>(libs.map((l) => [l.libId, l.title]));
    // Libraries in the user's list whose prompts aren't copied into the app (websites), for "try these" suggestions.
    const sites = libs.filter((l) => !l.imported);
    const siteList = sites.map((l) => `${l.libId} | ${l.title} | ${l.summary.slice(0, 140)}`).join("\n");
    const cands = shortlist(catalog.filter((r) => names.has(r.libId)), keywords, 60);
    const byId = new Map(cands.map((r) => [r.pid, r]));
    const list = cands.map((r) => `${r.pid} | ${names.get(r.libId)} | ${r.title} | ${r.desc}`).join("\n");

    // 3. Let Gemini rank.
    const r2 = await callGemini({
      model: MODELS.advisor(),
      system:
        "You help someone find a ready-made prompt. You get their REQUEST, CANDIDATES (prompts copied from open-source libraries: id | library | title | description) " +
        "and OTHER LIBRARIES (prompt libraries in their list whose prompts are NOT searchable here, mostly websites: libId | name | what it has). " +
        "matches: up to 5 candidates that genuinely match the request, most relevant first. Only include real matches (it is fine to return 1 or 0). " +
        'Each match: id, fit ("full" = does what was asked, "partial" = close but missing something), why (one short sentence: what it does for this request). Never invent ids. ' +
        'coverage: "full" if at least one match fully fits, "partial" if only partial matches, "none" if no matches. ' +
        "message: one or two plain-English sentences for the user (when partial, say what is missing). " +
        "trySites: when coverage is not full, up to 3 OTHER LIBRARIES most likely to have this prompt, most likely first, each with why (one short sentence); [] if none is a reasonable bet or coverage is full. Use only libIds from OTHER LIBRARIES. " +
        'Reply JSON only: {"coverage":"full|partial|none","message":"...","matches":[{"id":0,"fit":"full|partial","why":"..."}],"trySites":[{"libId":"p7","why":"..."}]}',
      turns: [{ role: "user", text: `REQUEST: ${q}\n\nCANDIDATES:\n${list || "(none found)"}\n\nOTHER LIBRARIES:\n${siteList || "(none)"}` }],
      json: true,
      thinking: "low",
      maxTokens: 3000,
    });
    const raw = parseJson(r2.text) || {};
    const seen = new Set<number>();
    const matches = (Array.isArray(raw.matches) ? raw.matches : [])
      .map((p: any) => {
        const r = byId.get(Number(p?.id));
        if (!r || seen.has(r.pid)) return null;
        seen.add(r.pid);
        return { pid: r.pid, libId: r.libId, libName: names.get(r.libId) || r.libId, title: r.title, desc: r.desc, why: String(p?.why || "").trim(), fit: p?.fit === "partial" ? "partial" : "full" };
      })
      .filter(Boolean)
      .slice(0, 5) as (Hit & { why: string; fit: "full" | "partial" })[];
    let coverage: "full" | "partial" | "none" = ["full", "partial", "none"].includes(raw.coverage) ? raw.coverage : matches.length ? "full" : "none";
    if (!matches.length) coverage = "none";
    else if (coverage === "none") coverage = "partial";
    const siteById = new Map(sites.map((l) => [l.libId, l]));
    const seenSite = new Set<string>();
    const trySites = coverage === "full" ? [] : (Array.isArray(raw.trySites) ? raw.trySites : [])
      .map((t: any) => {
        const l = siteById.get(String(t?.libId || ""));
        if (!l || seenSite.has(l.libId)) return null;
        seenSite.add(l.libId);
        return { libId: l.libId, title: l.title, url: (l.links && l.links[0] && l.links[0][1]) || "", why: String(t?.why || "").trim() };
      })
      .filter(Boolean)
      .slice(0, 3) as { libId: string; title: string; url: string; why: string }[];
    return {
      coverage,
      message: String(raw.message || (matches.length ? "" : "No prompt in the open-source libraries matches that.")).trim(),
      matches,
      trySites,
    };
  },
});

// ---------- Live lookup on the website libraries (prompts that aren't copied into the app) ----------
// 1. Gemini + Google Search finds candidate pages, only on those libraries' sites.
// 2. The pages are read here directly.
// 3. Gemini picks out the matching prompt from each page's real text; the text is checked against the page before it's shown.
const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "");

export const web = action({
  args: { key: v.string(), query: v.string() },
  handler: async (ctx, { key, query }): Promise<{ results: { libId: string; libTitle: string; url: string; title: string; why: string; prompt: string; verified: boolean }[]; searched: number }> => {
    checkKey(key);
    const q = query.trim().slice(0, 500);
    if (!q) throw new ConvexError("Type what kind of prompt you're looking for first.");
    const libs = ((await ctx.runQuery(internal.promptLibs.libNames, {})) as { libId: string; title: string; summary: string; bestFor: string; imported: boolean; links: [string, string][] }[])
      .filter((l) => !l.imported && l.links.length);
    if (!libs.length) return { results: [], searched: 0 };
    // Which sites belong to which library (GitHub repos only match their own repo path).
    const sites = libs.map((l) => ({ ...l, hosts: [...new Set(l.links.map((x) => x[1]))] }));
    const ownerOf = (u: string) => {
      const h = hostOf(u);
      if (!h) return null;
      for (const l of sites) for (const s of l.hosts) {
        const sh = hostOf(s);
        if (sh === "github.com") { const m = s.match(/github\.com\/[\w.-]+\/[\w.-]+/i); if (m && u.toLowerCase().includes(m[0].toLowerCase())) return l; }
        else if (h === sh || h.endsWith("." + sh)) return l;
      }
      return null;
    };

    // Words and phrases to look for (the request plus synonyms, e.g. "stress test" -> pre-mortem, devil's advocate).
    const norm = (s: string) => s.toLowerCase().replace(/%20/g, " ").replace(/[’']/g, "").replace(/[-_/.+]+/g, " ").replace(/\s+/g, " ").trim();
    let keywords: string[] = norm(q).split(" ").filter((w) => w.length >= 4 && !STOP.has(w));
    try {
      const rk = await callGemini({
        model: MODELS.advisor(),
        system: 'Someone is looking for a ready-made AI prompt. Give 10-15 short English keywords or 2-word phrases, including synonyms, likely to appear in the title, web address or text of a matching prompt (e.g. "stress test" -> pre-mortem, premortem, devil\'s advocate, red team, risk, failure). Reply JSON only: {"keywords": ["..."]}',
        turns: [{ role: "user", text: q }],
        json: true,
        thinking: "low",
        maxTokens: 512,
      });
      const k = parseJson(rk.text)?.keywords;
      if (Array.isArray(k)) keywords = [...keywords, ...k.map((x: any) => norm(String(x)))];
    } catch { /* use the request's own words */ }
    keywords = [...new Set(keywords.filter((k) => k.length >= 4 && !STOP.has(k)))].slice(0, 30);
    const hits = (s: string) => { const t = " " + norm(s) + " "; return keywords.reduce((n, k) => n + (t.includes(k) ? 1 : 0), 0); };

    const UA = { "User-Agent": "Mozilla/5.0 (compatible; ai-toolbox)", Accept: "text/html,application/xml" };
    const getRaw = async (url: string, ms = 12000) => {
      const res = await fetchWithTimeout(url, { headers: UA }, ms);
      if (!res.ok) return null;
      return { finalUrl: res.url || url, body: await res.text() };
    };
    const getPage = async (url: string) => {
      const r = await getRaw(url);
      return r ? { finalUrl: r.finalUrl, html: r.body, text: pageText(r.body) } : null;
    };
    // Keeps the parts of a long page around the matching words, so the important bits fit.
    const focus = (text: string) => {
      if (text.length <= 30000) return text;
      const low = text.toLowerCase();
      const spans: [number, number][] = [];
      for (const k of keywords) for (const variant of [k, k.replace(/ /g, "-"), k.replace(/ /g, "")]) { let at = low.indexOf(variant); let n = 0; while (at >= 0 && n++ < 6) { spans.push([Math.max(0, at - 1500), at + 2500]); at = low.indexOf(variant, at + variant.length); } }
      if (!spans.length) return text.slice(0, 30000);
      spans.sort((a, b) => a[0] - b[0]);
      const merged: [number, number][] = [];
      for (const s of spans) { const last = merged[merged.length - 1]; if (last && s[0] <= last[1]) last[1] = Math.max(last[1], s[1]); else merged.push([...s]); }
      return merged.map(([a, b]) => text.slice(a, b)).join("\n…\n").slice(0, 30000);
    };
    // Links on a page that stay on the same library's site, scored by their words and address.
    const NEXT = /^(next|older|more|load more|›|»|→|>|\d+)$/i;
    const linksOf = (html: string, base: string, lib: (typeof sites)[number]) => {
      const out: { url: string; title: string; score: number; next: boolean }[] = [];
      const seen = new Set<string>();
      for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
        let href = m[1];
        try { href = new URL(href, base).toString(); } catch { continue; }
        if (seen.has(href) || href === base || !/^https?:/.test(href)) continue;
        seen.add(href);
        if (ownerOf(href) !== lib && hostOf(href) !== hostOf(base)) continue;
        if (/\.(png|jpe?g|gif|svg|webp|pdf|zip|mp4|css|js)(\?|$)/i.test(href)) continue;
        const label = pageText(m[2]).slice(0, 200);
        const next = NEXT.test(label.trim()) || /[?&]page=\d+|\/page\/\d+/i.test(href);
        out.push({ url: href, title: label || href, score: hits(label) * 2 + hits(decodeURIComponent(href)), next });
      }
      return out;
    };

    // A site's list of all its pages (sitemap), cached for a week. Lets the search reach pages deep inside big sites.
    const sitemapUrls = async (startUrl: string): Promise<string[]> => {
      const host = hostOf(startUrl);
      if (!host || host === "github.com") return [];
      const cached: { at: number; urls: string[] } | null = await ctx.runQuery(internal.promptFinder.getSitemap, { host });
      if (cached && Date.now() - cached.at < 7 * 24 * 3600 * 1000) return cached.urls;
      const origin = new URL(startUrl).origin;
      const urls: string[] = [];
      try {
        const robots = await getRaw(origin + "/robots.txt", 8000).catch(() => null);
        const listed = robots ? [...robots.body.matchAll(/^sitemap:\s*(\S+)/gim)].map((m) => m[1]) : [];
        const queue = listed.length ? listed : [origin + "/sitemap.xml", origin + "/sitemap_index.xml"];
        let opened = 0;
        while (queue.length && opened < 8 && urls.length < 8000) {
          const sm = queue.shift()!;
          opened++;
          const r = await getRaw(sm, 10000).catch(() => null);
          if (!r || !/<(urlset|sitemapindex)/i.test(r.body)) continue;
          const locs = [...r.body.matchAll(/<loc>\s*(?:<!\[CDATA\[)?([^<\]]+?)(?:\]\]>)?\s*<\/loc>/gi)].map((m) => m[1].trim());
          if (/<sitemapindex/i.test(r.body)) {
            // Child sitemaps: prefer ones that sound like content (posts, prompts, pages).
            locs.sort((a, b) => Number(/prompt|post|page|blog|article|library|resource/i.test(b)) - Number(/prompt|post|page|blog|article|library|resource/i.test(a)));
            queue.push(...locs.slice(0, 6));
          } else urls.push(...locs.filter((u) => hostOf(u) === host));
        }
      } catch { /* no sitemap */ }
      const keep = [...new Set(urls)].slice(0, 8000);
      await ctx.runMutation(internal.promptFinder.saveSitemap, { host, urls: keep });
      return keep;
    };

    // 1. Open each website library's own page(s); score the page, its links, and its sitemap's page addresses.
    type Cand = { lib: (typeof sites)[number]; url: string; title: string; score: number; text?: string; depth: number; list?: boolean };
    const cands: Cand[] = [];
    const deeper: Cand[] = []; // linked pages worth opening to look one level further (categories, list pages)
    await Promise.all(sites.map(async (l) => {
      for (const start of l.hosts.slice(0, 2)) {
        if (/github\.com/i.test(start) && l.hosts.length > 1) continue; // mixed cards: their GitHub links are covered elsewhere
        try {
          const [pg, sm] = await Promise.all([getPage(start).catch(() => null), sitemapUrls(start).catch(() => [] as string[])]);
          if (pg) {
            cands.push({ lib: l, url: pg.finalUrl, title: l.title, score: hits(pg.text), text: pg.text, depth: 0 });
            const links = linksOf(pg.html, pg.finalUrl, l);
            for (const k of links) if (k.score > 0) cands.push({ lib: l, url: k.url, title: k.title, score: k.score, depth: 1 });
            // Next pages of a list, and the best-matching links, get opened to look one level deeper.
            for (const k of links.filter((x) => x.next).slice(0, 2)) deeper.push({ lib: l, url: k.url, title: k.title, score: 0.5, depth: 1 });
          }
          for (const u of sm) { const s = hits(decodeURIComponent(u)); if (s > 0) cands.push({ lib: l, url: u, title: decodeURIComponent(u.split("/").filter(Boolean).pop() || u).replace(/[-_]+/g, " "), score: s, depth: 1 }); }
        } catch { /* site unreachable: skip */ }
      }
    }));

    // 2. Go one level deeper: open the best few linked pages (and next pages of lists), and score the links found on them.
    const level1 = [...cands.filter((c) => c.depth === 1 && c.score > 0).sort((a, b) => b.score - a.score).slice(0, 6), ...deeper.slice(0, 6)];
    const seenDeep = new Set<string>();
    await Promise.all(level1.map(async (c) => {
      if (seenDeep.has(c.url)) return;
      seenDeep.add(c.url);
      try {
        const pg = await getPage(c.url);
        if (!pg) return;
        const pageScore = hits(pg.text);
        const sub = linksOf(pg.html, pg.finalUrl, c.lib).filter((k) => k.score > 0);
        // A short page whose matches are just links (a category or list page) is a stepping stone, not a prompt.
        const list = sub.length > 0 && pg.text.length < 400;
        for (const x of cands.filter((x) => x.url === c.url)) { x.text = pg.text; x.score = Math.max(x.score, pageScore); x.list = list; }
        if (!cands.some((x) => x.url === c.url) && pageScore > 0) cands.push({ ...c, text: pg.text, score: pageScore, depth: 1, list });
        for (const k of sub) cands.push({ lib: c.lib, url: k.url, title: k.title, score: k.score, depth: 2 });
      } catch { /* skip */ }
    }));

    // 3. Pick the most promising pages overall (a few per library).
    // Category/list pages (already followed above) and empty pages are skipped.
    const ranked = cands.filter((c) => c.score > 0 && !c.list && !(c.text !== undefined && c.text.trim().length < 40)).sort((a, b) => b.score - a.score || b.depth - a.depth);
    const perLib = new Map<string, number>();
    const chosen: Cand[] = [];
    for (const c of ranked) {
      if (chosen.length >= 10) break;
      const n = perLib.get(c.lib.libId) || 0;
      if (n >= 4 || chosen.some((x) => x.url === c.url)) continue;
      perLib.set(c.lib.libId, n + 1);
      chosen.push(c);
    }
    const read: { lib: (typeof sites)[number]; url: string; title: string; text: string }[] = [];
    await Promise.all(chosen.map(async (c) => {
      try {
        const text = c.text ?? (await getPage(c.url))?.text;
        if (text && text.trim().length > 40) read.push({ lib: c.lib, url: c.url, title: c.title, text: focus(text) });
      } catch { /* skip */ }
    }));
    if (!read.length) return { results: [], searched: libs.length };

    // 3. Pull the matching prompt out of each page's real text.
    const r2 = await callGemini({
      model: MODELS.advisor(),
      system:
        "You get a REQUEST and the text of web PAGES. For each page that contains a ready-made prompt matching the request, copy that prompt EXACTLY as written on the page (do not rewrite or shorten it; if it is longer than 4000 characters, copy the first 4000). " +
        'If a page only describes prompts without showing one, set prompt to "". Skip pages that don\'t match. Return best first. ' +
        'Reply JSON only: {"results":[{"page":0,"title":"short name of the prompt","why":"one short sentence: what it does for this request","prompt":"..."}]}',
      turns: [{ role: "user", text: `REQUEST: ${q}\n\n` + read.map((r, i) => `PAGE ${i} (${r.url}):\n${r.text}`).join("\n\n=====\n\n") }],
      json: true,
      thinking: "low",
      maxTokens: 8192,
    });
    const out = parseJson(r2.text) || {};
    const results = (Array.isArray(out.results) ? out.results : [])
      .map((x: any) => {
        const r = read[Number(x?.page)];
        if (!r) return null;
        let prompt = String(x?.prompt || "").trim();
        // Show the prompt only if it really is on the page.
        const verified = !!prompt && squash(r.text).includes(squash(prompt.slice(0, 300)).slice(0, 120));
        if (!verified) prompt = "";
        return { libId: r.lib.libId, libTitle: r.lib.title, url: r.url, title: String(x?.title || r.title || "").trim(), why: String(x?.why || "").trim(), prompt, verified };
      })
      .filter(Boolean)
      .slice(0, 3) as { libId: string; libTitle: string; url: string; title: string; why: string; prompt: string; verified: boolean }[];
    return { results, searched: libs.length };
  },
});

export const getSitemap = internalQuery({
  args: { host: v.string() },
  handler: async (ctx, { host }) => {
    const r = await ctx.db.query("sitemaps").withIndex("by_host", (q) => q.eq("host", host)).first();
    return r ? { at: r.at, urls: r.urls } : null;
  },
});

export const saveSitemap = internalMutation({
  args: { host: v.string(), urls: v.array(v.string()) },
  handler: async (ctx, { host, urls }) => {
    const r = await ctx.db.query("sitemaps").withIndex("by_host", (q) => q.eq("host", host)).first();
    if (r) await ctx.db.patch(r._id, { at: Date.now(), urls });
    else await ctx.db.insert("sitemaps", { host, at: Date.now(), urls });
  },
});
