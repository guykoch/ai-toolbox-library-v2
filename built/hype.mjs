// stub:server
var id = (d) => d;
var query = id;
var mutation = id;
var internalQuery = id;
var internalMutation = id;
var internalAction = id;

// stub:api
var mk = (m) => new Proxy({}, { get: (_, f) => m + ":" + String(f) });
var internal = { items: mk("items"), ingest: mk("ingest"), install: mk("install"), advisor: mk("advisor"), pipeline: mk("pipeline"), enrich: mk("enrich"), credit: mk("credit"), hype: mk("hype"), alts: mk("alts"), promptFinder: mk("promptFinder"), promptLibs: mk("promptLibs"), promptImport: mk("promptImport"), promptAdd: mk("promptAdd"), snapshot: mk("snapshot"), siteCheck: mk("siteCheck"), webjobs: mk("webjobs"), webcopy: mk("webcopy"), promptGen: mk("promptGen"), tabs: mk("tabs"), tabImport: mk("tabImport"), tabAdd: mk("tabAdd"), playbooks: mk("playbooks"), playbookAi: mk("playbookAi"), addAny: mk("addAny") };

// convex/hype.ts
import { v as v2 } from "convex/values";

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
  const start2 = src.indexOf("{");
  const end = src.lastIndexOf("}");
  if (start2 < 0 || end < start2) throw new ConvexError2("Couldn't read the AI's answer. Please try again.");
  try {
    return JSON.parse(src.slice(start2, end + 1));
  } catch {
    throw new ConvexError2("Couldn't read the AI's answer. Please try again.");
  }
}

// convex/snapshot.ts
import { v } from "convex/values";

// convex/kinds.ts
var KINDS = ["skill", "connector", "plugin", "webapp", "app", "devtool", "model", "learn", "news"];
var KIND_LABEL = {
  skill: "Skill",
  connector: "Connector (MCP)",
  plugin: "Plugin / extension",
  webapp: "Web app",
  app: "Desktop / phone app",
  devtool: "Developer tool",
  model: "AI model",
  learn: "Learn",
  news: "News"
};
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

