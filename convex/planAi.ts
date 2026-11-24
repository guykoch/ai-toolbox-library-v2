// The "Plan" pop-up: a chat that turns a free-text request into an explained, step-by-step plan
// using the best items in the user's library (tools, skills, connectors, prompt libraries, single prompts,
// rules, agents, automations), with 2 alternatives per item. It asks questions first when details are missing.
import { action } from "./_generated/server";
import { v, ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { checkKey } from "./auth";
import { callGemini, parseJson, MODELS, FILE_MIME, docsBlock, GeminiTurn } from "./llm";
import { KIND_LABEL } from "./kinds";

type Lib = { topics: string[]; types: { key: string; label: string; icon: string }[]; tools: { id: string; name: string; kind: string; cat: string; info: string; url: string }[]; libs: { id: string; name: string; info: string; copied: boolean }[]; cards: { id: string; tab: string; name: string; info: string }[] };
type PRow = { pid: number; libId: string; title: string; desc: string };
type IRow = { cid: string; n: number; title: string; desc: string; tag: string; tab: string; card: string };
export type Ref = { ref: string; name: string; type: string; where: string };

const STOP = new Set("a an the and or for to of in on with my me i you your want need that this is be it as by from about how what which can please some any like make do get use using help plan".split(" "));
const words = (s: string) => s.toLowerCase().split(/[^a-z0-9À-ɏ]+/).filter((w) => w.length > 2 && !STOP.has(w));
function shortlist<T extends { title: string; desc: string }>(rows: T[], kws: string[], n: number): T[] {
  const ks = [...new Set(kws.flatMap(words))].slice(0, 50);
  if (!ks.length) return [];
  const low = rows.map((r) => ({ r, t: r.title.toLowerCase(), d: r.desc.toLowerCase() }));
  const df = new Map(ks.map((k) => [k, low.filter((x) => x.t.includes(k) || x.d.includes(k)).length]));
  return low
    .map((x) => ({ r: x.r, s: ks.reduce((s, k) => { const d = df.get(k) || 0; if (!d) return s; const idf = Math.log(1 + low.length / d); return s + (x.t.includes(k) ? 3 * idf : x.d.includes(k) ? idf : 0); }, 0) }))
    .filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, n).map((x) => x.r);
}
const TAB_TYPE: Record<string, string> = { rules: "Rule / guardrail", agents: "Agent", autos: "Automation" };
const ITEM_TYPE: Record<string, string> = { rules: "Rule file", agents: "Agent", autos: "Workflow" };

