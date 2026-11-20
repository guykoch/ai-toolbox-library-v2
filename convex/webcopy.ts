"use node";
// xyz: copies the prompts out of a website library into the app, trying in order:
//   1. an open data source behind it (a GitHub repo it points to, or the library's own GitHub link)
//   2. reading the site's pages directly (its page list / sitemap, plus links, two levels deep)
//   3. the data a page carries behind the scenes (e.g. Next.js page data, embedded JSON)
//   4. a browser-rendering reader (r.jina.ai) for pages that only show content with JavaScript
// If nothing works, the library stays as before (link + live website search) and the card says why.
// Respects each site's robots.txt. Copies are labeled "copied from website, not open source".
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { fetchWithTimeout, hostOf, pageText } from "./web";
import { callGemini, MODELS, parseJson } from "./llm";
import { addInBatches, PromptRow, parseRepoUrl } from "./promptRows";
import { extractPrompts } from "./promptImport";

const MAX_QUEUE = 400; // pages per library
const MAX_AI_PAGES = 120; // pages per library read with Gemini (keeps cost around $0.20-0.30 per library)
const MAX_READER = 25; // pages per library through the browser-rendering reader (free tier is rate-limited)
const PER_STEP = 10; // pages per step (each step is a fresh action, well within time limits)
const UA = { "User-Agent": "Mozilla/5.0 (compatible; ai-toolbox-copier)", Accept: "text/html,application/xhtml+xml,application/xml" };
const LOGIN_SITES = /(^|\.)(facebook\.com|fb\.watch|instagram\.com|linkedin\.com|x\.com|twitter\.com|tiktok\.com)$/i;
const NEVER_COPY = /github\.com\/x1xhlol\/system-prompts-and-models-of-ai-tools/i;
const SKIP_PATH = /\/(login|signin|sign-in|signup|sign-up|register|account|cart|checkout|privacy|terms|cookie|contact|about|careers|jobs|pricing|press|legal|search|tag|tags|author|feed|wp-json|wp-admin|cdn-cgi)(\/|$|\?)/i;
const ASSET = /\.(png|jpe?g|gif|svg|webp|ico|pdf|zip|mp4|mp3|webm|css|js|json|xml|txt|woff2?)(\?|$)/i;

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9֐-׿؀-ۿ]+/g, "");
const clean = (s: string) => String(s || "").replace(/\s+/g, " ").trim();
const short = (s: string, n = 220) => { const t = clean(s); return t.length <= n ? t : t.slice(0, n).replace(/\s+\S*$/, "") + "…"; };
const decode = (s: string) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&rsquo;|&lsquo;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&ldquo;|&rdquo;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
const stripTags = (s: string) => decode(s.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h\d)>/gi, "\n").replace(/<[^>]+>/g, "")).replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();

// Text that reads like an instruction to an AI (not code, not a menu).
function looksLikePrompt(t: string) {
  const s = t.trim();
  if (s.length < 80) return false;
  const words = s.split(/\s+/).length;
  if (words < 14) return false;
  const code = (s.match(/[{};=<>$]|=>|\(\)/g) || []).length;
  if (code / s.length > 0.03) return false;
  return true;
}

