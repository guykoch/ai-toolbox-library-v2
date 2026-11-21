// Prompts tab: the prompt-library list and the prompts copied from open-source libraries.
import { query, mutation, internalQuery, internalMutation, internalAction } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { checkKey } from "./auth";
import { internal } from "./_generated/api";
import { PROMPT_LIB_SEED, BEST_FOR, PROMPT_LIB_ADDITIONS, PROMPT_LIB_ADDITIONS_VERSION } from "./promptLibSeed";
import { snapshotSoon } from "./snapshot";

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
    const bestForMissing = libs.filter((l: any) => !l.bestFor).length;
    const additionsPending = rows.length > 0 && (await getMeta(ctx, "plAdditions"))?.value !== PROMPT_LIB_ADDITIONS_VERSION;
    return { libs, bestForMissing, additionsPending, seeded: rows.length > 0 || !!seed, seed, prompts: libs.reduce((n, l) => n + (l.imp.state === "done" ? l.imp.count : 0), 0) };
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

// ---------- one-time additions shipped with the code (see PROMPT_LIB_ADDITIONS) ----------
const normLink = (u: string) => String(u || "").toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/+$/, "");
export const applyAdditions = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    if ((await getMeta(ctx, "plAdditions"))?.value === PROMPT_LIB_ADDITIONS_VERSION) return { added: 0 };
    const rows = await ctx.db.query("plibs").collect();
    const have = new Set(rows.flatMap((r) => [r.data?.repo, r.data?.links?.[0]?.[1]].filter(Boolean).map((u: string) => normLink(u))));
    let n = Math.max(28, ...rows.map((r) => Number(String(r.libId).replace(/\D/g, "")) || 0));
    const added: string[] = [];
    for (const card of PROMPT_LIB_ADDITIONS) {
      if (have.has(normLink(card.links[0][1]))) continue;
      const libId = "p" + ++n;
      await ctx.db.insert("plibs", { libId, data: { ...card, added: new Date().toISOString().slice(0, 10) }, imp: { state: "none", count: 0, note: "", at: "" } });
      added.push(libId);
    }
    await setMeta(ctx, "plAdditions", PROMPT_LIB_ADDITIONS_VERSION);
    if (added.length) {
      await ctx.scheduler.runAfter(0, internal.siteCheck.run, { libIds: added });
      await snapshotSoon(ctx);
    }
    return { added: added.length };
  },
});

// ---------- "Best for" on cards made before that field existed ----------
// The original 28 get the written lines; any others get one short Gemini call (at most every 10 minutes).
export const fillBestFor = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    let needAi = false;
    for (const lib of await ctx.db.query("plibs").collect()) {
      if (lib.deleting || lib.data?.bestFor) continue;
      if (BEST_FOR[lib.libId]) await ctx.db.patch(lib._id, { data: { ...lib.data, bestFor: BEST_FOR[lib.libId] } });
      else needAi = true;
    }
    if (needAi) {
      const m = await getMeta(ctx, "bestForAt");
      if (!m || Date.now() - (m.value || 0) > 10 * 60 * 1000) {
        await setMeta(ctx, "bestForAt", Date.now());
        await ctx.scheduler.runAfter(0, internal.promptAdd.bestForMissing, {});
      }
    }
    return { needAi };
  },
});

// A repo turned out to have an open license: remember it and start copying its prompts.
export const setRepo = internalMutation({
  args: { libId: v.string(), repo: v.string(), license: v.string() },
  handler: async (ctx, { libId, repo, license }) => {
    await snapshotSoon(ctx);
    const lib = await ctx.db.query("plibs").withIndex("by_libId", (q) => q.eq("libId", libId)).first();
    if (!lib || lib.deleting) return;
    const data = { ...lib.data, repo, license, kind: lib.data?.kind === "official" ? "official" : "open" };
    await ctx.db.patch(lib._id, { data });
    await startImport(ctx, { ...lib, data });
  },
});

export const missingBestFor = internalQuery({
  args: {},
  handler: async (ctx) => (await ctx.db.query("plibs").collect()).filter((r) => !r.deleting && !r.data?.bestFor).map((r) => ({ libId: r.libId, title: r.data?.title || "", summary: r.data?.summary || "", links: r.data?.links || [] })),
});