const SYSTEM = `You are a senior AI-workflow planner inside the user's personal "AI Toolbox" app. The user writes a free-text request (English or Hebrew, maybe with typos). You turn it into a clear, explained, step-by-step plan that uses the BEST items from THEIR library.

HOW TO WORK
0. FIRST decide what the user is doing in THIS message — be a dynamic partner, not a plan machine:
   a) ASKING or CONSULTING (a question, "what do you think", "which is better", "why did you pick X", "how does Y work", "is this realistic", brainstorming, thinking out loud): ANSWER it directly in "reply" — conversational, specific to their situation, the current plan and their library (name the relevant items). Don't make or change a plan ("plan": null). You may end with one short offer like "Want me to turn this into a plan?" or "Want me to swap that into step 3?" when it would help.
   b) ASKING FOR A PLAN or a clear goal to achieve ("help me do X", "I need to…", "plan…", "make it"): follow steps 1-3 below.
   c) ASKING TO CHANGE the existing plan: change it (step 3).
   d) Unclear which: answer briefly and ask what they'd like.
1. Understand the full context: the whole chat so far, the current plan (if any), earlier answers, and the pinned defaults.
2. If this is a new plan request and details that would really change the plan are missing (e.g. the audience, the deadline, what they already have, budget, skill level, which platform), ask 1-3 short questions INSTEAD of a plan. Give each question 2-4 short quick-reply options. Don't ask about things you can reasonably assume; never ask twice in a row about the same thing; if the user says "just do it" or similar, make the plan with sensible assumptions and list them in "assumptions".
3. When changing an existing plan, keep everything the user didn't ask to change. Resolve vague references ("step 2", "that tool", "make it cheaper") from context. If a change request is truly ambiguous, ask one short question and return "plan": null.

PICKING ITEMS
- Use ONLY items from the LIBRARY lists below, by their exact ref:
  t:<id> tool (its type is shown: Skill, Connector (MCP), Plugin, Web app, App, Developer tool, AI model, Learn…), l:<id> prompt library, c:<id> rule / agent / automation card,
  p:<id> one specific prompt (inside a prompt library), i:<card>:<n> one specific copied file (an agent file, a rule file or an n8n workflow).
- Prefer the most specific useful item: a specific prompt (p:) or agent/workflow file (i:) beats its whole library when it fits.
- Each step gets 1-3 items. Each item gets "role": ONE concise sentence (max ~22 words) saying what it is and exactly how it's used in this step.
- Each item gets "alts": the 2 next-best alternatives from the library for that same job (different refs, each with its own role). If fewer than 2 good alternatives exist, give what exists.
- If the job needs something not in the library, say so in "gaps" (name a well-known option) — never invent refs.

THE PLAN (JSON)
{"title": "short name", "goal": "one sentence", "outcome": "what the user ends up with",
 "type": one of "create" (write & present), "research", "learn", "career", "build" (apps & sites), "money" (data & stocks), "automate" (automate & agents), "media" (video, images, audio), or one of the user's own types listed under PLAYBOOK TYPES AND TOPICS (by its key),
 "newType": only if NONE of those fits at all: {"label": "2-3 word type name", "icon": "one emoji"} (else omit),
 "topics": ["1-3 short topic tags; reuse the user's EXISTING TOPICS (exact spelling) when they fit, otherwise create a short new one, e.g. Product management, Startups, NotebookLM"],
 "summary": "2-3 plain sentences: the approach and why it works",
 "approach": ["2-4 short key ideas"], "assumptions": ["what you assumed, if anything"],
 "time": "rough total time", "cost": "rough cost, e.g. Free / ~$20 a month (say which item costs)",
 "phases": [{"id": "A", "name": "short phase name"}] (2-4 phases),
 "steps": [{"id": "s1", "phase": "A", "title": "short imperative", "why": "one sentence: why this step matters",
            "do": "2-4 plain sentences: exactly what to do", "output": "what this step produces",
            "after": ["ids of steps that must be done first (empty for the first)"],
            "items": [{"ref": "t:12", "role": "...", "alts": [{"ref": "...", "role": "..."}, {"ref": "...", "role": "..."}]}],
            "prompt": "optional ready-to-copy prompt with [brackets] to fill", "tip": "optional short tip"}],
 "caveats": ["2-4 honest risks, limits or things to watch"], "gaps": ["needed but not in the library: …"]}
Steps: 3-9, in order. Keep text short and friendly; no jargon unless the user uses it. Write in the user's language.

REPLY (JSON only)
{"reply": "for a plan or change: 1-3 short sentences (what you did, or why you ask). For a question or consulting: your full answer (plain text, short paragraphs or '- ' bullets, usually under 150 words)",
 "questions": [{"q": "...", "options": ["...", "..."]}] (empty when you give a plan),
 "plan": the FULL plan when you made or changed one, or null when you answer, consult or ask questions,
 "changes": ["each change in a few words, when you changed an existing plan"],
 "fileNotes": "ONLY when files are attached to the latest message: detailed notes of everything in them that could matter for this or later requests (structure, steps, numbers, names, constraints, what diagrams show) — up to ~400 words. Later messages only see these notes, not the files."}

FILES: the user may attach images, screenshots, diagrams, PDFs or documents (Word, PowerPoint, Excel, text) for context. Read them completely and use them: they can define the goal, constraints, the current setup, a process to follow or examples. Mention what you took from them. Earlier files appear in the chat as [Notes on attached files: …].`;

