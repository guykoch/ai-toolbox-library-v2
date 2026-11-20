// xyz bookkeeping: the line of website libraries waiting to be copied, and each library's copy job.
// The copying itself happens in webcopy.ts.
import { internalMutation, internalQuery, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { checkKey } from "./auth";
import { snapshotSoon } from "./snapshot";

export const XYZ_VERSION = "xyz v1 (20 Nov 2026)";
const nowIso = () => new Date().toISOString();

async function getMeta(ctx: any, key: string) {
  return await ctx.db.query("meta").withIndex("by_key", (q: any) => q.eq("key", key)).first();
}
async function setMeta(ctx: any, key: string, value: any) {
  const m = await getMeta(ctx, key);
  if (m) await ctx.db.patch(m._id, { value });
  else await ctx.db.insert("meta", { key, value });
}
const libRow = (ctx: any, libId: string) => ctx.db.query("plibs").withIndex("by_libId", (q: any) => q.eq("libId", libId)).first();

// Website libraries: everything without an open-source repo whose prompts aren't copied yet.
const eligible = (r: any) => !r.deleting && !r.data?.repo && r.imp?.state !== "done" && r.imp?.state !== "importing";

// Put libraries in line to be copied, then start the next one if nothing is running.
export async function enqueue(ctx: any, libIds: string[]) {
  const m = await getMeta(ctx, "webQueue");
  const q: string[] = m?.value || [];
  for (const id of libIds) {
    const r = await libRow(ctx, id);
    if (!r || !eligible(r) || q.includes(id)) continue;
    q.push(id);
    await ctx.db.patch(r._id, { imp: { state: "queued", count: 0, note: "Waiting to be copied from the website…", at: nowIso() } });
  }
  await setMeta(ctx, "webQueue", q);
  await kick(ctx);
}

// Starts the next library in line, unless a website copy is already running.
export async function kick(ctx: any) {
  const running = (await ctx.db.query("webjobs").collect()).length > 0;
  if (running) return;
  const m = await getMeta(ctx, "webQueue");
  const q: string[] = m?.value || [];
  while (q.length) {
    const id = q.shift()!;
    const r = await libRow(ctx, id);
    if (!r || r.deleting || r.data?.repo) continue;
    const run = Math.random().toString(36).slice(2) + Date.now().toString(36);
    await ctx.db.patch(r._id, { imp: { state: "importing", count: 0, note: "Looking for prompt pages…", at: nowIso(), run } });
    await ctx.scheduler.runAfter(0, internal.webcopy.discover, { libId: id, runId: run });
    break;
  }
  await setMeta(ctx, "webQueue", q);
}

export const enqueueLibs = internalMutation({ args: { libIds: v.array(v.string()) }, handler: async (ctx, { libIds }) => { await enqueue(ctx, libIds); } });
export const kickNext = internalMutation({ args: {}, handler: async (ctx) => { await kick(ctx); } });

// Page load: the first time after xyz arrives, put every website library in line; afterwards just keep the line moving.
export const ensure = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    if ((await getMeta(ctx, "xyz"))?.value !== XYZ_VERSION) {
      await setMeta(ctx, "xyz", XYZ_VERSION);
      const rows = await ctx.db.query("plibs").collect();
      await enqueue(ctx, rows.filter(eligible).map((r: any) => r.libId));
      return { started: true };
    }
    // A job left behind by an interrupted run (no progress for 6 minutes) is cleared so the line keeps moving.
    for (const j of await ctx.db.query("webjobs").collect()) {
      const r = await libRow(ctx, j.libId);
      const stale = !r || r.imp?.run !== j.runId || Date.now() - Date.parse(r.imp?.at || 0) > 6 * 60 * 1000;
      if (stale) {
        await ctx.db.delete(j._id);
        if (r && r.imp?.state === "importing" && r.imp?.run === j.runId) await ctx.db.patch(r._id, { imp: { state: "failed", count: 0, note: "The copy was interrupted. Press Try again.", at: nowIso() } });
      }
    }
    await kick(ctx);
    return { started: false };
  },
});

// Monthly: copy website libraries again so they stay current.
export const resyncAll = internalMutation({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("plibs").collect();
    const ids: string[] = [];
    for (const r of rows) {
      if (r.deleting || r.data?.repo || r.data?.copiedFrom !== "website") continue;
      await ctx.db.patch(r._id, { imp: { ...(r.imp || {}), state: "none" } as any });
      ids.push(r.libId);
    }
    await enqueue(ctx, ids);
  },
});

// ---------- job storage ----------
export const getJob = internalQuery({
  args: { libId: v.string() },
  handler: async (ctx, { libId }) => await ctx.db.query("webjobs").withIndex("by_lib", (q) => q.eq("libId", libId)).first(),
});

export const saveJob = internalMutation({
  args: { job: v.any() },
  handler: async (ctx, { job }) => {
    const { _id, _creationTime, ...rest } = job;
    const cur = await ctx.db.query("webjobs").withIndex("by_lib", (q) => q.eq("libId", rest.libId)).first();
    if (cur) {
      if (cur.runId !== rest.runId) return false; // replaced by a newer run
      await ctx.db.patch(cur._id, rest);
    } else await ctx.db.insert("webjobs", rest);
    return true;
  },
});

export const libInfo = internalQuery({
  args: { libId: v.string() },
  handler: async (ctx, { libId }) => {
    const r = await libRow(ctx, libId);
    return r && !r.deleting ? { libId, links: (r.data?.links || []) as [string, string][], sec: r.data?.sec || "", run: r.imp?.run || "" } : null;
  },
});

// Finish: record the result, mark the library as copied from its website, start the next one.
export const finish = internalMutation({
  args: { libId: v.string(), runId: v.string(), count: v.number(), note: v.string() },
  handler: async (ctx, { libId, runId, count, note }) => {
    const job = await ctx.db.query("webjobs").withIndex("by_lib", (q) => q.eq("libId", libId)).first();
    if (job && job.runId === runId) await ctx.db.delete(job._id);
    const r = await libRow(ctx, libId);
    if (r && !r.deleting && r.imp?.run === runId) {
      const data = count ? { ...r.data, copiedFrom: "website", copiedAt: nowIso().slice(0, 10) } : r.data;
      await ctx.db.patch(r._id, { data, imp: { state: count ? "done" : "failed", count, note, at: nowIso(), run: runId } });
      await snapshotSoon(ctx);
    }
    await kick(ctx);
  },
});
