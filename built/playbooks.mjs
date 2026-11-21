// stub:server
var id = (d) => d;
var query = id;
var mutation = id;
var internalQuery = id;
var internalMutation = id;
var internalAction = id;

// convex/playbooks.ts
import { v as v2, ConvexError as ConvexError2 } from "convex/values";

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

// convex/snapshot.ts
import { v } from "convex/values";

// stub:api
var mk = (m) => new Proxy({}, { get: (_, f) => m + ":" + String(f) });
var internal = { items: mk("items"), ingest: mk("ingest"), install: mk("install"), advisor: mk("advisor"), pipeline: mk("pipeline"), enrich: mk("enrich"), credit: mk("credit"), hype: mk("hype"), alts: mk("alts"), promptFinder: mk("promptFinder"), promptLibs: mk("promptLibs"), promptImport: mk("promptImport"), promptAdd: mk("promptAdd"), snapshot: mk("snapshot"), siteCheck: mk("siteCheck"), webjobs: mk("webjobs"), webcopy: mk("webcopy"), promptGen: mk("promptGen"), tabs: mk("tabs"), tabImport: mk("tabImport"), tabAdd: mk("tabAdd"), playbooks: mk("playbooks"), playbookAi: mk("playbookAi"), addAny: mk("addAny") };

// convex/kinds.ts
var KINDS = ["skill", "connector", "plugin", "webapp", "app", "devtool", "model", "learn", "news"];
var KIND_LABEL = {
  skill: "Skill",
  connector: "Connector (MCP)",
  plugin: "Plugin / extension",
  webapp: "Web app",
  app: "Desktop / phone app",
  devtool: "Developer tool",
  model: "AI model",
  learn: "Learn",
  news: "News"
};
function guessKind(it) {
  if (KINDS.includes(it?.kind)) return it.kind;
  const t = `${it?.title || ""} ${it?.summary || ""}`.toLowerCase();
  const url = String(it?.url || "").toLowerCase();
  const type = String(it?.type || "");
  if (type === "news") return "news";
  if (["guide", "course", "video", "post"].includes(type) || /youtube\.com|youtu\.be/.test(url)) return "learn";
  const gh = /github\.com/.test(url) || type === "open-source-repo";
  if (/\bskills?\b|skill\.md/.test(t)) return "skill";
  if (/desktop app|mac app|menu bar|iphone|android|ios app|app store|windows, macos|for windows|desktop meeting|video editor|image editor|on-device/.test(t)) return "app";
  if (/\bmcp server\b|\bconnector\b/.test(t) && !/\bcli\b/.test(t)) return "connector";
  if (/extension|plugin|add-on/.test(t) || /chromewebstore|marketplace\.visualstudio/.test(url)) return "plugin";
  if (/open-weight|open weights|text-to-speech model|image model|diarization model/.test(t) || /huggingface\.co/.test(url)) return "model";
  if (gh || /\bcli\b|library|sdk|self-hosted|framework|api\b|apis\b/.test(t)) return "devtool";
  if (/\bnews\b|report|benchmark/.test(t)) return "news";
  return "webapp";
}

