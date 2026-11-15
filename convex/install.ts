import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import { checkKey } from "./auth";
import { gatherUrl } from "./web";
import { callGemini, MODELS } from "./llm";

// ---------------------------------------------------------------------------
// "Install prompt": researches what it takes to get a tool fully working and
// writes one self-contained prompt you can paste into any AI agent
// (Claude Code, Cursor, Codex, ChatGPT agent, Gemini CLI...).
// ---------------------------------------------------------------------------

const SYSTEM = `You are a senior developer-tools engineer. Your job: research ONE AI tool / resource and write a complete, copy-paste-ready PROMPT that a capable AI agent (Claude Code, Cursor, Codex, Gemini CLI, ChatGPT agent mode, or a browser agent) can follow to get it FULLY installed, configured and working for the user.

STEP 1 — RESEARCH (use Google Search; prefer official sources: the GitHub README, official docs, the product's own site, package registries).
Work out exactly what this thing is, and which kind it is:
 a) Agent skill / plugin (e.g. Claude Code skills, SKILL.md folders, plugin marketplaces) — exact install commands, where files go (~/.claude/skills, project .claude/skills, etc.), how to verify it loads.
 b) MCP server — install command, the exact JSON config block for each common client (Claude Code \`claude mcp add\`, Claude Desktop config file, Cursor), required env vars / API keys.
 c) CLI or library (npm / pip / brew / cargo / docker) — prerequisites + versions, install, first-run config, a smoke-test command.
 d) Self-hosted app / open-source repo — clone, env file, dependencies, build, run, open locally.
 e) Desktop app or browser extension — official download/store URL, permissions, first-run setup.
 f) Web app / SaaS — exact URL, sign-up, plan/billing notes, which settings pages to visit and what to click, API key creation if relevant, and how to connect it to the user's other tools.
 g) A guide, course, video, prompt, technique or news item (nothing to install) — then the prompt should set the user up to APPLY it: extract the concrete steps/prompts/settings and turn them into actions (e.g. create the CLAUDE.md, save the custom instructions, create the project, bookmark the course).
 If a social post points to a tool, research the tool it points to. If the item is several tools, cover each.

STEP 2 — WRITE THE PROMPT. Output ONLY the prompt text (plain Markdown, no preamble, no closing remarks). Structure:
# Install & set up: <tool name>
## Goal — one or two sentences: what will be working at the end.
## What this is — kind (from the list above), official links (repo / docs / site).
## Before you start — ask the user for anything only they can provide (OS if unknown, API keys, account choice, target folder/project). Check prerequisites with commands and install missing ones.
## Steps — numbered, exact commands in code blocks, exact file paths and config snippets. Give macOS/Linux and Windows variants where they differ. Mark steps that need a human (signing in, paying, approving OAuth, CAPTCHAs) with "👤 USER ACTION:" and tell the agent to pause and wait. For web steps give the exact URL and what to click.
## Verify it works — a concrete test the agent must run, and what success looks like.
## If something goes wrong — 3-6 likely problems with fixes; and: "If anything here doesn't match what you see, check the official docs at <URL> and follow them instead."
## Rules for the agent — never invent API keys or credentials; don't run destructive commands; ask before installing anything system-wide; report what was done at the end.

Be precise and current: use commands exactly as the official docs give them today. If a fact can't be confirmed, say so in the prompt and tell the agent how to check. Never fabricate URLs, package names or flags.`;

export const generatePrompt = action({
  args: { key: v.string(), id: v.number(), today: v.string() },
  handler: async (ctx, { key, id, today }): Promise<{ text: string; sources: { title: string; url: string }[]; model: string; createdAt: string }> => {
    checkKey(key);
    const item: any = await ctx.runQuery(internal.items.getItem, { id });
    if (!item) throw new ConvexError("That item no longer exists.");

    // Read the real pages first: the main link and the link the post points to.
    const links = [item.url, item.mentioned, item.docs].filter((u: string) => u && /^https?:\/\//.test(u)).slice(0, 3);
    const fetched = await Promise.all(links.map(gatherUrl));
    const context = fetched.map((f) => f.notes).join("\n---\n").slice(0, 14000);

    const card = {
      title: item.title, summary: item.summary, kind: item.type, shelf: item.cat, openSource: item.os,
      url: item.url, alsoLinked: item.mentioned || "", docs: item.docs || "", knownInstallCommands: item.install || [], installAlt: item.installAlt || [], installNote: item.installNote || "",
    };
    const user =
      `Today is ${today}. Research this saved library item and write the install prompt.\n\nLIBRARY CARD:\n${JSON.stringify(card, null, 1)}\n\n` +
      (context ? `WHAT I FOUND AT ITS LINKS (may be partial — e.g. Facebook often blocks reading; verify with search):\n${context}\n` : "");

    const model = MODELS.install();
    const res = await callGemini({ model, system: SYSTEM, turns: [{ role: "user", text: user }], search: true, thinking: "high", maxTokens: 16000 });
    let text = res.text.replace(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/m, "$1").trim();
    if (res.sources.length) {
      text += "\n\n## Sources checked while writing this\n" + res.sources.slice(0, 8).map((s) => `- ${s.title || "source"}: ${s.url}`).join("\n");
    }
    const saved = { itemId: id, text, sources: res.sources.slice(0, 8), model, createdAt: today };
    await ctx.runMutation(internal.items.savePrompt, saved);
    return { text, sources: saved.sources, model, createdAt: today };
  },
});
