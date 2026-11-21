// stub:server
var id = (d) => d;
var action = id;

// convex/promptGen.ts
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

// convex/promptGen.ts
var TARGETS = {
  any: "Any AI assistant: use universal best practices (clear role, context, task, constraints, output format).",
  chatgpt: "ChatGPT: clearly labeled sections, explicit output format, step-by-step instructions; conversation starters work well.",
  claude: "Claude: rich context, XML-style tags for inputs (<context>, <task>, <format>), ask it to think step by step before answering on complex tasks; it handles long prompts well.",
  gemini: "Gemini: direct instructions, explicit structure and comparisons, examples of the desired output; good for creative and comparative tasks.",
  image: "An image generator (Midjourney, DALL-E, Nano Banana, etc.): one dense descriptive prompt: subject, setting, composition, camera/lens or medium, lighting, color palette, mood, style references, aspect ratio; no chatty instructions."
};
var SYSTEM = `You are a master prompt engineer. You turn a person's rough request into the best possible ready-to-use prompt for an AI, using the 4-D method:

1. DECONSTRUCT - find the real goal behind the words, the key facts and entities, the expected output, and the constraints. Note what was given and what is missing.
2. DIAGNOSE - spot gaps and ambiguity: unclear audience, goal, scope, format, length, tone, success criteria, examples.
3. DEVELOP - pick the techniques that fit the request type:
   - Creative (writing, marketing, ideas): a fitting expert role, audience, tone and voice, multiple options or angles.
   - Technical (code, data, analysis): precise constraints, inputs/outputs, edge cases, step-by-step reasoning, verification.
   - Educational (explain, teach, coach): level of the learner, clear structure, examples, checks for understanding.
   - Complex (strategy, decisions, multi-step work): break into steps, chain-of-thought, frameworks, criteria for judging.
   - Persona / ongoing chat ("act as\u2026"): a detailed role with experience and judgment, how to work with the user (ask questions first, be direct, prioritize), output format, "stay in this role".
   Core techniques to use when they help: role assignment, context layering, task decomposition, explicit output format, constraints, few-shot examples, asking clarifying questions first, self-check before answering.
4. DELIVER - write the final prompt: complete, specific, well structured (short headed sections or bullet lists), with [square-bracket placeholders] for facts only the user knows (with a short e.g. inside). Write it in the same language the user wrote in. Never answer the request itself - only write the prompt.

Rules:
- The prompt must be immediately usable: copy, fill in placeholders, paste.
- Keep it as long as the task needs and no longer. A simple ask gets a compact prompt; a complex one gets full structure.
- Don't invent facts about the user; use placeholders.
- Tailor it to the TARGET AI described below.`;
var generate = action({
  args: {
    key: v.string(),
    text: v.string(),
    target: v.optional(v.string()),
    mode: v.optional(v.string()),
    // "quick" | "detailed"
    answers: v.optional(v.array(v.object({ q: v.string(), a: v.string() })))
  },
  handler: async (_ctx, { key, text, target, mode, answers }) => {
    checkKey(key);
    const req = text.trim().slice(0, 4e3);
    if (!req) throw new ConvexError3("Write what you want the AI to do first.");
    const tgt = TARGETS[target || "any"] || TARGETS.any;
    const detailed = mode === "detailed";
    const answered = (answers || []).filter((x) => x.a.trim());
    const user = `REQUEST:
${req}

TARGET AI: ${tgt}

MODE: ${detailed ? "DETAILED" : "QUICK"}` + (answered.length ? `

THE USER ANSWERED YOUR QUESTIONS (use these facts instead of placeholders):
${answered.map((x) => `Q: ${x.q}
A: ${x.a}`).join("\n")}` : "") + `

Reply with JSON only:
{"prompt": "the final optimized prompt (use \\n for new lines)",
 "whatChanged": ["2-5 short bullets: what you added or fixed, in plain words"],
 "techniques": ["1-4 technique names you applied, e.g. Role assignment, Output format, Task breakdown"],
 "proTip": "one short practical tip for using this prompt",
 "questions": ${detailed && !answered.length ? '["2-3 short, specific questions whose answers would most improve the prompt"]' : "[]"}}`;
    const res = await callGemini({
      model: MODELS.advisor(),
      system: SYSTEM,
      turns: [{ role: "user", text: user }],
      json: true,
      thinking: "medium",
      maxTokens: 6e3
    });
    const j = parseJson(res.text) || {};
    const arr = (x, n) => Array.isArray(x) ? x.map((s) => String(s).trim()).filter(Boolean).slice(0, n) : [];
    const prompt = String(j.prompt || "").trim();
    if (!prompt) throw new ConvexError3("The generator didn't return a prompt. Please try again.");
    return { prompt, whatChanged: arr(j.whatChanged, 5), techniques: arr(j.techniques, 4), proTip: String(j.proTip || "").trim(), questions: detailed && !answered.length ? arr(j.questions, 3) : [] };
  }
});
export {
  generate
};