// ---------- robots.txt ----------
async function robotsRules(origin: string): Promise<string[]> {
  try {
    const r = await fetchWithTimeout(origin + "/robots.txt", { headers: UA }, 8000);
    if (!r.ok) return [];
    const lines = (await r.text()).split(/\r?\n/);
    const out: string[] = [];
    let applies = false, sawAgent = false;
    for (const raw of lines) {
      const line = raw.replace(/#.*/, "").trim();
      const m = line.match(/^(user-agent|disallow|allow)\s*:\s*(.*)$/i);
      if (!m) continue;
      const k = m[1].toLowerCase(), val = m[2].trim();
      if (k === "user-agent") { if (sawAgent) { applies = false; sawAgent = false; } applies = applies || val === "*" || /ai-toolbox/i.test(val); continue; }
      sawAgent = true;
      if (applies && k === "disallow" && val) out.push(val);
    }
    return out;
  } catch { return []; }
}
const allowed = (url: string, disallow: string[]) => {
  try { const p = new URL(url).pathname; return !disallow.some((d) => d !== "" && p.startsWith(d.replace(/\*.*$/, ""))); } catch { return false; }
};

// ---------- fetching ----------
async function fetchHtml(url: string): Promise<{ url: string; html: string } | null> {
  try {
    const r = await fetchWithTimeout(url, { headers: UA }, 15000);
    if (!r.ok) return null;
    const type = r.headers.get("content-type") || "";
    if (type && !/html|xml|text/i.test(type)) return null;
    return { url: r.url || url, html: await r.text() };
  } catch { return null; }
}
// Browser-rendering reader: returns the page's HTML after its JavaScript has run.
async function fetchRendered(url: string): Promise<{ url: string; html: string } | null> {
  try {
    const r = await fetchWithTimeout("https://r.jina.ai/" + url, { headers: { "X-Return-Format": "html", Accept: "text/html" } }, 40000);
    if (!r.ok) return null;
    return { url, html: await r.text() };
  } catch { return null; }
}
const wordCount = (html: string) => pageText(html).split(/\s+/).filter((w) => w.length > 2).length;

// ---------- reading prompts off a page without AI ----------
function headingBefore(html: string, at: number, fallback: string) {
  const before = html.slice(Math.max(0, at - 4000), at);
  const hs = [...before.matchAll(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi)];
  const t = hs.length ? clean(stripTags(hs[hs.length - 1][1])) : "";
  return t && t.length < 140 ? t : fallback;
}
function pageTitle(html: string, url: string) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const t = h1 ? clean(stripTags(h1[1])) : clean(stripTags((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || ""));
  return (t || decodeURIComponent(url.split("/").filter(Boolean).pop() || url).replace(/[-_]+/g, " ")).slice(0, 140);
}

// Prompts shown in clear boxes: code/pre blocks, text areas, copy buttons, blocks marked "prompt", quotes.
function blocksFrom(html: string, url: string): { title: string; text: string }[] {
  const out: { title: string; text: string }[] = [];
  const title = pageTitle(html, url);
  const add = (raw: string, at: number) => {
    const t = stripTags(raw);
    if (looksLikePrompt(t)) out.push({ title: headingBefore(html, at, title), text: t });
  };
  for (const m of html.matchAll(/<pre[^>]*>([\s\S]*?)<\/pre>/gi)) add(m[1], m.index || 0);
  for (const m of html.matchAll(/<textarea[^>]*>([\s\S]*?)<\/textarea>/gi)) add(m[1], m.index || 0);
  for (const m of html.matchAll(/data-(?:clipboard-text|copy|copy-text|prompt|text)=["']([^"']{80,})["']/gi)) add(m[1], m.index || 0);
  for (const m of html.matchAll(/<(div|p|section|blockquote|span)[^>]*class=["'][^"']*\bprompt[\w-]*\b[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi)) add(m[2], m.index || 0);
  for (const m of html.matchAll(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi)) add(m[1], m.index || 0);
  // Code blocks outside <pre> (e.g. <code> on its own), only if multi-line prose.
  for (const m of html.matchAll(/<code[^>]*>([\s\S]{120,}?)<\/code>/gi)) add(m[1], m.index || 0);
  return out;
}

// Prompts carried in the page's data (Next.js page data, JSON scripts, structured data).
function dataFrom(html: string): { title: string; text: string }[] {
  const out: { title: string; text: string }[] = [];
  const blobs: string[] = [];
  for (const m of html.matchAll(/<script[^>]*(?:id=["']__NEXT_DATA__["']|type=["']application\/(?:ld\+)?json["'])[^>]*>([\s\S]*?)<\/script>/gi)) blobs.push(m[1]);
  const PK = /^(prompt|prompttext|prompt_text|content|text|body|template|instruction|instructions|system|systemprompt)$/i;
  const TK = /^(title|name|act|label|heading|slug)$/i;
  const walk = (o: any, depth: number) => {
    if (!o || depth > 12 || out.length > 3000) return;
    if (Array.isArray(o)) { for (const x of o) walk(x, depth + 1); return; }
    if (typeof o !== "object") return;
    const keys = Object.keys(o);
    const pk = keys.find((k) => PK.test(k) && typeof o[k] === "string" && looksLikePrompt(o[k]));
    if (pk) {
      const tk = keys.find((k) => TK.test(k) && typeof o[k] === "string" && o[k].length < 160);
      out.push({ title: clean(tk ? o[tk] : short(o[pk], 60)), text: String(o[pk]).trim() });
    }
    for (const k of keys) if (typeof o[k] === "object") walk(o[k], depth + 1);
  };
  for (const b of blobs) { try { walk(JSON.parse(decode(b)), 0); } catch { /* not JSON */ } }
  return out;
}

// ---------- links ----------
function linksFrom(html: string, base: string): { url: string; label: string }[] {
  const out: { url: string; label: string }[] = [];
  const seen = new Set<string>();
  const push = (href: string, label: string) => {
    let u: string;
    try { u = new URL(decode(href), base).toString().replace(/#.*$/, ""); } catch { return; }
    if (!/^https?:/.test(u) || seen.has(u) || ASSET.test(u)) return;
    seen.add(u);
    out.push({ url: u, label: clean(stripTags(label)).slice(0, 160) });
  };
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) push(m[1], m[2]);
  for (const m of html.matchAll(/\[([^\]]{1,160})\]\((https?:\/\/[^)\s]+)\)/g)) push(m[2], m[1]); // markdown links (reader output)
  return out;
}

// ---------- the site's page list ----------
async function sitemapUrls(origin: string, host: string): Promise<string[]> {
  const urls: string[] = [];
  try {
    const rob = await fetchWithTimeout(origin + "/robots.txt", { headers: UA }, 8000).catch(() => null);
    const listed = rob && rob.ok ? [...(await rob.text()).matchAll(/^sitemap:\s*(\S+)/gim)].map((m) => m[1]) : [];
    const queue = listed.length ? listed : [origin + "/sitemap.xml", origin + "/sitemap_index.xml"];
    let opened = 0;
    while (queue.length && opened < 10 && urls.length < 20000) {
      const sm = queue.shift()!;
      opened++;
      const r = await fetchHtml(sm);
      if (!r || !/<(urlset|sitemapindex)/i.test(r.html)) continue;
      const locs = [...r.html.matchAll(/<loc>\s*(?:<!\[CDATA\[)?([^<\]]+?)(?:\]\]>)?\s*<\/loc>/gi)].map((m) => m[1].trim());
      if (/<sitemapindex/i.test(r.html)) {
        locs.sort((a, b) => Number(/prompt|post|page|library|resource|template|gallery/i.test(b)) - Number(/prompt|post|page|library|resource|template|gallery/i.test(a)));
        queue.push(...locs.slice(0, 8));
      } else urls.push(...locs.filter((u) => hostOf(u) === host));
    }
  } catch { /* no sitemap */ }
  return [...new Set(urls)];
}

// Which part of the site belongs to the library: the start page's folder (e.g. /en/resources/prompt-library/).
function prefixOf(url: string) {
  const p = new URL(url).pathname.replace(/\/+$/, "");
  const parts = p.split("/").filter(Boolean);
  if (parts.length <= 1) return "/" + (parts[0] || "");
  return "/" + parts.slice(0, -1).join("/");
}
const inScope = (u: string, host: string, prefix: string) => {
  try {
    const x = new URL(u);
    if (hostOf(u) !== host || SKIP_PATH.test(x.pathname)) return false;
    return prefix === "/" ? true : x.pathname.startsWith(prefix) || /prompt|template|rule|style|gallery|library/i.test(x.pathname);
  } catch { return false; }
};

// ---------- 1. find where the prompts are ----------
export const discover = internalAction({
  args: { libId: v.string(), runId: v.string() },
  handler: async (ctx, { libId, runId }): Promise<void> => {
    const progress = async (note: string): Promise<void> => { await ctx.runMutation(internal.promptLibs.progress, { libId, runId, note }); };
    const done = async (count: number, note: string): Promise<void> => { await ctx.runMutation(internal.webjobs.finish, { libId, runId, count, note }); };
    try {
      const lib: { links: [string, string][]; sec: string; run: string } | null = await ctx.runQuery(internal.webjobs.libInfo, { libId });
      if (!lib || lib.run !== runId) return;
      // Clear an older copy of this library first (re-sync / try again).
      while ((await ctx.runMutation(internal.promptLibs.clearPrompts, { libId, runId })) > 0) { /* keep clearing */ }
      const links = lib.links.map((x) => x[1]).filter((u) => /^https?:\/\//.test(u) && !NEVER_COPY.test(u));
      if (!links.length) return await done(0, lib.links.some((x) => NEVER_COPY.test(x[1])) ? "Not copied: this repo collects other companies' system prompts." : "No link to copy from.");
      const mixed = lib.sec === "patterns" && links.length > 1;

      // 1a. The library's own GitHub repo (e.g. a repo without an open license): read its files.
      const gh = links.find((u) => parseRepoUrl(u) && !(mixed && /github\.com/i.test(u)));
      let ghTried = false;
      if (gh && links.indexOf(gh) === 0) {
        ghTried = true;
        await progress("Reading the GitHub repo…");
        const { rows } = await extractPrompts(libId, gh, async (n) => { await progress(n); });
        if (rows.length) {
          await addInBatches(ctx, rows, runId, (k) => progress(`Saved ${k.toLocaleString()} of ${rows.length.toLocaleString()}…`));
          const count: number = await ctx.runQuery(internal.promptLibs.countFor, { libId });
          return await done(count, "Copied from its GitHub repo (not open source)");
        }
      }

      // 2-4. Websites: plan which pages to read.
      const queue: string[] = [];
      let disallowAll = "", host = "", prefix = "/", disallow: string[] = [];
      for (const start of links.slice(0, 3)) {
        if (/github\.com/i.test(start) && mixed) continue; // mixed cards: their GitHub sources are copied elsewhere
        if (parseRepoUrl(start)) continue;
        const h = hostOf(start);
        if (LOGIN_SITES.test(h)) { disallowAll = disallowAll || `${h} needs a login, so its posts can't be copied.`; continue; }
        const origin = new URL(start).origin;
        const rules = await robotsRules(origin);
        if (!allowed(start, rules)) { disallowAll = disallowAll || `${h} doesn't allow automatic copying (robots.txt).`; continue; }
        if (!host) { host = h; prefix = prefixOf(start); disallow = rules; }
        queue.push("0|" + start);
        await progress(`Reading ${h}'s page list…`);
        const sm = await sitemapUrls(origin, h);
        const pfx = prefixOf(start);
        for (const u of sm) if (queue.length < MAX_QUEUE && inScope(u, h, pfx) && allowed(u, rules)) queue.push("1|" + u);
      }
      if (!queue.length) return await done(0, disallowAll || (ghTried ? "Couldn't find prompts in its GitHub repo's files." : "Couldn't reach the site."));
      const dedup = [...new Map(queue.map((q) => [q.split("|").slice(1).join("|"), q])).values()].slice(0, MAX_QUEUE);
      const ok = await ctx.runMutation(internal.webjobs.saveJob, {
        job: { libId, runId, queue: dedup, pos: 0, found: 0, ai: 0, reader: 0, fetched: 0, seen: [], visited: [], prefix, host, disallow, note: disallowAll },
      });
      if (!ok) return;
      await progress(`Reading pages… 0 of ${dedup.length}`);
      await ctx.scheduler.runAfter(0, internal.webcopy.step, { libId, runId });
    } catch (e: any) {
      await done(0, "Couldn't copy: " + String(e?.message || e).slice(0, 160));
    }
  },
});

// ---------- 2. read pages a few at a time ----------
export const step = internalAction({
  args: { libId: v.string(), runId: v.string() },
  handler: async (ctx, { libId, runId }): Promise<void> => {
    const job: any = await ctx.runQuery(internal.webjobs.getJob, { libId });
    if (!job || job.runId !== runId) return;
    const progress = async (note: string): Promise<void> => { await ctx.runMutation(internal.promptLibs.progress, { libId, runId, note }); };
    try {
      const seen = new Set<string>(job.seen);
      const visited = new Set<string>(job.visited);
      const batch = job.queue.slice(job.pos, job.pos + PER_STEP);
      const rows: PromptRow[] = [];
      const forAi: { url: string; title: string; text: string }[] = [];
      const keep = (title: string, text: string, url: string) => {
        const key = squash(text).slice(0, 80);
        if (!key || seen.has(key)) return;
        seen.add(key);
        rows.push({ libId, title: clean(title).slice(0, 200) || "Prompt", desc: short(text), text: text.slice(0, 60000), url });
      };
      for (const item of batch) {
        const depth = Number(item.split("|")[0]);
        const url = item.split("|").slice(1).join("|");
        if (visited.has(url)) continue;
        visited.add(url);
        let page = await fetchHtml(url);
        // JavaScript-only page: try the browser-rendering reader.
        if ((!page || wordCount(page.html) < 120) && job.reader < MAX_READER) {
          job.reader++;
          const r = await fetchRendered(url);
          if (r && wordCount(r.html) > (page ? wordCount(page.html) : 0)) page = r;
          await new Promise((res) => setTimeout(res, 3000)); // stay under the reader's free rate limit
        }
        if (!page) continue;
        job.fetched = (job.fetched || 0) + 1;
        const found = [...dataFrom(page.html), ...blocksFrom(page.html, page.url)];
        for (const f of found) keep(f.title, f.text, page.url);
        const text = pageText(page.html);
        if (!found.length && text.split(/\s+/).length > 60 && /prompt|you are|act as|copy|instruction/i.test(text) && job.ai < MAX_AI_PAGES) {
          forAi.push({ url: page.url, title: pageTitle(page.html, page.url), text: text.slice(0, 14000) });
        }
        // Go deeper: follow this page's links inside the library's part of the site (two levels from the start page).
        if (depth < 2) {
          for (const l of linksFrom(page.html, page.url)) {
            if (job.queue.length >= MAX_QUEUE) break;
            if (visited.has(l.url) || job.queue.some((q: string) => q.endsWith("|" + l.url))) continue;
            if (!inScope(l.url, job.host, job.prefix) || !allowed(l.url, job.disallow)) continue;
            job.queue.push(`${depth + 1}|${l.url}`);
          }
        }
      }
      // Pages without clear prompt boxes: let Gemini pick out the prompts (3 pages per call); keep only text really on the page.
      for (let i = 0; i < forAi.length; i += 3) {
        const part = forAi.slice(i, i + 3);
        job.ai += part.length;
        try {
          const res = await callGemini({
            model: MODELS.advisor(),
            system:
              "You copy ready-to-use AI prompts from web PAGES. For each page, list every complete prompt shown on it (the text a person would paste into an AI), copied EXACTLY as written, with a short title. " +
              "Skip navigation, descriptions about prompts, AI outputs/answers, and code that isn't a prompt. If a page has no prompt, return nothing for it. " +
              'Reply JSON only: {"items":[{"page":0,"title":"...","prompt":"..."}]}',
            turns: [{ role: "user", text: part.map((p, k) => `PAGE ${k} (${p.url}) — ${p.title}:\n${p.text}`).join("\n\n=====\n\n") }],
            json: true,
            thinking: "low",
            maxTokens: 12000,
          });
          const items = parseJson(res.text)?.items;
          for (const it of Array.isArray(items) ? items : []) {
            const p = part[Number(it?.page)];
            const t = String(it?.prompt || "").trim();
            if (!p || t.length < 60) continue;
            if (!squash(p.text).includes(squash(t.slice(0, 300)).slice(0, 120))) continue; // must really be on the page
            keep(String(it?.title || p.title), t, p.url);
          }
        } catch (e: any) {
          if (/quota|billing|credit|API key|permission/i.test(String(e?.message || e))) { job.ai = MAX_AI_PAGES; job.note = "Gemini credit ran out; copied what didn't need it."; }
        }
      }
      if (rows.length) await addInBatches(ctx, rows, runId);
      job.found += rows.length;
      job.pos += batch.length;
      job.seen = [...seen].slice(-6000);
      job.visited = [...visited].slice(-2000);
      const ok = await ctx.runMutation(internal.webjobs.saveJob, { job });
      if (!ok) return;
      if (job.pos < job.queue.length) {
        await progress(`Reading pages… ${job.pos} of ${job.queue.length} · ${job.found.toLocaleString()} prompts so far`);
        await ctx.scheduler.runAfter(0, internal.webcopy.step, { libId, runId });
        return;
      }
      const count: number = await ctx.runQuery(internal.promptLibs.countFor, { libId });
      const extras = [job.ai ? `${job.ai} pages read with AI` : "", job.reader ? `${job.reader} rendered pages` : ""].filter(Boolean).join(", ");
      await ctx.runMutation(internal.webjobs.finish, {
        libId, runId, count,
        note: count ? `Copied from the website (not open source)${extras ? " · " + extras : ""}${job.note ? " · " + job.note : ""}` : job.note || (job.fetched ? `No ready-to-copy prompts found on the ${job.fetched} pages it could read.` : "Couldn't open the site's pages (it may block automatic visits or need JavaScript/login)."),
      });
    } catch (e: any) {
      await ctx.runMutation(internal.webjobs.finish, { libId, runId, count: 0, note: "Couldn't copy: " + String(e?.message || e).slice(0, 160) });
    }
  },
});
