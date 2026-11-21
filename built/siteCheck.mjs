// stub:server
var id = (d) => d;
var mutation = id;
var internalQuery = id;
var internalMutation = id;
var internalAction = id;

// convex/siteCheck.ts
import { v } from "convex/values";

// stub:api
var mk = (m) => new Proxy({}, { get: (_, f) => m + ":" + String(f) });
var internal = { items: mk("items"), ingest: mk("ingest"), install: mk("install"), advisor: mk("advisor"), pipeline: mk("pipeline"), enrich: mk("enrich"), credit: mk("credit"), hype: mk("hype"), alts: mk("alts"), promptFinder: mk("promptFinder"), promptLibs: mk("promptLibs"), promptImport: mk("promptImport"), promptAdd: mk("promptAdd"), snapshot: mk("snapshot"), siteCheck: mk("siteCheck"), webjobs: mk("webjobs"), webcopy: mk("webcopy"), promptGen: mk("promptGen"), tabs: mk("tabs"), tabImport: mk("tabImport"), tabAdd: mk("tabAdd"), playbooks: mk("playbooks"), playbookAi: mk("playbookAi"), addAny: mk("addAny") };

// convex/auth.ts
import { ConvexError } from "convex/values";
function checkKey(key) {
  const expected = process.env.ADMIN_KEY;
  if (!expected) {
    throw new ConvexError("ADMIN_KEY is not set in the Convex dashboard (Settings \u2192 Environment Variables).");
  }
  if (key !== expected) {
    throw new ConvexError("Wrong access key.");
  }
}

// convex/web.ts
async function fetchWithTimeout(url, init = {}, ms = 12e3) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}
function pageText(html) {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ").replace(/<(br|p|div|li|h\d|pre|tr|section|article)[^>]*>/gi, "\n").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&rsquo;|&lsquo;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&ldquo;|&rdquo;/g, '"').replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

// convex/siteCheck.ts
var NEEDS_JS = /enable javascript|javascript is (required|disabled)|please turn on javascript|you need to enable|requires javascript|checking your browser|just a moment\.\.\.|access denied|captcha/i;
async function probe(url) {
  try {
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; ai-toolbox)", Accept: "text/html" } }, 15e3);
    if (res.status === 401 || res.status === 403) return { ok: false, why: "the site blocks automatic visits" };
    if (!res.ok) return { ok: false, why: `the page answered ${res.status}` };
    const text = pageText(await res.text());
    const words = text.split(/\s+/).filter((w) => w.length > 2).length;
    if (words < 250) return { ok: false, why: NEEDS_JS.test(text) ? "the site only shows content with JavaScript or a login" : "the page loads its content with JavaScript" };
    if (NEEDS_JS.test(text.slice(0, 2e3)) && words < 600) return { ok: false, why: "the site only shows content with JavaScript or a login" };
    return { ok: true, why: "" };
  } catch (e) {
    return { ok: false, why: /abort|timeout/i.test(String(e?.message || e)) ? "the site didn't answer in time" : "the site couldn't be reached" };
  }
}
var toCheck = internalQuery({
  args: { libIds: v.optional(v.array(v.string())) },
  handler: async (ctx, { libIds }) => (await ctx.db.query("plibs").collect()).filter((r) => !r.deleting && r.imp?.state !== "done" && (libIds ? libIds.includes(r.libId) : !r.data?.live)).map((r) => ({ libId: r.libId, links: r.data?.links || [] }))
});
var setLive = internalMutation({
  args: { libId: v.string(), ok: v.boolean(), note: v.string() },
  handler: async (ctx, { libId, ok, note }) => {
    const lib = await ctx.db.query("plibs").withIndex("by_libId", (q) => q.eq("libId", libId)).first();
    if (lib && !lib.deleting) await ctx.db.patch(lib._id, { data: { ...lib.data, live: { ok, note, at: (/* @__PURE__ */ new Date()).toISOString() } } });
  }
});
var run = internalAction({
  args: { libIds: v.optional(v.array(v.string())) },
  handler: async (ctx, { libIds }) => {
    const libs = await ctx.runQuery(internal.siteCheck.toCheck, { libIds });
    for (let i = 0; i < libs.length; i += 5) {
      await Promise.all(libs.slice(i, i + 5).map(async (l) => {
        const links = l.links.map((x) => x[1]).filter((u) => /^https?:\/\//.test(u)).slice(0, 3);
        if (!links.length) return;
        const results = await Promise.all(links.map(probe));
        const okN = results.filter((r) => r.ok).length;
        const note = okN === links.length ? "" : okN ? `${okN} of ${links.length} sites readable` : results[0].why;
        await ctx.runMutation(internal.siteCheck.setLive, { libId: l.libId, ok: okN > 0, note });
      }));
    }
  }
});
var ensure = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    const pending = (await ctx.db.query("plibs").collect()).some((r) => !r.deleting && r.imp?.state !== "done" && !r.data?.live);
    if (!pending) return { started: false };
    const m = await ctx.db.query("meta").withIndex("by_key", (q) => q.eq("key", "siteCheckAt")).first();
    if (m && Date.now() - (m.value || 0) < 10 * 60 * 1e3) return { started: false };
    if (m) await ctx.db.patch(m._id, { value: Date.now() });
    else await ctx.db.insert("meta", { key: "siteCheckAt", value: Date.now() });
    await ctx.scheduler.runAfter(0, internal.siteCheck.run, {});
    return { started: true };
  }
});
var recheck = mutation({
  args: { key: v.string(), libId: v.string() },
  handler: async (ctx, { key, libId }) => {
    checkKey(key);
    await ctx.scheduler.runAfter(0, internal.siteCheck.run, { libIds: [libId] });
    return { ok: true };
  }
});
export {
  ensure,
  probe,
  recheck,
  run,
  setLive,
  toCheck
};
