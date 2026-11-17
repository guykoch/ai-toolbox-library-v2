import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { checkKey } from "./auth";
import { SEED_ITEMS, SEED_META } from "./seedData";
import { PREPARED, PREPARED_VERSION, PREPARED_NEW } from "./preparedData";

const SOCIAL = ["Facebook", "LinkedIn", "linkedin.com"];

// ---------- read ----------
export const list = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    const rows = await ctx.db.query("items").collect();
    const metaRows = await ctx.db.query("meta").collect();
    const meta: Record<string, any> = {};
    for (const m of metaRows) meta[m.key] = m.value;
    const activeRows = rows.filter((r) => r.status === "active");
    const active = activeRows.map((r) => r.data);
    const promptIds = (await ctx.db.query("prompts").collect()).map((p) => p.itemId);
    const promptSet = new Set(promptIds);
    const job = {
      ...(meta.pipeline || {}),
      total: activeRows.length,
      promptsDone: activeRows.filter((r) => promptSet.has(r.itemId)).length,
      researchTotal: activeRows.filter((r) => SOCIAL.includes(r.data?.host) || r.data?.savedFrom || r.enrichedAt).length,
      researchDone: activeRows.filter((r) => r.enrichedAt || r.data?.savedFrom).length,
      toolLinksFound: activeRows.filter((r) => r.data?.savedFrom).length,
    };
    delete meta.pipeline;
    const archived = rows
      .filter((r) => r.status === "archived")
      .map((r) => ({ ...r.data, archivedAt: r.archivedAt ?? "" }));
    const preparedPending = PREPARED.length > 0 && meta.prepared !== PREPARED_VERSION;
    delete meta.prepared;
    return { active, archived, meta, promptIds, job, preparedPending, preparedCount: PREPARED.length, seeded: rows.length > 0 || metaRows.length > 0 };
  },
});

// ---------- first-run import of the original library ----------
export const seedIfEmpty = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    const existing = await ctx.db.query("items").first();
    const existingMeta = await ctx.db.query("meta").first();
    if (existing || existingMeta) return { seeded: false };
    for (const it of SEED_ITEMS) {
      await ctx.db.insert("items", { itemId: it.id, status: "active", data: it });
    }
    for (const [k, val] of Object.entries(SEED_META)) {
      await ctx.db.insert("meta", { key: k, value: val });
    }
    return { seeded: true, count: SEED_ITEMS.length };
  },
});

// ---------- archive / restore / delete ----------
async function getRow(ctx: any, id: number) {
  const row = await ctx.db
    .query("items")
    .withIndex("by_itemId", (q: any) => q.eq("itemId", id))
    .first();
  if (!row) throw new ConvexError("That item no longer exists.");
  return row;
}

export const archive = mutation({
  args: { key: v.string(), id: v.number(), today: v.string() },
  handler: async (ctx, { key, id, today }) => {
    checkKey(key);
    const row = await getRow(ctx, id);
    await ctx.db.patch(row._id, { status: "archived", archivedAt: today });
  },
});

export const restore = mutation({
  args: { key: v.string(), id: v.number() },
  handler: async (ctx, { key, id }) => {
    checkKey(key);
    const row = await getRow(ctx, id);
    await ctx.db.patch(row._id, { status: "active", archivedAt: undefined });
  },
});

export const remove = mutation({
  args: { key: v.string(), id: v.number() },
  handler: async (ctx, { key, id }) => {
    checkKey(key);
    const row = await getRow(ctx, id);
    await ctx.db.delete(row._id);
    const saved = await ctx.db.query("prompts").withIndex("by_itemId", (q) => q.eq("itemId", id)).collect();
    for (const p of saved) await ctx.db.delete(p._id);
  },
});

// ---------- used by the "add from text" action ----------
export const allForIngest = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("items").collect();
    return rows.map((r) => ({ status: r.status, data: r.data }));
  },
});

export const insertItem = internalMutation({
  args: { data: v.any() },
  handler: async (ctx, { data }) => {
    // Pick the next free id at write time so two adds can never collide.
    const last = await ctx.db.query("items").withIndex("by_itemId").order("desc").first();
    const nextId = Math.max(last ? last.itemId : -1, 207) + 1;
    const item = { ...data, id: nextId };
    await ctx.db.insert("items", { itemId: nextId, status: "active", data: item });
    return item;
  },
});

