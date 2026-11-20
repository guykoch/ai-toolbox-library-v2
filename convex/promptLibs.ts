// Prompts tab: the prompt-library list and the prompts copied from open-source libraries.
import { query, mutation, internalQuery, internalMutation, internalAction } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { checkKey } from "./auth";
import { internal } from "./_generated/api";
import { PROMPT_LIB_SEED } from "./promptLibSeed";

const nowIso = () => new Date().toISOString();

async function getMeta(ctx: any, key: string) {
  return await ctx.db.query("meta").withIndex("by_key", (q: any) => q.eq("key", key)).first();
}
async function setMeta(ctx: any, key: string, value: any) {
  const m = await getMeta(ctx, key);
  if (m) await ctx.db.patch(m._id, { value });
  else await ctx.db.insert("meta", { key, value });
}

// ---------- the list ----------
export const list = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    const rows = await ctx.db.query("plibs").collect();
    const seed = (await getMeta(ctx, "plseed"))?.value || null;
    const libs = rows
      .filter((r) => !r.deleting)
      .map((r) => ({ ...r.data, id: r.libId, imp: r.imp || { state: "none", count: 0, note: "", at: "" } }));
    return { libs, seeded: rows.length > 0 || !!seed, seed, prompts: libs.reduce((n, l) => n + (l.imp.state === "done" ? l.imp.count : 0), 0) };
  },
});

// First run: add the original libraries, then copy their prompts from their GitHub repos into the database.
export const ensureSeeded = mutation({
  args: { key: v.string(), origin: v.string() },
  handler: async (ctx, { key, origin }) => {
    checkKey(key);
    if (!/^https?:\/\/[\w.-]+(:\d+)?$/.test(origin)) throw new ConvexError("Bad site address.");
    if (await getMeta(ctx, "plseed")) return { started: false };
    if ((await ctx.db.query("plibs").first()) === null) {
      for (const lib of PROMPT_LIB_SEED) {
        const { id, ...data } = lib;
        await ctx.db.insert("plibs", {
          libId: id,
          data,
          imp: lib.repo ? { state: "importing", count: 0, note: "Copying prompts…", at: nowIso() } : { state: "none", count: 0, note: "", at: "" },
        });
      }
    }
    await setMeta(ctx, "plseed", { origin, shard: 0, shards: 0, finished: false, startedAt: nowIso() });
    await ctx.scheduler.runAfter(0, internal.promptLibs.seedStep, { origin, shard: 0 });
    return { started: true };
  },
});

// Copies each seed library's prompts straight from its GitHub repo (same importer as newly added libraries).
// Older deploys shipped the prompts as files in /pl; if those are gone, this path is used instead.
export const seedStep = internalAction({
  args: { origin: v.string(), shard: v.number() },
  handler: async (ctx) => {
    const libs = (await ctx.runQuery(internal.promptLibs.libNames, {})) as { libId: string; repo: string; imported: boolean }[];
    for (const l of libs) if (l.repo && !l.imported) await ctx.runMutation(internal.promptLibs.startImportFor, { libId: l.libId });
    await ctx.runMutation(internal.promptLibs.seedProgress, { shard: 0, shards: 0, finished: true });
  },
});

export const seedProgress = internalMutation({
  args: { shard: v.number(), shards: v.number(), finished: v.optional(v.boolean()) },
  handler: async (ctx, a) => {
    const m = await getMeta(ctx, "plseed");
    await setMeta(ctx, "plseed", { ...(m?.value || {}), shard: a.shard, shards: a.shards, finished: !!a.finished, ...(a.finished ? { finishedAt: nowIso() } : {}) });
  },
});

// ---------- storing prompts ----------
export const addPrompts = internalMutation({
  args: { rows: v.array(v.object({ libId: v.string(), title: v.string(), desc: v.string(), text: v.string(), url: v.string() })), runId: v.optional(v.string()) },
  handler: async (ctx, { rows, runId }) => {
    const seqRow = await getMeta(ctx, "plSeq");
    let pid: number = seqRow?.value || 0;
    const alive = new Map<string, boolean>();
    for (const r of rows) {
      if (!alive.has(r.libId)) {
        const lib = await ctx.db.query("plibs").withIndex("by_libId", (q) => q.eq("libId", r.libId)).first();
        alive.set(r.libId, !!lib && !lib.deleting && (!runId || lib.imp?.run === runId));
      }
      if (!alive.get(r.libId)) continue; // library was deleted meanwhile, or this copy job was replaced
      pid++;
      await ctx.db.insert("plIndex", { libId: r.libId, pid, title: r.title.slice(0, 300), desc: r.desc.slice(0, 400) });
      await ctx.db.insert("plText", { libId: r.libId, pid, text: r.text, url: r.url });
    }
    await setMeta(ctx, "plSeq", pid);
  },
});