export const chat = action({
  args: {
    key: v.string(),
    history: v.array(v.object({ role: v.string(), text: v.string() })),
    message: v.string(),
    plan: v.optional(v.any()),
    defaults: v.optional(v.array(v.string())),
    files: v.optional(v.array(v.object({ mime: v.string(), data: v.string() }))),
    docs: v.optional(v.array(v.object({ name: v.string(), text: v.string() }))),
  },
  handler: async (ctx, { key, history, message, plan, defaults, files, docs }): Promise<{ reply: string; questions: { q: string; options: string[] }[]; plan: any | null; changes: string[]; fileNotes: string }> => {
    checkKey(key);
    const pics = (files || []).filter((f) => FILE_MIME.test(f.mime)).slice(0, 20);
    const docText = docsBlock(docs);
    const hasFiles = pics.length > 0 || !!docText;
    const m = message.trim() || (hasFiles ? "Here are some files for context." : "");
    if (!m) throw new ConvexError("Write what you want to do.");
    const lib: Lib = await ctx.runQuery(internal.playbooks.libraryForPlan, {});

    // Search words (in English) for finding specific prompts / agents / workflows.
    const userText = [...history.filter((h) => h.role === "user").map((h) => h.text), m, docText.slice(0, 3000), plan?.title || "", plan?.goal || ""].join("\n").slice(-6000);
    let kws: string[] = [userText];
    try {
      const r = await callGemini({
        model: MODELS.advisor(),
        system: 'Turn this request into 12-20 short English search keywords and synonyms for finding relevant AI prompts, agents, rule files and automation workflows (translate if needed). Reply JSON only: {"keywords": ["..."]}',
        turns: [{ role: "user", text: userText, images: pics }],
        json: true, thinking: "low", maxTokens: 1024,
      });
      const k = parseJson(r.text)?.keywords;
      if (Array.isArray(k)) kws = [userText, ...k.map(String)];
    } catch (e) { /* fall back to the user's words */ }

    const prompts: PRow[] = [];
    let cursor: string | null = null;
    for (;;) {
      const page: { rows: PRow[]; cursor: string; done: boolean } = await ctx.runQuery(internal.promptLibs.indexPage, { cursor });
      prompts.push(...page.rows);
      if (page.done) break;
      cursor = page.cursor;
    }
    const libName = new Map(lib.libs.map((l) => [l.id, l.name]));
    const pShort = shortlist(prompts.filter((p) => libName.has(p.libId)), kws, 40);
    const copied: IRow[] = await ctx.runQuery(internal.tabs.itemIndex, {});
    const iShort = shortlist(copied.map((f) => ({ ...f, desc: f.desc + " " + f.tag })), kws, 40);

    // Every ref the model may use, with display info.
    const refs = new Map<string, Ref>();
    for (const t of lib.tools) refs.set("t:" + t.id, { ref: "t:" + t.id, name: t.name, type: (KIND_LABEL as any)[t.kind] || "Tool", where: "Tools" });
    for (const l of lib.libs) refs.set("l:" + l.id, { ref: "l:" + l.id, name: l.name, type: "Prompt library", where: "Prompts" });
    for (const c of lib.cards) refs.set("c:" + c.id, { ref: "c:" + c.id, name: c.name, type: TAB_TYPE[c.tab] || "Card", where: ({ rules: "Rules", agents: "Agents", autos: "Automations" } as any)[c.tab] });
    for (const p of pShort) refs.set("p:" + p.pid, { ref: "p:" + p.pid, name: p.title, type: "Prompt", where: libName.get(p.libId) || "Prompts" });
    for (const f of iShort) refs.set(`i:${f.cid}:${f.n}`, { ref: `i:${f.cid}:${f.n}`, name: f.title, type: ITEM_TYPE[f.tab] || "File", where: f.card });
    // Keep refs already in the current plan valid even if this search didn't find them again.
    for (const s of plan?.steps || []) for (const it of s.items || []) for (const r of [it, ...(it.alts || [])]) if (r?.ref && !refs.has(r.ref) && r.name) refs.set(r.ref, { ref: r.ref, name: r.name, type: r.type || "Item", where: r.where || "" });

    const libText =
      "TOOLS (ref | name | type | what it is):\n" + lib.tools.map((t) => `t:${t.id} | ${t.name} | ${(KIND_LABEL as any)[t.kind] || t.kind} | ${t.info}`).join("\n") +
      "\n\nPROMPT LIBRARIES:\n" + lib.libs.map((l) => `l:${l.id} | ${l.name} | ${l.info}`).join("\n") +
      "\n\nRULE / AGENT / AUTOMATION CARDS:\n" + lib.cards.map((c) => `c:${c.id} | ${c.name} | ${TAB_TYPE[c.tab]} | ${c.info}`).join("\n") +
      "\n\nSPECIFIC PROMPTS that may fit (ref | title | library | what it does):\n" + (pShort.map((p) => `p:${p.pid} | ${p.title} | ${libName.get(p.libId)} | ${p.desc.slice(0, 160)}`).join("\n") || "(none found)") +
      "\n\nSPECIFIC AGENT / RULE / WORKFLOW FILES that may fit (ref | title | type | collection | what it does):\n" + (iShort.map((f) => `i:${f.cid}:${f.n} | ${f.title} | ${ITEM_TYPE[f.tab]} | ${f.card} | ${f.desc.slice(0, 160)}`).join("\n") || "(none found)") +
      "\n\nPLAYBOOK TYPES AND TOPICS already used:\nOwn types: " + (lib.types.map((t) => `${t.key} (${t.icon} ${t.label})`).join(", ") || "none") + "\nExisting topics: " + (lib.topics.join(", ") || "none") +
      (defaults?.length ? "\n\nPINNED DEFAULTS (follow when they apply):\n" + defaults.map((d) => "- " + d).join("\n") : "");

    const turns: GeminiTurn[] = history.slice(-20).map((h) => ({ role: (h.role === "user" ? "user" : "model") as "user" | "model", text: h.text.slice(0, 7000) }));
    while (turns.length && turns[0].role !== "user") turns.shift();
    for (let i = turns.length - 1; i > 0; i--) if (turns[i].role === turns[i - 1].role) { turns[i - 1].text += "\n" + turns[i].text; turns.splice(i, 1); }
    if (turns.length && turns[turns.length - 1].role === "user") turns.push({ role: "model", text: "(ok)" });
    turns.push({
      role: "user",
      text: (plan ? `CURRENT PLAN:\n${JSON.stringify(stripPlan(plan)).slice(0, 40000)}\n\n` : "") + docText +
        (pics.length ? `${pics.length} IMAGE(S) / PDF(S) ATTACHED to this message — read every one fully (diagrams, text, numbers).\n\n` : "") +
        `MY MESSAGE: ${m.slice(0, 4000)}`,
      images: pics,
    });

    knownTypes = new Set(lib.types.map((t) => t.key));
    const res = await callGemini({ model: MODELS.advisor(), system: SYSTEM + "\n\nLIBRARY\n" + libText, turns, json: true, thinking: "high", maxTokens: 16000 });
    const out = parseJson(res.text) || {};
    const fileNotes = hasFiles ? String(out.fileNotes || "").slice(0, 6000) : "";
    const questions = (Array.isArray(out.questions) ? out.questions : []).slice(0, 3).map((q: any) => ({ q: String(q?.q || "").slice(0, 300), options: (Array.isArray(q?.options) ? q.options : []).map((o: any) => String(o).slice(0, 80)).slice(0, 4) })).filter((q: any) => q.q);
    const p = out.plan && typeof out.plan === "object" ? cleanPlan(out.plan, refs) : null;
    return {
      reply: String(out.reply || (questions.length ? "A couple of quick questions first:" : p ? "Here's your plan." : "Sorry — I couldn't work that out. Try saying it another way.")).slice(0, 4000),
      questions: p ? [] : questions,
      plan: p && p.steps.length ? p : null,
      changes: Array.isArray(out.changes) ? out.changes.map((c: any) => String(c).slice(0, 200)).slice(0, 12) : [],
      fileNotes,
    };
  },
});

