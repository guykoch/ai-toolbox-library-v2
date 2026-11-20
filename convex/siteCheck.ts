// Checks whether the live website search can read each website library's pages.
// It opens each card's links the same way the website search does (a plain request, no JavaScript)
// and records on the card whether real page text came back. No Gemini involved.
import { internalAction, internalQuery, internalMutation, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { checkKey } from "./auth";
import { fetchWithTimeout } from "./web";
import { pageText } from "./promptFinder";

const NEEDS_JS = /enable javascript|javascript is (required|disabled)|please turn on javascript|you need to enable|requires javascript|checking your browser|just a moment\.\.\.|access denied|captcha/i;

export async function probe(url: string): Promise<{ ok: boolean; why: string }> {
  try {
    const res = await fetchWithTimeout(url, { headers: { "User-Agent": "Mozilla/5.0 (compatible; ai-toolbox)", Accept: "text/html" } }, 15000);
    if (res.status === 401 || res.status === 403) return { ok: false, why: "the site blocks automatic visits" };
    if (!res.ok) return { ok: false, why: `the page answered ${res.status}` };
    const text = pageText(await res.text());
    const words = text.split(/\s+/).filter((w) => w.length > 2).length;
    if (words < 250) return { ok: false, why: NEEDS_JS.test(text) ? "the site only shows content with JavaScript or a login" : "the page loads its content with JavaScript" };
    if (NEEDS_JS.test(text.slice(0, 2000)) && words < 600) return { ok: false, why: "the site only shows content with JavaScript or a login" };
    return { ok: true, why: "" };
  } catch (e: any) {
    return { ok: false, why: /abort|timeout/i.test(String(e?.message || e)) ? "the site didn't answer in time" : "the site couldn't be reached" };
  }
}

export const toCheck = internalQuery({
  args: { libIds: v.optional(v.array(v.string())) },
  handler: async (ctx, { libIds }) =>
    (await ctx.db.query("plibs").collect())
      .filter((r) => !r.deleting && r.imp?.state !== "done" && (libIds ? libIds.includes(r.libId) : !r.data?.live))
      .map((r) => ({ libId: r.libId, links: (r.data?.links || []) as [string, string][] })),
});

export const setLive = internalMutation({
  args: { libId: v.string(), ok: v.boolean(), note: v.string() },
  handler: async (ctx, { libId, ok, note }) => {
    const lib = await ctx.db.query("plibs").withIndex("by_libId", (q) => q.eq("libId", libId)).first();
    if (lib && !lib.deleting) await ctx.db.patch(lib._id, { data: { ...lib.data, live: { ok, note, at: new Date().toISOString() } } });
  },
});

export const run = internalAction({
  args: { libIds: v.optional(v.array(v.string())) },
  handler: async (ctx, { libIds }) => {
    const libs: { libId: string; links: [string, string][] }[] = await ctx.runQuery(internal.siteCheck.toCheck, { libIds });
    for (let i = 0; i < libs.length; i += 5) {
      await Promise.all(libs.slice(i, i + 5).map(async (l) => {
        const links = l.links.map((x) => x[1]).filter((u) => /^https?:\/\//.test(u)).slice(0, 3);
        if (!links.length) return;
        const results = await Promise.all(links.map(probe));
        const okN = results.filter((r) => r.ok).length;
        // Mixed cards (several sites): readable if at least one of its sites is.
        const note = okN === links.length ? "" : okN ? `${okN} of ${links.length} sites readable` : results[0].why;
        await ctx.runMutation(internal.siteCheck.setLive, { libId: l.libId, ok: okN > 0, note });
      }));
    }
  },
});

// Page load: check any website library that hasn't been checked yet (at most every 10 minutes).
export const ensure = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    const pending = (await ctx.db.query("plibs").collect()).some((r) => !r.deleting && r.imp?.state !== "done" && !r.data?.live);
    if (!pending) return { started: false };
    const m = await ctx.db.query("meta").withIndex("by_key", (q) => q.eq("key", "siteCheckAt")).first();
    if (m && Date.now() - (m.value || 0) < 10 * 60 * 1000) return { started: false };
    if (m) await ctx.db.patch(m._id, { value: Date.now() });
    else await ctx.db.insert("meta", { key: "siteCheckAt", value: Date.now() });
    await ctx.scheduler.runAfter(0, internal.siteCheck.run, {});
    return { started: true };
  },
});

// "Check again" on one card.
export const recheck = mutation({
  args: { key: v.string(), libId: v.string() },
  handler: async (ctx, { key, libId }) => {
    checkKey(key);
    await ctx.scheduler.runAfter(0, internal.siteCheck.run, { libIds: [libId] });
    return { ok: true };
  },
});
