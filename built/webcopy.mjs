"use node";

// stub:server
var id = (d) => d;
var internalAction = id;

// convex/webcopy.ts
import { v as v2 } from "convex/values";

// stub:api
var mk = (m) => new Proxy({}, { get: (_, f) => m + ":" + String(f) });
var internal = { items: mk("items"), ingest: mk("ingest"), install: mk("install"), advisor: mk("advisor"), pipeline: mk("pipeline"), enrich: mk("enrich"), credit: mk("credit"), hype: mk("hype"), alts: mk("alts"), promptFinder: mk("promptFinder"), promptLibs: mk("promptLibs"), promptImport: mk("promptImport"), promptAdd: mk("promptAdd"), snapshot: mk("snapshot"), siteCheck: mk("siteCheck"), webjobs: mk("webjobs"), webcopy: mk("webcopy"), promptGen: mk("promptGen"), tabs: mk("tabs"), tabImport: mk("tabImport"), tabAdd: mk("tabAdd"), playbooks: mk("playbooks"), playbookAi: mk("playbookAi"), addAny: mk("addAny") };

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
import { ConvexError } from "convex/values";
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
  if (!key) throw new ConvexError("GEMINI_API_KEY is not set in the Convex dashboard (Settings \u2192 Environment Variables).");
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
  if (!ok) throw new ConvexError("Gemini API error: " + (j?.error?.message || "unknown error"));
  const cand = j?.candidates?.[0];
  const text = (cand?.content?.parts || []).filter((p) => typeof p.text === "string" && !p.thought).map((p) => p.text).join("").trim();
  if (!text) throw new ConvexError("Gemini returned an empty answer" + (cand?.finishReason ? ` (${cand.finishReason})` : "") + ". Try again.");
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
  if (start < 0 || end < start) throw new ConvexError("Couldn't read the AI's answer. Please try again.");
  try {
    return JSON.parse(src.slice(start, end + 1));
  } catch {
    throw new ConvexError("Couldn't read the AI's answer. Please try again.");
  }
}

// convex/promptRows.ts
async function addInBatches(ctx, rows, runId, onBatch) {
  let batch = [], size = 0, done = 0;
  for (const r of rows) {
    const s = r.text.length + r.title.length + r.desc.length + r.url.length + 100;
    if (batch.length && (size + s > 9e5 || batch.length >= 300)) {
      await ctx.runMutation(internal.promptLibs.addPrompts, { rows: batch, runId });
      done += batch.length;
      if (onBatch) await onBatch(done);
      batch = [];
      size = 0;
    }
    batch.push(r);
    size += s;
  }
  if (batch.length) await ctx.runMutation(internal.promptLibs.addPrompts, { rows: batch, runId });
}
function parseRepoUrl(url) {
  const m = String(url || "").match(/github\.com\/([\w.-]+)\/([\w.-]+)(?:\/(?:tree|blob)\/([^/]+)\/?(.*))?/i);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/, ""), branch: m[3] || "", sub: (m[4] || "").replace(/\/+$/, "") };
}

