// The one "Add to the library" box: works out what each pasted thing is and which tab(s) it belongs on.
// The page then adds it with that tab's own add step (tools, prompt libraries, rules, agents, automations).
import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { checkKey } from "./auth";
import { callGemini, parseJson, MODELS } from "./llm";

const TABS = ["tools", "prompts", "rules", "agents", "autos"];

const SPEC = `You sort what the user pasted into the tabs of their personal AI library. Screenshots may be attached (usually a social post): read them, including any names and links shown.
The tabs:
- "tools": AI apps, websites, products, models, GitHub tools, skills, plugins, MCP servers, extensions, courses, tutorials, guides or posts about how to use a tool. The default when unsure.
- "prompts": prompt libraries — a collection, site or repo full of ready-to-copy prompts (or a post that IS a ready prompt to keep).
- "rules": rule / instruction files for AI coding tools (CLAUDE.md, AGENTS.md, Cursor rules, Copilot instructions, Windsurf/Cline rules, GEMINI.md, DESIGN.md brand files) or collections of them.
- "agents": ready-made agents with their own instructions: Claude Code subagents, Gemini Gems, custom GPTs, Claude Projects setups, collections of agents, frameworks that run teams of agents.
- "autos": workflow automations: n8n / Zapier / Make templates, galleries or collections of workflows, AI automation recipes.
Split the input into separate items only when it clearly names different things (several links or several tools). A post about one thing is one item.
An item can belong on more than one tab when it clearly has both kinds of content (e.g. a repo with both rule files and agents, or a tool that also ships a prompt library). List every tab it clearly fits, best fit first; don't add a tab on a weak guess.
Reply with JSON only:
{"items": [{"name": "short name", "input": "everything needed to add this one item: its link(s), its name and the relevant pasted text, plus anything read from the screenshots (names, links)", "tabs": ["tools"], "why": "a few words on why these tabs"}]}`;

export const classify = action({
  args: { key: v.string(), text: v.string(), images: v.optional(v.array(v.object({ mime: v.string(), data: v.string() }))) },
  handler: async (ctx, { key, text, images }): Promise<{ items: { name: string; input: string; tabs: string[]; why: string }[] }> => {
    checkKey(key);
    const t = text.trim();
    const pics = (images || []).filter((im) => /^image\/(png|jpeg|webp|gif)$/.test(im.mime)).slice(0, 20);
    if (!t && !pics.length) throw new ConvexError("Paste a link, a name, some text or a screenshot first.");
    const res = await callGemini({
      model: MODELS.addGemini(),
      system: SPEC,
      turns: [{ role: "user", text: `WHAT THE USER PASTED:\n"""\n${t.slice(0, 12000) || "(only screenshots)"}\n"""\nReturn only the JSON.`, images: pics }],
      json: true,
      thinking: "low",
      maxTokens: 4096,
    });
    const out = parseJson(res.text) || {};
    const items = (Array.isArray(out.items) ? out.items : [])
      .map((it: any) => ({
        name: String(it?.name || "").trim().slice(0, 100),
        input: String(it?.input || "").trim().slice(0, 8000),
        tabs: [...new Set((Array.isArray(it?.tabs) ? it.tabs : []).map(String).filter((x: string) => TABS.includes(x)))].slice(0, 3) as string[],
        why: String(it?.why || "").trim().slice(0, 200),
      }))
      .filter((it: any) => it.input || it.name)
      .slice(0, 15);
    for (const it of items) if (!it.tabs.length) it.tabs = ["tools"];
    // If it couldn't be read at all, treat the whole thing as one tool (the Tools step can still read screenshots).
    if (!items.length) return { items: [{ name: t.slice(0, 60) || "Screenshot", input: t, tabs: ["tools"], why: "" }] };
    return { items };
  },
});
