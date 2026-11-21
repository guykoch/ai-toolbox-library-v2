// Playbooks tab: saved playbooks (goal → steps that use items from the library), starter ones, pinned defaults.
import { query, mutation, internalQuery } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { checkKey } from "./auth";
import { snapshotSoon } from "./snapshot";
import { PLAYBOOK_SEED, PLAYBOOK_SEED_VERSION, PB_TYPES } from "./playbookSeed";
import { guessKind } from "./kinds";

async function getMeta(ctx: any, key: string) {
  return await ctx.db.query("meta").withIndex("by_key", (q: any) => q.eq("key", key)).first();
}
async function setMeta(ctx: any, key: string, value: any) {
  const m = await getMeta(ctx, key);
  if (m) await ctx.db.patch(m._id, { value });
  else await ctx.db.insert("meta", { key, value });
}

// ---------- the library, as a compact list (for checking step links and for Gemini) ----------
export type LibRef = { k: "t" | "l" | "c"; id: string; name: string; tab?: string; info: string };
export async function libraryRefs(ctx: any): Promise<LibRef[]> {
  const out: LibRef[] = [];
  for (const r of await ctx.db.query("items").withIndex("by_status", (q: any) => q.eq("status", "active")).collect()) {
    const d = r.data || {};
    out.push({ k: "t", id: String(d.id), name: String(d.title || ""), info: [d.cat, String(d.summary || "").slice(0, 140)].filter(Boolean).join(" · ") });
  }
  for (const r of await ctx.db.query("plibs").collect()) {
    if (r.deleting) continue;
    out.push({ k: "l", id: r.libId, name: String(r.data?.title || ""), info: "prompt library · " + String(r.data?.bestFor || r.data?.summary || "").slice(0, 140) });
  }
  for (const r of await ctx.db.query("tcards").collect()) {
    if (r.deleting) continue;
    out.push({ k: "c", id: r.cid, tab: r.tab, name: String(r.data?.title || ""), info: ({ rules: "rule file", agents: "agent", autos: "automation" } as any)[r.tab] + " · " + String(r.data?.bestFor || r.data?.summary || "").slice(0, 140) });
  }
  return out;
}
export const library = internalQuery({ args: {}, handler: async (ctx) => libraryRefs(ctx) });

// Cleans a playbook (from the page or from Gemini): known type, short topics, steps whose links exist.
export function cleanPlaybook(p: any, lib: LibRef[]) {
  const str = (x: any, n: number) => (typeof x === "string" ? x.trim().slice(0, n) : "");
  const find = (u: any) => {
    const k = u?.k === "tool" ? "t" : u?.k === "lib" ? "l" : u?.k === "card" ? "c" : u?.k;
    const id = String(u?.id ?? "");
    return lib.find((x) => x.k === k && x.id === id) || (u?.name ? lib.find((x) => x.k === k && x.name.toLowerCase() === String(u.name).toLowerCase()) : undefined);
  };
  const steps = (Array.isArray(p?.steps) ? p.steps : []).slice(0, 15).map((s: any) => {
    const seen = new Set<string>();
    const use = (Array.isArray(s?.use) ? s.use : [])
      .map(find)
      .filter((x: LibRef | undefined): x is LibRef => !!x && !seen.has(x.k + x.id) && !!seen.add(x.k + x.id))
      .slice(0, 5)
      .map((x: LibRef) => ({ k: x.k, id: x.id, name: x.name, ...(x.tab ? { tab: x.tab } : {}) }));
    return { title: str(s?.title, 120) || "Step", do: str(s?.do, 1200), use, ...(str(s?.prompt, 4000) ? { prompt: str(s.prompt, 4000) } : {}), ...(str(s?.tip, 600) ? { tip: str(s.tip, 600) } : {}) };
  });
  return {
    title: str(p?.title, 120) || "Untitled playbook",
    goal: str(p?.goal, 400),
    type: (PB_TYPES as readonly string[]).includes(p?.type) ? p.type : "create",
    topics: (Array.isArray(p?.topics) ? p.topics : []).map((t: any) => str(t, 40)).filter(Boolean).slice(0, 4),
    time: str(p?.time, 40),
    steps,
  };
}

// ---------- list / starter playbooks ----------
export const list = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    const rows = await ctx.db.query("playbooks").collect();
    const seeded = (await getMeta(ctx, "pbSeed"))?.value === PLAYBOOK_SEED_VERSION;
    const defaults: string[] = (await getMeta(ctx, "pbDefaults"))?.value || [];
    return { playbooks: rows.map((r) => ({ ...r.data, id: r.pbId })), seeded, defaults };
  },
});

async function nextId(ctx: any) {
  const rows = await ctx.db.query("playbooks").collect();
  return "b" + (Math.max(0, ...rows.map((r: any) => Number(String(r.pbId).replace(/\D/g, "")) || 0)) + 1);
}

