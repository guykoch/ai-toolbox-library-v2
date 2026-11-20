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

  // Prompts tab: one row per prompt library (card fields in `data`, same shape as the page's PROMPT_LIBS).
  // imp = state of copying its prompts into the finder: none (website) | queued | importing | done | failed.
  plibs: defineTable({
    libId: v.string(),
    data: v.any(),
    imp: v.optional(v.object({ state: v.string(), count: v.number(), note: v.string(), at: v.string(), run: v.optional(v.string()) })),
    deleting: v.optional(v.boolean()),
  }).index("by_libId", ["libId"]),

  // xyz: one copy job per website library being copied (pages still to read, prompts seen so far).
  webjobs: defineTable({
    libId: v.string(),
    runId: v.string(),
    queue: v.array(v.string()), // "depth|url"
    pos: v.number(),
    found: v.number(),
    ai: v.number(), // pages read with Gemini
    reader: v.number(), // pages read through the browser-rendering service
    fetched: v.optional(v.number()), // pages that could be opened
    v2: v.optional(v.boolean()),
    seen: v.array(v.string()),
    visited: v.array(v.string()),
    prefix: v.string(),
    host: v.string(),
    disallow: v.array(v.string()),
    note: v.string(),
  }).index("by_lib", ["libId"]),

  // Cached page lists (sitemaps) of website libraries, for the live website search. Refreshed weekly.
  sitemaps: defineTable({ host: v.string(), at: v.number(), urls: v.array(v.string()) }).index("by_host", ["host"]),

  // Prompts copied from open-source libraries, for "Find a prompt". Split in two so search reads only the small part.
  plIndex: defineTable({ libId: v.string(), pid: v.number(), title: v.string(), desc: v.string() })
    .index("by_lib", ["libId"])
    .index("by_pid", ["pid"]),
  plText: defineTable({ libId: v.string(), pid: v.number(), text: v.string(), url: v.string() })
    .index("by_lib", ["libId"])
    .index("by_pid", ["pid"]),

  // Rules / Agents / Automations tabs: one row per card (tab = "rules" | "agents" | "autos").
  // imp = copying the contents of an open-source repo (rule files, agent files, workflow files) into the app.
  tcards: defineTable({
    cid: v.string(),
    tab: v.string(),
    data: v.any(),
    imp: v.optional(v.object({ state: v.string(), count: v.number(), note: v.string(), at: v.string(), run: v.optional(v.string()) })),
    deleting: v.optional(v.boolean()),
  })
    .index("by_cid", ["cid"])
    .index("by_tab", ["tab"]),
  // The files copied from a card's repo (one agent / rule file / workflow each), for its "Browse" pop-up.
  // Split in two (like the prompts) so listing a big collection reads only the small part.
  tcItems: defineTable({ cid: v.string(), n: v.number(), title: v.string(), desc: v.string(), tag: v.string() })
    .index("by_cid", ["cid"])
    .index("by_cid_n", ["cid", "n"]),
  tcText: defineTable({ cid: v.string(), n: v.number(), text: v.string(), url: v.string() })
    .index("by_cid", ["cid"])
    .index("by_cid_n", ["cid", "n"]),

  // Playbooks tab: one row per saved playbook (goal, type, topics, steps that point at library items).
  playbooks: defineTable({ pbId: v.string(), data: v.any() }).index("by_pbId", ["pbId"]),

  // Library-wide extras from the original page: clusters, attachments, unresolved links.
  meta: defineTable({
    key: v.string(),
    value: v.any(),
  }).index("by_key", ["key"]),
});
