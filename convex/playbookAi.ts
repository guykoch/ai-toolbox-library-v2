// Playbooks: "Make a playbook" and the tweak chat. Both use Gemini with the whole library in context,
// and return a draft only — nothing is saved until the user presses Save.
import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { checkKey } from "./auth";
import { callGemini, parseJson, MODELS } from "./llm";
import { cleanPlaybook, LibRef } from "./playbooks";

const TYPES = `"create" (write & present: docs, decks, posts), "research" (research & decide), "learn" (learn & study), "career" (career & job hunt), "build" (build apps & sites), "money" (data, money & stocks), "automate" (automate & agents), "media" (video, images & audio)`;

const SHAPE = `A playbook is JSON:
{"title": "short name (max 6 words)", "goal": "one sentence: what you end up with", "type": one of ${TYPES},
 "topics": ["1-3 short topic tags, e.g. Product management, Startups, NotebookLM"], "time": "rough time, e.g. 1–2 hours",
 "steps": [{"title": "short imperative step name", "do": "1-3 plain sentences: exactly what to do in this step",
            "use": [{"k": "t" | "l" | "c", "id": "the item's id from the LIBRARY list"}],
            "prompt": "optional: a ready-to-copy prompt for this step, with [brackets] for what the user fills in",
            "tip": "optional: one short tip, or a tool the step needs that is NOT in the library (say so plainly)"}]}
Rules: 3-8 steps in a sensible order. "use" may ONLY contain items from the LIBRARY list, by their exact k and id (k: t = Tools tab, l = Prompts-tab library, c = Rules/Agents/Automations card). Prefer the best 1-3 items per step; a step can have none. Never invent links or items.`;

function libText(lib: LibRef[]) {
  return lib.map((x) => `${x.k}:${x.id} | ${x.name} | ${x.info}`).join("\n");
}
function defaultsText(defaults: string[]) {
  return defaults.length ? `\nPINNED DEFAULTS (always follow these when they apply):\n${defaults.map((d) => "- " + d).join("\n")}\n` : "";
}

export const make = action({
  args: { key: v.string(), goal: v.string(), defaults: v.optional(v.array(v.string())) },
  handler: async (ctx, { key, goal, defaults }): Promise<{ playbook: any; note: string }> => {
    checkKey(key);
    const g = goal.trim();
    if (!g) throw new ConvexError("Write your goal first, e.g. \"prepare a pitch deck for investors\".");
    const lib: LibRef[] = await ctx.runQuery(internal.playbooks.library, {});
    const res = await callGemini({
      model: MODELS.advisor(),
      system: `You build a step-by-step playbook that reaches the user's goal using the user's own AI library.\n${SHAPE}\nAlso add "note": one short sentence for the user (in the language they wrote in), e.g. which step had no matching item in their library. Reply with JSON only: {"playbook": {...}, "note": "..."}. Write the playbook in the user's language (Hebrew or English).`,
      turns: [{ role: "user", text: `LIBRARY (id | name | what it is):\n${libText(lib)}\n${defaultsText(defaults || [])}\nGOAL: ${g.slice(0, 2000)}` }],
      json: true,
      thinking: "medium",
      maxTokens: 8192,
    });
    const out = parseJson(res.text) || {};
    const playbook = cleanPlaybook(out.playbook || out, lib);
    if (!playbook.steps.length) throw new ConvexError("Couldn't build a playbook for that. Try saying the goal in another way.");
    return { playbook, note: typeof out.note === "string" ? out.note.slice(0, 400) : "" };
  },
});

// The tweak chat: understands the goal, the whole current draft, every earlier message, the pinned defaults
// and the library; handles typos, Hebrew/English and vague references ("the second step", "that tool").
export const tweak = action({
  args: {
    key: v.string(),
    playbook: v.any(),
    history: v.array(v.object({ role: v.string(), text: v.string() })),
    message: v.string(),
    defaults: v.optional(v.array(v.string())),
  },
  handler: async (ctx, { key, playbook, history, message, defaults }): Promise<{ reply: string; question: string; playbook: any | null; changes: string[] }> => {
    checkKey(key);
    const m = message.trim();
    if (!m) throw new ConvexError("Write what to change.");
    const lib: LibRef[] = await ctx.runQuery(internal.playbooks.library, {});
    const numbered = { ...playbook, steps: (playbook?.steps || []).map((s: any, i: number) => ({ step: i + 1, ...s })) };
    const turns = history.slice(-16).map((h) => ({ role: (h.role === "user" ? "user" : "model") as "user" | "model", text: h.text.slice(0, 3000) }));
    while (turns.length && turns[0].role !== "user") turns.shift();
    // Gemini needs user / model turns to alternate: merge any two in a row.
    for (let i = turns.length - 1; i > 0; i--) if (turns[i].role === turns[i - 1].role) { turns[i - 1].text += "\n" + turns[i].text; turns.splice(i, 1); }
    if (turns.length && turns[turns.length - 1].role === "user") turns.push({ role: "model", text: "(ok)" });
    turns.push({
      role: "user",
      text: `CURRENT PLAYBOOK (steps are numbered):\n${JSON.stringify(numbered).slice(0, 30000)}\n\nMY REQUEST: ${m.slice(0, 3000)}`,
    });
    const res = await callGemini({
      model: MODELS.advisor(),
      system: `You help the user tweak a playbook through a back-and-forth chat.
Understand the request in full context: the playbook's goal, every step as it is now, everything said earlier in this chat (earlier requests and your earlier changes), the pinned defaults, and the library.
The user may write in Hebrew or English, with typos, and refer to things vaguely ("the second step", "that tool", "make it shorter", "undo the last thing", "swap it for the open-source one") — resolve these from the context. "Step N" means the step numbered N in the CURRENT playbook.
If the request is truly ambiguous (two very different readings), don't change anything: ask ONE short question with the likely options.
Otherwise apply the change and keep everything else exactly as it was.
${SHAPE}
LIBRARY (id | name | what it is):
${libText(lib)}
${defaultsText(defaults || [])}
Reply with JSON only:
{"reply": "1-2 short sentences in the user's language saying what you changed (or the question)",
 "question": "the question if you need one, else empty",
 "changes": ["each change in a few words, e.g. 'Step 3: swapped Cursor for Lovable'"],
 "playbook": the FULL updated playbook (same shape, without step numbers), or null if you asked a question}`,
      turns,
      json: true,
      thinking: "medium",
      maxTokens: 8192,
    });
    const out = parseJson(res.text) || {};
    const question = typeof out.question === "string" ? out.question.trim().slice(0, 500) : "";
    const pb = out.playbook && !question ? cleanPlaybook(out.playbook, lib) : null;
    return {
      reply: typeof out.reply === "string" ? out.reply.slice(0, 800) : question || "Done.",
      question,
      playbook: pb && pb.steps.length ? pb : null,
      changes: Array.isArray(out.changes) ? out.changes.map((c: any) => String(c).slice(0, 200)).slice(0, 10) : [],
    };
  },
});