// convex/promptImport.ts
import { v } from "convex/values";
var MAX_PROMPTS = 5e3;
var MAX_BYTES = 4e7;
var MAX_TEXT = 6e4;
var BAD = /jailbreak|\bDAN\b|uncensored|nsfw/i;
var SKIP_PATH = /(^|\/)(node_modules|\.github|\.git|vendor|dist|build|tests?|__tests__|\.vscode|\.idea)(\/|$)/i;
var SKIP_FILE = /^(license|licence|changelog|contributing|code_of_conduct|security|governance|owners|agents|claude|support|funding|history|notice|authors)(\.[a-z]+)?$/i;
var TEXT_EXT = /\.(md|mdx|txt|prompt)$/i;
function clean(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}
function short(s, n = 220) {
  const t = clean(String(s || "").replace(/^---[\s\S]*?---/, "").replace(/<[^>]+>/g, " ").replace(/[#*`>_|]/g, " "));
  return t.length <= n ? t : t.slice(0, n).replace(/\s+\S*$/, "") + "\u2026";
}
function pretty(name) {
  return name.replace(/\.(md|mdx|txt|prompt)$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}
function frontmatter(text, key) {
  const fm = text.match(/^---\s*\n([\s\S]*?)\n---/);
  const m = fm && fm[1].match(new RegExp("^" + key + ":\\s*(.+)$", "m"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
}
function ghHeaders() {
  const h = { "User-Agent": "ai-toolbox", Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}
function parseCsv(text) {
  const rows = [];
  let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          f += '"';
          i++;
        } else q = false;
      } else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      row.push(f);
      f = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(f);
      f = "";
      rows.push(row);
      row = [];
    } else f += c;
  }
  if (f || row.length) {
    row.push(f);
    rows.push(row);
  }
  return rows;
}
var PROMPT_COLS = ["prompt", "content", "text", "system_prompt", "system", "instructions", "template"];
var TITLE_COLS = ["act", "title", "name", "role", "task", "persona", "id"];
async function extractPrompts(libId, repoUrl, progress = async () => {
}) {
  const r = parseRepoUrl(repoUrl);
  if (!r) throw new Error("Not a GitHub repo link.");
  await progress("Reading the repo on GitHub\u2026");
  const info = await fetchWithTimeout(`https://api.github.com/repos/${r.owner}/${r.repo}`, { headers: ghHeaders() }, 15e3);
  if (!info.ok) throw new Error(info.status === 404 ? "GitHub repo not found (or it's private)." : `GitHub said ${info.status}.`);
  const meta = await info.json();
  const branch = r.branch || meta.default_branch || "main";
  const tr = await fetchWithTimeout(`https://api.github.com/repos/${r.owner}/${r.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`, { headers: ghHeaders() }, 3e4);
  if (!tr.ok) throw new Error(`Couldn't list the repo's files (GitHub ${tr.status}).`);
  const tree = (await tr.json()).tree;
  const files = tree.filter((t) => t.type === "blob" && (!r.sub || t.path === r.sub || t.path.startsWith(r.sub + "/")) && !SKIP_PATH.test(t.path)).map((t) => ({ path: t.path, size: t.size || 0, name: t.path.split("/").pop() || "", dir: t.path.split("/").slice(0, -1).join("/") }));
  const raw = (p) => `https://raw.githubusercontent.com/${r.owner}/${r.repo}/${encodeURIComponent(branch)}/${p.split("/").map(encodeURIComponent).join("/")}`;
  const page = (p) => `https://github.com/${r.owner}/${r.repo}/blob/${branch}/${p}`;
  const get = async (p) => {
    const res = await fetchWithTimeout(raw(p), {}, 3e4);
    if (!res.ok) throw new Error("fetch " + res.status);
    return await res.text();
  };
  const fetchMany = async (list) => {
    const out = [];
    let bytes = 0;
    for (let i = 0; i < list.length; i += 10) {
      const part = list.slice(i, i + 10);
      const got = await Promise.all(part.map(async (f) => {
        try {
          return { f, text: await get(f.path) };
        } catch {
          return null;
        }
      }));
      for (const g of got) if (g) {
        out.push(g);
        bytes += g.text.length;
      }
      if (bytes > MAX_BYTES) break;
    }
    return out;
  };
  const ok = (title, text) => title && text && text.trim().length >= 40 && !BAD.test(title) && !BAD.test(text.slice(0, 500));
  const row = (title, text, url, desc) => ({ libId, title: clean(title).slice(0, 200), desc: short(desc || text), text: text.trim().slice(0, MAX_TEXT), url });
  const tables = files.filter((f) => /\.(csv|json)$/i.test(f.name) && f.size > 2e3 && f.size < 3e7 && !/package(-lock)?\.json|tsconfig|composer|manifest|schema|config|\.lock/i.test(f.name)).sort((a, b) => b.size - a.size).slice(0, 3);
  for (const f of tables) {
    await progress(`Downloading ${f.name} (${(f.size / 1e6).toFixed(1)} MB)\u2026`);
    let text = "";
    try {
      text = await get(f.path);
    } catch {
      continue;
    }
    const rows = [];
    if (/\.csv$/i.test(f.name)) {
      const t = parseCsv(text);
      const head = (t[0] || []).map((h) => h.trim().toLowerCase());
      const pc = head.findIndex((h) => PROMPT_COLS.includes(h));
      const tc = head.findIndex((h) => TITLE_COLS.includes(h));
      if (pc < 0) continue;
      for (const line of t.slice(1)) {
        const p = line[pc] || "", ti = (tc >= 0 ? line[tc] : "") || short(p, 60);
        if (ok(ti, p)) rows.push(row(ti, p, page(f.path)));
        if (rows.length >= MAX_PROMPTS) break;
      }
    } else {
      try {
        let j = JSON.parse(text);
        if (!Array.isArray(j)) j = Object.values(j).find((x) => Array.isArray(x)) || [];
        for (const o of j) {
          if (!o || typeof o !== "object") continue;
          const pk = Object.keys(o).find((k) => PROMPT_COLS.includes(k.toLowerCase()) && typeof o[k] === "string");
          if (!pk) continue;
          const tk = Object.keys(o).find((k) => TITLE_COLS.includes(k.toLowerCase()) && typeof o[k] === "string");
          const ti = (tk ? o[tk] : "") || short(o[pk], 60);
          if (ok(ti, o[pk])) rows.push(row(ti, o[pk], page(f.path), typeof o.description === "string" ? o.description : void 0));
          if (rows.length >= MAX_PROMPTS) break;
        }
      } catch {
        continue;
      }
    }
    if (rows.length >= 5) return { rows, how: `${rows.length} prompts from ${f.path}` };
  }
  const texts = files.filter((f) => TEXT_EXT.test(f.name) && !SKIP_FILE.test(f.name) && f.size < 4e5);
  const byName = /* @__PURE__ */ new Map();
  for (const f of texts) {
    if (!f.dir) continue;
    const k = f.name.toLowerCase();
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k).push(f);
  }
  const rank = (k) => /^(system|prompt|skill|design)\.mdx?$/.test(k) ? 2 : k === "readme.md" ? 0 : 1;
  const perFolder = [...byName.entries()].filter(([, l]) => l.length >= 5).sort((a, b) => rank(b[0]) - rank(a[0]) || b[1].length - a[1].length)[0];
  const byDir = /* @__PURE__ */ new Map();
  for (const f of texts) {
    if (/^readme/i.test(f.name)) continue;
    if (!byDir.has(f.dir)) byDir.set(f.dir, []);
    byDir.get(f.dir).push(f);
  }
  const flatDirs = [...byDir.entries()].filter(([, l]) => l.length >= 5).sort((a, b) => b[1].length - a[1].length);
  const flatCount = flatDirs.slice(0, 5).reduce((n, [, l]) => n + l.length, 0);
  if (perFolder && (rank(perFolder[0]) > 0 || perFolder[1].length >= flatCount)) {
    await progress(`Downloading ${Math.min(perFolder[1].length, MAX_PROMPTS)} prompt files\u2026`);
    const got = await fetchMany(perFolder[1].slice(0, MAX_PROMPTS));
    const rows = got.map(({ f, text }) => {
      const folder = f.dir.split("/").pop() || f.name;
      return row(frontmatter(text, "name") || pretty(folder), text, page(f.path), frontmatter(text, "description") || void 0);
    }).filter((x) => ok(x.title, x.text));
    if (rows.length >= 3) return { rows, how: `${rows.length} prompts, one per folder (${perFolder[0]})` };
  }
  if (flatCount >= 5) {
    const list = flatDirs.slice(0, 5).flatMap(([, l]) => l).slice(0, MAX_PROMPTS);
    await progress(`Downloading ${list.length} prompt files\u2026`);
    const got = await fetchMany(list);
    const rows = got.map(({ f, text }) => row(frontmatter(text, "title") || frontmatter(text, "name") || pretty(f.name), text, page(f.path), frontmatter(text, "description") || void 0)).filter((x) => ok(x.title, x.text));
    if (rows.length >= 3) return { rows, how: `${rows.length} prompt files` };
  }
  const readme = files.filter((f) => /^readme\.mdx?$/i.test(f.name)).sort((a, b) => a.path.split("/").length - b.path.split("/").length || b.size - a.size)[0];
  if (readme) {
    const text = await get(readme.path);
    const parts = text.split(/\n(?=##\s+[^#])/);
    const rows = [];
    for (const p of parts.slice(1)) {
      const h = clean(p.split("\n")[0].replace(/^##\s+/, "").replace(/[*_`[\]]/g, ""));
      const body = p.split("\n").slice(1).join("\n").trim();
      if (/contents|license|contributing|install|usage|credits|acknowledg|star history|sponsor|support|about/i.test(h)) continue;
      if ((body.match(/[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]/g) || []).length > body.length * 0.15 || /[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]{2}/.test(h)) continue;
      if ((body.match(/\]\(https?:/g) || []).length >= 3 && !/```/.test(body)) continue;
      const code = body.match(/```[\w-]*\n([\s\S]*?)```/);
      const promptText = code && code[1].trim().length > 60 ? code[1].trim() : body;
      if (ok(h, promptText) && promptText.length > 80) rows.push(row(h, promptText, page(readme.path)));
    }
    if (rows.length >= 3) return { rows, how: `${rows.length} prompts from README sections` };
  }
  return { rows: [], how: "" };
}
var run = internalAction({
  args: { libId: v.string(), repo: v.string(), runId: v.optional(v.string()) },
  handler: async (ctx, { libId, repo, runId }) => {
    try {
      const progress = async (note) => {
        console.log(`[prompt copy ${libId}] ${note}`);
        await ctx.runMutation(internal.promptLibs.progress, { libId, runId, note });
      };
      await progress("Clearing old copy\u2026");
      while (await ctx.runMutation(internal.promptLibs.clearPrompts, { libId, runId }) > 0) {
      }
      const { rows, how } = await extractPrompts(libId, repo, progress);
      if (!rows.length) {
        await ctx.runMutation(internal.promptLibs.setImp, { libId, state: "failed", count: 0, note: "Couldn't find prompts in this repo's files.", runId });
        return;
      }
      await progress(`Found ${rows.length.toLocaleString()} prompts \u2014 saving\u2026`);
      await addInBatches(ctx, rows, runId, (done) => progress(`Saved ${done.toLocaleString()} of ${rows.length.toLocaleString()}\u2026`));
      const count = await ctx.runQuery(internal.promptLibs.countFor, { libId });
      await ctx.runMutation(internal.promptLibs.setImp, { libId, state: "done", count, note: how, runId });
    } catch (e) {
      console.log(`[prompt copy ${libId}] failed: ${String(e?.message || e)}`);
      await ctx.runMutation(internal.promptLibs.setImp, { libId, state: "failed", count: 0, note: String(e?.message || e).slice(0, 200), runId });
    }
  }
});

// convex/webcopy.ts
var MAX_QUEUE = 400;
var MAX_AI_PAGES = 120;
var MAX_READER = 25;
var PER_STEP = 5;
var UA = { "User-Agent": "Mozilla/5.0 (compatible; ai-toolbox-copier)", Accept: "text/html,application/xhtml+xml,application/xml" };
var LOGIN_SITES = /(^|\.)(facebook\.com|fb\.watch|instagram\.com|linkedin\.com|x\.com|twitter\.com|tiktok\.com)$/i;
var NEVER_COPY = /github\.com\/x1xhlol\/system-prompts-and-models-of-ai-tools/i;
var SKIP_PATH2 = /\/(login|signin|sign-in|signup|sign-up|register|account|cart|checkout|privacy|terms|cookie|contact|about|careers|jobs|pricing|press|legal|search|tag|tags|author|feed|wp-json|wp-admin|cdn-cgi)(\/|$|\?)/i;
var ASSET = /\.(png|jpe?g|gif|svg|webp|ico|pdf|zip|mp4|mp3|webm|css|js|json|xml|txt|woff2?)(\?|$)/i;
var squash = (s) => s.toLowerCase().replace(/[^a-z0-9֐-׿؀-ۿ]+/g, "");
var clean2 = (s) => String(s || "").replace(/\s+/g, " ").trim();
var short2 = (s, n = 220) => {
  const t = clean2(s);
  return t.length <= n ? t : t.slice(0, n).replace(/\s+\S*$/, "") + "\u2026";
};
var decode = (s) => s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&rsquo;|&lsquo;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&ldquo;|&rdquo;/g, '"').replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
var stripTags = (s) => decode(s.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|div|li|h\d)>/gi, "\n").replace(/<[^>]+>/g, "")).replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
function looksLikePrompt(t) {
  const s = t.trim();
  if (s.length < 80) return false;
  const words = s.split(/\s+/).length;
  if (words < 14) return false;
  const code = (s.match(/[{};=<>$]|=>|\(\)/g) || []).length;
  if (code / s.length > 0.03) return false;
  return true;
}
async function robotsRules(origin) {
  try {
    const r = await fetchWithTimeout(origin + "/robots.txt", { headers: UA }, 8e3);
    if (!r.ok) return [];
    const lines = (await r.text()).split(/\r?\n/);
    const out = [];
    let applies = false, sawAgent = false;
    for (const raw of lines) {
      const line = raw.replace(/#.*/, "").trim();
      const m = line.match(/^(user-agent|disallow|allow)\s*:\s*(.*)$/i);
      if (!m) continue;
      const k = m[1].toLowerCase(), val = m[2].trim();
      if (k === "user-agent") {
        if (sawAgent) {
          applies = false;
          sawAgent = false;
        }
        applies = applies || val === "*" || /ai-toolbox/i.test(val);
        continue;
      }
      sawAgent = true;
      if (applies && k === "disallow" && val) out.push(val);
    }
    return out;
  } catch {
    return [];
  }
}
var allowed = (url, disallow) => {
  try {
    const p = new URL(url).pathname;
    return !disallow.some((d) => d !== "" && p.startsWith(d.replace(/\*.*$/, "")));
  } catch {
    return false;
  }
};
async function fetchHtml(url) {
  try {
    const r = await fetchWithTimeout(url, { headers: UA }, 15e3);
    if (!r.ok) return null;
    const type = r.headers.get("content-type") || "";
    if (type && !/html|xml|text/i.test(type)) return null;
    return { url: r.url || url, html: await r.text() };
  } catch {
    return null;
  }
}
async function fetchRendered(url) {
  try {
    const r = await fetchWithTimeout("https://r.jina.ai/" + url, { headers: { "X-Return-Format": "html", Accept: "text/html" } }, 25e3);
    if (!r.ok) return null;
    return { url, html: await r.text() };
  } catch {
    return null;
  }
}
var wordCount = (html) => pageText(html).split(/\s+/).filter((w) => w.length > 2).length;
function headingBefore(html, at, fallback) {
  const before = html.slice(Math.max(0, at - 4e3), at);
  const hs = [...before.matchAll(/<h[1-4][^>]*>([\s\S]*?)<\/h[1-4]>/gi)];
  const t = hs.length ? clean2(stripTags(hs[hs.length - 1][1])) : "";
  return t && t.length < 140 ? t : fallback;
}
function pageTitle(html, url) {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const t = h1 ? clean2(stripTags(h1[1])) : clean2(stripTags((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || ""));
  return (t || decodeURIComponent(url.split("/").filter(Boolean).pop() || url).replace(/[-_]+/g, " ")).slice(0, 140);
}
function blocksFrom(html, url) {
  const out = [];
  const title = pageTitle(html, url);
  const add = (raw, at) => {
    const t = stripTags(raw);
    if (looksLikePrompt(t)) out.push({ title: headingBefore(html, at, title), text: t });
  };
  for (const m of html.matchAll(/<pre[^>]*>([\s\S]*?)<\/pre>/gi)) add(m[1], m.index || 0);
  for (const m of html.matchAll(/<textarea[^>]*>([\s\S]*?)<\/textarea>/gi)) add(m[1], m.index || 0);
  for (const m of html.matchAll(/data-(?:clipboard-text|copy|copy-text|prompt|text)=["']([^"']{80,})["']/gi)) add(m[1], m.index || 0);
  for (const m of html.matchAll(/<(div|p|section|blockquote|span)[^>]*class=["'][^"']*\bprompt[\w-]*\b[^"']*["'][^>]*>([\s\S]*?)<\/\1>/gi)) add(m[2], m.index || 0);
  for (const m of html.matchAll(/<blockquote[^>]*>([\s\S]*?)<\/blockquote>/gi)) add(m[1], m.index || 0);
  for (const m of html.matchAll(/<code[^>]*>([\s\S]{120,}?)<\/code>/gi)) add(m[1], m.index || 0);
  return out;
}
function dataFrom(html) {
  const out = [];
  const blobs = [];
  for (const m of html.matchAll(/<script[^>]*(?:id=["']__NEXT_DATA__["']|type=["']application\/(?:ld\+)?json["'])[^>]*>([\s\S]*?)<\/script>/gi)) blobs.push(m[1]);
  const PK = /^(prompt|prompttext|prompt_text|content|text|body|template|instruction|instructions|system|systemprompt)$/i;
  const TK = /^(title|name|act|label|heading|slug)$/i;
  const walk = (o, depth) => {
    if (!o || depth > 12 || out.length > 3e3) return;
    if (Array.isArray(o)) {
      for (const x of o) walk(x, depth + 1);
      return;
    }
    if (typeof o !== "object") return;
    const keys = Object.keys(o);
    const pk = keys.find((k) => PK.test(k) && typeof o[k] === "string" && looksLikePrompt(o[k]));
    if (pk) {
      const tk = keys.find((k) => TK.test(k) && typeof o[k] === "string" && o[k].length < 160);
      out.push({ title: clean2(tk ? o[tk] : short2(o[pk], 60)), text: String(o[pk]).trim() });
    }
    for (const k of keys) if (typeof o[k] === "object") walk(o[k], depth + 1);
  };
  for (const b of blobs) {
    try {
      walk(JSON.parse(decode(b)), 0);
    } catch {
    }
  }
  return out;
}
function linksFrom(html, base) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  const push = (href, label) => {
    let u;
    try {
      u = new URL(decode(href), base).toString().replace(/#.*$/, "");
    } catch {
      return;
    }
    if (!/^https?:/.test(u) || seen.has(u) || ASSET.test(u)) return;
    seen.add(u);
    out.push({ url: u, label: clean2(stripTags(label)).slice(0, 160) });
  };
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) push(m[1], m[2]);
  for (const m of html.matchAll(/\[([^\]]{1,160})\]\((https?:\/\/[^)\s]+)\)/g)) push(m[2], m[1]);
  return out;
}
async function sitemapUrls(origin, host) {
  const urls = [];
  try {
    const rob = await fetchWithTimeout(origin + "/robots.txt", { headers: UA }, 8e3).catch(() => null);
    const listed = rob && rob.ok ? [...(await rob.text()).matchAll(/^sitemap:\s*(\S+)/gim)].map((m) => m[1]) : [];
    const queue = listed.length ? listed : [origin + "/sitemap.xml", origin + "/sitemap_index.xml"];
    let opened = 0;
    while (queue.length && opened < 10 && urls.length < 2e4) {
      const sm = queue.shift();
      opened++;
      const r = await fetchHtml(sm);
      if (!r || !/<(urlset|sitemapindex)/i.test(r.html)) continue;
      const locs = [...r.html.matchAll(/<loc>\s*(?:<!\[CDATA\[)?([^<\]]+?)(?:\]\]>)?\s*<\/loc>/gi)].map((m) => m[1].trim());
      if (/<sitemapindex/i.test(r.html)) {
        locs.sort((a, b) => Number(/prompt|post|page|library|resource|template|gallery/i.test(b)) - Number(/prompt|post|page|library|resource|template|gallery/i.test(a)));
        queue.push(...locs.slice(0, 8));
      } else urls.push(...locs.filter((u) => hostOf(u) === host));
    }
  } catch {
  }
  return [...new Set(urls)];
}
function prefixOf(url) {
  const p = new URL(url).pathname.replace(/\/+$/, "");
  const parts = p.split("/").filter(Boolean);
  if (parts.length <= 1) return "/" + (parts[0] || "");
  return "/" + parts.slice(0, -1).join("/");
}
var PROMPTY = /prompt|template|rule|gallery|library|pattern|persona|skill/i;
var inScope = (u, host, prefix) => {
  try {
    const x = new URL(u);
    if (hostOf(u) !== host || SKIP_PATH2.test(x.pathname)) return false;
    const folderIsPrompty = prefix !== "/" && PROMPTY.test(prefix);
    if (folderIsPrompty && x.pathname.startsWith(prefix)) return true;
    return PROMPTY.test(x.pathname);
  } catch {
    return false;
  }
};
var discover = internalAction({
  args: { libId: v2.string(), runId: v2.string() },
  handler: async (ctx, { libId, runId }) => {
    const progress = async (note) => {
      await ctx.runMutation(internal.promptLibs.progress, { libId, runId, note });
    };
    const done = async (count, note) => {
      await ctx.runMutation(internal.webjobs.finish, { libId, runId, count, note });
    };
    try {
      const lib = await ctx.runQuery(internal.webjobs.libInfo, { libId });
      if (!lib || lib.run !== runId) return;
      while (await ctx.runMutation(internal.promptLibs.clearPrompts, { libId, runId }) > 0) {
      }
      const links = lib.links.map((x) => x[1]).filter((u) => /^https?:\/\//.test(u) && !NEVER_COPY.test(u));
      if (!links.length) return await done(0, lib.links.some((x) => NEVER_COPY.test(x[1])) ? "Not copied: this repo collects other companies' system prompts." : "No link to copy from.");
      const mixed = lib.sec === "patterns" && links.length > 1;
      const gh = links.find((u) => parseRepoUrl(u) && !(mixed && /github\.com/i.test(u)));
      let ghTried = false;
      if (gh && links.indexOf(gh) === 0) {
        ghTried = true;
        await progress("Reading the GitHub repo\u2026");
        const { rows } = await extractPrompts(libId, gh, async (n) => {
          await progress(n);
        });
        if (rows.length) {
          await addInBatches(ctx, rows, runId, (k) => progress(`Saved ${k.toLocaleString()} of ${rows.length.toLocaleString()}\u2026`));
          const count = await ctx.runQuery(internal.promptLibs.countFor, { libId });
          return await done(count, "Copied from its GitHub repo (not open source)");
        }
      }
      const queue = [];
      let disallowAll = "", host = "", prefix = "/", disallow = [];
      for (const start of links.slice(0, 3)) {
        if (/github\.com/i.test(start) && mixed) continue;
        if (parseRepoUrl(start)) continue;
        const h = hostOf(start);
        if (LOGIN_SITES.test(h)) {
          disallowAll = disallowAll || `${h} needs a login, so its posts can't be copied.`;
          continue;
        }
        const origin = new URL(start).origin;
        const rules = await robotsRules(origin);
        if (!allowed(start, rules)) {
          disallowAll = disallowAll || `${h} doesn't allow automatic copying (robots.txt).`;
          continue;
        }
        if (!host) {
          host = h;
          prefix = prefixOf(start);
          disallow = rules;
        }
        queue.push("0|" + start);
        await progress(`Reading ${h}'s page list\u2026`);
        const sm = await sitemapUrls(origin, h);
        const pfx = prefixOf(start);
        for (const u of sm) if (queue.length < MAX_QUEUE && inScope(u, h, pfx) && allowed(u, rules)) queue.push("1|" + u);
      }
      if (!queue.length) return await done(0, disallowAll || (ghTried ? "Couldn't find prompts in its GitHub repo's files." : "Couldn't reach the site."));
      const dedup = [...new Map(queue.map((q) => [q.split("|").slice(1).join("|"), q])).values()].slice(0, MAX_QUEUE);
      const ok = await ctx.runMutation(internal.webjobs.saveJob, {
        job: { libId, runId, queue: dedup, pos: 0, found: 0, ai: 0, reader: 0, fetched: 0, seen: [], visited: [], prefix, host, disallow, note: disallowAll }
      });
      if (!ok) return;
      await progress(`Reading pages\u2026 0 of ${dedup.length}`);
      await ctx.scheduler.runAfter(0, internal.webcopy.step, { libId, runId });
    } catch (e) {
      await done(0, "Couldn't copy: " + String(e?.message || e).slice(0, 160));
    }
  }
});
var step = internalAction({
  args: { libId: v2.string(), runId: v2.string() },
  handler: async (ctx, { libId, runId }) => {
    const job = await ctx.runQuery(internal.webjobs.getJob, { libId });
    if (!job || job.runId !== runId) return;
    const progress = async (note) => {
      await ctx.runMutation(internal.promptLibs.progress, { libId, runId, note });
    };
    try {
      if (!job.v2) {
        const head = job.queue.slice(0, job.pos), rest = job.queue.slice(job.pos);
        job.queue = [...head, ...rest.filter((q) => {
          const [d, ...u] = q.split("|");
          return d === "0" || inScope(u.join("|"), job.host, job.prefix);
        })];
        job.v2 = true;
      }
      const seen = new Set(job.seen);
      const visited = new Set(job.visited);
      const batch = job.queue.slice(job.pos, job.pos + PER_STEP);
      const rows = [];
      const forAi = [];
      const keep = (title, text, url) => {
        const key = squash(text).slice(0, 80);
        if (!key || seen.has(key)) return;
        seen.add(key);
        rows.push({ libId, title: clean2(title).slice(0, 200) || "Prompt", desc: short2(text), text: text.slice(0, 6e4), url });
      };
      for (const item of batch) {
        const depth = Number(item.split("|")[0]);
        const url = item.split("|").slice(1).join("|");
        if (visited.has(url)) continue;
        visited.add(url);
        let page = await fetchHtml(url);
        if ((!page || wordCount(page.html) < 120) && job.reader < MAX_READER) {
          job.reader++;
          const r = await fetchRendered(url);
          if (r && wordCount(r.html) > (page ? wordCount(page.html) : 0)) page = r;
          await new Promise((res) => setTimeout(res, 3e3));
        }
        if (!page) continue;
        job.fetched = (job.fetched || 0) + 1;
        const found = [...dataFrom(page.html), ...blocksFrom(page.html, page.url)];
        for (const f of found) keep(f.title, f.text, page.url);
        const text = pageText(page.html);
        if (!found.length && text.split(/\s+/).length > 60 && /prompt|you are|act as|copy|instruction/i.test(text) && job.ai < MAX_AI_PAGES) {
          forAi.push({ url: page.url, title: pageTitle(page.html, page.url), text: text.slice(0, 14e3) });
        }
        if (depth < 2 && !(depth === 0 && found.length >= 3)) {
          for (const l of linksFrom(page.html, page.url)) {
            if (job.queue.length >= MAX_QUEUE) break;
            if (visited.has(l.url) || job.queue.some((q) => q.endsWith("|" + l.url))) continue;
            if (!inScope(l.url, job.host, job.prefix) || !allowed(l.url, job.disallow)) continue;
            job.queue.push(`${depth + 1}|${l.url}`);
          }
        }
      }
      for (let i = 0; i < forAi.length; i += 3) {
        const part = forAi.slice(i, i + 3);
        job.ai += part.length;
        try {
          const res = await callGemini({
            model: MODELS.advisor(),
            system: `You copy ready-to-use AI prompts from web PAGES. For each page, list every complete prompt shown on it (the text a person would paste into an AI), copied EXACTLY as written, with a short title. Skip navigation, descriptions about prompts, AI outputs/answers, and code that isn't a prompt. If a page has no prompt, return nothing for it. Reply JSON only: {"items":[{"page":0,"title":"...","prompt":"..."}]}`,
            turns: [{ role: "user", text: part.map((p, k) => `PAGE ${k} (${p.url}) \u2014 ${p.title}:
${p.text}`).join("\n\n=====\n\n") }],
            json: true,
            thinking: "low",
            maxTokens: 12e3
          });
          const items = parseJson(res.text)?.items;
          for (const it of Array.isArray(items) ? items : []) {
            const p = part[Number(it?.page)];
            const t = String(it?.prompt || "").trim();
            if (!p || t.length < 60) continue;
            if (!squash(p.text).includes(squash(t.slice(0, 300)).slice(0, 120))) continue;
            keep(String(it?.title || p.title), t, p.url);
          }
        } catch (e) {
          if (/quota|billing|credit|API key|permission/i.test(String(e?.message || e))) {
            job.ai = MAX_AI_PAGES;
            job.note = "Gemini credit ran out; copied what didn't need it.";
          }
        }
      }
      if (rows.length) await addInBatches(ctx, rows, runId);
      job.found += rows.length;
      job.pos += batch.length;
      job.seen = [...seen].slice(-6e3);
      job.visited = [...visited].slice(-2e3);
      const ok = await ctx.runMutation(internal.webjobs.saveJob, { job });
      if (!ok) return;
      if (job.pos < job.queue.length) {
        await progress(`Reading pages\u2026 ${job.pos} of ${job.queue.length} \xB7 ${job.found.toLocaleString()} prompts so far`);
        await ctx.scheduler.runAfter(0, internal.webcopy.step, { libId, runId });
        return;
      }
      const count = await ctx.runQuery(internal.promptLibs.countFor, { libId });
      const extras = [job.ai ? `${job.ai} pages read with AI` : "", job.reader ? `${job.reader} rendered pages` : ""].filter(Boolean).join(", ");
      await ctx.runMutation(internal.webjobs.finish, {
        libId,
        runId,
        count,
        note: count ? `Copied from the website (not open source)${extras ? " \xB7 " + extras : ""}${job.note ? " \xB7 " + job.note : ""}` : job.note || (job.fetched ? `No ready-to-copy prompts found on the ${job.fetched} pages it could read.` : "Couldn't open the site's pages (it may block automatic visits or need JavaScript/login).")
      });
    } catch (e) {
      await ctx.runMutation(internal.webjobs.finish, { libId, runId, count: 0, note: "Couldn't copy: " + String(e?.message || e).slice(0, 160) });
    }
  }
});
export {
  discover,
  step
};