export const markSavedAgain = internalMutation({
  args: { id: v.number(), date: v.string() },
  handler: async (ctx, { id, date }) => {
    const row = await getRow(ctx, id);
    const data = { ...row.data };
    data.again = date;
    const line = "You saved it again on " + date + " — a sign it kept circulating";
    data.why = [...(data.why || []).filter((w: string) => !w.startsWith("You saved it again on")), line];
    await ctx.db.patch(row._id, { data, status: "active", archivedAt: undefined });
    return { item: data, wasArchived: row.status === "archived" };
  },
});

// ---------- install prompts ----------
export const getPrompt = query({
  args: { key: v.string(), id: v.number() },
  handler: async (ctx, { key, id }) => {
    checkKey(key);
    return await ctx.db.query("prompts").withIndex("by_itemId", (q) => q.eq("itemId", id)).first();
  },
});

export const getItem = internalQuery({
  args: { id: v.number() },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.query("items").withIndex("by_itemId", (q) => q.eq("itemId", id)).first();
    return row ? row.data : null;
  },
});

export const savePrompt = internalMutation({
  args: { itemId: v.number(), text: v.string(), sources: v.array(v.object({ title: v.string(), url: v.string() })), model: v.string(), createdAt: v.string() },
  handler: async (ctx, args) => {
    const old = await ctx.db.query("prompts").withIndex("by_itemId", (q) => q.eq("itemId", args.itemId)).collect();
    for (const p of old) await ctx.db.delete(p._id);
    await ctx.db.insert("prompts", args);
  },
});

// Compact view of the active library for the "What would you like to do?" advisor.
export const activeForAdvisor = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("items").withIndex("by_status", (q) => q.eq("status", "active")).collect();
    return rows.map((r) => r.data);
  },
});

// ---------- background job helpers ----------
export const replaceData = internalMutation({
  args: { id: v.number(), data: v.any() },
  handler: async (ctx, { id, data }) => {
    const row = await getRow(ctx, id);
    await ctx.db.patch(row._id, { data: { ...data, id } });
  },
});

export const markEnriched = internalMutation({
  args: { id: v.number(), date: v.string(), note: v.string() },
  handler: async (ctx, { id, date, note }) => {
    const row = await getRow(ctx, id);
    await ctx.db.patch(row._id, { enrichedAt: date, enrichNote: note });
  },
});

export const bumpAttempts = internalMutation({
  args: { id: v.number() },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.query("items").withIndex("by_itemId", (q) => q.eq("itemId", id)).first();
    if (row) await ctx.db.patch(row._id, { attempts: (row.attempts ?? 0) + 1 });
  },
});

// Next items that still need research and/or an install prompt (highest hype first).
export const nextWork = internalQuery({
  args: { limit: v.number() },
  handler: async (ctx, { limit }) => {
    const rows = await ctx.db.query("items").withIndex("by_status", (q) => q.eq("status", "active")).collect();
    const done = new Set((await ctx.db.query("prompts").collect()).map((p) => p.itemId));
    return rows
      .filter((r) => (r.attempts ?? 0) < 2)
      .map((r) => ({
        id: r.itemId,
        pop: Number(r.data?.pop) || 0,
        needsResearch: SOCIAL.includes(r.data?.host) && !r.data?.savedFrom && !r.enrichedAt,
        needsPrompt: !done.has(r.itemId),
      }))
      .filter((w) => w.needsResearch || w.needsPrompt)
      .sort((a, b) => b.pop - a.pop)
      .slice(0, limit);
  },
});

export const getJob = internalQuery({
  args: {},
  handler: async (ctx) => {
    const row = await ctx.db.query("meta").withIndex("by_key", (q) => q.eq("key", "pipeline")).first();
    return row ? row.value : null;
  },
});

export const setJob = internalMutation({
  args: { patch: v.any() },
  handler: async (ctx, { patch }) => {
    const row = await ctx.db.query("meta").withIndex("by_key", (q) => q.eq("key", "pipeline")).first();
    if (row) await ctx.db.patch(row._id, { value: { ...row.value, ...patch } });
    else await ctx.db.insert("meta", { key: "pipeline", value: patch });
  },
});