// The plan sent back to the model: refs and text only (no display fields).
function stripPlan(p: any) {
  return { ...p, steps: (p.steps || []).map((s: any) => ({ ...s, items: (s.items || []).map((it: any) => ({ ref: it.ref, role: it.role, alts: (it.alts || []).map((a: any) => ({ ref: a.ref, role: a.role })) })) })) };
}

let knownTypes = new Set<string>();
const BASE_TYPES = ["create", "research", "learn", "career", "build", "money", "automate", "media"];
// One of the 8 types, one of the user's own types, or a brand-new one ("x-<name>", with its label and emoji).
function planType(p: any) {
  const nt = p?.newType;
  if (nt && typeof nt === "object" && str(nt.label, 30)) {
    const label = str(nt.label, 30), slug = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "other";
    return { type: "x-" + slug, typeLabel: label, typeIcon: str(nt.icon, 8) || "\u{1F4C1}" };
  }
  if (BASE_TYPES.includes(p?.type) || knownTypes.has(p?.type)) return { type: p.type };
  return { type: "create" };
}
const str = (x: any, n: number) => (typeof x === "string" ? x.trim().slice(0, n) : "");
const list = (x: any, n: number, len = 300) => (Array.isArray(x) ? x.map((y) => str(y, len)).filter(Boolean).slice(0, n) : []);