// convex/snapshot.ts
var REPO = () => process.env.SNAPSHOT_REPO || "guykoch/ai-toolbox-library-v2";
var BRANCH = () => process.env.SNAPSHOT_BRANCH || "main";
var PATH = "library-snapshot.md";
var DELAY_MS = () => Number(process.env.SNAPSHOT_DELAY_MS) || 6e4;
var SHELF = { "coding-agents": "Coding agents", "agent-skills": "Agent skills", "courses-guides": "Courses & guides", "productivity": "Productivity", "app-building": "App building", "video": "Video", "image": "Image", "audio": "Audio", "ai-models": "AI models", "news-analysis": "News & analysis", "translation": "Translation", "other": "Other" };
var SECTION = { general: "All-purpose libraries", business: "Business & productivity", coding: "Coding", design: "Slides, web & app design", images: "Images, logos & products", patterns: "Thinking patterns" };
var SOURCE = { official: "Official", open: "Open source", community: "Community", academic: "Academic", free: "Free" };
async function meta(ctx) {
  return await ctx.db.query("meta").withIndex("by_key", (q) => q.eq("key", "snapshot")).first();
}
async function snapshotSoon(ctx) {
  const m = await meta(ctx);
  const val = m?.value || {};
  if (val.pendingUntil && val.pendingUntil > Date.now()) return;
  const next = { ...val, pendingUntil: Date.now() + DELAY_MS() };
  if (m) await ctx.db.patch(m._id, { value: next });
  else await ctx.db.insert("meta", { key: "snapshot", value: next });
  await ctx.scheduler.runAfter(DELAY_MS(), internal.snapshot.write, {});
}
var request = internalMutation({ args: {}, handler: async (ctx) => {
  await snapshotSoon(ctx);
} });
var ensure = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    const val = (await meta(ctx))?.value || {};
    if (!val.at || Date.now() - Date.parse(val.at) > 24 * 3600 * 1e3) await snapshotSoon(ctx);
    return null;
  }
});
var refreshNow = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    const m = await meta(ctx);
    const val = m?.value || {};
    if (val.pendingUntil && val.pendingUntil > Date.now() && val.pendingUntil - Date.now() < 1e4) return null;
    const next = { ...val, pendingUntil: Date.now() + 5e3 };
    if (m) await ctx.db.patch(m._id, { value: next });
    else await ctx.db.insert("meta", { key: "snapshot", value: next });
    await ctx.scheduler.runAfter(5e3, internal.snapshot.write, {});
    return null;
  }
});
var status = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    const val = (await meta(ctx))?.value || {};
    return { at: val.at || "", ok: val.ok ?? null, error: val.error || "", url: `https://github.com/${REPO()}/blob/${BRANCH()}/${PATH}` };
  }
});
var record = internalMutation({
  args: { ok: v.boolean(), error: v.string() },
  handler: async (ctx, { ok, error }) => {
    const m = await meta(ctx);
    const value = { ...m?.value || {}, pendingUntil: 0, ok, error, ...ok ? { at: (/* @__PURE__ */ new Date()).toISOString() } : { failedAt: (/* @__PURE__ */ new Date()).toISOString() } };
    if (m) await ctx.db.patch(m._id, { value });
    else await ctx.db.insert("meta", { key: "snapshot", value });
  }
});
var data = internalQuery({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db.query("items").collect();
    const libs = await ctx.db.query("plibs").collect();
    const cards = await ctx.db.query("tcards").collect();
    const pbs = await ctx.db.query("playbooks").collect();
    return {
      tools: items.map((r) => ({ status: r.status, ...pickTool(r.data) })),
      libs: libs.filter((l) => !l.deleting).map((l) => ({ id: l.libId, ...l.data, imp: l.imp })),
      cards: cards.filter((c) => !c.deleting).map((c) => ({ id: c.cid, tab: c.tab, title: c.data?.title, sec: c.data?.sec, kind: c.data?.kind, bestFor: c.data?.bestFor || c.data?.summary, link: c.data?.links?.[0]?.[1] || "", imp: c.imp })),
      playbooks: pbs.map((p) => ({ id: p.pbId, ...p.data }))
    };
  }
});
function pickTool(d) {
  return {
    id: d.id,
    title: d.title,
    summary: d.summary,
    date: d.date,
    iso: d.iso,
    cat: d.cat,
    kind: d.kind,
    type: d.type,
    os: d.os,
    pop: d.pop,
    url: d.url,
    host: d.host,
    alternativeTo: d.alternativeTo,
    private: d.private
  };
}
var cell = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
function render(tools, libs, cards = [], playbooks = []) {
  const active = tools.filter((t) => t.status === "active").sort((a, b) => (b.iso || "").localeCompare(a.iso || "") || b.id - a.id);
  const archived = tools.filter((t) => t.status === "archived").sort((a, b) => b.id - a.id);
  const secOrder = Object.keys(SECTION);
  const sortedLibs = [...libs].sort((a, b) => secOrder.indexOf(a.sec) - secOrder.indexOf(b.sec) || Number(String(a.id).slice(1)) - Number(String(b.id).slice(1)));
  const promptsTotal = libs.reduce((n, l) => n + (l.imp?.state === "done" ? l.imp.count : 0), 0);
  const out = [];
  out.push("# AI Toolbox \u2014 library snapshot", "");
  out.push(`Updated automatically by the app: ${(/* @__PURE__ */ new Date()).toISOString().replace("T", " ").slice(0, 16)} UTC.`);
  out.push(`Tools: ${active.length} active, ${archived.length} archived. Prompt libraries: ${libs.length} (${libs.filter((l) => l.kind === "open").length} open source, ${promptsTotal.toLocaleString("en-US")} prompts copied into Find a prompt).`);
  out.push(`Rules: ${cards.filter((c) => c.tab === "rules").length}. Agents: ${cards.filter((c) => c.tab === "agents").length}. Automations: ${cards.filter((c) => c.tab === "autos").length}. Playbooks: ${playbooks.length}.`, "");
  out.push("## Tools (active)", "");
  out.push("| id | Name | Type | Shelf | Open source | Hype | Saved | Link | Alternative for |", "|---|---|---|---|---|---|---|---|---|");
  for (const t of active) {
    const kind = KIND_LABEL[t.kind || guessKind(t)] || "";
    out.push(`| ${t.id} | ${cell(t.title)}${t.private ? " (private, do not share)" : ""} | ${cell(kind)} | ${cell(SHELF[t.cat] || t.cat)} | ${t.os ? "yes" : "no"} | ${t.pop ?? ""} | ${cell(t.date)} | ${cell(t.url)} | ${cell((t.alternativeTo || []).join(", "))} |`);
  }
  out.push("", "## Tools (archived)", "");
  if (!archived.length) out.push("None.");
  else {
    out.push("| id | Name | Link |", "|---|---|---|");
    for (const t of archived) out.push(`| ${t.id} | ${cell(t.title)} | ${cell(t.url)} |`);
  }
  out.push("", "## Prompt libraries", "");
  out.push("| id | Name | Section | Source | Open source | Prompts in Find a prompt | Best for | Link |", "|---|---|---|---|---|---|---|---|");
  for (const l of sortedLibs) {
    const n = l.imp?.state === "done" ? String(l.imp.count) : l.imp?.state === "importing" ? "copying\u2026" : l.imp?.state === "failed" ? "copy failed" : "\u2014";
    out.push(`| ${l.id} | ${cell(l.title)} | ${cell(SECTION[l.sec] || l.sec)} | ${cell(SOURCE[l.kind] || l.kind)} | ${l.kind === "open" ? "yes" : "no"} | ${n} | ${cell(l.bestFor || l.summary)} | ${cell(l.links?.[0]?.[1] || "")} |`);
  }
  for (const [tab, name] of [["rules", "Rules"], ["agents", "Agents"], ["autos", "Automations"]]) {
    const list = cards.filter((c) => c.tab === tab).sort((a, b) => (TAB_SEC[tab] || []).indexOf(a.sec) - (TAB_SEC[tab] || []).indexOf(b.sec) || Number(String(a.id).slice(1)) - Number(String(b.id).slice(1)));
    out.push("", `## ${name}`, "");
    if (!list.length) {
      out.push("None yet.");
      continue;
    }
    out.push("| id | Name | Section | Source | Files copied | Best for | Link |", "|---|---|---|---|---|---|---|");
    for (const c of list) {
      const n = c.imp?.state === "done" ? String(c.imp.count) : c.imp?.state === "importing" ? "copying\u2026" : c.imp?.state === "failed" ? "copy failed" : "\u2014";
      out.push(`| ${c.id} | ${cell(c.title)} | ${cell(c.sec)} | ${cell(SOURCE[c.kind] || c.kind)} | ${n} | ${cell(c.bestFor)} | ${cell(c.link)} |`);
    }
  }
  out.push("", "## Playbooks", "");
  if (!playbooks.length) out.push("None yet.");
  else {
    out.push("| id | Name | Type | Topics | Steps (items used) |", "|---|---|---|---|---|");
    for (const p of [...playbooks].sort((a, b) => String(a.type).localeCompare(String(b.type)) || Number(String(a.id).slice(1)) - Number(String(b.id).slice(1)))) {
      const steps = (p.steps || []).map((s, i) => `${i + 1}. ${s.title}` + (s.use?.length ? ` (${s.use.map((u) => u.k + ":" + u.id).join(", ")})` : "")).join("; ");
      out.push(`| ${p.id} | ${cell(p.title)} | ${cell(p.type)} | ${cell((p.topics || []).join(", "))} | ${cell(steps)} |`);
    }
  }
  out.push("");
  return out.join("\n");
}
var TAB_SEC = { rules: ["standards", "coding", "collections", "design"], agents: ["subagents", "assistants", "teams"], autos: ["templates", "collections", "ai"] };
var b64 = (s) => {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(bin);
};
var write = internalAction({
  args: {},
  handler: async (ctx) => {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      await ctx.runMutation(internal.snapshot.record, { ok: false, error: "GITHUB_TOKEN isn't set in Convex." });
      return;
    }
    try {
      const d = await ctx.runQuery(internal.snapshot.data, {});
      const md = render(d.tools, d.libs, d.cards, d.playbooks);
      const api = `https://api.github.com/repos/${REPO()}/contents/${PATH}`;
      const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "ai-toolbox", "Content-Type": "application/json" };
      for (let attempt = 0; ; attempt++) {
        const cur = await fetch(`${api}?ref=${encodeURIComponent(BRANCH())}`, { headers });
        let sha;
        if (cur.ok) {
          const j = await cur.json();
          sha = j.sha;
          const old = j.content ? new TextDecoder().decode(Uint8Array.from(atob(String(j.content).replace(/\n/g, "")), (c) => c.charCodeAt(0))) : "";
          const strip = (s) => s.replace(/^Updated automatically.*$/m, "");
          if (strip(old) === strip(md)) break;
        } else if (cur.status !== 404) {
          throw new Error(cur.status === 401 ? "GitHub rejected the token (401)." : `GitHub said ${cur.status} reading the file.`);
        }
        const put = await fetch(api, { method: "PUT", headers, body: JSON.stringify({ message: "Update library snapshot", content: b64(md), branch: BRANCH(), ...sha ? { sha } : {} }) });
        if (put.ok) break;
        if ((put.status === 409 || put.status === 422) && attempt < 3) {
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
          continue;
        }
        throw new Error(put.status === 403 || put.status === 404 ? "The GitHub token can't write to the repo (it needs Contents: Read and write)." : put.status === 409 ? "Two updates collided; the next one will catch up." : `GitHub said ${put.status}.`);
      }
      await ctx.runMutation(internal.snapshot.record, { ok: true, error: "" });
    } catch (e) {
      await ctx.runMutation(internal.snapshot.record, { ok: false, error: String(e?.message || e).slice(0, 300) });
    }
  }
});

