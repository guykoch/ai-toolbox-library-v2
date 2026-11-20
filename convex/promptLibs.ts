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
    for (const l of libs) if (l.repo && !l.imported) await ctx.scheduler.runAfter(0, internal.promptImport.run, { libId: l.libId, repo: l.repo });
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
export type PromptRow = { libId: string; title: string; desc: string; text: string; url: string };

// Sends rows to the database in pieces small enough for one mutation.
export async function addInBatches(ctx: any, rows: PromptRow[]) {
  let batch: PromptRow[] = [], size = 0;
  for (const r of rows) {
    const s = r.text.length + r.title.length + r.desc.length + r.url.length + 100;
    if (batch.length && (size + s > 900_000 || batch.length >= 300)) {
      await ctx.runMutation(internal.promptLibs.addPrompts, { rows: batch });
      batch = []; size = 0;
    }
    batch.push(r); size += s;
  }
  if (batch.length) await ctx.runMutation(internal.promptLibs.addPrompts, { rows: batch });
}

export const addPrompts = internalMutation({
  args: { rows: v.array(v.object({ libId: v.string(), title: v.string(), desc: v.string(), text: v.string(), url: v.string() })) },
  handler: async (ctx, { rows }) => {
    const seqRow = await getMeta(ctx, "plSeq");
    let pid: number = seqRow?.value || 0;
    const alive = new Map<string, boolean>();
    for (const r of rows) {
      if (!alive.has(r.libId)) {
        const lib = await ctx.db.query("plibs").withIndex("by_libId", (q) => q.eq("libId", r.libId)).first();
        alive.set(r.libId, !!lib && !lib.deleting);
      }
      if (!alive.get(r.libId)) continue; // library was deleted meanwhile
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
  args: { libId: v.string(), state: v.string(), count: v.number(), note: v.string() },
  handler: async (ctx, { libId, state, count, note }) => {
    const lib = await ctx.db.query("plibs").withIndex("by_libId", (q) => q.eq("libId", libId)).first();
    if (lib && !lib.deleting) await ctx.db.patch(lib._id, { imp: { state, count, note, at: nowIso() } });
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
    await ctx.db.insert("plibs", {
      libId,
      data,
      imp: importing ? { state: "importing", count: 0, note: "Copying prompts…", at: nowIso() } : { state: "none", count: 0, note: "", at: "" },
    });
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
    if (lib.imp?.state === "importing") return { ok: true };
    await ctx.db.patch(lib._id, { imp: { state: "importing", count: 0, note: "Copying prompts…", at: nowIso() } });
    await ctx.scheduler.runAfter(0, internal.promptImport.run, { libId, repo: lib.data.repo });
    return { ok: true };
  },
});

export const clearPrompts = internalMutation({
  args: { libId: v.string() },
  handler: async (ctx, { libId }) => {
    const idx = await ctx.db.query("plIndex").withIndex("by_lib", (q) => q.eq("libId", libId)).take(400);
    for (const r of idx) await ctx.db.delete(r._id);
    const txt = await ctx.db.query("plText").withIndex("by_lib", (q) => q.eq("libId", libId)).take(200);
    for (const r of txt) await ctx.db.delete(r._id);
    return idx.length + txt.length;
  },
});
