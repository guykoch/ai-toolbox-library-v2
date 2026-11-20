// "Add a prompt library": writes the card (same fields as the others on the Prompts tab), checks for duplicates,
// and — if it's an open-source GitHub repo — starts copying its prompts into the finder.
import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { checkKey } from "./auth";
import { norm, gatherUrl } from "./web";
import { callGemini, parseJson, MODELS } from "./llm";
import { parseRepoUrl } from "./promptRows";

const SECTIONS = ["general", "business", "coding", "design", "images", "patterns"];
const KINDS = ["official", "open", "community", "academic", "free"];

const SPEC = `You add one prompt library to the user's list. Reply with JSON only:
{"title": "name of the library", "summary": "one plain-English sentence: what prompts it has and who it's for (max 160 chars)",
 "sec": one of "general" (all-purpose collections), "business" (business & productivity), "coding" (coding assistants), "design" (slides, websites, app UI, DESIGN.md), "images" (image prompts: logos, products, posters), "patterns" (thinking patterns: stress-testing, extraction, interviews, grading, style, meta-prompts),
 "kind": one of "official" (by an AI company), "open" (open-source repo), "community", "academic", "free" (free website/tool),
 "license": "e.g. MIT, CC0, Apache-2.0, Free", "format": "e.g. Website, GitHub, Website + GitHub, Visual gallery",
 "how": "one sentence: how to browse it and see examples",
 "links": [["short label", "https://..."]] (the main link first; include the GitHub repo if there is one),
 "repo": "https://github.com/owner/repo of the open-source repo that holds the prompts, or empty",
 "openSource": true only if the prompts themselves are published under an open license in that repo}
If it isn't a prompt library at all, reply {"notALibrary": true, "why": "..."}. Never invent links: use only links you were given or found.`;

export const add = action({
  args: { key: v.string(), text: v.string() },
  handler: async (ctx, { key, text }): Promise<{ status: "added" | "exists"; libId: string; title: string; importing: boolean }> => {
    checkKey(key);
    const input = text.trim();
    if (!input) throw new ConvexError("Paste a link to a prompt library (a GitHub repo or a website) first.");
    const urls = Array.from(new Set((input.match(/https?:\/\/[^\s<>"')\]]+/g) || []).map((u) => u.replace(/[.,;]+$/, "")))).slice(0, 4);

    const libs: { libId: string; title: string; links: [string, string][]; repo: string }[] = await ctx.runQuery(internal.promptLibs.libNames, {});
    const findDup = (u: string) => libs.find((l) => [l.repo, ...l.links.map((x) => x[1])].filter(Boolean).some((x) => norm(x) === norm(u)));
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
      maxTokens: 4096,
    });
    const c = parseJson(res.text) || {};
    if (c.notALibrary) throw new ConvexError("That doesn't look like a prompt library" + (c.why ? ": " + String(c.why) : ".") + " To save a tool, use the Tools tab.");
    const str = (x: any) => (typeof x === "string" ? x.trim() : "");
    let links: [string, string][] = Array.isArray(c.links) ? c.links.filter((l: any) => Array.isArray(l) && /^https?:\/\//.test(String(l[1]))).map((l: any) => [str(l[0]) || "Link", str(l[1])] as [string, string]).slice(0, 4) : [];
    if (!links.length && urls.length) links = [["Link", urls[0]]];
    if (!links.length) throw new ConvexError("I couldn't find a link for that library. Paste its website or GitHub link.");
    const ghFromInput = urls.find((u) => parseRepoUrl(u));
    const repo = str(c.repo) && parseRepoUrl(str(c.repo)) ? str(c.repo) : ghFromInput || "";
    if (repo && !links.some((l) => norm(l[1]) === norm(repo))) links.push(["GitHub", repo]);
    for (const l of links) {
      const d = findDup(l[1]);
      if (d) return { status: "exists", libId: d.libId, title: d.title, importing: false };
    }
    const openSource = c.openSource === true || /MIT|Apache|CC0|CC-BY|BSD|GPL|Unlicense/i.test(str(c.license));
    const data = {
      title: str(c.title) || links[0][0],
      summary: str(c.summary),
      sec: SECTIONS.includes(c.sec) ? c.sec : "general",
      kind: KINDS.includes(c.kind) ? c.kind : repo && openSource ? "open" : "free",
      license: str(c.license) || (openSource ? "Open source" : "Not stated"),
      format: str(c.format) || (repo ? "GitHub" : "Website"),
      how: str(c.how),
      links,
      ...(repo && openSource ? { repo } : {}),
      added: new Date().toISOString().slice(0, 10),
    };
    const importing = !!(repo && openSource);
    const libId: string = await ctx.runMutation(internal.promptLibs.insertLib, { data, importing });
    return { status: "added", libId, title: data.title, importing };
  },
});
