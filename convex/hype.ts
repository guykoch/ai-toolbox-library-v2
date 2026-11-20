import { mutation, internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { checkKey } from "./auth";
import { callGemini, parseJson, MODELS } from "./llm";
import { fetchWithTimeout } from "./web";
import { snapshotSoon } from "./snapshot";

// ---------------------------------------------------------------------------
// "Update hype scores": re-checks every tool's buzz in the background.
//  • GitHub repos: free — fresh star/fork counts from GitHub; the score moves
//    with how much the stars grew since the last check.
//  • Everything else: one Gemini call with Google Search per tool.
// Tools checked in the last 24 hours are skipped, so pressing twice costs nothing.
// Stops by itself on credit/key problems.
// ---------------------------------------------------------------------------

const PARALLEL = 4;
const RECENT_MS = 24 * 3600 * 1000;
// The line that records a star count, e.g. "317,181 GitHub stars and 28,227 forks when checked on …"
// (not the generic "…so GitHub stars and forks drive its buzz").
const STAR_LINE = /\d[\d,]* GitHub stars and/;

function isFatal(msg: string) {
  return /quota|billing|prepay|credits are depleted|API key|API_KEY|PERMISSION_DENIED|not set in the Convex dashboard|exceeded/i.test(msg);
}
function fmt(n: number) {
  return n.toLocaleString("en-US");
}
function dateLabel(d: Date) {
  const M = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${d.getUTCDate()} ${M[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
const repoOf = (u: string) => {
  const m = String(u || "").match(/github\.com\/([\w.-]+)\/([\w.-]+)/i);
  return m && !["orgs", "topics", "search", "marketplace", "features", "apps"].includes(m[1].toLowerCase()) ? `${m[1]}/${m[2].replace(/\.git$/, "")}` : null;
};

// ---------- start / pause ----------
export const start = mutation({
  args: { key: v.string() },
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
      runId, running: true, finished: false, total: rows.length, done: skipped, skipped, changed: 0,
      repos, others: rows.length - skipped - repos, startedAt: now, resumedAt: now, doneAtResume: skipped, lastError: "", finishedAt: 0,
    };
    const m = await ctx.db.query("meta").withIndex("by_key", (q) => q.eq("key", "hype")).first();
    if (m) await ctx.db.patch(m._id, { value });
    else await ctx.db.insert("meta", { key: "hype", value });
    await ctx.scheduler.runAfter(0, internal.hype.step, { runId });
    return value;
  },
});

export const pause = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    const m = await ctx.db.query("meta").withIndex("by_key", (q) => q.eq("key", "hype")).first();
    if (m) await ctx.db.patch(m._id, { value: { ...m.value, running: false } });
  },
});

export const resume = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    const m = await ctx.db.query("meta").withIndex("by_key", (q) => q.eq("key", "hype")).first();
    if (!m || m.value.finished) return;
    await ctx.db.patch(m._id, { value: { ...m.value, running: true, lastError: "", resumedAt: Date.now(), doneAtResume: m.value.done } });
    await ctx.scheduler.runAfter(0, internal.hype.step, { runId: m.value.runId });
  },
});

export const dismiss = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    const m = await ctx.db.query("meta").withIndex("by_key", (q) => q.eq("key", "hype")).first();
    if (m && !m.value.running) await ctx.db.patch(m._id, { value: { ...m.value, dismissed: true } });
  },
});

// ---------- internals ----------
export const getJob = internalQuery({
  args: {},
  handler: async (ctx) => (await ctx.db.query("meta").withIndex("by_key", (q) => q.eq("key", "hype")).first())?.value ?? null,
});

export const nextBatch = internalQuery({
  args: { runId: v.string(), limit: v.number() },
  handler: async (ctx, { runId, limit }) => {
    const rows = await ctx.db.query("items").withIndex("by_status", (q) => q.eq("status", "active")).collect();
    return rows
      .filter((r) => r.hypeRun !== runId)
      .sort((a, b) => (Number(b.data?.pop) || 0) - (Number(a.data?.pop) || 0))
      .slice(0, limit)
      .map((r) => ({ id: r.itemId, data: r.data }));
  },
});

export const record = internalMutation({
  args: { runId: v.string(), id: v.number(), pop: v.optional(v.number()), why: v.optional(v.array(v.string())), failed: v.optional(v.string()) },
  handler: async (ctx, { runId, id, pop, why, failed }) => {
    await snapshotSoon(ctx);
    const row = await ctx.db.query("items").withIndex("by_itemId", (q) => q.eq("itemId", id)).first();
    const m = await ctx.db.query("meta").withIndex("by_key", (q) => q.eq("key", "hype")).first();
    if (!m || m.value.runId !== runId) return;
    let changed = 0;
    if (row) {
      const patch: any = { hypeRun: runId };
      if (!failed && pop !== undefined && why) {
        const old = Number(row.data?.pop) || 0;
        if (Math.round(pop) !== old) changed = 1;
        const keep = (row.data?.why || []).filter((w: string) => w.startsWith("You saved it again on"));
        patch.data = { ...row.data, pop: Math.round(pop), why: [...why, ...keep] };
        patch.hypeAt = new Date().toISOString();
      }
      await ctx.db.patch(row._id, patch);
    }
    const value = { ...m.value, done: m.value.done + 1, changed: m.value.changed + changed };
    if (failed) value.lastError = failed.slice(0, 200);
    await ctx.db.patch(m._id, { value });
  },
});

