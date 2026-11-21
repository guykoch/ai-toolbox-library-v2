// stub:server
var id = (d) => d;
var query = id;
var mutation = id;
var internalQuery = id;
var internalMutation = id;
var internalAction = id;

// convex/webjobs.ts
import { v as v2 } from "convex/values";

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

// convex/webjobs.ts
var XYZ_VERSION = "xyz v1 (20 Nov 2026)";
var nowIso = () => (/* @__PURE__ */ new Date()).toISOString();
async function getMeta(ctx, key) {
  return await ctx.db.query("meta").withIndex("by_key", (q) => q.eq("key", key)).first();
}
async function setMeta(ctx, key, value) {
  const m = await getMeta(ctx, key);
  if (m) await ctx.db.patch(m._id, { value });
  else await ctx.db.insert("meta", { key, value });
}
var libRow = (ctx, libId) => ctx.db.query("plibs").withIndex("by_libId", (q) => q.eq("libId", libId)).first();
var eligible = (r) => !r.deleting && !r.data?.repo && r.imp?.state !== "done" && r.imp?.state !== "importing";
async function enqueue(ctx, libIds) {
  const m = await getMeta(ctx, "webQueue");
  const q = m?.value || [];
  for (const id2 of libIds) {
    const r = await libRow(ctx, id2);
    if (!r || !eligible(r) || q.includes(id2)) continue;
    q.push(id2);
    await ctx.db.patch(r._id, { imp: { state: "queued", count: 0, note: "Waiting to be copied from the website\u2026", at: nowIso() } });
  }
  await setMeta(ctx, "webQueue", q);
  await kick(ctx);
}
async function kick(ctx) {
  const running = (await ctx.db.query("webjobs").collect()).length > 0;
  if (running) return;
  const m = await getMeta(ctx, "webQueue");
  const q = m?.value || [];
  while (q.length) {
    const id2 = q.shift();
    const r = await libRow(ctx, id2);
    if (!r || r.deleting || r.data?.repo) continue;
    const run = Math.random().toString(36).slice(2) + Date.now().toString(36);
    await ctx.db.patch(r._id, { imp: { state: "importing", count: 0, note: "Looking for prompt pages\u2026", at: nowIso(), run } });
    await ctx.scheduler.runAfter(0, internal.webcopy.discover, { libId: id2, runId: run });
    break;
  }
  await setMeta(ctx, "webQueue", q);
}
var enqueueLibs = internalMutation({ args: { libIds: v2.array(v2.string()) }, handler: async (ctx, { libIds }) => {
  await enqueue(ctx, libIds);
} });
var kickNext = internalMutation({ args: {}, handler: async (ctx) => {
  await kick(ctx);
} });
var ensure2 = mutation({
  args: { key: v2.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    if ((await getMeta(ctx, "xyz"))?.value !== XYZ_VERSION) {
      await setMeta(ctx, "xyz", XYZ_VERSION);
      const rows = await ctx.db.query("plibs").collect();
      await enqueue(ctx, rows.filter(eligible).map((r) => r.libId));
      return { started: true };
    }
    for (const j of await ctx.db.query("webjobs").collect()) {
      const r = await libRow(ctx, j.libId);
      const stale = !r || r.imp?.run !== j.runId || Date.now() - Date.parse(r.imp?.at || 0) > 6 * 60 * 1e3;
      if (stale) {
        await ctx.db.delete(j._id);
        if (r && r.imp?.state === "importing" && r.imp?.run === j.runId) await ctx.db.patch(r._id, { imp: { state: "failed", count: 0, note: "The copy was interrupted. Press Try again.", at: nowIso() } });
      }
    }
    await kick(ctx);
    return { started: false };
  }
});
var resyncAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("plibs").collect();
    const ids = [];
    for (const r of rows) {
      if (r.deleting || r.data?.repo || r.data?.copiedFrom !== "website") continue;
      await ctx.db.patch(r._id, { imp: { ...r.imp || {}, state: "none" } });
      ids.push(r.libId);
    }
    await enqueue(ctx, ids);
  }
});
var getJob = internalQuery({
  args: { libId: v2.string() },
  handler: async (ctx, { libId }) => await ctx.db.query("webjobs").withIndex("by_lib", (q) => q.eq("libId", libId)).first()
});
var saveJob = internalMutation({
  args: { job: v2.any() },
  handler: async (ctx, { job }) => {
    const { _id, _creationTime, ...rest } = job;
    const cur = await ctx.db.query("webjobs").withIndex("by_lib", (q) => q.eq("libId", rest.libId)).first();
    if (cur) {
      if (cur.runId !== rest.runId) return false;
      await ctx.db.patch(cur._id, rest);
    } else await ctx.db.insert("webjobs", rest);
    return true;
  }
});
var libInfo = internalQuery({
  args: { libId: v2.string() },
  handler: async (ctx, { libId }) => {
    const r = await libRow(ctx, libId);
    return r && !r.deleting ? { libId, links: r.data?.links || [], sec: r.data?.sec || "", run: r.imp?.run || "" } : null;
  }
});
var finish = internalMutation({
  args: { libId: v2.string(), runId: v2.string(), count: v2.number(), note: v2.string() },
  handler: async (ctx, { libId, runId, count, note }) => {
    const job = await ctx.db.query("webjobs").withIndex("by_lib", (q) => q.eq("libId", libId)).first();
    if (job && job.runId === runId) await ctx.db.delete(job._id);
    const r = await libRow(ctx, libId);
    if (r && !r.deleting && r.imp?.run === runId) {
      const data2 = count ? { ...r.data, copiedFrom: "website", copiedAt: nowIso().slice(0, 10) } : r.data;
      await ctx.db.patch(r._id, { data: data2, imp: { state: count ? "done" : "failed", count, note, at: nowIso(), run: runId } });
      await snapshotSoon(ctx);
    }
    await kick(ctx);
  }
});
export {
  XYZ_VERSION,
  enqueue,
  enqueueLibs,
  ensure2 as ensure,
  finish,
  getJob,
  kick,
  kickNext,
  libInfo,
  resyncAll,
  saveJob
};
