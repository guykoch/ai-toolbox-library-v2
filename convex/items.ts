import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { checkKey } from "./auth";
import { SEED_ITEMS, SEED_META } from "./seedData";

// ---------- read ----------
export const list = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    const rows = await ctx.db.query("items").collect();
    const metaRows = await ctx.db.query("meta").collect();
    const meta: Record<string, any> = {};
    for (const m of metaRows) meta[m.key] = m.value;
    const active = rows.filter((r) => r.status === "active").map((r) => r.data);
    const archived = rows
      .filter((r) => r.status === "archived")
      .map((r) => ({ ...r.data, archivedAt: r.archivedAt ?? "" }));
    return { active, archived, meta, seeded: rows.length > 0 || metaRows.length > 0 };
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
