// "Add a prompt library": writes the card (same fields as the others on the Prompts tab), checks for duplicates,
// and — if it's an open-source GitHub repo — starts copying its prompts into the finder.
import { action, internalAction } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { checkKey } from "./auth";
import { norm, gatherUrl } from "./web";
import { callGemini, parseJson, MODELS } from "./llm";
import { parseRepoUrl } from "./promptRows";

// Open licenses that allow copying the prompts into the app.
export function isOpenLicense(id: string) {
  return /^(MIT|Apache|CC0|CC-BY|BSD|GPL|AGPL|LGPL|MPL|Unlicense|ISC|0BSD|WTFPL|Zlib)/i.test(String(id || "").trim());
}
// Repos whose content isn't really theirs to license (e.g. other companies' system prompts): card only, never copied.
const NEVER_COPY = /github\.com\/x1xhlol\/system-prompts-and-models-of-ai-tools/i;

const SECTIONS = ["general", "business", "coding", "design", "images", "patterns"];
const KINDS = ["official", "open", "community", "academic", "free"];

const SPEC = `You add one prompt library to the user's list. Reply with JSON only:
{"title": "name of the library", "summary": "one plain-English sentence: what prompts it has and who it's for (max 160 chars)",
 "bestFor": "one concise line (max 130 chars) giving the intuition of when to reach for this library and what it includes, e.g. \"Making decks look designed: 120+ slide styles with colors, fonts and a ready prompt.\"",
 "sec": one of "general" (all-purpose collections), "business" (business & productivity), "coding" (coding assistants), "design" (slides, websites, app UI, DESIGN.md), "images" (image prompts: logos, products, posters), "patterns" (thinking patterns: stress-testing, extraction, interviews, grading, style, meta-prompts),
 "kind": one of "official" (by an AI company), "open" (open-source repo), "community", "academic", "free" (free website/tool),
 "license": "e.g. MIT, CC0, Apache-2.0, Free", "format": "e.g. Website, GitHub, Website + GitHub, Visual gallery",
 "how": "one sentence: how to browse it and see examples",
 "links": [["short label", "https://..."]] (the main link first; include the GitHub repo if there is one),
 "repo": "https://github.com/owner/repo of the open-source repo that holds the prompts, or empty",
 "openSource": true only if the prompts themselves are published under an open license in that repo}
If it is ONE ready-to-copy prompt (e.g. a post sharing a single prompt) rather than a library, reply {"singlePrompt": true, "title": "short name of the prompt", "desc": "one plain-English sentence: what it does", "prompt": "the full prompt text exactly as given, every line"}.
If it isn't a prompt library or a prompt at all, reply {"notALibrary": true, "why": "..."}. Never invent links: use only links you were given or found.`;