export const countFor = internalQuery({
  args: { libId: v.string() },
  handler: async (ctx, { libId }) => (await ctx.db.query("plIndex").withIndex("by_lib", (q) => q.eq("libId", libId)).collect()).length,
});

export const setImp = internalMutation({
  args: { libId: v.string(), state: v.string(), count: v.number(), note: v.string(), runId: v.optional(v.string()) },
  handler: async (ctx, { libId, state, count, note, runId }) => {
    const lib = await ctx.db.query("plibs").withIndex("by_libId", (q) => q.eq("libId", libId)).first();
    if (!lib || lib.deleting) return;
    if (runId && lib.imp?.run !== runId) return; // an old copy job finishing late: ignore it
    await ctx.db.patch(lib._id, { imp: { state, count, note, at: nowIso(), ...(lib.imp?.run ? { run: lib.imp.run } : {}) } });
  },
});

// Progress note while copying (also proves the job is alive).
export const progress = internalMutation({
  args: { libId: v.string(), runId: v.optional(v.string()), note: v.string() },
  handler: async (ctx, { libId, runId, note }) => {
    const lib = await ctx.db.query("plibs").withIndex("by_libId", (q) => q.eq("libId", libId)).first();
    if (!lib || lib.deleting || lib.imp?.state !== "importing" || (runId && lib.imp?.run !== runId)) return;
    await ctx.db.patch(lib._id, { imp: { ...lib.imp, note, at: nowIso() } });
  },
});

// Starts (or restarts) copying one library's prompts. Each start gets a new job id.
async function startImport(ctx: any, lib: any) {
  const run = Math.random().toString(36).slice(2) + Date.now().toString(36);
  await ctx.db.patch(lib._id, { imp: { state: "importing", count: 0, note: "Copying prompts…", at: nowIso(), run } });
  await ctx.scheduler.runAfter(0, internal.promptImport.run, { libId: lib.libId, repo: lib.data.repo, runId: run });
}
export const startImportFor = internalMutation({
  args: { libId: v.string() },
  handler: async (ctx, { libId }) => {
    const lib = await ctx.db.query("plibs").withIndex("by_libId", (q) => q.eq("libId", libId)).first();
    if (lib && !lib.deleting && lib.data?.repo) await startImport(ctx, lib);
  },
});

// A live copy job reports progress every few seconds; one silent for 4 minutes was interrupted: restart it.
// (Restarting is safe: the old job's writes are ignored because it no longer holds the library's job id.)
const STALE_MS = 4 * 60 * 1000;
const isStale = (imp: any) => imp?.state === "importing" && Date.now() - Date.parse(imp.at || 0) > STALE_MS;
export const resumeStuck = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    let n = 0;
    for (const lib of await ctx.db.query("plibs").collect()) {
      if (!lib.deleting && lib.data?.repo && isStale(lib.imp)) { await startImport(ctx, lib); n++; }
    }
    const m = await getMeta(ctx, "plseed");
    if (m && !m.value?.finished && Date.now() - Date.parse(m.value?.startedAt || 0) > STALE_MS) await setMeta(ctx, "plseed", { ...m.value, finished: true, finishedAt: nowIso() });
    return { restarted: n };
  },
});

// ---------- reading for the finder ----------
export const indexPage = internalQuery({
  args: { cursor: v.union(v.string(), v.null()) },
  handler: async (ctx, { cursor }) => {
    const page = await ctx.db.query("plIndex").paginate({ numItems: 3000, cursor });
    return { rows: page.page.map((r) => ({ pid: r.pid, libId: r.libId, title: r.title, desc: r.desc })), cursor: page.continueCursor, done: page.isDone };
  },
});

export const libNames = internalQuery({
  args: {},
  handler: async (ctx) => (await ctx.db.query("plibs").collect()).filter((r) => !r.deleting).map((r) => ({ libId: r.libId, title: r.data?.title || r.libId, links: r.data?.links || [], repo: r.data?.repo || "", summary: r.data?.summary || "", imported: r.imp?.state === "done" })),
});

