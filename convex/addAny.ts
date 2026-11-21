// The one "Add to the library" box: works out what each pasted thing is and which tab(s) it belongs on.
// The page then adds it with that tab's own add step (tools, prompt libraries, rules, agents, automations).
import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { checkKey } from "./auth";
import { callGemini, parseJson, MODELS, FILE_MIME, docsBlock } from "./llm";

const TABS = ["tools", "prompts", "rules", "agents", "autos"];

const SPEC = `You sort what the user pasted into the tabs of their personal AI library. Files may be attached — screenshots (usually a social post), PDFs or documents: read them, including any names and links shown, and put what you read into each item's "input".
The tabs:
- "tools": AI apps, websites, products, models, GitHub tools, skills, plugins, MCP servers, extensions, courses, tutorials, guides or posts about how to use a tool. The default when unsure.
- "prompts": prompt libraries — a collection, site or repo full of ready-to-copy prompts — or a single ready-to-copy prompt to keep (a post or screenshot that IS a prompt).
- "rules": rule / instruction files for AI coding tools (CLAUDE.md, AGENTS.md, Cursor rules, Copilot instructions, Windsurf/Cline rules, GEMINI.md, DESIGN.md brand files) or collections of them.
- "agents": ready-made agents with their own instructions: Claude Code subagents, Gemini Gems, custom GPTs, Claude Projects setups, collections of agents, frameworks that run teams of agents.
- "autos": workflow automations: n8n / Zapier / Make templates, galleries or collections of workflows, AI automation recipes.
Split the input into separate items only when it clearly names different things (several links or several tools). A post about one thing is one item.
An item can belong on more than one tab when it clearly has both kinds of content (e.g. a repo with both rule files and agents, or a tool that also ships a prompt library). List every tab it clearly fits, best fit first; don't add a tab on a weak guess.
Reply with JSON only:
{"items": [{"name": "short name", "input": "everything needed to add this one item: its link(s), its name and the relevant pasted text, plus anything read from the screenshots (names, links)", "tabs": ["tools"], "why": "a few words on why these tabs",
  "prompt": "ONLY when the item is a single ready-to-copy prompt (not a library): the full prompt text exactly as written, every line, read from the text or screenshots; otherwise empty",
  "desc": "when prompt is set: one plain-English sentence on what the prompt does; otherwise empty"}]}`;

export const classify = action({
  args: { key: v.string(), text: v.string(), images: v.optional(v.array(v.object({ mime: v.string(), data: v.string() }))), docs: v.optional(v.array(v.object({ name: v.string(), text: v.string() }))) },
  handler: async (ctx, { key, text, images, docs }): Promise<{ items: { name: string; input: string; tabs: string[]; why: string; prompt?: string; desc?: string }[] }> => {
    checkKey(key);
    const t = text.trim();
    const pics = (images || []).filter((im) => FILE_MIME.test(im.mime)).slice(0, 20);
    const docText = docsBlock(docs, 30000, 100000);
    if (!t && !pics.length && !docText) throw new ConvexError("Paste a link, a name, some text or a screenshot first.");
    const res = await callGemini({
      model: MODELS.addGemini(),
      system: SPEC,
      turns: [{ role: "user", text: `WHAT THE USER PASTED:\n"""\n${t.slice(0, 12000) || "(only files)"}\n"""\n${docText}Return only the JSON.`, images: pics }],
      json: true,
      thinking: "low",
      maxTokens: 12000,
    });
    const out = parseJson(res.text) || {};
    const items = (Array.isArray(out.items) ? out.items : [])
      .map((it: any) => ({
        name: String(it?.name || "").trim().slice(0, 100),
        input: String(it?.input || "").trim().slice(0, 8000),
        tabs: [...new Set((Array.isArray(it?.tabs) ? it.tabs : []).map(String).filter((x: string) => TABS.includes(x)))].slice(0, 3) as string[],
        why: String(it?.why || "").trim().slice(0, 200),
        prompt: String(it?.prompt || "").trim().slice(0, 40000),
        desc: String(it?.desc || "").trim().slice(0, 400),
      }))
      .filter((it: any) => it.input || it.name)
      .slice(0, 15);
    for (const it of items) {
      if (it.prompt && it.prompt.length >= 15 && !it.tabs.includes("prompts")) it.tabs.unshift("prompts");
      if (!it.tabs.length) it.tabs = ["tools"];
    }
    // If it couldn't be read at all, treat the whole thing as one tool (the Tools step can still read screenshots).
    if (!items.length) return { items: [{ name: t.slice(0, 60) || "Screenshot", input: t, tabs: ["tools"], why: "" }] };
    return { items };
  },
});
