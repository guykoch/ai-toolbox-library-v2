// "Prompt Generator": turns a rough request into a precise, ready-to-use prompt, the way the Lyra method does.
// The 4-D method: Deconstruct → Diagnose → Develop → Deliver.
//   Quick mode: fix the main gaps with sensible defaults and deliver straight away.
//   Detailed mode: also ask 2-3 sharp questions; answering them gives an even better version.
import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { checkKey } from "./auth";
import { callGemini, MODELS, parseJson } from "./llm";

const TARGETS: Record<string, string> = {
  any: "Any AI assistant: use universal best practices (clear role, context, task, constraints, output format).",
  chatgpt: "ChatGPT: clearly labeled sections, explicit output format, step-by-step instructions; conversation starters work well.",
  claude: "Claude: rich context, XML-style tags for inputs (<context>, <task>, <format>), ask it to think step by step before answering on complex tasks; it handles long prompts well.",
  gemini: "Gemini: direct instructions, explicit structure and comparisons, examples of the desired output; good for creative and comparative tasks.",
  image: "An image generator (Midjourney, DALL-E, Nano Banana, etc.): one dense descriptive prompt: subject, setting, composition, camera/lens or medium, lighting, color palette, mood, style references, aspect ratio; no chatty instructions.",
};

const SYSTEM = `You are a master prompt engineer. You turn a person's rough request into the best possible ready-to-use prompt for an AI, using the 4-D method:

1. DECONSTRUCT - find the real goal behind the words, the key facts and entities, the expected output, and the constraints. Note what was given and what is missing.
2. DIAGNOSE - spot gaps and ambiguity: unclear audience, goal, scope, format, length, tone, success criteria, examples.
3. DEVELOP - pick the techniques that fit the request type:
   - Creative (writing, marketing, ideas): a fitting expert role, audience, tone and voice, multiple options or angles.
   - Technical (code, data, analysis): precise constraints, inputs/outputs, edge cases, step-by-step reasoning, verification.
   - Educational (explain, teach, coach): level of the learner, clear structure, examples, checks for understanding.
   - Complex (strategy, decisions, multi-step work): break into steps, chain-of-thought, frameworks, criteria for judging.
   - Persona / ongoing chat ("act as…"): a detailed role with experience and judgment, how to work with the user (ask questions first, be direct, prioritize), output format, "stay in this role".
   Core techniques to use when they help: role assignment, context layering, task decomposition, explicit output format, constraints, few-shot examples, asking clarifying questions first, self-check before answering.
4. DELIVER - write the final prompt: complete, specific, well structured (short headed sections or bullet lists), with [square-bracket placeholders] for facts only the user knows (with a short e.g. inside). Write it in the same language the user wrote in. Never answer the request itself - only write the prompt.

Rules:
- The prompt must be immediately usable: copy, fill in placeholders, paste.
- Keep it as long as the task needs and no longer. A simple ask gets a compact prompt; a complex one gets full structure.
- Don't invent facts about the user; use placeholders.
- Tailor it to the TARGET AI described below.`;

export const generate = action({
  args: {
    key: v.string(),
    text: v.string(),
    target: v.optional(v.string()),
    mode: v.optional(v.string()), // "quick" | "detailed"
    answers: v.optional(v.array(v.object({ q: v.string(), a: v.string() }))),
  },
  handler: async (_ctx, { key, text, target, mode, answers }): Promise<{ prompt: string; whatChanged: string[]; techniques: string[]; proTip: string; questions: string[] }> => {
    checkKey(key);
    const req = text.trim().slice(0, 4000);
    if (!req) throw new ConvexError("Write what you want the AI to do first.");
    const tgt = TARGETS[target || "any"] || TARGETS.any;
    const detailed = mode === "detailed";
    const answered = (answers || []).filter((x) => x.a.trim());
    const user =
      `REQUEST:\n${req}\n\nTARGET AI: ${tgt}\n\nMODE: ${detailed ? "DETAILED" : "QUICK"}` +
      (answered.length ? `\n\nTHE USER ANSWERED YOUR QUESTIONS (use these facts instead of placeholders):\n${answered.map((x) => `Q: ${x.q}\nA: ${x.a}`).join("\n")}` : "") +
      `\n\nReply with JSON only:
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
      maxTokens: 6000,
    });
    const j = parseJson(res.text) || {};
    const arr = (x: any, n: number) => (Array.isArray(x) ? x.map((s) => String(s).trim()).filter(Boolean).slice(0, n) : []);
    const prompt = String(j.prompt || "").trim();
    if (!prompt) throw new ConvexError("The generator didn't return a prompt. Please try again.");
    return { prompt, whatChanged: arr(j.whatChanged, 5), techniques: arr(j.techniques, 4), proTip: String(j.proTip || "").trim(), questions: detailed && !answered.length ? arr(j.questions, 3) : [] };
  },
});