// Titles (and one-line descriptions) of one library's prompts, for the "Browse prompts" pop-up.
export const titles = query({
  args: { key: v.string(), libId: v.string() },
  handler: async (ctx, { key, libId }) => {
    checkKey(key);
    const rows = await ctx.db.query("plIndex").withIndex("by_lib", (q) => q.eq("libId", libId)).collect();
    return rows.map((r) => ({ pid: r.pid, title: r.title, desc: r.desc }));
  },
});

export const promptText = query({
  args: { key: v.string(), pid: v.number() },
  handler: async (ctx, { key, pid }) => {
    checkKey(key);
    const t = await ctx.db.query("plText").withIndex("by_pid", (q) => q.eq("pid", pid)).first();
    if (!t) throw new ConvexError("That prompt is no longer in the app.");
    return { text: t.text, url: t.url };
  },
});

// ---------- deleting a library (and its prompts) ----------
export const remove = mutation({
  args: { key: v.string(), libId: v.string() },
  handler: async (ctx, { key, libId }) => {
    checkKey(key);
    const lib = await ctx.db.query("plibs").withIndex("by_libId", (q) => q.eq("libId", libId)).first();
    if (!lib) return { ok: true };
    await ctx.db.patch(lib._id, { deleting: true });
    await ctx.scheduler.runAfter(0, internal.promptLibs.purge, { libId });
    return { ok: true };
  },
});

export const purge = internalMutation({
  args: { libId: v.string() },
  handler: async (ctx, { libId }) => {
    const idx = await ctx.db.query("plIndex").withIndex("by_lib", (q) => q.eq("libId", libId)).take(400);
    for (const r of idx) await ctx.db.delete(r._id);
    const txt = await ctx.db.query("plText").withIndex("by_lib", (q) => q.eq("libId", libId)).take(200);
    for (const r of txt) await ctx.db.delete(r._id);
    if (idx.length || txt.length) {
      await ctx.scheduler.runAfter(0, internal.promptLibs.purge, { libId });
      return;
    }
    const lib = await ctx.db.query("plibs").withIndex("by_libId", (q) => q.eq("libId", libId)).first();
    if (lib) await ctx.db.delete(lib._id);
  },
});

// ---------- adding a library (used by promptAdd.ts) ----------
export const insertLib = internalMutation({
  args: { data: v.any(), importing: v.boolean() },
  handler: async (ctx, { data, importing }) => {
    const rows = await ctx.db.query("plibs").collect();
    const n = Math.max(28, ...rows.map((r) => Number(String(r.libId).replace(/\D/g, "")) || 0)) + 1;
    const libId = "p" + n;
    const id = await ctx.db.insert("plibs", { libId, data, imp: { state: "none", count: 0, note: "", at: "" } });
    if (importing) await startImport(ctx, { _id: id, libId, data });
    return libId;
  },
});

// Re-try copying prompts for a library (e.g. after a failure).
export const reimport = mutation({
  args: { key: v.string(), libId: v.string() },
  handler: async (ctx, { key, libId }) => {
    checkKey(key);
    const lib = await ctx.db.query("plibs").withIndex("by_libId", (q) => q.eq("libId", libId)).first();
    if (!lib || lib.deleting || !lib.data?.repo) throw new ConvexError("This library has no open-source repo to copy prompts from.");
    if (lib.imp?.state === "importing" && !isStale(lib.imp)) return { ok: true };
    await startImport(ctx, lib);
    return { ok: true };
  },
});

export const clearPrompts = internalMutation({
  args: { libId: v.string(), runId: v.optional(v.string()) },
  handler: async (ctx, { libId, runId }) => {
    if (runId) {
      const lib = await ctx.db.query("plibs").withIndex("by_libId", (q) => q.eq("libId", libId)).first();
      if (!lib || lib.imp?.run !== runId) return 0; // replaced by a newer copy job
    }
    const idx = await ctx.db.query("plIndex").withIndex("by_lib", (q) => q.eq("libId", libId)).take(400);
    for (const r of idx) await ctx.db.delete(r._id);
    const txt = await ctx.db.query("plText").withIndex("by_lib", (q) => q.eq("libId", libId)).take(200);
    for (const r of txt) await ctx.db.delete(r._id);
    return idx.length + txt.length;
  },
});
