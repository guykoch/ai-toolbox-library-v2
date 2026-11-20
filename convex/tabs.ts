// Rules / Agents / Automations tabs: the cards, their copied files, adding, deleting.
// Same idea as the Prompts tab (promptLibs.ts), kept separate so prompt search and website copying stay untouched.
import { query, mutation, internalQuery, internalMutation } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { checkKey } from "./auth";
import { internal } from "./_generated/api";
import { snapshotSoon } from "./snapshot";
import { TAB_SEED, TAB_SEED_VERSION } from "./tabSeed";

export const TABS = ["rules", "agents", "autos"] as const;
const PREFIX: Record<string, string> = { rules: "r", agents: "a", autos: "w" };
const nowIso = () => new Date().toISOString();
const NONE = { state: "none", count: 0, note: "", at: "" };
const normLink = (u: string) => String(u || "").toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/+$/, "");

async function getMeta(ctx: any, key: string) {
  return await ctx.db.query("meta").withIndex("by_key", (q: any) => q.eq("key", key)).first();
}
async function setMeta(ctx: any, key: string, value: any) {
  const m = await getMeta(ctx, key);
  if (m) await ctx.db.patch(m._id, { value });
  else await ctx.db.insert("meta", { key, value });
}
async function byCid(ctx: any, cid: string) {
  return await ctx.db.query("tcards").withIndex("by_cid", (q: any) => q.eq("cid", cid)).first();
}
async function nextCid(ctx: any, tab: string) {
  const rows = await ctx.db.query("tcards").withIndex("by_tab", (q: any) => q.eq("tab", tab)).collect();
  return PREFIX[tab] + (Math.max(0, ...rows.map((r: any) => Number(String(r.cid).replace(/\D/g, "")) || 0)) + 1);
}

// ---------- the lists (all three tabs in one call) ----------
export const list = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    const rows = (await ctx.db.query("tcards").collect()).filter((r) => !r.deleting);
    const out: Record<string, any[]> = { rules: [], agents: [], autos: [] };
    for (const r of rows) (out[r.tab] ||= []).push({ ...r.data, id: r.cid, tab: r.tab, imp: r.imp || NONE });
    const seeded = (await getMeta(ctx, "tabSeed"))?.value === TAB_SEED_VERSION;
    return { ...out, seeded };
  },
});

// First visit (and after a code update that adds starter cards): add the starter cards once,
// skipping any already there or deleted by the user before.
export const ensureSeeded = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    if ((await getMeta(ctx, "tabSeed"))?.value === TAB_SEED_VERSION) return { added: 0 };
    const rows = await ctx.db.query("tcards").collect();
    const have = new Set(rows.map((r) => r.tab + "|" + normLink(r.data?.links?.[0]?.[1])));
    const gone = new Set<string>((await getMeta(ctx, "tabGone"))?.value || []);
    let added = 0;
    for (const card of TAB_SEED) {
      const k = card.tab + "|" + normLink(card.links[0][1]);
      if (have.has(k) || gone.has(k)) continue;
      const { tab, ...data } = card;
      const cid = await nextCid(ctx, tab);
      const id = await ctx.db.insert("tcards", { cid, tab, data: { ...data, added: nowIso().slice(0, 10) }, imp: NONE });
      if (data.repo && data.copy) await startImport(ctx, { _id: id, cid, tab, data });
      have.add(k);
      added++;
    }
    await setMeta(ctx, "tabSeed", TAB_SEED_VERSION);
    if (added) await snapshotSoon(ctx);
    return { added };
  },
});

// ---------- copying a repo's files ----------
async function startImport(ctx: any, card: any) {
  const run = Math.random().toString(36).slice(2) + Date.now().toString(36);
  await ctx.db.patch(card._id, { imp: { state: "importing", count: 0, note: "Copying files…", at: nowIso(), run } });
  await ctx.scheduler.runAfter(0, internal.tabImport.run, { cid: card.cid, tab: card.tab, repo: card.data.repo, runId: run });
}

const STALE_MS = 4 * 60 * 1000;
const isStale = (imp: any) => imp?.state === "importing" && Date.now() - Date.parse(imp.at || 0) > STALE_MS;

export const reimport = mutation({
  args: { key: v.string(), cid: v.string() },
  handler: async (ctx, { key, cid }) => {
    checkKey(key);
    const c = await byCid(ctx, cid);
    if (!c || c.deleting) throw new ConvexError("That card is no longer in your list.");
    if (!c.data?.repo) throw new ConvexError("This card has no open-source repo to copy.");
    if (c.imp?.state === "importing" && !isStale(c.imp)) return { ok: true };
    await startImport(ctx, c);
    return { ok: true };
  },
});

// A copy that went silent for 4 minutes was interrupted: restart it.
export const resumeStuck = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    let n = 0;
    for (const c of await ctx.db.query("tcards").collect()) if (!c.deleting && c.data?.repo && isStale(c.imp)) { await startImport(ctx, c); n++; }
    return { restarted: n };
  },
});

export const progress = internalMutation({
  args: { cid: v.string(), runId: v.string(), note: v.string() },
  handler: async (ctx, { cid, runId, note }) => {
    const c = await byCid(ctx, cid);
    if (!c || c.deleting || c.imp?.state !== "importing" || c.imp?.run !== runId) return;
    await ctx.db.patch(c._id, { imp: { ...c.imp, note, at: nowIso() } });
  },
});