export const setJob = internalMutation({
  args: { patch: v.any() },
  handler: async (ctx, { patch }) => {
    const m = await ctx.db.query("meta").withIndex("by_key", (q) => q.eq("key", "hype")).first();
    if (m) await ctx.db.patch(m._id, { value: { ...m.value, ...patch } });
  },
});

// ---------- scoring ----------
async function githubScore(item: any, today: string): Promise<{ pop: number; why: string[] } | null> {
  const repo = repoOf(item.url);
  if (!repo) return null;
  const headers: Record<string, string> = { "User-Agent": "ai-toolbox-library", Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const r = await fetchWithTimeout(`https://api.github.com/repos/${repo}`, { headers }, 15000);
  if (!r.ok) return null; // e.g. GitHub's hourly limit without a token: fall back to Gemini
  const j: any = await r.json();
  const stars = Number(j.stargazers_count) || 0, forks = Number(j.forks_count) || 0;
  const lic = j.license?.spdx_id && j.license.spdx_id !== "NOASSERTION" ? j.license.spdx_id : "";
  const oldPop = Number(item.pop) || 40;
  // The score moves with star growth since the last recorded count (curated scores stay the anchor).
  const prevLine = (item.why || []).find((w: string) => STAR_LINE.test(w));
  const prev = prevLine ? Number((prevLine.match(/([\d,]+) GitHub stars/) || [])[1]?.replace(/,/g, "")) : 0;
  let pop = oldPop;
  if (prev > 0 && stars > 0) pop = oldPop + Math.max(-10, Math.min(10, Math.round(8 * Math.log10(stars / prev))));
  else if (!prevLine && stars > 0) {
    // No earlier count: blend the current score with a stars-based estimate.
    const est = Math.min(97, Math.max(10, Math.round(15 + 16 * Math.log10(Math.max(stars, 1)))));
    pop = Math.round((oldPop + est) / 2);
  }
  pop = Math.max(1, Math.min(100, pop));
  const why = (item.why || []).filter((w: string) => !STAR_LINE.test(w) && !w.startsWith("You saved it again on")).slice(0, 3);
  why.push(`${fmt(stars)} GitHub stars and ${fmt(forks)} forks when checked on ${today}${lic ? ` — ${lic} licence` : ""}`);
  return { pop, why };
}

const SYSTEM = `You re-score the "hype" of one AI tool / resource in a personal library: how big and talked-about it is RIGHT NOW. Use Google Search for current signals.

Scale 1-100: 90+ huge buzz; 70-89 widely talked about; 55-69 solid following; 40-54 niche but known; 25-39 small/local; under 25 very niche.
Weigh: official source (Anthropic, Google, OpenAI, Microsoft, Vercel...), how established the product is, recent news/launches, adoption and user numbers, GitHub stars if it's a repo, how widely it's discussed. Guides, posts and local (e.g. Hebrew/Israeli) content usually score lower than major products.
Keep the current score unless the evidence clearly says otherwise; small moves (±5) are normal, big jumps need clear reasons.

Return ONLY JSON: {"pop": <1-100>, "why": ["1-4 short reasons in the same style as the current ones"]}`;

async function geminiScore(item: any, today: string): Promise<{ pop: number; why: string[] }> {
  const card = { title: item.title, summary: item.summary, shelf: item.cat, kind: item.type, url: item.url, currentScore: item.pop, currentReasons: (item.why || []).filter((w: string) => !w.startsWith("You saved it again on")) };
  const res = await callGemini({
    model: MODELS.hype(),
    system: SYSTEM,
    turns: [{ role: "user", text: `Today is ${today}.\n\nTOOL:\n${JSON.stringify(card, null, 1)}` }],
    search: true,
    thinking: "low",
    maxTokens: 2048,
  });
  const raw = parseJson(res.text);
  const pop = Math.max(1, Math.min(100, Math.round(Number(raw.pop))));
  if (!Number.isFinite(pop)) throw new Error("no score returned");
  const why = (Array.isArray(raw.why) ? raw.why : []).map((x: any) => String(x).trim()).filter(Boolean).slice(0, 4);
  return { pop, why: why.length ? why : (item.why || []).slice(0, 3) };
}

export const step = internalAction({
  args: { runId: v.string() },
  handler: async (ctx, { runId }) => {
    const job: any = await ctx.runQuery(internal.hype.getJob, {});
    if (!job || !job.running || job.runId !== runId) return;
    const batch: { id: number; data: any }[] = await ctx.runQuery(internal.hype.nextBatch, { runId, limit: PARALLEL });
    if (!batch.length) {
      await ctx.runMutation(internal.hype.setJob, { patch: { running: false, finished: true, finishedAt: Date.now() } });
      return;
    }
    const today = dateLabel(new Date(Date.now() - 5 * 3600 * 1000));
    let fatal = "";
    await Promise.all(
      batch.map(async ({ id, data }) => {
        try {
          const r = (await githubScore(data, today).catch(() => null)) || (await geminiScore(data, today));
          await ctx.runMutation(internal.hype.record, { runId, id, pop: r.pop, why: r.why });
        } catch (e: any) {
          const msg = String(e?.data ?? e?.message ?? e);
          if (isFatal(msg)) fatal = msg;
          else await ctx.runMutation(internal.hype.record, { runId, id, failed: `${data?.title || "#" + id}: ${msg}` });
        }
      }),
    );
    if (fatal) {
      await ctx.runMutation(internal.hype.setJob, { patch: { running: false, lastError: fatal.slice(0, 300) } });
      return;
    }
    await ctx.scheduler.runAfter(200, internal.hype.step, { runId });
  },
});
