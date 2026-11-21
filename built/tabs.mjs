// stub:server
var id = (d) => d;
var query = id;
var mutation = id;
var internalQuery = id;
var internalMutation = id;
var internalAction = id;

// convex/tabs.ts
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

// stub:api
var mk = (m) => new Proxy({}, { get: (_, f) => m + ":" + String(f) });
var internal = { items: mk("items"), ingest: mk("ingest"), install: mk("install"), advisor: mk("advisor"), pipeline: mk("pipeline"), enrich: mk("enrich"), credit: mk("credit"), hype: mk("hype"), alts: mk("alts"), promptFinder: mk("promptFinder"), promptLibs: mk("promptLibs"), promptImport: mk("promptImport"), promptAdd: mk("promptAdd"), snapshot: mk("snapshot"), siteCheck: mk("siteCheck"), webjobs: mk("webjobs"), webcopy: mk("webcopy"), promptGen: mk("promptGen"), tabs: mk("tabs"), tabImport: mk("tabImport"), tabAdd: mk("tabAdd"), playbooks: mk("playbooks"), playbookAi: mk("playbookAi"), addAny: mk("addAny") };

// convex/snapshot.ts
import { v } from "convex/values";

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
    const items2 = await ctx.db.query("items").collect();
    const libs = await ctx.db.query("plibs").collect();
    const cards = await ctx.db.query("tcards").collect();
    const pbs = await ctx.db.query("playbooks").collect();
    return {
      tools: items2.map((r) => ({ status: r.status, ...pickTool(r.data) })),
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

// convex/tabSeed.ts
var TAB_SEED_VERSION = "abc-1 20 Nov 2026";
var TAB_SEED = [
  // ---------------- RULES ----------------
  {
    tab: "rules",
    sec: "standards",
    kind: "open",
    license: "MIT",
    title: "AGENTS.md (the shared standard)",
    summary: "One open Markdown file that tells any coding agent how to work on your project: setup, tests, code style, PR rules. A README for agents.",
    bestFor: "Writing your project rules once so Codex, Cursor, Copilot, Jules, Amp and others all follow them.",
    tools: "Codex, Cursor, GitHub Copilot, Jules, Amp, Cline, Gemini CLI (with a setting). Claude Code reads CLAUDE.md instead (it can import @AGENTS.md).",
    where: "AGENTS.md in the project root. Big repos can add one per subfolder; the closest file to the code wins.",
    example: "# AGENTS.md\n\n## Setup\n- Install: pnpm install\n- Run: pnpm dev\n\n## Code style\n- TypeScript strict mode, functional components\n\n## Before you commit\n- Run pnpm lint and pnpm test\n- Add or update tests for the code you change",
    links: [["agents.md", "https://agents.md"], ["GitHub", "https://github.com/agentsmd/agents.md"]]
  },
  {
    tab: "rules",
    sec: "coding",
    kind: "official",
    license: "Free",
    title: "CLAUDE.md (Claude Code memory)",
    summary: "The instruction file Claude Code loads at the start of every session: your commands, conventions and do/don't rules.",
    bestFor: "Stop repeating yourself to Claude Code: put build commands, style rules and project facts in one file.",
    tools: "Claude Code",
    where: "./CLAUDE.md or ./.claude/CLAUDE.md in the project (shared with the team); ~/.claude/CLAUDE.md for all your projects. Run /init to generate a first version.",
    example: "# Project notes for Claude\n\n- Build: npm run build \xB7 Test: npm test -- --watch=false\n- Use ES modules, not require()\n- Keep components small; put API calls in src/api/\n- Never edit files in /generated\n- Ask before adding a new dependency",
    links: [["Docs: memory & CLAUDE.md", "https://code.claude.com/docs/en/memory"]],
    related: [89, 87, 96]
  },
  {
    tab: "rules",
    sec: "coding",
    kind: "official",
    license: "Free",
    title: "Cursor Rules",
    summary: "Cursor's project, user and team rules: small .mdc files that are attached always, by file pattern, or when the AI decides they're relevant.",
    bestFor: "Teaching Cursor your stack and style, e.g. one rule for React components and another for API routes.",
    tools: "Cursor (it also reads AGENTS.md)",
    where: ".cursor/rules/*.mdc in the project; personal User Rules in Cursor Settings \u2192 Rules.",
    example: "---\ndescription: React component conventions\nglobs: src/components/**/*.tsx\nalwaysApply: false\n---\n- Use function components and hooks\n- Props get a TypeScript interface named <Name>Props\n- Style with Tailwind; no inline styles",
    links: [["Docs: Rules", "https://cursor.com/docs/context/rules"]],
    related: [164]
  },
  {
    tab: "rules",
    sec: "coding",
    kind: "official",
    license: "Free",
    title: "GitHub Copilot custom instructions",
    summary: "Repository-wide and path-specific instruction files that GitHub Copilot adds to every chat and code review in that repo.",
    bestFor: "Making Copilot follow your team's conventions in VS Code, on github.com and in code review.",
    tools: "GitHub Copilot (it also reads AGENTS.md, CLAUDE.md and GEMINI.md)",
    where: ".github/copilot-instructions.md for the whole repo; .github/instructions/NAME.instructions.md with an applyTo pattern for some files.",
    example: "# Copilot instructions\n\nThis is a Next.js 15 app using the App Router and Prisma.\n- Write server actions in app/actions/\n- Use zod for all input validation\n- Tests use Vitest; put them next to the file as *.test.ts",
    links: [["Docs: repository instructions", "https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions"]]
  },
  {
    tab: "rules",
    sec: "coding",
    kind: "official",
    license: "Free",
    title: "Windsurf rules & memories",
    summary: "Workspace and global rules for Windsurf's Cascade agent, plus memories it saves on its own.",
    bestFor: "Setting Windsurf's coding style per project; each rule file can be up to 12,000 characters.",
    tools: "Windsurf (Cascade)",
    where: ".windsurf/rules/ in the project; global_rules.md for all projects (Windsurf Settings \u2192 Memories & Rules).",
    example: "# Project rules\n- Python 3.12, type hints everywhere\n- Format with ruff; line length 100\n- Prefer small pure functions; no global state\n- Explain any database migration before writing it",
    links: [["Docs: memories & rules", "https://docs.windsurf.com/windsurf/cascade/memories"], ["Rules directory", "https://windsurf.com/editor/directory"]]
  },
  {
    tab: "rules",
    sec: "coding",
    kind: "official",
    license: "Free",
    title: "Cline Rules",
    summary: "A .clinerules folder of Markdown files that Cline reads for every task; each rule can be switched on or off.",
    bestFor: "Giving Cline project rules, and reusing rules you already wrote for Cursor or Windsurf.",
    tools: "Cline (it also reads .cursorrules, .windsurfrules and AGENTS.md)",
    where: ".clinerules/ folder in the project (one .md file per topic); global rules in Cline's settings.",
    example: "# .clinerules/testing.md\n- Every new function gets a unit test\n- Run npm test before saying a task is done\n- Never mock the database in integration tests",
    links: [["Docs: Cline Rules", "https://docs.cline.bot/features/cline-rules"]]
  },
  {
    tab: "rules",
    sec: "coding",
    kind: "open",
    license: "Apache-2.0",
    title: "GEMINI.md (Gemini CLI context)",
    summary: "Context files Gemini CLI sends with every prompt: a global one for you, one per project, and more in subfolders.",
    bestFor: "Giving Gemini CLI your project's instructions; it can also be set to read AGENTS.md instead.",
    tools: "Gemini CLI",
    where: "~/.gemini/GEMINI.md for all projects; GEMINI.md in the project root (and subfolders). To use AGENTS.md set context.fileName in .gemini/settings.json.",
    example: "# Project: My TypeScript Library\n\n## General instructions\n- Follow the existing code style\n- Add JSDoc to every new function\n- Prefer async/await over .then()\n\n@./docs/coding-style.md",
    links: [["Docs: GEMINI.md", "https://geminicli.com/docs/cli/gemini-md/"]]
  },
  {
    tab: "rules",
    sec: "collections",
    kind: "open",
    license: "CC0-1.0",
    title: "Awesome Cursor Rules",
    summary: "250+ ready Cursor rule files by stack (Next.js, Python, Flutter, SwiftUI, Tailwind\u2026), free to copy.",
    bestFor: "Starting a project's rules from a proven file for your exact stack instead of a blank page.",
    tools: "Cursor (the text works in any tool's rule file)",
    where: "Copy a file into .cursor/rules/ (or paste the text into CLAUDE.md / AGENTS.md).",
    links: [["GitHub", "https://github.com/PatrickJS/awesome-cursorrules"]],
    repo: "https://github.com/PatrickJS/awesome-cursorrules",
    copy: true,
    relatedLibs: ["p31"]
  },
  {
    tab: "rules",
    sec: "collections",
    kind: "community",
    license: "Free",
    title: "cursor.directory",
    summary: "Community site of rule files per framework and language, with a search and one-click copy.",
    bestFor: "Quickly finding a rule set for a stack (e.g. Next.js + Supabase) and copying it.",
    tools: "Cursor, and any tool with a rule file",
    where: "Copy into .cursor/rules/, CLAUDE.md or AGENTS.md.",
    links: [["cursor.directory", "https://cursor.directory"]],
    relatedLibs: ["p10"]
  },
  {
    tab: "rules",
    sec: "design",
    kind: "open",
    license: "MIT",
    title: "DESIGN.md brand rules (awesome-design-md)",
    summary: "DESIGN.md files that describe a famous brand's look (Stripe, Linear, Apple\u2026): colors, type, spacing, components.",
    bestFor: "Making an AI-built site look like a known brand: drop one DESIGN.md in your project and point the agent at it.",
    tools: "Claude Code, Cursor, Codex, v0, Lovable\u2026",
    where: 'DESIGN.md in the project root; mention it in CLAUDE.md / AGENTS.md ("follow DESIGN.md for all UI").',
    links: [["GitHub", "https://github.com/VoltAgent/awesome-design-md"]],
    relatedLibs: ["p16", "p17"]
  },
  // ---------------- AGENTS ----------------
  {
    tab: "agents",
    sec: "subagents",
    kind: "official",
    license: "Free",
    title: "Claude Code subagents (how they work)",
    summary: "Specialist helpers inside Claude Code, each with its own instructions, tools and context window; Claude hands them tasks.",
    bestFor: "Splitting work: a reviewer, a test writer and a researcher that don't clutter the main chat.",
    platform: "Claude Code",
    how: "Type /agents to create one, or save a Markdown file with name and description at the top in .claude/agents/ (project) or ~/.claude/agents/ (all projects).",
    example: "---\nname: code-reviewer\ndescription: Reviews changed code for bugs, security and readability. Use after any code change.\ntools: Read, Grep, Glob\n---\nYou are a senior reviewer. List problems by severity, quote the line, and suggest the fix.",
    links: [["Docs: subagents", "https://code.claude.com/docs/en/sub-agents"]]
  },
  {
    tab: "agents",
    sec: "subagents",
    kind: "open",
    license: "MIT",
    title: "Awesome Claude Code Subagents (VoltAgent)",
    summary: "100+ ready subagents in 10 categories: core development, languages, infrastructure, security, data & AI, business\u2026",
    bestFor: "Grabbing a specialist (API designer, SQL expert, UX researcher) and dropping it into .claude/agents/.",
    platform: "Claude Code",
    how: "Open Browse, copy an agent, save it as .claude/agents/NAME.md. Claude uses it when the task matches its description.",
    links: [["GitHub", "https://github.com/VoltAgent/awesome-claude-code-subagents"]],
    repo: "https://github.com/VoltAgent/awesome-claude-code-subagents",
    copy: true
  },
  {
    tab: "agents",
    sec: "subagents",
    kind: "open",
    license: "MIT",
    title: "wshobson/agents",
    summary: "A big plugin collection for Claude Code: ~200 specialist agents grouped into plugins (backend, frontend, security, ML, SEO\u2026).",
    bestFor: "Whole toolkits per area; install a plugin, or copy single agents from Browse.",
    platform: "Claude Code (also Cursor and Codex plugin formats)",
    how: "In Claude Code: /plugin marketplace add wshobson/agents, then install the plugins you want. Or copy one agent file into .claude/agents/.",
    links: [["GitHub", "https://github.com/wshobson/agents"]],
    repo: "https://github.com/wshobson/agents",
    copy: true
  },
  {
    tab: "agents",
    sec: "subagents",
    kind: "open",
    license: "MIT",
    title: "Claude Code sub-agents (lst97)",
    summary: "~35 subagents for full-stack work plus an agent-organizer that picks the right team for a task.",
    bestFor: "A ready dev team (frontend, backend, data, product manager) coordinated by one organizer agent.",
    platform: "Claude Code",
    how: "Copy the agents/ folder into ~/.claude/agents/, or copy single agents from Browse.",
    links: [["GitHub", "https://github.com/lst97/claude-code-sub-agents"]],
    repo: "https://github.com/lst97/claude-code-sub-agents",
    copy: true
  },
  {
    tab: "agents",
    sec: "subagents",
    kind: "open",
    license: "MIT",
    title: "claude-agents (iannuttall)",
    summary: "A small, sharp set of everyday agents: code refactorer, content writer, frontend designer, PRD writer, security auditor and more.",
    bestFor: "A handful of useful agents to start with, without wading through hundreds.",
    platform: "Claude Code",
    how: "Copy an agent from Browse into .claude/agents/.",
    links: [["GitHub", "https://github.com/iannuttall/claude-agents"]],
    repo: "https://github.com/iannuttall/claude-agents",
    copy: true
  },
  {
    tab: "agents",
    sec: "subagents",
    kind: "open",
    license: "Open source",
    title: "Claude Code Templates (davila7)",
    summary: "A registry and CLI of Claude Code components: agents, commands, settings, hooks and MCPs, installed with one command.",
    bestFor: "Browsing components on a website and installing them with npx instead of copying files by hand.",
    platform: "Claude Code",
    how: "Browse the catalog, then run the npx claude-code-templates command shown for the agent you want.",
    links: [["GitHub", "https://github.com/davila7/claude-code-templates"]],
    related: [259]
  },
  {
    tab: "agents",
    sec: "assistants",
    kind: "official",
    license: "Free with Gemini plans",
    title: "Gemini Gems (premade and your own)",
    summary: "Custom versions of Gemini with saved instructions and files. Premade ones include Brainstormer, Career guide, Coding partner, Learning coach and Writing editor.",
    bestFor: "A repeat task you keep explaining to Gemini: save it once as a Gem; copy a premade Gem to start fast.",
    platform: "Gemini app (web and mobile)",
    how: "gemini.google.com \u2192 Gems (left panel) \u2192 pick a premade Gem, or New Gem and write its instructions (Gemini can help write them). Upload files for context.",
    links: [["Help: get started with Gems", "https://support.google.com/gemini/answer/15236321"], ["Premade Gems", "https://support.google.com/gemini/answer/15235907"]],
    related: [56, 57, 158]
  },
  {
    tab: "agents",
    sec: "assistants",
    kind: "official",
    license: "Free to browse",
    title: "GPT Store (custom GPTs)",
    summary: "Thousands of custom ChatGPTs by OpenAI partners and the community, in categories like writing, research, programming, education and DALL\xB7E.",
    bestFor: "Finding a ready assistant for a niche job (paper search, diagrams, tutoring) before building your own.",
    platform: "ChatGPT",
    how: "Open chatgpt.com/gpts, search or browse a category, and start a chat. Make your own with Create.",
    links: [["Explore GPTs", "https://chatgpt.com/gpts"]]
  },
  {
    tab: "agents",
    sec: "assistants",
    kind: "official",
    license: "Free (up to 5 projects)",
    title: "Claude Projects",
    summary: "Workspaces in Claude with their own instructions and files; every chat in the project uses them.",
    bestFor: "A standing assistant for one job (a course, a client, a product) with its documents always at hand.",
    platform: "Claude (web, desktop, mobile)",
    how: "claude.ai/projects \u2192 New Project \u2192 Set project instructions, then add files. Free accounts can have up to five projects.",
    links: [["Help: create and manage projects", "https://support.claude.com/en/articles/9519177"]],
    related: [124, 51]
  },
  {
    tab: "agents",
    sec: "teams",
    kind: "open",
    license: "Open source",
    title: "Paperclip (agent company orchestration)",
    summary: 'Open-source orchestration for running a whole "company" of AI agents that work together toward a goal.',
    bestFor: "Experimenting with many agents working together on a long project.",
    platform: "Self-hosted",
    how: "Follow the quick start in the repo's README.",
    links: [["GitHub", "https://github.com/paperclipai/paperclip"]],
    related: [209, 195]
  },
  {
    tab: "agents",
    sec: "teams",
    kind: "official",
    license: "Paid (API)",
    title: "Claude Managed Agents",
    summary: "Anthropic's hosted service for running Claude agents with tools, memory and long tasks, without running servers yourself.",
    bestFor: "Putting an agent into production for a product or an internal workflow.",
    platform: "Claude Platform (API)",
    how: "Read the overview, then create an agent in the Claude Console and call it from your app.",
    links: [["Docs: overview", "https://platform.claude.com/docs/en/managed-agents/overview"]],
    related: [83]
  },
  // ---------------- AUTOMATIONS ----------------
  {
    tab: "autos",
    sec: "templates",
    kind: "official",
    license: "Free",
    title: "n8n workflow templates",
    summary: "n8n's official gallery of thousands of ready workflows from the team and community, searchable by app and use case.",
    bestFor: "Finding a working n8n flow (AI agents, email, CRM, Sheets) and importing it in one click.",
    platform: "n8n",
    trigger: "Varies",
    apps: "Many",
    effort: "Easy",
    does: "Pick a template, click Use, connect your accounts, run it.",
    links: [["n8n.io/workflows", "https://n8n.io/workflows/"], ["Docs: templates", "https://docs.n8n.io/workflows/templates"]],
    related: [249, 202]
  },
  {
    tab: "autos",
    sec: "templates",
    kind: "official",
    license: "Free to browse",
    title: "Zapier templates",
    summary: "Zapier's template library by use case: sales pipeline, marketing campaigns, support, data, project management, plus AI and MCP kits.",
    bestFor: "No-code automations between everyday apps (Gmail, Slack, Sheets, HubSpot) in a few minutes.",
    platform: "Zapier",
    trigger: "Varies",
    apps: "8,000+ apps",
    effort: "Easy",
    does: "Pick a template, sign in to the apps, turn it on.",
    links: [["zapier.com/templates", "https://zapier.com/templates"], ["Zapier MCP", "https://zapier.com/templates/mcp"]]
  },
  {
    tab: "autos",
    sec: "templates",
    kind: "official",
    license: "Free to browse",
    title: "Make templates",
    summary: "Make's public template library: 7,500+ ready scenarios by Make and its community, with written setup notes.",
    bestFor: "Visual, multi-step automations with branches and filters, built by dragging modules.",
    platform: "Make",
    trigger: "Varies",
    apps: "Many",
    effort: "Easy",
    does: "Choose a template, connect the apps, run the scenario.",
    links: [["make.com/en/templates", "https://www.make.com/en/templates"], ["Help: templates", "https://help.make.com/scenario-templates"]]
  },
  {
    tab: "autos",
    sec: "collections",
    kind: "open",
    license: "CC-BY-4.0",
    title: "Awesome n8n Templates",
    summary: "280+ free n8n workflows by app: Gmail, Telegram, WhatsApp, Slack, Notion, Google Sheets, OpenAI, RAG and data analysis.",
    bestFor: "Ready AI workflows (email triage, chatbots, RAG) you can download and import into n8n.",
    platform: "n8n",
    trigger: "Varies",
    apps: "Many",
    effort: "Medium",
    does: "Browse here, copy the workflow JSON, then in n8n: Import from file / paste.",
    links: [["GitHub", "https://github.com/enescingoz/awesome-n8n-templates"]],
    repo: "https://github.com/enescingoz/awesome-n8n-templates",
    copy: true
  },
  {
    tab: "autos",
    sec: "collections",
    kind: "open",
    license: "MIT",
    title: "n8n-workflows (Zie619)",
    summary: "A searchable archive of ~2,000 n8n workflows grouped by the main app they use (Slack, Telegram, Airtable, Google Sheets\u2026).",
    bestFor: "Seeing how other people automated a specific app before building your own.",
    platform: "n8n",
    trigger: "Varies",
    apps: "Many",
    effort: "Medium",
    does: "Browse here, copy a workflow's JSON and paste it into n8n.",
    links: [["GitHub", "https://github.com/Zie619/n8n-workflows"]],
    repo: "https://github.com/Zie619/n8n-workflows",
    copy: true
  },
  {
    tab: "autos",
    sec: "ai",
    kind: "community",
    license: "Free",
    title: "Daily briefing: Claude Code + NotebookLM",
    summary: "A routine from a post in your library: Claude Code gathers the day's sources and NotebookLM turns them into a briefing.",
    bestFor: "A personal morning briefing on your topics without opening ten sites.",
    platform: "Claude Code + NotebookLM",
    trigger: "Every morning (scheduled)",
    apps: "Claude Code, NotebookLM",
    effort: "Medium",
    does: "Collects new items on your topics, adds them to a notebook and produces a summary or audio overview.",
    links: [["Original post", "https://facebook.com/685119124/posts/pfbid02j3L4Dd3uU3YMC5GZbfnMTqSbGVpUqdZH5D6pCuBiexZPHbdjDbE7Vrz3bE9RvCqPl/"]],
    related: [78, 61]
  },
  {
    tab: "autos",
    sec: "ai",
    kind: "official",
    license: "Paid (Gemini plans)",
    title: "Gemini Spark (agent that runs tasks)",
    summary: "Google's agent mode in Gemini for handing off multi-step tasks (in your Tools tab).",
    bestFor: "Handing off an errand (research, booking, collecting info) instead of building a workflow.",
    platform: "Gemini",
    trigger: "You ask, or a schedule",
    apps: "Google apps, web",
    effort: "Easy",
    does: "Plans the steps, does them, and reports back.",
    links: [["Gemini Spark", "https://gemini.google/overview/agent/spark/"]],
    related: [119]
  }
];

// convex/tabs.ts
var TABS = ["rules", "agents", "autos"];
var PREFIX = { rules: "r", agents: "a", autos: "w" };
var nowIso = () => (/* @__PURE__ */ new Date()).toISOString();
var NONE = { state: "none", count: 0, note: "", at: "" };
var normLink = (u) => String(u || "").toLowerCase().replace(/^https?:\/\/(www\.)?/, "").replace(/[?#].*$/, "").replace(/\/+$/, "");
async function getMeta(ctx, key) {
  return await ctx.db.query("meta").withIndex("by_key", (q) => q.eq("key", key)).first();
}
async function setMeta(ctx, key, value) {
  const m = await getMeta(ctx, key);
  if (m) await ctx.db.patch(m._id, { value });
  else await ctx.db.insert("meta", { key, value });
}
async function byCid(ctx, cid) {
  return await ctx.db.query("tcards").withIndex("by_cid", (q) => q.eq("cid", cid)).first();
}
async function nextCid(ctx, tab) {
  const rows = await ctx.db.query("tcards").withIndex("by_tab", (q) => q.eq("tab", tab)).collect();
  return PREFIX[tab] + (Math.max(0, ...rows.map((r) => Number(String(r.cid).replace(/\D/g, "")) || 0)) + 1);
}
var list = query({
  args: { key: v2.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    const rows = (await ctx.db.query("tcards").collect()).filter((r) => !r.deleting);
    const out = { rules: [], agents: [], autos: [] };
    for (const r of rows) (out[r.tab] ||= []).push({ ...r.data, id: r.cid, tab: r.tab, imp: r.imp || NONE });
    const seeded = (await getMeta(ctx, "tabSeed"))?.value === TAB_SEED_VERSION;
    return { ...out, seeded };
  }
});
var ensureSeeded = mutation({
  args: { key: v2.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    if ((await getMeta(ctx, "tabSeed"))?.value === TAB_SEED_VERSION) return { added: 0 };
    const rows = await ctx.db.query("tcards").collect();
    const have = new Set(rows.map((r) => r.tab + "|" + normLink(r.data?.links?.[0]?.[1])));
    const gone = new Set((await getMeta(ctx, "tabGone"))?.value || []);
    let added = 0;
    for (const card of TAB_SEED) {
      const k = card.tab + "|" + normLink(card.links[0][1]);
      if (have.has(k) || gone.has(k)) continue;
      const { tab, ...data2 } = card;
      const cid = await nextCid(ctx, tab);
      const id2 = await ctx.db.insert("tcards", { cid, tab, data: { ...data2, added: nowIso().slice(0, 10) }, imp: NONE });
      if (data2.repo && data2.copy) await startImport(ctx, { _id: id2, cid, tab, data: data2 });
      have.add(k);
      added++;
    }
    await setMeta(ctx, "tabSeed", TAB_SEED_VERSION);
    if (added) await snapshotSoon(ctx);
    return { added };
  }
});
async function startImport(ctx, card) {
  const run = Math.random().toString(36).slice(2) + Date.now().toString(36);
  await ctx.db.patch(card._id, { imp: { state: "importing", count: 0, note: "Copying files\u2026", at: nowIso(), run } });
  await ctx.scheduler.runAfter(0, internal.tabImport.run, { cid: card.cid, tab: card.tab, repo: card.data.repo, runId: run });
}
var STALE_MS = 4 * 60 * 1e3;
var isStale = (imp) => imp?.state === "importing" && Date.now() - Date.parse(imp.at || 0) > STALE_MS;
var reimport = mutation({
  args: { key: v2.string(), cid: v2.string() },
  handler: async (ctx, { key, cid }) => {
    checkKey(key);
    const c = await byCid(ctx, cid);
    if (!c || c.deleting) throw new ConvexError2("That card is no longer in your list.");
    if (!c.data?.repo) throw new ConvexError2("This card has no open-source repo to copy.");
    if (c.imp?.state === "importing" && !isStale(c.imp)) return { ok: true };
    await startImport(ctx, c);
    return { ok: true };
  }
});
var resumeStuck = mutation({
  args: { key: v2.string() },
  handler: async (ctx, { key }) => {
    checkKey(key);
    let n = 0;
    for (const c of await ctx.db.query("tcards").collect()) if (!c.deleting && c.data?.repo && isStale(c.imp)) {
      await startImport(ctx, c);
      n++;
    }
    return { restarted: n };
  }
});
var progress = internalMutation({
  args: { cid: v2.string(), runId: v2.string(), note: v2.string() },
  handler: async (ctx, { cid, runId, note }) => {
    const c = await byCid(ctx, cid);
    if (!c || c.deleting || c.imp?.state !== "importing" || c.imp?.run !== runId) return;
    await ctx.db.patch(c._id, { imp: { ...c.imp, note, at: nowIso() } });
  }
});
var setImp = internalMutation({
  args: { cid: v2.string(), runId: v2.string(), state: v2.string(), note: v2.string() },
  handler: async (ctx, { cid, runId, state, note }) => {
    const c = await byCid(ctx, cid);
    if (!c || c.deleting || c.imp?.run !== runId) return;
    const count = (await ctx.db.query("tcItems").withIndex("by_cid", (q) => q.eq("cid", cid)).collect()).length;
    await ctx.db.patch(c._id, { imp: { state, count, note, at: nowIso(), run: runId } });
    await snapshotSoon(ctx);
  }
});
async function clearSome(ctx, cid) {
  const idx = await ctx.db.query("tcItems").withIndex("by_cid", (q) => q.eq("cid", cid)).take(400);
  for (const r of idx) await ctx.db.delete(r._id);
  const txt = await ctx.db.query("tcText").withIndex("by_cid", (q) => q.eq("cid", cid)).take(50);
  for (const r of txt) await ctx.db.delete(r._id);
  return idx.length + txt.length;
}
var clearItems = internalMutation({
  args: { cid: v2.string(), runId: v2.optional(v2.string()) },
  handler: async (ctx, { cid, runId }) => {
    if (runId) {
      const c = await byCid(ctx, cid);
      if (!c || c.imp?.run !== runId) return 0;
    }
    return await clearSome(ctx, cid);
  }
});
var addItems = internalMutation({
  args: { cid: v2.string(), runId: v2.string(), start: v2.number(), rows: v2.array(v2.object({ title: v2.string(), desc: v2.string(), tag: v2.string(), text: v2.string(), url: v2.string() })) },
  handler: async (ctx, { cid, runId, start, rows }) => {
    const c = await byCid(ctx, cid);
    if (!c || c.deleting || c.imp?.run !== runId) return false;
    let n = start;
    for (const r of rows) {
      await ctx.db.insert("tcItems", { cid, n, title: r.title, desc: r.desc, tag: r.tag });
      await ctx.db.insert("tcText", { cid, n, text: r.text, url: r.url });
      n++;
    }
    return true;
  }
});
var items = query({
  args: { key: v2.string(), cid: v2.string() },
  handler: async (ctx, { key, cid }) => {
    checkKey(key);
    const rows = await ctx.db.query("tcItems").withIndex("by_cid", (q) => q.eq("cid", cid)).collect();
    return rows.map((r) => ({ n: r.n, title: r.title, desc: r.desc, tag: r.tag }));
  }
});
var itemText = query({
  args: { key: v2.string(), cid: v2.string(), n: v2.number() },
  handler: async (ctx, { key, cid, n }) => {
    checkKey(key);
    const r = await ctx.db.query("tcText").withIndex("by_cid_n", (q) => q.eq("cid", cid).eq("n", n)).first();
    if (!r) throw new ConvexError2("That file is no longer in the app.");
    return { text: r.text, url: r.url };
  }
});
var remove = mutation({
  args: { key: v2.string(), cid: v2.string() },
  handler: async (ctx, { key, cid }) => {
    checkKey(key);
    const c = await byCid(ctx, cid);
    if (!c) return { ok: true };
    await ctx.db.patch(c._id, { deleting: true });
    const gone = (await getMeta(ctx, "tabGone"))?.value || [];
    gone.push(c.tab + "|" + normLink(c.data?.links?.[0]?.[1]));
    await setMeta(ctx, "tabGone", gone.slice(-500));
    await ctx.scheduler.runAfter(0, internal.tabs.purge, { cid });
    await snapshotSoon(ctx);
    return { ok: true };
  }
});
var purge = internalMutation({
  args: { cid: v2.string() },
  handler: async (ctx, { cid }) => {
    if (await clearSome(ctx, cid)) {
      await ctx.scheduler.runAfter(0, internal.tabs.purge, { cid });
      return;
    }
    const c = await byCid(ctx, cid);
    if (c) await ctx.db.delete(c._id);
  }
});
var cardNames = internalQuery({
  args: { tab: v2.string() },
  handler: async (ctx, { tab }) => (await ctx.db.query("tcards").withIndex("by_tab", (q) => q.eq("tab", tab)).collect()).filter((r) => !r.deleting).map((r) => ({ cid: r.cid, title: r.data?.title || r.cid, links: r.data?.links || [], repo: r.data?.repo || "" }))
});
var insertCard = internalMutation({
  args: { tab: v2.string(), data: v2.any(), importing: v2.boolean() },
  handler: async (ctx, { tab, data: data2, importing }) => {
    if (!TABS.includes(tab)) throw new ConvexError2("Unknown tab.");
    const cid = await nextCid(ctx, tab);
    const id2 = await ctx.db.insert("tcards", { cid, tab, data: data2, imp: NONE });
    if (importing) await startImport(ctx, { _id: id2, cid, tab, data: data2 });
    await snapshotSoon(ctx);
    return cid;
  }
});
var all = internalQuery({
  args: {},
  handler: async (ctx) => (await ctx.db.query("tcards").collect()).filter((r) => !r.deleting).map((r) => ({ ...r.data, id: r.cid, tab: r.tab, imp: r.imp || NONE }))
});
export {
  TABS,
  addItems,
  all,
  cardNames,
  clearItems,
  ensureSeeded,
  insertCard,
  itemText,
  items,
  list,
  progress,
  purge,
  reimport,
  remove,
  resumeStuck,
  setImp
};