export const add = action({
  args: { key: v.string(), text: v.string() },
  handler: async (ctx, { key, text }): Promise<{ status: "added" | "exists"; libId: string; title: string; importing: boolean; why?: string }> => {
    // (A single prompt goes to "My prompts" instead of becoming a library card.)
    checkKey(key);
    const input = text.trim();
    if (!input) throw new ConvexError("Paste a link to a prompt library (a GitHub repo or a website) first.");
    const urls = Array.from(new Set((input.match(/https?:\/\/[^\s<>"')\]]+/g) || []).map((u) => u.replace(/[.,;]+$/, "")))).slice(0, 4);

    const libs: { libId: string; title: string; links: [string, string][]; repo: string; sec: string }[] = await ctx.runQuery(internal.promptLibs.libNames, {});
    // A library is a duplicate only if the link is that card's own main link or its repo —
    // not a secondary link (e.g. a repo mentioned on a mixed "pattern" card).
    // "Thinking patterns" cards are mixes of several sources, so they never count as the same library.
    const findDup = (u: string) => libs.find((l) => l.sec !== "patterns" && [l.repo, l.links[0] && l.links[0][1]].filter(Boolean).some((x) => norm(x as string) === norm(u)));
    for (const u of urls) {
      const d = findDup(u);
      if (d) return { status: "exists", libId: d.libId, title: d.title, importing: false };
    }

    const fetched = await Promise.all(urls.map(gatherUrl));
    const res = await callGemini({
      model: MODELS.addGemini(),
      system: SPEC,
      turns: [{ role: "user", text: `WHAT THE USER PASTED:\n"""\n${input.slice(0, 6000)}\n"""\n\n` + (fetched.length ? `WHAT I FOUND AT THE LINKS:\n${fetched.map((f) => f.notes).join("\n---\n")}\n\n` : "") + "Return only the JSON." }],
      search: true,
      thinking: "medium",
      maxTokens: 8192,
    });
    const c = parseJson(res.text) || {};
    if (c.singlePrompt && typeof c.prompt === "string" && c.prompt.trim().length >= 15) {
      const r: { status: "added" | "exists"; title: string } = await ctx.runMutation(internal.promptLibs.addMine, { title: String(c.title || "").trim() || c.prompt.trim().slice(0, 60), desc: String(c.desc || "").trim(), text: c.prompt.trim().slice(0, 40000), url: urls[0] || "" });
      return { status: r.status, libId: "mine", title: r.title, importing: false, why: "mine" };
    }
    if (c.notALibrary) throw new ConvexError("That doesn't look like a prompt library" + (c.why ? ": " + String(c.why) : ".") + " To save a tool, use the Tools tab.");
    const str = (x: any) => (typeof x === "string" ? x.trim() : "");
    let links: [string, string][] = Array.isArray(c.links) ? c.links.filter((l: any) => Array.isArray(l) && /^https?:\/\//.test(String(l[1]))).map((l: any) => [str(l[0]) || "Link", str(l[1])] as [string, string]).slice(0, 4) : [];
    if (!links.length && urls.length) links = [["Link", urls[0]]];
    if (!links.length) throw new ConvexError("I couldn't find a link for that library. Paste its website or GitHub link.");
    const ghFromInput = urls.find((u) => parseRepoUrl(u));
    const repo = str(c.repo) && parseRepoUrl(str(c.repo)) ? str(c.repo) : ghFromInput || "";
    if (repo && !links.some((l) => norm(l[1]) === norm(repo))) links.push(["GitHub", repo]);
    for (const u of [links[0][1], repo].filter(Boolean)) {
      const d = findDup(u);
      if (d) return { status: "exists", libId: d.libId, title: d.title, importing: false };
    }
    // The repo's own license on GitHub decides whether its prompts may be copied (not the AI's guess).
    const ghInfo = repo ? fetched.find((f) => norm(f.finalUrl) === norm(repo) || norm(f.input) === norm(repo))?.github : undefined;
    const ghLicense = ghInfo ? ghInfo.license : "";
    let openSource = repo ? (ghInfo ? isOpenLicense(ghLicense) : c.openSource === true || isOpenLicense(str(c.license))) : false;
    if (repo && NEVER_COPY.test(repo)) openSource = false;
    if (ghInfo && !ghLicense) c.license = "No license on GitHub";
    else if (ghLicense) c.license = ghLicense;
    const data = {
      title: str(c.title) || links[0][0],
      summary: str(c.summary),
      bestFor: str(c.bestFor).slice(0, 200),
      sec: SECTIONS.includes(c.sec) ? c.sec : "general",
      kind: repo && openSource && c.kind !== "official" ? "open" : KINDS.includes(c.kind) && c.kind !== "open" ? c.kind : repo && openSource ? "open" : "community",
      license: str(c.license) || (openSource ? "Open source" : "Not stated"),
      format: str(c.format) || (repo ? "GitHub" : "Website"),
      how: str(c.how),
      links,
      ...(repo && openSource ? { repo } : {}),
      added: new Date().toISOString().slice(0, 10),
    };
    const importing = !!(repo && openSource);
    const libId: string = await ctx.runMutation(internal.promptLibs.insertLib, { data, importing });
    if (!importing) await ctx.scheduler.runAfter(0, internal.siteCheck.run, { libIds: [libId] });
    // xyz: website libraries (and repos without an open license) get their prompts copied from the website.
    if (!importing) await ctx.runMutation(internal.webjobs.enqueueLibs, { libIds: [libId] });
    const why = importing ? "" : repo && NEVER_COPY.test(repo) ? "excluded" : repo ? "nolicense" : "website";
    return { status: "added", libId, title: data.title, importing, why };
  },
});

// Fills "Best for" on cards added before that field existed (one call for all of them).
export const bestForMissing = internalAction({
  args: {},
  handler: async (ctx) => {
    const libs: { libId: string; title: string; summary: string; links: [string, string][] }[] = await ctx.runQuery(internal.promptLibs.missingBestFor, {});
    if (!libs.length) return;
    try {
      const res = await callGemini({
        model: MODELS.advisor(),
        system:
          'For each prompt library, write "bestFor": one concise line (max 130 chars) giving the intuition of when to reach for it and what it includes. Example: "Making decks look designed: 120+ slide styles with colors, fonts and a ready prompt." Reply JSON only: {"<libId>": "..."}',
        turns: [{ role: "user", text: libs.map((l) => `${l.libId} | ${l.title} | ${l.summary} | ${l.links.map((x) => x[1]).join(" ")}`).join("\n") }],
        json: true,
        thinking: "low",
        maxTokens: 2048,
      });
      const out = parseJson(res.text) || {};
      for (const l of libs) if (typeof out[l.libId] === "string") await ctx.runMutation(internal.promptLibs.setBestFor, { libId: l.libId, bestFor: out[l.libId].trim().slice(0, 200) });
    } catch (e) {
      console.log("bestFor fill failed", String(e));
    }
  },
});

// "Check again": re-reads a GitHub repo's license; if it's now open, the prompts get copied.
export const recheck = action({
  args: { key: v.string(), libId: v.string() },
  handler: async (ctx, { key, libId }): Promise<{ open: boolean; license: string }> => {
    checkKey(key);
    const libs: { libId: string; links: [string, string][]; repo: string }[] = await ctx.runQuery(internal.promptLibs.libNames, {});
    const lib = libs.find((l) => l.libId === libId);
    const gh = lib && lib.links.map((x) => x[1]).find((u) => parseRepoUrl(u));
    if (!lib || !gh) throw new ConvexError("This library has no GitHub repo.");
    if (NEVER_COPY.test(gh)) return { open: false, license: "Not copied: this repo collects other companies' prompts" };
    const f = await gatherUrl(gh);
    const license = f.github?.license || "";
    if (!isOpenLicense(license)) return { open: false, license: license || "No license on GitHub" };
    const r = parseRepoUrl(gh)!;
    await ctx.runMutation(internal.promptLibs.setRepo, { libId, repo: `https://github.com/${r.owner}/${r.repo}`, license });
    return { open: true, license };
  },
});
