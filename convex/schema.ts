import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // One row per saved link. `data` holds the card exactly in the original
  // library format (id, date, iso, month, title, summary, cat, type, os, ...).
  items: defineTable({
    itemId: v.number(),
    status: v.union(v.literal("active"), v.literal("archived")),
    archivedAt: v.optional(v.string()),
    data: v.any(),
    // Background research of post links (Facebook/LinkedIn) into the tool's own page.
    enrichedAt: v.optional(v.string()),
    enrichNote: v.optional(v.string()),
    // Failed background attempts for this item (it is skipped after 2).
    attempts: v.optional(v.number()),
    // "Update hype scores": which run last checked this item, and when (ISO time).
    hypeRun: v.optional(v.string()),
    hypeAt: v.optional(v.string()),
  })
    .index("by_itemId", ["itemId"])
    .index("by_status", ["status"]),

  // Saved install prompts (one per item), so reopening one is instant and free.
  prompts: defineTable({
    itemId: v.number(),
    text: v.string(),
    sources: v.array(v.object({ title: v.string(), url: v.string() })),
    model: v.string(),
    createdAt: v.string(),
  }).index("by_itemId", ["itemId"]),

  // Library-wide extras from the original page: clusters, attachments, unresolved links.
  meta: defineTable({
    key: v.string(),
    value: v.any(),
  }).index("by_key", ["key"]),
});
