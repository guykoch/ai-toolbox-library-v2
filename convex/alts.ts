// One-time fill of "Alternative for" on cards you added through the app before this field existed.
// A single cheap Gemini call (no web search) for all of them together.
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { callGemini, MODELS, parseJson } from "./llm";

export const missing = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("items").collect();
    return rows
      .filter((r) => r.data && r.data.alternativeTo === undefined)
      .map((r) => ({ id: r.itemId, title: r.data.title, summary: r.data.summary, kind: r.data.kind || "", host: r.data.host }));
  },
});

export const save = internalMutation({
  args: { alts: v.array(v.object({ id: v.number(), list: v.array(v.string()) })) },
  handler: async (ctx, { alts }) => {
    for (const a of alts) {
      const row = await ctx.db.query("items").withIndex("by_itemId", (q) => q.eq("itemId", a.id)).first();
      if (row && row.data?.alternativeTo === undefined) await ctx.db.patch(row._id, { data: { ...row.data, alternativeTo: a.list } });
    }
  },
});

export const fill = internalAction({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.runQuery(internal.alts.missing, {});
    for (let i = 0; i < all.length; i += 40) await fillBatch(ctx, all.slice(i, i + 40));
  },
});

async function fillBatch(ctx: any, items: { id: number; title: string; summary: string; kind: string; host: string }[]) {
    if (!items.length) return;
    const list = items.map((i) => `${i.id} | ${i.title} | ${String(i.summary || "").replace(/\s+/g, " ")} | ${i.kind} | ${i.host}`).join("\n");
    let parsed: any = null;
    try {
      const res = await callGemini({
        model: MODELS.advisor(),
        system:
          'For each AI tool below, name up to 3 famous, widely known products on the market that it can replace or is an alternative to (most famous first). Use [] for guides, courses, posts to learn from, news and announcements. Reply JSON only: {"<id>": ["A","B","C"], ...}',
        turns: [{ role: "user", text: "id | title | summary | type | site\n" + list }],
        json: true,
        thinking: "low",
        maxTokens: 8192,
      });
      parsed = parseJson(res.text);
    } catch (e) {
      console.log("alternatives fill failed", String(e));
      return; // tried again next time the page loads new prepared data
    }
    // Only save cards the model actually answered for; the rest are tried again later.
    const alts = items
      .filter((i) => Array.isArray(parsed?.[String(i.id)]))
      .map((i) => ({ id: i.id, list: parsed[String(i.id)].map((x: any) => String(x).trim()).filter(Boolean).slice(0, 3) }));
    if (!alts.length) console.log("alternatives fill: no usable answer", String(parsed).slice(0, 200));
    if (alts.length) await ctx.runMutation(internal.alts.save, { alts });
}
