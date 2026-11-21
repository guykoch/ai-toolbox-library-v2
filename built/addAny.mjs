// stub:server
var id = (d) => d;
var action = id;

// convex/addAny.ts
import { v, ConvexError as ConvexError3 } from "convex/values";

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

// convex/llm.ts
import { ConvexError as ConvexError2 } from "convex/values";

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

// convex/llm.ts
var MODELS = {
  // Researches how to install a tool and writes the install prompt (uses Google Search).
  install: () => process.env.GEMINI_MODEL_INSTALL || "gemini-3.8-flash",
  // Answers "What would you like to do?" from your library.
  advisor: () => process.env.GEMINI_MODEL_ADVISOR || "gemini-3.8-flash",
  // Re-scores hype for "Update hype scores" (uses Google Search).
  hype: () => process.env.GEMINI_MODEL_HYPE || "gemini-3.8-flash",
  // Writes new cards from what you paste (Claude if ANTHROPIC_API_KEY is set, otherwise Gemini).
  addClaude: () => process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
  addGemini: () => process.env.GEMINI_MODEL_ADD || "gemini-3.8-flash"
};
async function callGemini(opts) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new ConvexError2("GEMINI_API_KEY is not set in the Convex dashboard (Settings \u2192 Environment Variables).");
  const generationConfig = { maxOutputTokens: opts.maxTokens ?? 8192 };
  if (opts.json) generationConfig.responseMimeType = "application/json";
  if (opts.thinking) generationConfig.thinkingConfig = { thinkingLevel: opts.thinking };
  const body = {
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: opts.turns.map((t) => ({ role: t.role, parts: [...(t.images || []).map((im) => ({ inline_data: { mime_type: im.mime, data: im.data } })), { text: t.text }] })),
    generationConfig
  };
  if (opts.search) body.tools = [{ google_search: {} }];
  const send = async (b) => {
    const r = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.model)}:generateContent`,
      { method: "POST", headers: { "x-goog-api-key": key, "content-type": "application/json" }, body: JSON.stringify(b) },
      24e4
    );
    const j2 = await r.json().catch(() => ({}));
    return { ok: r.ok, j: j2 };
  };
  let { ok, j } = await send(body);
  if (!ok && /thinking|responseMimeType|google_search|tool/i.test(JSON.stringify(j?.error ?? ""))) {
    const plain = { ...body, generationConfig: { maxOutputTokens: generationConfig.maxOutputTokens } };
    if (opts.json && !opts.search) plain.generationConfig.responseMimeType = "application/json";
    ({ ok, j } = await send(plain));
  }
  if (!ok) throw new ConvexError2("Gemini API error: " + (j?.error?.message || "unknown error"));
  const cand = j?.candidates?.[0];
  const text = (cand?.content?.parts || []).filter((p) => typeof p.text === "string" && !p.thought).map((p) => p.text).join("").trim();
  if (!text) throw new ConvexError2("Gemini returned an empty answer" + (cand?.finishReason ? ` (${cand.finishReason})` : "") + ". Try again.");
  const seen = /* @__PURE__ */ new Set();
  const sources = [];
  for (const c of cand?.groundingMetadata?.groundingChunks || []) {
    const url = c?.web?.uri;
    const title = c?.web?.title || "";
    if (url && !seen.has(title + url)) {
      seen.add(title + url);
      sources.push({ title, url });
    }
  }
  return { text, sources };
}
function parseJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const src = fenced ? fenced[1] : text;
  const start = src.indexOf("{");
  const end = src.lastIndexOf("}");
  if (start < 0 || end < start) throw new ConvexError2("Couldn't read the AI's answer. Please try again.");
  try {
    return JSON.parse(src.slice(start, end + 1));
  } catch {
    throw new ConvexError2("Couldn't read the AI's answer. Please try again.");
  }
}

// convex/addAny.ts
var TABS = ["tools", "prompts", "rules", "agents", "autos"];
var SPEC = `You sort what the user pasted into the tabs of their personal AI library. Screenshots may be attached (usually a social post): read them, including any names and links shown.
The tabs:
- "tools": AI apps, websites, products, models, GitHub tools, skills, plugins, MCP servers, extensions, courses, tutorials, guides or posts about how to use a tool. The default when unsure.
- "prompts": prompt libraries \u2014 a collection, site or repo full of ready-to-copy prompts (or a post that IS a ready prompt to keep).
- "rules": rule / instruction files for AI coding tools (CLAUDE.md, AGENTS.md, Cursor rules, Copilot instructions, Windsurf/Cline rules, GEMINI.md, DESIGN.md brand files) or collections of them.
- "agents": ready-made agents with their own instructions: Claude Code subagents, Gemini Gems, custom GPTs, Claude Projects setups, collections of agents, frameworks that run teams of agents.
- "autos": workflow automations: n8n / Zapier / Make templates, galleries or collections of workflows, AI automation recipes.
Split the input into separate items only when it clearly names different things (several links or several tools). A post about one thing is one item.
An item can belong on more than one tab when it clearly has both kinds of content (e.g. a repo with both rule files and agents, or a tool that also ships a prompt library). List every tab it clearly fits, best fit first; don't add a tab on a weak guess.
Reply with JSON only:
{"items": [{"name": "short name", "input": "everything needed to add this one item: its link(s), its name and the relevant pasted text, plus anything read from the screenshots (names, links)", "tabs": ["tools"], "why": "a few words on why these tabs"}]}`;
var classify = action({
  args: { key: v.string(), text: v.string(), images: v.optional(v.array(v.object({ mime: v.string(), data: v.string() }))) },
  handler: async (ctx, { key, text, images }) => {
    checkKey(key);
    const t = text.trim();
    const pics = (images || []).filter((im) => /^image\/(png|jpeg|webp|gif)$/.test(im.mime)).slice(0, 20);
    if (!t && !pics.length) throw new ConvexError3("Paste a link, a name, some text or a screenshot first.");
    const res = await callGemini({
      model: MODELS.addGemini(),
      system: SPEC,
      turns: [{ role: "user", text: `WHAT THE USER PASTED:
"""
${t.slice(0, 12e3) || "(only screenshots)"}
"""
Return only the JSON.`, images: pics }],
      json: true,
      thinking: "low",
      maxTokens: 4096
    });
    const out = parseJson(res.text) || {};
    const items = (Array.isArray(out.items) ? out.items : []).map((it) => ({
      name: String(it?.name || "").trim().slice(0, 100),
      input: String(it?.input || "").trim().slice(0, 8e3),
      tabs: [...new Set((Array.isArray(it?.tabs) ? it.tabs : []).map(String).filter((x) => TABS.includes(x)))].slice(0, 3),
      why: String(it?.why || "").trim().slice(0, 200)
    })).filter((it) => it.input || it.name).slice(0, 15);
    for (const it of items) if (!it.tabs.length) it.tabs = ["tools"];
    if (!items.length) return { items: [{ name: t.slice(0, 60) || "Screenshot", input: t, tabs: ["tools"], why: "" }] };
    return { items };
  }
});
export {
  classify
};