// ---------- built-in research + install prompts (prepared ahead of time, no AI credits) ----------
const SOCIAL_HOST_RE = /facebook\.com|fb\.watch|linkedin\.com/i;
// GitHub links count as the same tool whatever the extra path (…/tree/main, …/blob/…).
const sameTool = (u: string) => {
  const gh = String(u || "").match(/github\.com\/([\w.-]+)\/([\w.-]+)/i);
  return gh ? ("github.com/" + gh[1] + "/" + gh[2].replace(/\.git$/, "")).toLowerCase() : normUrl(u);
};
const normUrl = (u: string) => String(u || "").replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/[?#].*$/, "").replace(/\/+$/, "").toLowerCase();

export const applyPrepared = mutation({
  args: { key: v.string(), from: v.number(), to: v.number(), today: v.string() },
  handler: async (ctx, { key, from, to, today }) => {
    checkKey(key);
    // Stop the paid background job — this replaces its work.
    const job = await ctx.db.query("meta").withIndex("by_key", (q) => q.eq("key", "pipeline")).first();
    if (job && job.value?.running) await ctx.db.patch(job._id, { value: { ...job.value, running: false } });

    const rows = await ctx.db.query("items").collect();
    const byId = new Map(rows.map((r) => [r.itemId, r]));
    const urlOwner = new Map<string, number>();
    for (const r of rows) if (r.data?.url) urlOwner.set(normUrl(r.data.url), r.itemId);
    const prompted = new Set((await ctx.db.query("prompts").collect()).map((p) => p.itemId));
    let switched = 0, prompts = 0;

    for (const p of PREPARED.slice(from, to)) {
      const row = byId.get(p.id);
      if (!row) continue;
      const e = p.enrich;
      if (e && !row.data?.savedFrom && SOCIAL_HOST_RE.test(String(row.data?.url || ""))) {
        if (e.decision === "tool" && e.url) {
          const owner = urlOwner.get(normUrl(e.url));
          if (owner === undefined || owner === p.id) {
            const next: any = { ...row.data, savedFrom: row.data.url, url: e.url, host: e.host, title: e.title || row.data.title, summary: e.summary || row.data.summary };
            if (e.type) next.type = e.type;
            if (e.os === true || e.os === false || e.os === "unknown") next.os = e.os;
            if (e.docs && normUrl(e.docs) !== normUrl(e.url)) next.docs = e.docs;
            if (e.install && e.install.length && !(row.data.install && row.data.install.length)) next.install = e.install;
            if (next.mentioned && normUrl(next.mentioned) === normUrl(e.url)) next.mentioned = "";
            if (e.whyExtra) next.why = [...(row.data.why || []).filter((w: string) => !/\d[\d,]* GitHub stars and/.test(w)), e.whyExtra];
            await ctx.db.patch(row._id, { data: next, enrichedAt: today, enrichNote: e.note || "" });
            urlOwner.set(normUrl(e.url), p.id);
            switched++;
          } else {
            await ctx.db.patch(row._id, { enrichedAt: today, enrichNote: `kept post: tool already has its own card (#${owner})` });
          }
        } else if (!row.enrichedAt) {
          await ctx.db.patch(row._id, { enrichedAt: today, enrichNote: "kept post: " + (e.note || "") });
        }
      }
      if (p.prompt && !prompted.has(p.id)) {
        await ctx.db.insert("prompts", { itemId: p.id, text: p.prompt, sources: p.sources || [], model: "Claude (prepared in advance)", createdAt: PREPARED_VERSION });
        prompted.add(p.id);
        prompts++;
      }
    }
    if (to >= PREPARED.length) {
      // Add new ready-made tools, unless the library already has them (any link form).
      const known = new Set<string>();
      for (const r of rows) for (const u of [r.data?.url, r.data?.mentioned, r.data?.docs, r.data?.savedFrom]) if (u) known.add(sameTool(u));
      let nextId = Math.max(207, ...rows.map((r) => r.itemId)) + 1;
      for (const n of PREPARED_NEW) {
        if (known.has(sameTool(n.card.url))) continue;
        const id = nextId++;
        await ctx.db.insert("items", { itemId: id, status: "active", data: { ...n.card, id } });
        if (!prompted.has(id)) await ctx.db.insert("prompts", { itemId: id, text: n.prompt, sources: [], model: "Claude (prepared in advance)", createdAt: n.card.date });
        known.add(sameTool(n.card.url));
      }
      const m = await ctx.db.query("meta").withIndex("by_key", (q) => q.eq("key", "prepared")).first();
      if (m) await ctx.db.patch(m._id, { value: PREPARED_VERSION });
      else await ctx.db.insert("meta", { key: "prepared", value: PREPARED_VERSION });
    }
    return { switched, prompts };
  },
});

// Light/dark choice, shared by all your devices.
export const setTheme = mutation({
  args: { key: v.string(), theme: v.union(v.literal("light"), v.literal("dark")) },
  handler: async (ctx, { key, theme }) => {
    checkKey(key);
    const row = await ctx.db.query("meta").withIndex("by_key", (q) => q.eq("key", "theme")).first();
    if (row) await ctx.db.patch(row._id, { value: theme });
    else await ctx.db.insert("meta", { key: "theme", value: theme });
  },
});