export const setBestFor = internalMutation({
  args: { libId: v.string(), bestFor: v.string() },
  handler: async (ctx, { libId, bestFor }) => {
    await snapshotSoon(ctx);
    const lib = await ctx.db.query("plibs").withIndex("by_libId", (q) => q.eq("libId", libId)).first();
    if (lib && !lib.data?.bestFor && bestFor) await ctx.db.patch(lib._id, { data: { ...lib.data, bestFor } });
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
    await snapshotSoon(ctx);
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
  if (lib.data?.repo) {
    await ctx.db.patch(lib._id, { imp: { state: "importing", count: 0, note: "Copying prompts…", at: nowIso(), run } });
    await ctx.scheduler.runAfter(0, internal.promptImport.run, { libId: lib.libId, repo: lib.data.repo, runId: run });
  } else {
    // Website library: copy it from the website (xyz).
    const old = await ctx.db.query("webjobs").withIndex("by_lib", (q: any) => q.eq("libId", lib.libId)).first();
    if (old) await ctx.db.delete(old._id);
    await ctx.db.patch(lib._id, { imp: { state: "importing", count: 0, note: "Looking for prompt pages…", at: nowIso(), run } });
    await ctx.scheduler.runAfter(0, internal.webcopy.discover, { libId: lib.libId, runId: run });
  }
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
  handler: async (ctx) => (await ctx.db.query("plibs").collect()).filter((r) => !r.deleting).map((r) => ({ libId: r.libId, title: r.data?.title || r.libId, links: r.data?.links || [], repo: r.data?.repo || "", summary: r.data?.summary || "", bestFor: r.data?.bestFor || "", imported: r.imp?.state === "done", sec: r.data?.sec || "" })),
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
    await snapshotSoon(ctx);
    checkKey(key);
    const lib = await ctx.db.query("plibs").withIndex("by_libId", (q) => q.eq("libId", libId)).first();
    if (!lib) return { ok: true };
    await ctx.db.patch(lib._id, { deleting: true });
    const job = await ctx.db.query("webjobs").withIndex("by_lib", (q) => q.eq("libId", libId)).first();
    if (job) { await ctx.db.delete(job._id); await ctx.scheduler.runAfter(0, internal.webjobs.kickNext, {}); }
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
    await snapshotSoon(ctx);
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
    if (!lib || lib.deleting) throw new ConvexError("That library is no longer in your list.");
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

// ---------- "My prompts": single prompts the user saves (from a post, screenshot or pasted text) ----------
export const MINE = "mine";
const mineData = () => ({
  title: "My prompts",
  summary: "Single prompts you saved yourself — from posts, screenshots or pasted text.",
  bestFor: "Your own keepers: one-off prompts you found and want to reuse.",
  sec: "mine",
  kind: "mine",
  license: "Your own copy",
  format: "Saved prompts",
  how: "Tap Browse prompts to read, copy or delete them. They also show up in Find a prompt and in Plan.",
  links: [] as [string, string][],
  added: nowIso().slice(0, 10),
});
const squash = (t: string) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export const addMine = internalMutation({
  args: { title: v.string(), desc: v.string(), text: v.string(), url: v.string() },
  handler: async (ctx, { title, desc, text, url }): Promise<{ status: "added" | "exists"; title: string; pid: number }> => {
    await snapshotSoon(ctx);
    let lib = await ctx.db.query("plibs").withIndex("by_libId", (q) => q.eq("libId", MINE)).first();
    if (lib && lib.deleting) throw new ConvexError("My prompts is being deleted — try again in a minute.");
    if (!lib) {
      await ctx.db.insert("plibs", { libId: MINE, data: mineData(), imp: { state: "done", count: 0, note: "", at: nowIso() } });
      lib = (await ctx.db.query("plibs").withIndex("by_libId", (q) => q.eq("libId", MINE)).first())!;
    }
    const have = await ctx.db.query("plText").withIndex("by_lib", (q) => q.eq("libId", MINE)).collect();
    const key = squash(text);
    const dup = have.find((r) => squash(r.text) === key);
    if (dup) {
      const ix = await ctx.db.query("plIndex").withIndex("by_pid", (q) => q.eq("pid", dup.pid)).first();
      return { status: "exists", title: ix?.title || title, pid: dup.pid };
    }
    const seqRow = await getMeta(ctx, "plSeq");
    const pid: number = (seqRow?.value || 0) + 1;
    await ctx.db.insert("plIndex", { libId: MINE, pid, title: title.slice(0, 300), desc: desc.slice(0, 400) });
    await ctx.db.insert("plText", { libId: MINE, pid, text, url });
    await setMeta(ctx, "plSeq", pid);
    await ctx.db.patch(lib._id, { imp: { state: "done", count: have.length + 1, note: "", at: nowIso() } });
    return { status: "added", title, pid };
  },
});

// Saves one prompt the page already read (the Add box found a single prompt).
export const saveMine = mutation({
  args: { key: v.string(), title: v.string(), desc: v.string(), text: v.string(), source: v.string() },
  handler: async (ctx, { key, title, desc, text, source }): Promise<{ status: "added" | "exists"; title: string; pid: number }> => {
    checkKey(key);
    const t = text.trim();
    if (t.length < 15) throw new ConvexError("I couldn’t read the prompt itself. Paste its text into the box.");
    const url = ((source.match(/https?:\/\/[^\s<>"')\]]+/) || [""])[0]).replace(/[.,;]+$/, "");
    return await ctx.runMutation(internal.promptLibs.addMine, { title: title.trim() || t.slice(0, 60), desc: desc.trim(), text: t.slice(0, 40000), url });
  },
});

// Deletes one of "My prompts".
export const removeMine = mutation({
  args: { key: v.string(), pid: v.number() },
  handler: async (ctx, { key, pid }) => {
    checkKey(key);
    await snapshotSoon(ctx);
    const ix = await ctx.db.query("plIndex").withIndex("by_pid", (q) => q.eq("pid", pid)).first();
    if (!ix || ix.libId !== MINE) throw new ConvexError("Only prompts you saved yourself can be deleted here.");
    await ctx.db.delete(ix._id);
    const tx = await ctx.db.query("plText").withIndex("by_pid", (q) => q.eq("pid", pid)).first();
    if (tx) await ctx.db.delete(tx._id);
    const lib = await ctx.db.query("plibs").withIndex("by_libId", (q) => q.eq("libId", MINE)).first();
    if (lib) await ctx.db.patch(lib._id, { imp: { state: "done", count: Math.max(0, (lib.imp?.count || 1) - 1), note: "", at: nowIso() } });
    return { ok: true };
  },
});