// convex/snapshot.ts
var REPO = () => process.env.SNAPSHOT_REPO || "guykoch/ai-toolbox-library-v2";
var BRANCH = () => process.env.SNAPSHOT_BRANCH || "main";
var PATH = "library-snapshot.md";
var DELAY_MS = () => Number(process.env.SNAPSHOT_DELAY_MS) || 6e4;
var SHELF = { "coding-agents": "Coding agents", "agent-skills": "Agent skills", "courses-guides": "Courses & guides", "productivity": "Productivity", "app-building": "App building", "video": "Video", "image": "Image", "audio": "Audio", "ai-models": "AI models", "news-analysis": "News & analysis", "translation": "Translation", "other": "Other" };
var SECTION = { general: "All-purpose libraries", business: "Business & productivity", coding: "Coding", design: "Slides, web & app design", images: "Images, logos & products", patterns: "Thinking patterns" };
var SOURCE = { official: "Official", open: "Open source", community: "Community", academic: "Academic", free: "Free" };
async function meta(ctx) {
  return await ctx.db.query("meta").withIndex("by_key", (q) => q.eq("key", "snapshot")).first();
}
async function snapshotSoon(ctx) {
  const m = await meta(ctx);
  const val = m?.value || {};
  if (val.pendingUntil && val.pendingUntil > Date.now()) return;
  const next = { ...val, pendingUntil: Date.now() + DELAY_MS() };
  if (m) await ctx.db.patch(m._id, { value: next });
  else await ctx.db.insert("meta", { key: "snapshot", value: next });
  await ctx.scheduler.runAfter(DELAY_MS(), internal.snapshot.write, {});
}
var request = internalMutation({ args: {}, handler: async (ctx) => {
  await snapshotSoon(ctx);
} });
var ensure = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    const val = (await meta(ctx))?.value || {};
    if (!val.at || Date.now() - Date.parse(val.at) > 24 * 3600 * 1e3) await snapshotSoon(ctx);
    return null;
  }
});
var refreshNow = mutation({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    const m = await meta(ctx);
    const val = m?.value || {};
    if (val.pendingUntil && val.pendingUntil > Date.now() && val.pendingUntil - Date.now() < 1e4) return null;
    const next = { ...val, pendingUntil: Date.now() + 5e3 };
    if (m) await ctx.db.patch(m._id, { value: next });
    else await ctx.db.insert("meta", { key: "snapshot", value: next });
    await ctx.scheduler.runAfter(5e3, internal.snapshot.write, {});
    return null;
  }
});
var status = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    const val = (await meta(ctx))?.value || {};
    return { at: val.at || "", ok: val.ok ?? null, error: val.error || "", url: `https://github.com/${REPO()}/blob/${BRANCH()}/${PATH}` };
  }
});
var record = internalMutation({
  args: { ok: v.boolean(), error: v.string() },
  handler: async (ctx, { ok, error }) => {
    const m = await meta(ctx);
    const value = { ...m?.value || {}, pendingUntil: 0, ok, error, ...ok ? { at: (/* @__PURE__ */ new Date()).toISOString() } : { failedAt: (/* @__PURE__ */ new Date()).toISOString() } };
    if (m) await ctx.db.patch(m._id, { value });
    else await ctx.db.insert("meta", { key: "snapshot", value });
  }
});
var data = internalQuery({
  args: {},
  handler: async (ctx) => {
    const items = await ctx.db.query("items").collect();
    const libs = await ctx.db.query("plibs").collect();
    const cards = await ctx.db.query("tcards").collect();
    const pbs = await ctx.db.query("playbooks").collect();
    return {
      tools: items.map((r) => ({ status: r.status, ...pickTool(r.data) })),
      libs: libs.filter((l) => !l.deleting).map((l) => ({ id: l.libId, ...l.data, imp: l.imp })),
      cards: cards.filter((c) => !c.deleting).map((c) => ({ id: c.cid, tab: c.tab, title: c.data?.title, sec: c.data?.sec, kind: c.data?.kind, bestFor: c.data?.bestFor || c.data?.summary, link: c.data?.links?.[0]?.[1] || "", imp: c.imp })),
      playbooks: pbs.map((p) => ({ id: p.pbId, ...p.data }))
    };
  }
});
function pickTool(d) {
  return {
    id: d.id,
    title: d.title,
    summary: d.summary,
    date: d.date,
    iso: d.iso,
    cat: d.cat,
    kind: d.kind,
    type: d.type,
    os: d.os,
    pop: d.pop,
    url: d.url,
    host: d.host,
    alternativeTo: d.alternativeTo,
    private: d.private
  };
}
var cell = (s) => String(s ?? "").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
function render(tools, libs, cards = [], playbooks = []) {
  const active = tools.filter((t) => t.status === "active").sort((a, b) => (b.iso || "").localeCompare(a.iso || "") || b.id - a.id);
  const archived = tools.filter((t) => t.status === "archived").sort((a, b) => b.id - a.id);
  const secOrder = Object.keys(SECTION);
  const sortedLibs = [...libs].sort((a, b) => secOrder.indexOf(a.sec) - secOrder.indexOf(b.sec) || Number(String(a.id).slice(1)) - Number(String(b.id).slice(1)));
  const promptsTotal = libs.reduce((n, l) => n + (l.imp?.state === "done" ? l.imp.count : 0), 0);
  const out = [];
  out.push("# AI Toolbox \u2014 library snapshot", "");
  out.push(`Updated automatically by the app: ${(/* @__PURE__ */ new Date()).toISOString().replace("T", " ").slice(0, 16)} UTC.`);
  out.push(`Tools: ${active.length} active, ${archived.length} archived. Prompt libraries: ${libs.length} (${libs.filter((l) => l.kind === "open").length} open source, ${promptsTotal.toLocaleString("en-US")} prompts copied into Find a prompt).`);
  out.push(`Rules: ${cards.filter((c) => c.tab === "rules").length}. Agents: ${cards.filter((c) => c.tab === "agents").length}. Automations: ${cards.filter((c) => c.tab === "autos").length}. Playbooks: ${playbooks.length}.`, "");
  out.push("## Tools (active)", "");
  out.push("| id | Name | Type | Shelf | Open source | Hype | Saved | Link | Alternative for |", "|---|---|---|---|---|---|---|---|---|");
  for (const t of active) {
    const kind = KIND_LABEL[t.kind || guessKind(t)] || "";
    out.push(`| ${t.id} | ${cell(t.title)}${t.private ? " (private, do not share)" : ""} | ${cell(kind)} | ${cell(SHELF[t.cat] || t.cat)} | ${t.os ? "yes" : "no"} | ${t.pop ?? ""} | ${cell(t.date)} | ${cell(t.url)} | ${cell((t.alternativeTo || []).join(", "))} |`);
  }
  out.push("", "## Tools (archived)", "");
  if (!archived.length) out.push("None.");
  else {
    out.push("| id | Name | Link |", "|---|---|---|");
    for (const t of archived) out.push(`| ${t.id} | ${cell(t.title)} | ${cell(t.url)} |`);
  }
  out.push("", "## Prompt libraries", "");
  out.push("| id | Name | Section | Source | Open source | Prompts in Find a prompt | Best for | Link |", "|---|---|---|---|---|---|---|---|");
  for (const l of sortedLibs) {
    const n = l.imp?.state === "done" ? String(l.imp.count) : l.imp?.state === "importing" ? "copying\u2026" : l.imp?.state === "failed" ? "copy failed" : "\u2014";
    out.push(`| ${l.id} | ${cell(l.title)} | ${cell(SECTION[l.sec] || l.sec)} | ${cell(SOURCE[l.kind] || l.kind)} | ${l.kind === "open" ? "yes" : "no"} | ${n} | ${cell(l.bestFor || l.summary)} | ${cell(l.links?.[0]?.[1] || "")} |`);
  }
  for (const [tab, name] of [["rules", "Rules"], ["agents", "Agents"], ["autos", "Automations"]]) {
    const list2 = cards.filter((c) => c.tab === tab).sort((a, b) => (TAB_SEC[tab] || []).indexOf(a.sec) - (TAB_SEC[tab] || []).indexOf(b.sec) || Number(String(a.id).slice(1)) - Number(String(b.id).slice(1)));
    out.push("", `## ${name}`, "");
    if (!list2.length) {
      out.push("None yet.");
      continue;
    }
    out.push("| id | Name | Section | Source | Files copied | Best for | Link |", "|---|---|---|---|---|---|---|");
    for (const c of list2) {
      const n = c.imp?.state === "done" ? String(c.imp.count) : c.imp?.state === "importing" ? "copying\u2026" : c.imp?.state === "failed" ? "copy failed" : "\u2014";
      out.push(`| ${c.id} | ${cell(c.title)} | ${cell(c.sec)} | ${cell(SOURCE[c.kind] || c.kind)} | ${n} | ${cell(c.bestFor)} | ${cell(c.link)} |`);
    }
  }
  out.push("", "## Playbooks", "");
  if (!playbooks.length) out.push("None yet.");
  else {
    out.push("| id | Name | Type | Topics | Steps (items used) |", "|---|---|---|---|---|");
    for (const p of [...playbooks].sort((a, b) => String(a.type).localeCompare(String(b.type)) || Number(String(a.id).slice(1)) - Number(String(b.id).slice(1)))) {
      const steps = (p.steps || []).map((s, i) => `${i + 1}. ${s.title}` + (s.use?.length ? ` (${s.use.map((u) => u.k + ":" + u.id).join(", ")})` : "")).join("; ");
      out.push(`| ${p.id} | ${cell(p.title)} | ${cell(p.type)} | ${cell((p.topics || []).join(", "))} | ${cell(steps)} |`);
    }
  }
  out.push("");
  return out.join("\n");
}
var TAB_SEC = { rules: ["standards", "coding", "collections", "design"], agents: ["subagents", "assistants", "teams"], autos: ["templates", "collections", "ai"] };
var b64 = (s) => {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 32768) bin += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(bin);
};
var write = internalAction({
  args: {},
  handler: async (ctx) => {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      await ctx.runMutation(internal.snapshot.record, { ok: false, error: "GITHUB_TOKEN isn't set in Convex." });
      return;
    }
    try {
      const d = await ctx.runQuery(internal.snapshot.data, {});
      const md = render(d.tools, d.libs, d.cards, d.playbooks);
      const api = `https://api.github.com/repos/${REPO()}/contents/${PATH}`;
      const headers = { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "ai-toolbox", "Content-Type": "application/json" };
      for (let attempt = 0; ; attempt++) {
        const cur = await fetch(`${api}?ref=${encodeURIComponent(BRANCH())}`, { headers });
        let sha;
        if (cur.ok) {
          const j = await cur.json();
          sha = j.sha;
          const old = j.content ? new TextDecoder().decode(Uint8Array.from(atob(String(j.content).replace(/\n/g, "")), (c) => c.charCodeAt(0))) : "";
          const strip = (s) => s.replace(/^Updated automatically.*$/m, "");
          if (strip(old) === strip(md)) break;
        } else if (cur.status !== 404) {
          throw new Error(cur.status === 401 ? "GitHub rejected the token (401)." : `GitHub said ${cur.status} reading the file.`);
        }
        const put = await fetch(api, { method: "PUT", headers, body: JSON.stringify({ message: "Update library snapshot", content: b64(md), branch: BRANCH(), ...sha ? { sha } : {} }) });
        if (put.ok) break;
        if ((put.status === 409 || put.status === 422) && attempt < 3) {
          await new Promise((r) => setTimeout(r, 1500 * (attempt + 1)));
          continue;
        }
        throw new Error(put.status === 403 || put.status === 404 ? "The GitHub token can't write to the repo (it needs Contents: Read and write)." : put.status === 409 ? "Two updates collided; the next one will catch up." : `GitHub said ${put.status}.`);
      }
      await ctx.runMutation(internal.snapshot.record, { ok: true, error: "" });
    } catch (e) {
      await ctx.runMutation(internal.snapshot.record, { ok: false, error: String(e?.message || e).slice(0, 300) });
    }
  }
});