export const ensureSeeded = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    if ((await getMeta(ctx, "pbSeed"))?.value === PLAYBOOK_SEED_VERSION) return { added: 0 };
    const lib = await libraryRefs(ctx);
    const have = new Set((await ctx.db.query("playbooks").collect()).map((r) => String(r.data?.title || "").toLowerCase()));
    const gone = new Set<string>((await getMeta(ctx, "pbGone"))?.value || []);
    let added = 0;
    for (const s of PLAYBOOK_SEED) {
      const t = s.title.toLowerCase();
      if (have.has(t) || gone.has(t)) continue;
      const steps = s.steps.map((st) => ({
        ...st,
        use: (st.use || []).map(([k, x]) => (k === "c" ? { k, id: lib.find((r) => r.k === "c" && r.name === x)?.id || "", name: String(x) } : { k, id: String(x) })),
      }));
      const data = { ...cleanPlaybook({ ...s, steps }, lib), source: "starter", updated: new Date().toISOString().slice(0, 10) };
      await ctx.db.insert("playbooks", { pbId: await nextId(ctx), data });
      added++;
    }
    await setMeta(ctx, "pbSeed", PLAYBOOK_SEED_VERSION);
    if (added) await snapshotSoon(ctx);
    return { added };
  },
});

// ---------- save / delete ----------
export const save = mutation({
  args: { key: v.string(), id: v.optional(v.string()), playbook: v.any() },
  handler: async (ctx, { key, id, playbook }) => {
    checkKey(key);
    const lib = await libraryRefs(ctx);
    const clean: any = cleanPlaybook(playbook, lib);
    if (!clean.steps.length) throw new ConvexError("A playbook needs at least one step.");
    // A playbook saved from the Plan pop-up keeps the whole plan (approach, alternatives, caveats, map) for reopening there.
    if (playbook?.plan && typeof playbook.plan === "object" && JSON.stringify(playbook.plan).length < 400_000) clean.plan = playbook.plan;
    const today = new Date().toISOString().slice(0, 10);
    if (id) {
      const row = await ctx.db.query("playbooks").withIndex("by_pbId", (q) => q.eq("pbId", id)).first();
      if (row) {
        await ctx.db.patch(row._id, { data: { ...clean, source: row.data?.source === "starter" ? "edited" : row.data?.source || "made", updated: today } });
        await snapshotSoon(ctx);
        return { id };
      }
    }
    const pbId = await nextId(ctx);
    await ctx.db.insert("playbooks", { pbId, data: { ...clean, source: "made", updated: today } });
    await snapshotSoon(ctx);
    return { id: pbId };
  },
});

export const remove = mutation({
  args: { key: v.string(), id: v.string() },
  handler: async (ctx, { key, id }) => {
    checkKey(key);
    const row = await ctx.db.query("playbooks").withIndex("by_pbId", (q) => q.eq("pbId", id)).first();
    if (!row) return { ok: true };
    if (row.data?.source === "starter" || row.data?.source === "edited") {
      const gone: string[] = (await getMeta(ctx, "pbGone"))?.value || [];
      gone.push(String(row.data?.title || "").toLowerCase());
      await setMeta(ctx, "pbGone", gone.slice(-300));
    }
    await ctx.db.delete(row._id);
    await snapshotSoon(ctx);
    return { ok: true };
  },
});

// Pinned defaults, e.g. "Slides: always the a16z style from SlideSpeak". Used by Make and Tweak.
export const setDefaults = mutation({
  args: { key: v.string(), defaults: v.array(v.string()) },
  handler: async (ctx, { key, defaults }) => {
    checkKey(key);
    await setMeta(ctx, "pbDefaults", defaults.map((d) => d.trim().slice(0, 200)).filter(Boolean).slice(0, 20));
    return { ok: true };
  },
});

export const all = internalQuery({
  args: {},
  handler: async (ctx) => (await ctx.db.query("playbooks").collect()).map((r) => ({ ...r.data, id: r.pbId })),
});

// A fuller picture of the library for the Plan chat: tools with their type (skill, connector…) and longer descriptions.
export const libraryForPlan = internalQuery({
  args: {},
  handler: async (ctx) => {
    const tools = (await ctx.db.query("items").withIndex("by_status", (q: any) => q.eq("status", "active")).collect()).map((r: any) => {
      const d = r.data || {};
      return { id: String(d.id), name: String(d.title || ""), kind: guessKind(d), cat: String(d.cat || ""), info: String(d.summary || "").slice(0, 220), url: String(d.url || "") };
    });
    const libs = (await ctx.db.query("plibs").collect()).filter((r) => !r.deleting).map((r) => ({ id: r.libId, name: String(r.data?.title || ""), info: String(r.data?.bestFor || r.data?.summary || "").slice(0, 200), copied: r.imp?.state === "done" }));
    const cards = (await ctx.db.query("tcards").collect()).filter((r) => !r.deleting).map((r) => ({ id: r.cid, tab: r.tab, name: String(r.data?.title || ""), info: String(r.data?.bestFor || r.data?.summary || "").slice(0, 200) }));
    return { tools, libs, cards };
  },
});
