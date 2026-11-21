// "Add" box on the Rules / Agents / Automations tabs: writes the card, checks for duplicates,
// and — for an open-source GitHub repo — starts copying its files into the app.
import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { checkKey } from "./auth";
import { norm, gatherUrl } from "./web";
import { callGemini, parseJson, MODELS } from "./llm";
import { parseRepoUrl } from "./promptRows";
import { isOpenLicense } from "./promptAdd";

export const SECTIONS: Record<string, string[]> = {
  rules: ["standards", "coding", "guardrails", "collections", "design"],
  agents: ["subagents", "assistants", "teams"],
  autos: ["templates", "collections", "ai"],
};
const KINDS = ["official", "open", "community", "free"];

const COMMON = `"title": "name", "summary": "one plain-English sentence: what it is and who it's for (max 160 chars)",
 "bestFor": "one concise line (max 130 chars): when to reach for it and what it includes",
 "kind": one of "official" (by the company that makes the tool), "open" (open-source repo), "community", "free",
 "license": "e.g. MIT, CC0, Free, Paid", "links": [["short label", "https://..."]] (main link first; include the GitHub repo if there is one),
 "repo": "https://github.com/owner/repo if its files are in an open-source repo, else empty",
 "openSource": true only if published under an open license in that repo`;

const SPEC: Record<string, string> = {
  rules: `You add one card to the user's RULES & GUARDRAILS tab: guardrails (hooks, permission settings, safety rules for agents) and rule / instruction files that tell an AI how to behave in a project (CLAUDE.md, AGENTS.md, Cursor rules, Copilot instructions, Windsurf/Cline rules, GEMINI.md, DESIGN.md brand rules) or collections of them. Reply with JSON only:
{${COMMON},
 "sec": one of "standards" (a format that works across tools, like AGENTS.md), "coding" (one coding tool's own rule file), "guardrails" (hooks, permission settings, sandboxing and safety rules that control what an agent may do), "collections" (a collection of ready rule files to copy), "design" (design / brand rule files),
 "tools": "which AI tools read it, e.g. Cursor, Claude Code",
 "where": "where the file goes, e.g. .cursor/rules/*.mdc in your project",
 "example": "a short example of what goes in such a file (5-12 lines, in the right format); empty if it's a collection"}
If it isn't about rule files at all, reply {"wrongTab": true, "why": "..."}. Never invent links.`,
  agents: `You add one card to the user's AGENTS tab: ready-made AI agents / assistants with their own instructions (Claude Code subagents, Gemini Gems, custom GPTs, Claude Projects, agent teams) or collections of them. Reply with JSON only:
{${COMMON},
 "sec": one of "subagents" (agent files for coding agents like Claude Code / Codex), "assistants" (custom chat assistants: Gems, GPTs, Claude Projects), "teams" (frameworks that run several agents together),
 "platform": "where it runs, e.g. Claude Code, Gemini app, ChatGPT",
 "how": "one or two sentences: how to set it up and start using it"}
If it isn't about agents at all, reply {"wrongTab": true, "why": "..."}. Never invent links.`,
  autos: `You add one card to the user's AUTOMATIONS tab: workflow automations (n8n, Zapier, Make templates, collections of workflows, AI automation recipes). Reply with JSON only:
{${COMMON},
 "sec": one of "templates" (an official template gallery), "collections" (a collection of ready workflows, e.g. on GitHub), "ai" (an AI-agent or AI automation workflow),
 "platform": "n8n, Zapier, Make, …",
 "trigger": "what starts it, e.g. new email, a schedule, a form (or 'Varies' for a collection)",
 "does": "one sentence: what it does",
 "apps": "apps it needs, comma-separated (or 'Many' for a collection)",
 "effort": one of "Easy" (minutes, no code), "Medium" (an hour, some setup), "Advanced" (self-hosting or code)}
If it isn't about automations at all, reply {"wrongTab": true, "why": "..."}. Never invent links.`,
};

const TAB_NAME: Record<string, string> = { rules: "Rules", agents: "Agents", autos: "Automations" };