// convex/playbookSeed.ts
var PLAYBOOK_SEED_VERSION = "abc-1 20 Nov 2026";
var PB_TYPES = ["create", "research", "learn", "career", "build", "money", "automate", "media"];
var PLAYBOOK_SEED = [
  {
    title: "Write a PRD",
    type: "create",
    topics: ["Product management"],
    time: "1\u20132 hours",
    goal: "Go from a rough product idea to a clear, reviewed product requirements document.",
    steps: [
      {
        title: "Let the AI interview you",
        do: "Instead of writing from a blank page, have the AI ask you questions about the problem, users, goals and limits, one at a time.",
        use: [["l", "p25"]],
        prompt: "I want to write a PRD for [product idea]. Interview me one question at a time about the problem, target users, goals, success metrics, scope and constraints. After 8\u201310 questions, summarize what you learned."
      },
      { title: "Research the market", do: "Collect competitor pages and articles in NotebookLM and ask it what others do and where the gaps are.", use: [["t", 3]] },
      {
        title: "Draft the PRD",
        do: "Set up a Claude Project with your interview notes and research, then ask for the PRD. Or use the PM system built for Claude Code.",
        use: [["c", "Claude Projects"], ["t", 88]],
        prompt: "Using the notes in this project, write a PRD with: problem, users, goals and non-goals, user stories, requirements (must/should/could), success metrics, risks and open questions. Keep it under 3 pages."
      },
      { title: "Stress-test it", do: "Ask for a pre-mortem and the hardest questions a skeptical engineer or exec would ask. Turn on the anti-sycophancy prompt so it doesn't just praise you.", use: [["l", "p23"], ["l", "p42"]] },
      { title: "Polish the writing", do: "Apply your voice and remove AI-sounding phrases before sharing.", use: [["l", "p27"], ["t", 59]] }
    ]
  },
  {
    title: "Build a pitch deck",
    type: "create",
    topics: ["Startups", "Slides"],
    time: "2\u20133 hours",
    goal: "A designed investor deck with a tight story, built with AI.",
    steps: [
      { title: "Check the idea first", do: "Run the idea through a validator to spot weak points before you design anything.", use: [["t", 102], ["t", 64]] },
      {
        title: "Write the story",
        do: "Get a 10\u201312 slide outline: problem, solution, why now, market, product, traction, business model, competition, team, ask.",
        prompt: "Write a 12-slide investor pitch outline for [company, one line]. For each slide give a headline (max 8 words), 3 bullet points and the one number that proves it. Audience: seed-stage VCs."
      },
      { title: "Pick a look", do: "Choose a slide style (pitch, consulting, editorial\u2026) and copy its design prompt.", use: [["l", "p13"], ["l", "p34"]] },
      { title: "Generate the slides", do: "Build the deck from the outline plus the style prompt.", use: [["t", 90], ["t", 92], ["t", 99]] },
      { title: "Prepare for questions", do: "Have the AI play a tough investor and red-team the deck.", use: [["l", "p23"], ["l", "p43"]] }
    ]
  },
  {
    title: "Prepare for a PM interview",
    type: "career",
    topics: ["Product management", "Interviews"],
    time: "2\u20134 hours",
    goal: "Walk into a product-manager interview with company research, practiced answers and feedback.",
    steps: [
      { title: "Research the company", do: "Put the company's site, recent news and product reviews into NotebookLM; ask for their strategy, metrics and likely problems.", use: [["t", 3], ["t", 5]] },
      {
        title: "Mock interview",
        do: "Have the AI interview you with product-sense, execution and behavioral questions, one at a time.",
        use: [["l", "p25"], ["l", "p3"]],
        prompt: "Act as a senior PM interviewer at [company]. Ask me one question at a time: 2 product-sense, 2 execution/metrics, 2 behavioral. After each answer, score it 1\u20135 and tell me what a strong answer would add."
      },
      { title: "Record and review", do: "Answer out loud, transcribe it, then have your answers graded with a rubric.", use: [["t", 247], ["l", "p26"]] },
      { title: "Explore the role", do: "See related roles and skills to talk about your growth path.", use: [["t", 10]] }
    ]
  },
  {
    title: "Research a company",
    type: "research",
    topics: ["Business research"],
    time: "1 hour",
    goal: "A one-page brief on a company: what it does, how it makes money, competitors and risks.",
    steps: [
      { title: "Collect the sources", do: "Grab the company's site and key pages as clean text.", use: [["t", 157], ["t", 105], ["t", 258]] },
      { title: "Deep research", do: "Load the sources into NotebookLM and run a deep-research pass with follow-up questions.", use: [["t", 3]] },
      {
        title: "Pull out what matters",
        do: "Turn the notes into a structured brief: business model, customers, numbers, competitors, risks.",
        use: [["l", "p24"], ["l", "p4"]],
        prompt: "From these notes, write a one-page company brief: what they sell, to whom, how they make money, key numbers (with sources), top 3 competitors, 3 risks, and 3 open questions."
      },
      { title: "Challenge the conclusions", do: "Ask what you might be wrong about and what evidence would change your view.", use: [["l", "p23"], ["l", "p42"]] }
    ]
  },
  {
    title: "Turn a lecture or video into study notes",
    type: "learn",
    topics: ["Studying", "NotebookLM"],
    time: "30 min",
    goal: "Clear notes, key ideas and a self-quiz from a lecture, talk or YouTube video.",
    steps: [
      { title: "Get the transcript in", do: "Send a YouTube video straight into NotebookLM, or transcribe a recording locally.", use: [["t", 29], ["t", 221]] },
      { title: "Make the notes", do: "Use ready NotebookLM prompts for summaries, study guides and key terms.", use: [["l", "p39"], ["l", "p24"]] },
      {
        title: "Quiz yourself",
        do: "Have a tutor quiz you on the material until you get it right.",
        use: [["t", 211]],
        prompt: "Quiz me on these notes: one question at a time, mix recall and 'explain why' questions, and re-ask the ones I get wrong at the end."
      }
    ]
  },
  {
    title: "Ship a small app",
    type: "build",
    topics: ["Vibe coding"],
    time: "1 day",
    goal: "From idea to a working, good-looking small web app built with AI.",
    steps: [
      { title: "Write a short spec", do: "One page: who it's for, the 3 main screens, the data it stores. (The PRD playbook works for bigger ideas.)", use: [["l", "p25"]] },
      { title: "Set the rules", do: "Give your coding tool a rules file with your stack and style so it stays consistent.", use: [["c", "CLAUDE.md (Claude Code memory)"], ["c", "Cursor Rules"], ["c", "Awesome Cursor Rules"]] },
      { title: "Build it", do: "Build in Cursor or Lovable, screen by screen.", use: [["t", 164], ["l", "p40"], ["t", 7]] },
      { title: "Make it look designed", do: "Use the 3-prompt method or a design skill so it doesn't look AI-made.", use: [["t", 8], ["t", 198], ["t", 155]] },
      { title: "Pick a database", do: "Choose a simple database that AI tools handle well.", use: [["t", 108]] }
    ]
  },
  {
    title: "Make a product demo video",
    type: "media",
    topics: ["Video", "Marketing"],
    time: "2 hours",
    goal: "A short demo video with screen recording, edits, voice-over and music.",
    steps: [
      { title: "Record the screen", do: "Record a walkthrough of the product.", use: [["t", 245]] },
      { title: "Or generate an explainer", do: "Have a coding agent turn your website into an explainer video, or pick a 3D explainer style.", use: [["t", 58], ["t", 196], ["t", 222]] },
      { title: "Edit", do: "Cut, add captions and zooms.", use: [["t", 255], ["t", 138]] },
      { title: "Add voice and music", do: "Generate a voice-over and a short background track.", use: [["t", 241], ["t", 233]] }
    ]
  },
  {
    title: "Analyze a stock",
    type: "money",
    topics: ["Stocks", "Investing"],
    time: "1 hour",
    goal: "A structured, skeptical look at one stock before you decide anything.",
    steps: [
      { title: "Run the analyst prompts", do: "Use the ready Gemini prompts for business quality, valuation, risks and competition.", use: [["t", 63], ["l", "p41"]] },
      { title: "Read the filings", do: "Put the latest annual report and earnings call into NotebookLM and ask for what changed.", use: [["t", 3]] },
      {
        title: "Argue the other side",
        do: "Ask for the strongest bear case and what would prove your thesis wrong. Keep the AI from simply agreeing with you.",
        use: [["l", "p23"], ["t", 2]],
        prompt: "Here's my thesis on [ticker]: [thesis]. Give me the strongest bear case, the 3 facts that would prove me wrong, and what to watch in the next 2 quarters. Don't be polite."
      }
    ]
  },
  {
    title: "Landing page that doesn't look AI-made",
    type: "build",
    topics: ["Web design"],
    time: "2\u20133 hours",
    goal: "A landing page with a real design system, built by a coding agent.",
    steps: [
      { title: "Choose a look", do: "Pick a brand style (DESIGN.md) or a visual style and add it to the project.", use: [["c", "DESIGN.md brand rules (awesome-design-md)"], ["l", "p17"]] },
      { title: "Install design skills", do: "Add skills that push the agent toward good layout and taste.", use: [["t", 144], ["t", 198], ["t", 155], ["t", 197]] },
      { title: "Build and polish", do: "Generate the page, then run a pass that fixes generic, AI-looking UI.", use: [["t", 223], ["t", 199]] }
    ]
  },
  {
    title: "Meeting notes to action items",
    type: "create",
    topics: ["Meetings", "Productivity"],
    time: "15 min per meeting",
    goal: "Every meeting ends with a clean summary, decisions and owners.",
    steps: [
      { title: "Prepare", do: "Before the meeting, ask NotebookLM about the docs and past notes.", use: [["t", 5]] },
      { title: "Record locally", do: "Use a local, open-source meeting recorder that writes the transcript.", use: [["t", 116], ["t", 103]] },
      {
        title: "Extract decisions and tasks",
        do: "Turn the transcript into decisions, action items with owners and dates, and open questions.",
        use: [["l", "p24"]],
        prompt: "From this transcript, list: 1) decisions made, 2) action items as a table (task, owner, due date), 3) open questions. Quote the transcript when something is unclear."
      }
    ]
  },
  {
    title: "Learn a new technical skill",
    type: "learn",
    topics: ["Self-study", "Coding"],
    time: "Ongoing",
    goal: "A personal learning path with a roadmap, a tutor and practice.",
    steps: [
      { title: "Get the roadmap", do: "Pick your path and see what to learn in what order.", use: [["t", 236]] },
      { title: "Learn with a tutor", do: "Use an AI tutor that adapts to you, or audio mini-courses for commutes.", use: [["t", 211], ["t", 163]] },
      { title: "Turn a book into a skill", do: "Make the book you're reading into a skill your agent can use while you practice.", use: [["t", 125]] },
      { title: "Build something", do: "Follow a hands-on course and ship a small project.", use: [["t", 225], ["t", 51]] }
    ]
  },
  {
    title: "Job application pack",
    type: "career",
    topics: ["Job hunt"],
    time: "1\u20132 hours per job",
    goal: "A tailored CV and cover letter for one job, in your own voice.",
    steps: [
      { title: "Set up the job-search system", do: "Use the Claude Code job application framework to keep jobs, CVs and letters organized.", use: [["t", 141]] },
      {
        title: "Tailor the CV",
        do: "Match your experience to the job description, keeping it truthful.",
        prompt: "Here's the job description and my CV. Rewrite my bullet points to match the role's top 5 requirements, using only facts from my CV. Flag any requirement I don't meet."
      },
      { title: "Write in your voice", do: "Write the cover letter with your style profile and remove AI-sounding text.", use: [["l", "p27"], ["t", 59], ["t", 239]] },
      { title: "Grade it", do: "Score the letter as a hiring manager would and fix the weakest part.", use: [["l", "p26"]] }
    ]
  },
  {
    title: "Set up Claude Code for a project",
    type: "automate",
    topics: ["Claude Code", "Coding"],
    time: "1 hour",
    goal: "Claude Code that knows your project, has specialist helpers and follows your rules.",
    steps: [
      { title: "Learn the basics", do: "Watch a short intro if you're new.", use: [["t", 98], ["t", 131]] },
      { title: "Write CLAUDE.md", do: "Run /init, then add your commands, style and don'ts.", use: [["c", "CLAUDE.md (Claude Code memory)"], ["c", "AGENTS.md (the shared standard)"]] },
      { title: "Add subagents", do: "Add a reviewer and a test writer from a collection.", use: [["c", "Claude Code subagents (how they work)"], ["c", "Awesome Claude Code Subagents (VoltAgent)"]] },
      { title: "Add skills and hooks", do: "Install a skills framework and set hooks for checks that must always run.", use: [["t", 23], ["t", 96]] }
    ]
  },
  {
    title: "Automate a weekly chore with n8n",
    type: "automate",
    topics: ["Automation", "n8n"],
    time: "2 hours",
    goal: "A repeated task (reports, emails, sheet updates) that runs by itself.",
    steps: [
      { title: "Learn n8n basics", do: "Watch the first lessons of the beginner course.", use: [["t", 202]] },
      { title: "Install or sign up", do: "Run n8n yourself (open source) or use n8n Cloud.", use: [["t", 249]] },
      { title: "Start from a template", do: "Find a workflow close to your chore and import it.", use: [["c", "n8n workflow templates"], ["c", "Awesome n8n Templates"], ["c", "n8n-workflows (Zie619)"]] },
      {
        title: "Adapt and schedule",
        do: "Connect your accounts, change the steps, add a schedule trigger, and test it once by hand.",
        prompt: "Here's my n8n workflow JSON and what I want it to do instead: [goal]. Tell me exactly which nodes to change, add or remove, and the settings for each."
      }
    ]
  },
  {
    title: "Marketing post in your own voice",
    type: "create",
    topics: ["Marketing", "LinkedIn"],
    time: "30 min",
    goal: "A post that sounds like you, not like AI.",
    steps: [
      { title: "Find the angle", do: "Start from a proven B2B content prompt.", use: [["l", "p8"], ["l", "p9"]] },
      { title: "Set your voice", do: "Give the AI your voice profile and rules against AI-sounding text.", use: [["l", "p27"], ["t", 159]] },
      { title: "De-AI the draft", do: "Run the draft through a humanizer pass.", use: [["t", 59]] },
      { title: "Get honest feedback", do: "Ask for blunt feedback, not compliments.", use: [["l", "p43"], ["l", "p26"]] }
    ]
  },
  {
    title: "Product and brand images",
    type: "media",
    topics: ["Images", "Branding"],
    time: "1 hour",
    goal: "Product shots, packaging and brand visuals from proven prompts.",
    steps: [
      { title: "Find a prompt that matches", do: "Browse galleries that show the exact prompt behind each image.", use: [["l", "p19"], ["l", "p20"], ["l", "p21"]] },
      { title: "Generate", do: "Run it in ChatGPT/Gemini, or in an open model for full control.", use: [["l", "p37"], ["t", 81], ["t", 137]] },
      { title: "Advanced control", do: "For consistent series, build a node workflow.", use: [["t", 220]] }
    ]
  },
  {
    title: "Turn a pile of documents into a brief",
    type: "research",
    topics: ["Documents"],
    time: "45 min",
    goal: "Answers and a summary from many PDFs, Word and PowerPoint files.",
    steps: [
      { title: "Convert to clean text", do: "Turn PDFs and Office files into Markdown that AI reads well.", use: [["t", 172], ["t", 115]] },
      { title: "Ask questions with sources", do: "Load them into NotebookLM and ask questions; every answer cites the file.", use: [["t", 3]] },
      {
        title: "Write the brief",
        do: "Summarize into a decision-ready brief.",
        use: [["l", "p24"]],
        prompt: "Using only these documents, write a one-page brief: the 5 key findings (each with its source file), what's still unclear, and a recommendation."
      }
    ]
  }
];