// convex/hype.ts
var PARALLEL = 4;
var RECENT_MS = 24 * 3600 * 1e3;
var STAR_LINE = /\d[\d,]* GitHub stars and/;
function isFatal(msg) {
  return /quota|billing|prepay|credits are depleted|API key|API_KEY|PERMISSION_DENIED|not set in the Convex dashboard|exceeded/i.test(msg);
}
function fmt(n) {
  return n.toLocaleString("en-US");
}
function dateLabel(d) {
  const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getUTCDate()} ${M[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
var repoOf = (u) => {
  const m = String(u || "").match(/github\.com\/([\w.-]+)\/([\w.-]+)/i);
  return m && !["orgs", "topics", "search", "marketplace", "features", "apps"].includes(m[1].toLowerCase()) ? `${m[1]}/${m[2].replace(/\.git$/, "")}` : null;
};
var start = mutation({
  args: { key: v2.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    const runId = `h${Date.now()}`;
    const now = Date.now();
    const rows = await ctx.db.query("items").withIndex("by_status", (q) => q.eq("status", "active")).collect();
    let skipped = 0, repos = 0;
    for (const r of rows) {
      if (r.hypeAt && now - Date.parse(r.hypeAt) < RECENT_MS) {
        await ctx.db.patch(r._id, { hypeRun: runId });
        skipped++;
      } else if (repoOf(r.data?.url)) repos++;
    }
    const value = {
      runId,
      running: true,
      finished: false,
      total: rows.length,
      done: skipped,
      skipped,
      changed: 0,
      repos,
      others: rows.length - skipped - repos,
      startedAt: now,
      resumedAt: now,
      doneAtResume: skipped,
      lastError: "",
      finishedAt: 0
    };
    const m = await ctx.db.query("meta").withIndex("by_key", (q) => q.eq("key", "hype")).first();
    if (m) await ctx.db.patch(m._id, { value });
    else await ctx.db.insert("meta", { key: "hype", value });
    await ctx.scheduler.runAfter(0, internal.hype.step, { runId });
    return value;
  }
});
var pause = mutation({
  args: { key: v2.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    const m = await ctx.db.query("meta").withIndex("by_key", (q) => q.eq("key", "hype")).first();
    if (m) await ctx.db.patch(m._id, { value: { ...m.value, running: false } });
  }
});
var resume = mutation({
  args: { key: v2.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    const m = await ctx.db.query("meta").withIndex("by_key", (q) => q.eq("key", "hype")).first();
    if (!m || m.value.finished) return;
    await ctx.db.patch(m._id, { value: { ...m.value, running: true, lastError: "", resumedAt: Date.now(), doneAtResume: m.value.done } });
    await ctx.scheduler.runAfter(0, internal.hype.step, { runId: m.value.runId });
  }
});
var dismiss = mutation({
  args: { key: v2.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    const m = await ctx.db.query("meta").withIndex("by_key", (q) => q.eq("key", "hype")).first();
    if (m && !m.value.running) await ctx.db.patch(m._id, { value: { ...m.value, dismissed: true } });
  }
});
var getJob = internalQuery({
  args: {},
  handler: async (ctx) => (await ctx.db.query("meta").withIndex("by_key", (q) => q.eq("key", "hype")).first())?.value ?? null
});
var nextBatch = internalQuery({
  args: { runId: v2.string(), limit: v2.number() },
  handler: async (ctx, { runId, limit }) => {
    const rows = await ctx.db.query("items").withIndex("by_status", (q) => q.eq("status", "active")).collect();
    return rows.filter((r) => r.hypeRun !== runId).sort((a, b) => (Number(b.data?.pop) || 0) - (Number(a.data?.pop) || 0)).slice(0, limit).map((r) => ({ id: r.itemId, data: r.data }));
  }
});
var record2 = internalMutation({
  args: { runId: v2.string(), id: v2.number(), pop: v2.optional(v2.number()), why: v2.optional(v2.array(v2.string())), failed: v2.optional(v2.string()) },
  handler: async (ctx, { runId, id: id2, pop, why, failed }) => {
    await snapshotSoon(ctx);
    const row = await ctx.db.query("items").withIndex("by_itemId", (q) => q.eq("itemId", id2)).first();
    const m = await ctx.db.query("meta").withIndex("by_key", (q) => q.eq("key", "hype")).first();
    if (!m || m.value.runId !== runId) return;
    let changed = 0;
    if (row) {
      const patch = { hypeRun: runId };
      if (!failed && pop !== void 0 && why) {
        const old = Number(row.data?.pop) || 0;
        if (Math.round(pop) !== old) changed = 1;
        const keep = (row.data?.why || []).filter((w) => w.startsWith("You saved it again on"));
        patch.data = { ...row.data, pop: Math.round(pop), why: [...why, ...keep] };
        patch.hypeAt = (/* @__PURE__ */ new Date()).toISOString();
      }
      await ctx.db.patch(row._id, patch);
    }
    const value = { ...m.value, done: m.value.done + 1, changed: m.value.changed + changed };
    if (failed) value.lastError = failed.slice(0, 200);
    await ctx.db.patch(m._id, { value });
  }
});
var setJob = internalMutation({
  args: { patch: v2.any() },
  handler: async (ctx, { patch }) => {
    const m = await ctx.db.query("meta").withIndex("by_key", (q) => q.eq("key", "hype")).first();
    if (m) await ctx.db.patch(m._id, { value: { ...m.value, ...patch } });
  }
});
async function githubScore(item, today) {
  const repo = repoOf(item.url);
  if (!repo) return null;
  const headers = { "User-Agent": "ai-toolbox-library", Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const r = await fetchWithTimeout(`https://api.github.com/repos/${repo}`, { headers }, 15e3);
  if (!r.ok) return null;
  const j = await r.json();
  const stars = Number(j.stargazers_count) || 0, forks = Number(j.forks_count) || 0;
  const lic = j.license?.spdx_id && j.license.spdx_id !== "NOASSERTION" ? j.license.spdx_id : "";
  const oldPop = Number(item.pop) || 40;
  const prevLine = (item.why || []).find((w) => STAR_LINE.test(w));
  const prev = prevLine ? Number((prevLine.match(/([\d,]+) GitHub stars/) || [])[1]?.replace(/,/g, "")) : 0;
  let pop = oldPop;
  if (prev > 0 && stars > 0) pop = oldPop + Math.max(-10, Math.min(10, Math.round(8 * Math.log10(stars / prev))));
  else if (!prevLine && stars > 0) {
    const est = Math.min(97, Math.max(10, Math.round(15 + 16 * Math.log10(Math.max(stars, 1)))));
    pop = Math.round((oldPop + est) / 2);
  }
  pop = Math.max(1, Math.min(100, pop));
  const why = (item.why || []).filter((w) => !STAR_LINE.test(w) && !w.startsWith("You saved it again on")).slice(0, 3);
  why.push(`${fmt(stars)} GitHub stars and ${fmt(forks)} forks when checked on ${today}${lic ? ` \u2014 ${lic} licence` : ""}`);
  return { pop, why };
}
var SYSTEM = `You re-score the "hype" of one AI tool / resource in a personal library: how big and talked-about it is RIGHT NOW. Use Google Search for current signals.

Scale 1-100: 90+ huge buzz; 70-89 widely talked about; 55-69 solid following; 40-54 niche but known; 25-39 small/local; under 25 very niche.
Weigh: official source (Anthropic, Google, OpenAI, Microsoft, Vercel...), how established the product is, recent news/launches, adoption and user numbers, GitHub stars if it's a repo, how widely it's discussed. Guides, posts and local (e.g. Hebrew/Israeli) content usually score lower than major products.
Keep the current score unless the evidence clearly says otherwise; small moves (\xB15) are normal, big jumps need clear reasons.

Return ONLY JSON: {"pop": <1-100>, "why": ["1-4 short reasons in the same style as the current ones"]}`;
async function geminiScore(item, today) {
  const card = { title: item.title, summary: item.summary, shelf: item.cat, kind: item.type, url: item.url, currentScore: item.pop, currentReasons: (item.why || []).filter((w) => !w.startsWith("You saved it again on")) };
  const res = await callGemini({
    model: MODELS.hype(),
    system: SYSTEM,
    turns: [{ role: "user", text: `Today is ${today}.

TOOL:
${JSON.stringify(card, null, 1)}` }],
    search: true,
    thinking: "low",
    maxTokens: 2048
  });
  const raw = parseJson(res.text);
  const pop = Math.max(1, Math.min(100, Math.round(Number(raw.pop))));
  if (!Number.isFinite(pop)) throw new Error("no score returned");
  const why = (Array.isArray(raw.why) ? raw.why : []).map((x) => String(x).trim()).filter(Boolean).slice(0, 4);
  return { pop, why: why.length ? why : (item.why || []).slice(0, 3) };
}
var step = internalAction({
  args: { runId: v2.string() },
  handler: async (ctx, { runId }) => {
    const job = await ctx.runQuery(internal.hype.getJob, {});
    if (!job || !job.running || job.runId !== runId) return;
    const batch = await ctx.runQuery(internal.hype.nextBatch, { runId, limit: PARALLEL });
    if (!batch.length) {
      await ctx.runMutation(internal.hype.setJob, { patch: { running: false, finished: true, finishedAt: Date.now() } });
      return;
    }
    const today = dateLabel(new Date(Date.now() - 5 * 3600 * 1e3));
    let fatal = "";
    await Promise.all(
      batch.map(async ({ id: id2, data: data2 }) => {
        try {
          const r = await githubScore(data2, today).catch(() => null) || await geminiScore(data2, today);
          await ctx.runMutation(internal.hype.record, { runId, id: id2, pop: r.pop, why: r.why });
        } catch (e) {
          const msg = String(e?.data ?? e?.message ?? e);
          if (isFatal(msg)) fatal = msg;
          else await ctx.runMutation(internal.hype.record, { runId, id: id2, failed: `${data2?.title || "#" + id2}: ${msg}` });
        }
      })
    );
    if (fatal) {
      await ctx.runMutation(internal.hype.setJob, { patch: { running: false, lastError: fatal.slice(0, 300) } });
      return;
    }
    await ctx.scheduler.runAfter(200, internal.hype.step, { runId });
  }
});
export {
  dismiss,
  getJob,
  nextBatch,
  pause,
  record2 as record,
  resume,
  setJob,
  start,
  step
};