export function cleanPlan(p: any, refs: Map<string, Ref>) {
  const phases = (Array.isArray(p.phases) ? p.phases : []).map((ph: any, i: number) => ({ id: str(ph?.id, 10) || String.fromCharCode(65 + i), name: str(ph?.name, 40) || "Phase " + (i + 1) })).slice(0, 5);
  if (!phases.length) phases.push({ id: "A", name: "Plan" });
  const phaseIds = new Set(phases.map((x: any) => x.id));
  const ref = (r: any) => { const x = refs.get(str(r?.ref, 60)); return x ? { ...x, role: str(r?.role, 300) } : null; };
  const steps = (Array.isArray(p.steps) ? p.steps : []).slice(0, 12).map((s: any, i: number) => {
    const used = new Set<string>();
    const items = (Array.isArray(s?.items) ? s.items : []).map((it: any) => {
      const main = ref(it);
      if (!main || used.has(main.ref)) return null;
      used.add(main.ref);
      const alts = (Array.isArray(it?.alts) ? it.alts : []).map(ref).filter((a: any) => a && a.ref !== main.ref).slice(0, 2);
      return { ...main, alts };
    }).filter(Boolean).slice(0, 4);
    return {
      id: str(s?.id, 10) || "s" + (i + 1),
      phase: phaseIds.has(s?.phase) ? s.phase : phases[Math.min(phases.length - 1, Math.floor((i * phases.length) / Math.max(1, p.steps.length)))].id,
      title: str(s?.title, 100) || "Step " + (i + 1), why: str(s?.why, 400), do: str(s?.do, 1500), output: str(s?.output, 300),
      after: list(s?.after, 6, 10), items, prompt: str(s?.prompt, 5000), tip: str(s?.tip, 500),
    };
  });
  const ids = new Set(steps.map((s: any) => s.id));
  for (const s of steps) s.after = s.after.filter((a: string) => ids.has(a) && a !== s.id);
  return {
    ...planType(p),
    topics: list(p.topics, 3, 40),
    title: str(p.title, 100) || "Your plan", goal: str(p.goal, 400), outcome: str(p.outcome, 400), summary: str(p.summary, 1000),
    approach: list(p.approach, 5), assumptions: list(p.assumptions, 5), time: str(p.time, 60), cost: str(p.cost, 120),
    phases, steps, caveats: list(p.caveats, 6), gaps: list(p.gaps, 5),
  };
}

// ---------- "How it works": an architecture diagram of a plan (components + arrows for what flows between them) ----------
const ARCH_KINDS = ["you", "input", "tool", "agent", "prompt", "rule", "automation", "data", "output", "goal"];
const ARCH_SYSTEM = `You turn a step-by-step AI plan into a simple ARCHITECTURE DIAGRAM that shows how the plan works, for a non-technical reader.
Think "system diagram", not "to-do list": the boxes are the COMPONENTS (the person, starting material, tools, agents, prompts, rule files, automations, data that gets produced, the final result) and the arrows show WHAT FLOWS between them (data, drafts, instructions, results).
Reply JSON only:
{"summary": "one plain sentence describing the flow from start to finish",
 "nodes": [{"id": "n1", "label": "2-4 words", "kind": one of ${JSON.stringify(ARCH_KINDS)},
   "what": "one short plain sentence: what this component is",
   "why": "one short plain sentence: its job in THIS plan",
   "steps": [step numbers (1-based) where it is used]}],
 "edges": [{"from": "n1", "to": "n2", "label": "1-3 words: what flows, e.g. \\"raw notes\\", \\"draft deck\\", \\"feedback\\"", "loop": true only for a feedback/repeat arrow that goes backwards}]}
Rules:
- 5 to 14 nodes. Start with "you" and/or "input" nodes, end with "output" and one "goal" node.
- Use the plan's real tool/agent/prompt names as labels where they exist (shortened). Merge near-duplicates; leave out minor items.
- Every node must have at least one arrow. Arrows go forward (start → finish) except loops.
- Write in the same language as the plan. Plain words, no jargon.`;