// convex/playbooks.ts
async function getMeta(ctx, key) {
  return await ctx.db.query("meta").withIndex("by_key", (q) => q.eq("key", key)).first();
}
async function setMeta(ctx, key, value) {
  const m = await getMeta(ctx, key);
  if (m) await ctx.db.patch(m._id, { value });
  else await ctx.db.insert("meta", { key, value });
}
async function libraryRefs(ctx) {
  const out = [];
  for (const r of await ctx.db.query("items").withIndex("by_status", (q) => q.eq("status", "active")).collect()) {
    const d = r.data || {};
    out.push({ k: "t", id: String(d.id), name: String(d.title || ""), info: [d.cat, String(d.summary || "").slice(0, 140)].filter(Boolean).join(" \xB7 ") });
  }
  for (const r of await ctx.db.query("plibs").collect()) {
    if (r.deleting) continue;
    out.push({ k: "l", id: r.libId, name: String(r.data?.title || ""), info: "prompt library \xB7 " + String(r.data?.bestFor || r.data?.summary || "").slice(0, 140) });
  }
  for (const r of await ctx.db.query("tcards").collect()) {
    if (r.deleting) continue;
    out.push({ k: "c", id: r.cid, tab: r.tab, name: String(r.data?.title || ""), info: { rules: "rule file", agents: "agent", autos: "automation" }[r.tab] + " \xB7 " + String(r.data?.bestFor || r.data?.summary || "").slice(0, 140) });
  }
  return out;
}
var library = internalQuery({ args: {}, handler: async (ctx) => libraryRefs(ctx) });
function cleanPlaybook(p, lib) {
  const str = (x, n) => typeof x === "string" ? x.trim().slice(0, n) : "";
  const find = (u) => {
    const k = u?.k === "tool" ? "t" : u?.k === "lib" ? "l" : u?.k === "card" ? "c" : u?.k;
    const id2 = String(u?.id ?? "");
    return lib.find((x) => x.k === k && x.id === id2) || (u?.name ? lib.find((x) => x.k === k && x.name.toLowerCase() === String(u.name).toLowerCase()) : void 0);
  };
  const steps = (Array.isArray(p?.steps) ? p.steps : []).slice(0, 15).map((s) => {
    const seen = /* @__PURE__ */ new Set();
    const use = (Array.isArray(s?.use) ? s.use : []).map(find).filter((x) => !!x && !seen.has(x.k + x.id) && !!seen.add(x.k + x.id)).slice(0, 5).map((x) => ({ k: x.k, id: x.id, name: x.name, ...x.tab ? { tab: x.tab } : {} }));
    return { title: str(s?.title, 120) || "Step", do: str(s?.do, 1200), use, ...str(s?.prompt, 4e3) ? { prompt: str(s.prompt, 4e3) } : {}, ...str(s?.tip, 600) ? { tip: str(s.tip, 600) } : {} };
  });
  return {
    title: str(p?.title, 120) || "Untitled playbook",
    goal: str(p?.goal, 400),
    type: PB_TYPES.includes(p?.type) ? p.type : "create",
    topics: (Array.isArray(p?.topics) ? p.topics : []).map((t) => str(t, 40)).filter(Boolean).slice(0, 4),
    time: str(p?.time, 40),
    steps
  };
}
var list = query({
  args: { key: v2.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    const rows = await ctx.db.query("playbooks").collect();
    const seeded = (await getMeta(ctx, "pbSeed"))?.value === PLAYBOOK_SEED_VERSION;
    const defaults = (await getMeta(ctx, "pbDefaults"))?.value || [];
    return { playbooks: rows.map((r) => ({ ...r.data, id: r.pbId })), seeded, defaults };
  }
});
async function nextId(ctx) {
  const rows = await ctx.db.query("playbooks").collect();
  return "b" + (Math.max(0, ...rows.map((r) => Number(String(r.pbId).replace(/\D/g, "")) || 0)) + 1);
}
var ensureSeeded = mutation({
  args: { key: v2.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    if ((await getMeta(ctx, "pbSeed"))?.value === PLAYBOOK_SEED_VERSION) return { added: 0 };
    const lib = await libraryRefs(ctx);
    const have = new Set((await ctx.db.query("playbooks").collect()).map((r) => String(r.data?.title || "").toLowerCase()));
    const gone = new Set((await getMeta(ctx, "pbGone"))?.value || []);
    let added = 0;
    for (const s of PLAYBOOK_SEED) {
      const t = s.title.toLowerCase();
      if (have.has(t) || gone.has(t)) continue;
      const steps = s.steps.map((st) => ({
        ...st,
        use: (st.use || []).map(([k, x]) => k === "c" ? { k, id: lib.find((r) => r.k === "c" && r.name === x)?.id || "", name: String(x) } : { k, id: String(x) })
      }));
      const data2 = { ...cleanPlaybook({ ...s, steps }, lib), source: "starter", updated: (/* @__PURE__ */ new Date()).toISOString().slice(0, 10) };
      await ctx.db.insert("playbooks", { pbId: await nextId(ctx), data: data2 });
      added++;
    }
    await setMeta(ctx, "pbSeed", PLAYBOOK_SEED_VERSION);
    if (added) await snapshotSoon(ctx);
    return { added };
  }
});
var save = mutation({
  args: { key: v2.string(), id: v2.optional(v2.string()), playbook: v2.any() },
  handler: async (ctx, { key, id: id2, playbook }) => {
    checkKey(key);
    const lib = await libraryRefs(ctx);
    const clean = cleanPlaybook(playbook, lib);
    if (!clean.steps.length) throw new ConvexError2("A playbook needs at least one step.");
    const today = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    if (id2) {
      const row = await ctx.db.query("playbooks").withIndex("by_pbId", (q) => q.eq("pbId", id2)).first();
      if (row) {
        await ctx.db.patch(row._id, { data: { ...clean, source: row.data?.source === "starter" ? "edited" : row.data?.source || "made", updated: today } });
        await snapshotSoon(ctx);
        return { id: id2 };
      }
    }
    const pbId = await nextId(ctx);
    await ctx.db.insert("playbooks", { pbId, data: { ...clean, source: "made", updated: today } });
    await snapshotSoon(ctx);
    return { id: pbId };
  }
});
var remove = mutation({
  args: { key: v2.string(), id: v2.string() },
  handler: async (ctx, { key, id: id2 }) => {
    checkKey(key);
    const row = await ctx.db.query("playbooks").withIndex("by_pbId", (q) => q.eq("pbId", id2)).first();
    if (!row) return { ok: true };
    if (row.data?.source === "starter" || row.data?.source === "edited") {
      const gone = (await getMeta(ctx, "pbGone"))?.value || [];
      gone.push(String(row.data?.title || "").toLowerCase());
      await setMeta(ctx, "pbGone", gone.slice(-300));
    }
    await ctx.db.delete(row._id);
    await snapshotSoon(ctx);
    return { ok: true };
  }
});
var setDefaults = mutation({
  args: { key: v2.string(), defaults: v2.array(v2.string()) },
  handler: async (ctx, { key, defaults }) => {
    checkKey(key);
    await setMeta(ctx, "pbDefaults", defaults.map((d) => d.trim().slice(0, 200)).filter(Boolean).slice(0, 20));
    return { ok: true };
  }
});
var all = internalQuery({
  args: {},
  handler: async (ctx) => (await ctx.db.query("playbooks").collect()).map((r) => ({ ...r.data, id: r.pbId }))
});
export {
  all,
  cleanPlaybook,
  ensureSeeded,
  library,
  libraryRefs,
  list,
  remove,
  save,
  setDefaults
};