export const add = action({
  args: { key: v.string(), tab: v.string(), text: v.string() },
  handler: async (ctx, { key, tab, text }): Promise<{ status: "added" | "exists"; cid: string; title: string; importing: boolean; why?: string }> => {
    checkKey(key);
    if (!SPEC[tab]) throw new ConvexError("Unknown tab.");
    const input = text.trim();
    if (!input) throw new ConvexError("Paste a link (a GitHub repo or a website) first.");
    const urls = Array.from(new Set((input.match(/https?:\/\/[^\s<>"')\]]+/g) || []).map((u) => u.replace(/[.,;]+$/, "")))).slice(0, 4);
    const cards: { cid: string; title: string; links: [string, string][]; repo: string }[] = await ctx.runQuery(internal.tabs.cardNames, { tab });
    const findDup = (u: string) => cards.find((c) => [c.repo, c.links[0] && c.links[0][1]].filter(Boolean).some((x) => norm(x as string) === norm(u)));
    for (const u of urls) { const d = findDup(u); if (d) return { status: "exists", cid: d.cid, title: d.title, importing: false }; }

    const fetched = await Promise.all(urls.map(gatherUrl));
    const res = await callGemini({
      model: MODELS.addGemini(),
      system: SPEC[tab],
      turns: [{ role: "user", text: `WHAT THE USER PASTED:\n"""\n${input.slice(0, 6000)}\n"""\n\n` + (fetched.length ? `WHAT I FOUND AT THE LINKS:\n${fetched.map((f) => f.notes).join("\n---\n")}\n\n` : "") + "Return only the JSON." }],
      search: true,
      thinking: "medium",
      maxTokens: 4096,
    });
    const c = parseJson(res.text) || {};
    if (c.wrongTab) throw new ConvexError(`That doesn't look like it belongs on the ${TAB_NAME[tab]} tab` + (c.why ? ": " + String(c.why) : "."));
    const str = (x: any) => (typeof x === "string" ? x.trim() : "");
    let links: [string, string][] = Array.isArray(c.links) ? c.links.filter((l: any) => Array.isArray(l) && /^https?:\/\//.test(String(l[1]))).map((l: any) => [str(l[0]) || "Link", str(l[1])] as [string, string]).slice(0, 4) : [];
    if (!links.length && urls.length) links = [["Link", urls[0]]];
    if (!links.length) throw new ConvexError("I couldn't find a link for that. Paste its website or GitHub link.");
    const ghFromInput = urls.find((u) => parseRepoUrl(u));
    const repo = str(c.repo) && parseRepoUrl(str(c.repo)) ? str(c.repo) : ghFromInput || "";
    if (repo && !links.some((l) => norm(l[1]) === norm(repo))) links.push(["GitHub", repo]);
    for (const u of [links[0][1], repo].filter(Boolean)) { const d = findDup(u); if (d) return { status: "exists", cid: d.cid, title: d.title, importing: false }; }
    const ghInfo = repo ? fetched.find((f) => norm(f.finalUrl) === norm(repo) || norm(f.input) === norm(repo))?.github : undefined;
    const license = ghInfo ? ghInfo.license || "No license on GitHub" : str(c.license);
    const openSource = repo ? (ghInfo ? isOpenLicense(ghInfo.license) : c.openSource === true || isOpenLicense(str(c.license))) : false;
    const data: any = {
      title: str(c.title) || links[0][0],
      summary: str(c.summary),
      bestFor: str(c.bestFor).slice(0, 200),
      sec: SECTIONS[tab].includes(c.sec) ? c.sec : SECTIONS[tab][0],
      kind: repo && openSource && c.kind !== "official" ? "open" : KINDS.includes(c.kind) && c.kind !== "open" ? c.kind : "community",
      license: license || (openSource ? "Open source" : "Not stated"),
      links,
      ...(repo && openSource ? { repo, copy: true } : {}),
      added: new Date().toISOString().slice(0, 10),
    };
    for (const k of ["tools", "where", "example", "platform", "how", "trigger", "does", "apps", "effort"]) if (str(c[k])) data[k] = str(c[k]).slice(0, k === "example" ? 1500 : 300);
    const importing = !!(repo && openSource);
    const cid: string = await ctx.runMutation(internal.tabs.insertCard, { tab, data, importing });
    return { status: "added", cid, title: data.title, importing, why: importing ? "" : repo ? "nolicense" : "website" };
  },
});