export const arch = action({
  args: { key: v.string(), plan: v.any() },
  handler: async (_ctx, { key, plan }) => {
    checkKey(key);
    const p = plan || {};
    const steps = Array.isArray(p.steps) ? p.steps.slice(0, 30) : [];
    if (!steps.length) throw new ConvexError("Make a plan first.");
    const s = (x: any, n = 400) => String(x || "").replace(/\s+/g, " ").trim().slice(0, n);
    const text = [`PLAN: ${s(p.title, 200)}`, p.goal ? `Goal: ${s(p.goal)}` : "", p.outcome ? `End result: ${s(p.outcome)}` : "", p.summary ? `Approach: ${s(p.summary, 800)}` : "",
      ...steps.map((st: any, i: number) => `Step ${i + 1}: ${s(st.title, 150)}\n  Do: ${s(st.do, 500)}\n  You get: ${s(st.output, 200)}\n  Uses: ${(Array.isArray(st.items) ? st.items : []).map((it: any) => `${s(it.name, 80)} (${s(it.type, 40)}${it.role ? ": " + s(it.role, 150) : ""})`).join("; ") || "nothing specific"}`)].filter(Boolean).join("\n");
    const res = await callGemini({ model: MODELS.advisor(), system: ARCH_SYSTEM, turns: [{ role: "user", text }], json: true, thinking: "medium", maxTokens: 6000 });
    const out = parseJson(res.text) || {};
    const nodes = (Array.isArray(out.nodes) ? out.nodes : []).slice(0, 16).map((n: any, i: number) => ({
      id: s(n?.id, 20) || "n" + (i + 1), label: s(n?.label, 40) || "Part " + (i + 1), kind: ARCH_KINDS.includes(n?.kind) ? n.kind : "tool",
      what: s(n?.what, 220), why: s(n?.why, 220), steps: (Array.isArray(n?.steps) ? n.steps : []).map(Number).filter((x: number) => x >= 1 && x <= steps.length).slice(0, 8),
    }));
    const ids = new Set(nodes.map((n: any) => n.id));
    const edges = (Array.isArray(out.edges) ? out.edges : []).map((e: any) => ({ from: s(e?.from, 20), to: s(e?.to, 20), label: s(e?.label, 30), loop: e?.loop === true }))
      .filter((e: any) => ids.has(e.from) && ids.has(e.to) && e.from !== e.to).slice(0, 30);
    if (nodes.length < 2 || !edges.length) throw new ConvexError("Couldn’t draw this plan — try again.");
    return { summary: s(out.summary, 300), nodes, edges };
  },
});