export const setImp = internalMutation({
  args: { cid: v.string(), runId: v.string(), state: v.string(), note: v.string() },
  handler: async (ctx, { cid, runId, state, note }) => {
    const c = await byCid(ctx, cid);
    if (!c || c.deleting || c.imp?.run !== runId) return;
    const count = (await ctx.db.query("tcItems").withIndex("by_cid", (q) => q.eq("cid", cid)).collect()).length;
    await ctx.db.patch(c._id, { imp: { state, count, note, at: nowIso(), run: runId } });
    await snapshotSoon(ctx);
  },
});

async function clearSome(ctx: any, cid: string) {
  const idx = await ctx.db.query("tcItems").withIndex("by_cid", (q: any) => q.eq("cid", cid)).take(400);
  for (const r of idx) await ctx.db.delete(r._id);
  const txt = await ctx.db.query("tcText").withIndex("by_cid", (q: any) => q.eq("cid", cid)).take(50);
  for (const r of txt) await ctx.db.delete(r._id);
  return idx.length + txt.length;
}
export const clearItems = internalMutation({
  args: { cid: v.string(), runId: v.optional(v.string()) },
  handler: async (ctx, { cid, runId }) => {
    if (runId) {
      const c = await byCid(ctx, cid);
      if (!c || c.imp?.run !== runId) return 0;
    }
    return await clearSome(ctx, cid);
  },
});

export const addItems = internalMutation({
  args: { cid: v.string(), runId: v.string(), start: v.number(), rows: v.array(v.object({ title: v.string(), desc: v.string(), tag: v.string(), text: v.string(), url: v.string() })) },
  handler: async (ctx, { cid, runId, start, rows }) => {
    const c = await byCid(ctx, cid);
    if (!c || c.deleting || c.imp?.run !== runId) return false;
    let n = start;
    for (const r of rows) {
      await ctx.db.insert("tcItems", { cid, n, title: r.title, desc: r.desc, tag: r.tag });
      await ctx.db.insert("tcText", { cid, n, text: r.text, url: r.url });
      n++;
    }
    return true;
  },
});

// ---------- browsing the copied files ----------
export const items = query({
  args: { key: v.string(), cid: v.string() },
  handler: async (ctx, { key, cid }) => {
    checkKey(key);
    const rows = await ctx.db.query("tcItems").withIndex("by_cid", (q) => q.eq("cid", cid)).collect();
    return rows.map((r) => ({ n: r.n, title: r.title, desc: r.desc, tag: r.tag }));
  },
});

export const itemText = query({
  args: { key: v.string(), cid: v.string(), n: v.number() },
  handler: async (ctx, { key, cid, n }) => {
    checkKey(key);
    const r = await ctx.db.query("tcText").withIndex("by_cid_n", (q) => q.eq("cid", cid).eq("n", n)).first();
    if (!r) throw new ConvexError("That file is no longer in the app.");
    return { text: r.text, url: r.url };
  },
});

// ---------- deleting ----------
export const remove = mutation({
  args: { key: v.string(), cid: v.string() },
  handler: async (ctx, { key, cid }) => {
    checkKey(key);
    const c = await byCid(ctx, cid);
    if (!c) return { ok: true };
    await ctx.db.patch(c._id, { deleting: true });
    // Remember it, so a later starter-card update doesn't bring it back.
    const gone: string[] = (await getMeta(ctx, "tabGone"))?.value || [];
    gone.push(c.tab + "|" + normLink(c.data?.links?.[0]?.[1]));
    await setMeta(ctx, "tabGone", gone.slice(-500));
    await ctx.scheduler.runAfter(0, internal.tabs.purge, { cid });
    await snapshotSoon(ctx);
    return { ok: true };
  },
});

export const purge = internalMutation({
  args: { cid: v.string() },
  handler: async (ctx, { cid }) => {
    if (await clearSome(ctx, cid)) { await ctx.scheduler.runAfter(0, internal.tabs.purge, { cid }); return; }
    const c = await byCid(ctx, cid);
    if (c) await ctx.db.delete(c._id);
  },
});

// ---------- adding (used by tabAdd.ts) ----------
export const cardNames = internalQuery({
  args: { tab: v.string() },
  handler: async (ctx, { tab }) =>
    (await ctx.db.query("tcards").withIndex("by_tab", (q) => q.eq("tab", tab)).collect())
      .filter((r) => !r.deleting)
      .map((r) => ({ cid: r.cid, title: r.data?.title || r.cid, links: r.data?.links || [], repo: r.data?.repo || "" })),
});

export const insertCard = internalMutation({
  args: { tab: v.string(), data: v.any(), importing: v.boolean() },
  handler: async (ctx, { tab, data, importing }) => {
    if (!(TABS as readonly string[]).includes(tab)) throw new ConvexError("Unknown tab.");
    const cid = await nextCid(ctx, tab);
    const id = await ctx.db.insert("tcards", { cid, tab, data, imp: NONE });
    if (importing) await startImport(ctx, { _id: id, cid, tab, data });
    await snapshotSoon(ctx);
    return cid;
  },
});

// For the snapshot and the playbook writer.
export const all = internalQuery({
  args: {},
  handler: async (ctx) => (await ctx.db.query("tcards").collect()).filter((r) => !r.deleting).map((r) => ({ ...r.data, id: r.cid, tab: r.tab, imp: r.imp || NONE })),
});
