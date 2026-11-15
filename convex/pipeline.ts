import { mutation, internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { checkKey } from "./auth";
import { enrichItem } from "./enrich";
import { buildAndSavePrompt } from "./install";

// ---------------------------------------------------------------------------
// Background job (runs on Convex, even with the browser closed):
//   1. For cards that link to a Facebook/LinkedIn post, research the tool itself
//      and switch the card to the tool's own page (the post is kept as "Saved from").
//   2. Pre-generate the install prompt for every card.
// It works through the library a few items at a time, highest hype first, and
// stops by itself on billing/quota/key errors so it never burns money in a loop.
// ---------------------------------------------------------------------------

const PARALLEL = 3;

function isFatal(msg: string) {
  return /quota|billing|API key|API_KEY|permission|PERMISSION_DENIED|not set in the Convex dashboard|exceeded/i.test(msg);
}

export const start = mutation({
  args: { key: v.string(), today: v.string() },
  handler: async (ctx, { key, today }) => {
    checkKey(key);
    const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const row = await ctx.db.query("meta").withIndex("by_key", (q) => q.eq("key", "pipeline")).first();
    const value = { ...(row?.value || {}), running: true, runId, today, startedAt: today, lastError: "", finished: false };
    if (row) await ctx.db.patch(row._id, { value });
    else await ctx.db.insert("meta", { key: "pipeline", value });
    // Give items that failed before another chance when you press Resume.
    const failed = await ctx.db.query("items").collect();
    for (const r of failed) if ((r.attempts ?? 0) >= 2) await ctx.db.patch(r._id, { attempts: 0 });
    await ctx.scheduler.runAfter(0, internal.pipeline.step, { runId });
  },
});

export const pause = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    const row = await ctx.db.query("meta").withIndex("by_key", (q) => q.eq("key", "pipeline")).first();
    if (row) await ctx.db.patch(row._id, { value: { ...row.value, running: false } });
  },
});

export const step = internalAction({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    const job: any = await ctx.runQuery(internal.items.getJob, {});
    if (!job || !job.running || job.runId !== runId) return;
    const today: string = job.today;

    const work: { id: number; needsResearch: boolean; needsPrompt: boolean }[] = await ctx.runQuery(internal.items.nextWork, { limit: PARALLEL });
    if (!work.length) {
      await ctx.runMutation(internal.items.setJob, { patch: { running: false, finished: true, finishedAt: today, current: "" } });
      return;
    }
    await ctx.runMutation(internal.items.setJob, { patch: { current: work.map((w) => w.id).join(",") } });

    let fatal = "";
    await Promise.all(
      work.map(async (w) => {
        try {
          if (w.needsResearch) {
            const r = await enrichItem(ctx, w.id, today);
            await ctx.runMutation(internal.items.markEnriched, { id: w.id, date: today, note: r.note });
          }
          if (w.needsPrompt) await buildAndSavePrompt(ctx, w.id, today, "high");
        } catch (e: any) {
          const msg = String(e?.data ?? e?.message ?? e);
          if (isFatal(msg)) fatal = msg;
          else {
            await ctx.runMutation(internal.items.bumpAttempts, { id: w.id });
            await ctx.runMutation(internal.items.setJob, { patch: { lastError: `#${w.id}: ${msg.slice(0, 200)}` } });
          }
        }
      }),
    );

    if (fatal) {
      await ctx.runMutation(internal.items.setJob, { patch: { running: false, lastError: fatal.slice(0, 300), current: "" } });
      return;
    }
    await ctx.scheduler.runAfter(500, internal.pipeline.step, { runId });
  },
});

// A card you just added gets its install prompt right away (no need to start the job).
export const promptForNew = internalAction({
  args: { id: v.number(), today: v.string() },
  handler: async (ctx, { id, today }) => {
    try {
      await buildAndSavePrompt(ctx, id, today, "high");
    } catch (e: any) {
      await ctx.runMutation(internal.items.bumpAttempts, { id });
      await ctx.runMutation(internal.items.setJob, { patch: { lastError: `#${id}: ${String(e?.data ?? e?.message ?? e).slice(0, 200)}` } });
    }
  },
});
