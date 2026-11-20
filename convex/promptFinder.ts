// "Find a prompt": searches the prompts inside the open-source prompt libraries (see promptCatalog.ts).
// Step 1: Gemini turns the request into search words. Step 2: a fast word search picks ~40 candidates.
// Step 3: Gemini reads the candidates and picks the best one — or says nothing fits.
import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { checkKey } from "./auth";
import { callGemini, MODELS, parseJson } from "./llm";
import { internal } from "./_generated/api";

type Row = { pid: number; libId: string; title: string; desc: string };

const STOP = new Set("a an the and or for to of in on with my me i you your want need prompt prompts that this is be it as by from about how what which can please some any like".split(" "));

function words(s: string): string[] {
  return s.toLowerCase().split(/[^a-z0-9À-ɏ]+/).filter((w) => w.length > 1 && !STOP.has(w));
}

function shortlist(catalog: Row[], keywords: string[], n: number): Row[] {
  const kws = [...new Set(keywords.flatMap(words))].slice(0, 40);
  if (!kws.length) return [];
  const rows = catalog.map((r) => ({ r, title: r.title.toLowerCase(), desc: r.desc.toLowerCase() }));
  // Rare words count more than common ones.
  const df = new Map<string, number>();
  for (const k of kws) df.set(k, rows.filter((x) => x.title.includes(k) || x.desc.includes(k)).length);
  const N = rows.length;
  const scored = rows.map((x) => {
    let s = 0;
    for (const k of kws) {
      const d = df.get(k) || 0;
      if (!d) continue;
      const idf = Math.log(1 + N / d);
      if (x.title.includes(k)) s += 3 * idf;
      else if (x.desc.includes(k)) s += idf;
    }
    return { r: x.r, s };
  });
  return scored.filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, n).map((x) => x.r);
}

type Hit = { pid: number; libId: string; libName: string; title: string; desc: string };

export const find = action({
  args: { key: v.string(), query: v.string() },
  handler: async (ctx, { key, query }): Promise<{ coverage: "full" | "partial" | "none"; message: string; best: (Hit & { why: string }) | null; others: (Hit & { why: string })[]; tryWebsite: string }> => {
    checkKey(key);
    const q = query.trim().slice(0, 500);
    if (!q) throw new ConvexError("Type what kind of prompt you're looking for first.");

    // 1. Turn the request into search words (synonyms included).
    let keywords: string[] = [q];
    try {
      const r1 = await callGemini({
        model: MODELS.advisor(),
        system:
          'Someone is looking for a ready-made AI prompt. Turn their request into 8-15 short English search keywords and synonyms that would appear in the title or description of a matching prompt (e.g. "slide deck" -> slides, presentation, deck, pitch, keynote). Translate if needed. Reply JSON only: {"keywords": ["..."]}',
        turns: [{ role: "user", text: q }],
        json: true,
        thinking: "low",
        maxTokens: 1024,
      });
      const k = parseJson(r1.text)?.keywords;
      if (Array.isArray(k)) keywords = [q, ...k.map(String)];
    } catch (e) {
      // Fall back to the user's own words; a credit/key problem will surface in step 3 anyway.
    }

    // 2. Fast word search over every copied prompt.
    const catalog: Row[] = [];
    let cursor: string | null = null;
    for (;;) {
      const page: { rows: Row[]; cursor: string; done: boolean } = await ctx.runQuery(internal.promptLibs.indexPage, { cursor });
      catalog.push(...page.rows);
      if (page.done) break;
      cursor = page.cursor;
    }
    if (!catalog.length) throw new ConvexError("No prompts are in the app yet. Add an open-source prompt library first (or wait for the copy to finish).");
    const libs = (await ctx.runQuery(internal.promptLibs.libNames, {})) as { libId: string; title: string; summary: string; imported: boolean }[];
    const names = new Map<string, string>(libs.map((l) => [l.libId, l.title]));
    // Libraries whose prompts aren't in the app (websites), for "try this site" suggestions.
    const WEBSITE_LIBS = libs.filter((l) => !l.imported).map((l) => `${l.title} (${l.summary.slice(0, 90)})`).join(" | ");
    const cands = shortlist(catalog.filter((r) => names.has(r.libId)), keywords, 40);
    const byId = new Map(cands.map((r) => [r.pid, r]));
    const list = cands.map((r) => `${r.pid} | ${names.get(r.libId)} | ${r.title} | ${r.desc}`).join("\n");

    // 3. Let Gemini pick.
    const r2 = await callGemini({
      model: MODELS.advisor(),
      system:
        "You help someone find a ready-made prompt. You get their request and CANDIDATES (prompts from open-source libraries: id | library | title | description). " +
        "Pick the single best candidate only if it really does what they asked; add up to 3 other close candidates. Never invent prompts or ids. " +
        'coverage: "full" = the best one does what they asked; "partial" = close but missing part of the request (say which part in message); "none" = nothing fits (best = null). ' +
        "message: one or two plain-English sentences for the user. why: one short sentence per pick. " +
        "If coverage is not full, set tryWebsite to the one website library most likely to have it, chosen from: " + WEBSITE_LIBS + ' (name only, or "" if none fits). ' +
        'Reply JSON only: {"coverage":"full|partial|none","message":"...","best":{"id":0,"why":"..."} or null,"others":[{"id":0,"why":"..."}],"tryWebsite":""}',
      turns: [{ role: "user", text: `REQUEST: ${q}\n\nCANDIDATES:\n${list || "(none found)"}` }],
      json: true,
      thinking: "low",
      maxTokens: 2048,
    });
    const raw = parseJson(r2.text) || {};
    const pick = (p: any) => {
      const r = byId.get(Number(p?.id));
      return r ? { pid: r.pid, libId: r.libId, libName: names.get(r.libId) || r.libId, title: r.title, desc: r.desc, why: String(p?.why || "").trim() } : null;
    };
    const best = raw.best ? pick(raw.best) : null;
    const seen = new Set(best ? [best.pid] : []);
    const others = (Array.isArray(raw.others) ? raw.others : [])
      .map(pick)
      .filter((h: any) => h && !seen.has(h.pid) && seen.add(h.pid))
      .slice(0, 3);
    let coverage = ["full", "partial", "none"].includes(raw.coverage) ? raw.coverage : best ? "full" : "none";
    if (!best && coverage !== "none") coverage = others.length ? "partial" : "none";
    return {
      coverage,
      message: String(raw.message || (best ? "" : "No prompt in the open-source libraries matches that.")).trim(),
      best,
      others,
      tryWebsite: coverage === "full" ? "" : String(raw.tryWebsite || "").trim(),
    };
  },
});