// ---------- "Generate plan prompt": one prompt that carries out the whole plan as it stands right now ----------
const BUILD_SYSTEM = `You write ONE complete, ready-to-paste prompt that makes an AI assistant (e.g. Claude, ChatGPT or Gemini, ideally with web, file and tool access) carry out the user's ENTIRE plan, exactly as the plan stands now.
Use only the steps and items given — do not add, drop or swap tools. Keep the step order and phases.
The prompt must contain, with clear headings:
1. Role and goal: who the AI acts as, the goal and the end result.
2. Context: the user's preferences/defaults and any assumptions; placeholders in [SQUARE BRACKETS] for details the user must fill in, listed together at the top under "Fill in before sending".
3. Tools and resources: every item with what it is for in this plan and its link (only links that were given).
4. Step-by-step instructions: for each step — what to do, which items to use and how, the expected output, and a checkpoint ("show me X and wait for my OK") at sensible points. Embed the given prompt texts and rule/agent/workflow file texts where they are used (verbatim, inside clearly marked blocks); if a text is too long or missing, say where to get it.
5. Things the AI can't do itself (e.g. install an app, sign up, click in another tool): tell it to give the user short instructions for those parts instead of pretending.
6. Final deliverables checklist and quality checks; the caveats to watch for.
Start the prompt by asking the AI to confirm the plan and ask up to 3 questions only if something essential is missing, then proceed step by step.
Write in the plan's language, plain and direct. Reply with JSON only: {"prompt": "the full prompt, markdown allowed"}`;

export const buildPrompt = action({
  args: { key: v.string(), plan: v.any(), defaults: v.optional(v.array(v.string())) },
  handler: async (_ctx, { key, plan, defaults }) => {
    checkKey(key);
    const p = plan || {};
    const steps = Array.isArray(p.steps) ? p.steps.slice(0, 40) : [];
    if (!steps.length) throw new ConvexError("This plan has no steps yet.");
    const s = (x: any, n = 600) => String(x || "").trim().slice(0, n);
    let budget = 60000; // characters of embedded prompt/file texts
    const text = [
      `PLAN: ${s(p.title, 200)}`, p.goal ? `Goal: ${s(p.goal)}` : "", p.outcome ? `End result: ${s(p.outcome)}` : "",
      p.summary ? `Approach: ${s(p.summary, 1200)}` : "", Array.isArray(p.approach) && p.approach.length ? `Approach points: ${p.approach.map((x: any) => s(x, 200)).join(" | ")}` : "",
      Array.isArray(p.assumptions) && p.assumptions.length ? `Assumed: ${p.assumptions.map((x: any) => s(x, 200)).join(" | ")}` : "",
      p.time ? `Time: ${s(p.time, 80)}` : "", p.cost ? `Cost: ${s(p.cost, 80)}` : "",
      defaults && defaults.length ? `USER'S STANDING PREFERENCES: ${defaults.map((x) => s(x, 200)).join(" | ")}` : "",
      ...steps.map((st: any, i: number) => {
        const items = (Array.isArray(st.items) ? st.items : []).slice(0, 12).map((it: any) => {
          let t = s(it.text, 12000);
          if (t.length > budget) t = budget > 500 ? t.slice(0, budget) + "\n[…cut: open the link for the rest]" : "";
          budget -= t.length;
          return `  - ${s(it.name, 120)} (${s(it.type, 40)}${it.where ? ", from " + s(it.where, 60) : ""})${it.role ? ": " + s(it.role, 300) : ""}${it.url ? "\n    Link: " + s(it.url, 300) : ""}${t ? "\n    FULL TEXT:\n\"\"\"\n" + t + "\n\"\"\"" : ""}`;
        }).join("\n");
        return `STEP ${i + 1}${st.phaseName ? " [" + s(st.phaseName, 60) + "]" : ""}: ${s(st.title, 200)}\n  Why: ${s(st.why, 400)}\n  Do: ${s(st.do, 1500)}\n  Output: ${s(st.output, 400)}${st.prompt ? "\n  Step prompt:\n\"\"\"\n" + s(st.prompt, 4000) + "\n\"\"\"" : ""}${st.tip ? "\n  Tip: " + s(st.tip, 300) : ""}\n  Items:\n${items || "  (none)"}`;
      }),
      Array.isArray(p.caveats) && p.caveats.length ? `CAVEATS: ${p.caveats.map((x: any) => s(x, 300)).join(" | ")}` : "",
    ].filter(Boolean).join("\n\n");
    const res = await callGemini({ model: MODELS.advisor(), system: BUILD_SYSTEM, turns: [{ role: "user", text }], json: true, thinking: "medium", maxTokens: 24000 });
    const out = parseJson(res.text);
    const prompt = String((out && out.prompt) || "").trim();
    if (prompt.length < 80) throw new ConvexError("Couldn’t write the prompt — try again.");
    return { prompt };
  },
});
