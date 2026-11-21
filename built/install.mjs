// stub:server
var id = (d) => d;
var action = id;

// stub:api
var mk = (m) => new Proxy({}, { get: (_, f) => m + ":" + String(f) });
var internal = { items: mk("items"), ingest: mk("ingest"), install: mk("install"), advisor: mk("advisor"), pipeline: mk("pipeline"), enrich: mk("enrich"), credit: mk("credit"), hype: mk("hype"), alts: mk("alts"), promptFinder: mk("promptFinder"), promptLibs: mk("promptLibs"), promptImport: mk("promptImport"), promptAdd: mk("promptAdd"), snapshot: mk("snapshot"), siteCheck: mk("siteCheck"), webjobs: mk("webjobs"), webcopy: mk("webcopy"), promptGen: mk("promptGen"), tabs: mk("tabs"), tabImport: mk("tabImport"), tabAdd: mk("tabAdd"), playbooks: mk("playbooks"), playbookAi: mk("playbookAi"), addAny: mk("addAny") };

// convex/install.ts
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

// convex/web.ts
var TRACKING = /^(utm_\w+|fbclid|gclid|mibextid|rdid|share_url|si|igsh|igshid|ref|ref_src|ref_url|s|t_?id|__cft__\[0\]|__tn__|_rdr|feature)$/i;
function cleanUrl(raw) {
  try {
    const u = new URL(raw.trim());
    const keys = [];
    u.searchParams.forEach((_val, k) => keys.push(k));
    for (const k of keys) {
      if (TRACKING.test(k) || k.startsWith("utm_") || k.startsWith("__cft__")) u.searchParams.delete(k);
    }
    u.hash = "";
    let s = u.toString();
    if (s.endsWith("?")) s = s.slice(0, -1);
    return s.replace("://www.facebook.com/", "://facebook.com/").replace("://m.facebook.com/", "://facebook.com/");
  } catch {
    return raw.trim();
  }
}
async function fetchWithTimeout(url, init = {}, ms = 12e3) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}
function decodeEntities(s) {
  return s.replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}
function metaTag(html, name) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
  return content ? decodeEntities(content).trim() : "";
}
async function gatherUrl(raw) {
  const out = { input: raw, finalUrl: cleanUrl(raw), notes: "" };
  try {
    const gh = raw.match(/github\.com\/([\w.-]+)\/([\w.-]+)/i);
    if (gh && !["orgs", "topics", "search", "marketplace", "features"].includes(gh[1].toLowerCase())) {
      const repo = `${gh[1]}/${gh[2].replace(/\.git$/, "")}`;
      const headers = { "User-Agent": "ai-toolbox-library", Accept: "application/vnd.github+json" };
      if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
      const r2 = await fetchWithTimeout(`https://api.github.com/repos/${repo}`, { headers });
      if (r2.ok) {
        const j = await r2.json();
        out.github = { stars: j.stargazers_count, forks: j.forks_count, license: j.license?.spdx_id && j.license.spdx_id !== "NOASSERTION" ? j.license.spdx_id : "" };
        out.notes += `GitHub repo ${j.full_name}: "${j.description ?? ""}". Stars ${j.stargazers_count}, forks ${j.forks_count}, licence ${out.github.license || "none stated"}, homepage ${j.homepage || "none"}, language ${j.language || "?"}, topics ${(j.topics || []).join(", ")}.
`;
        const rm = await fetchWithTimeout(`https://api.github.com/repos/${repo}/readme`, { headers: { ...headers, Accept: "application/vnd.github.raw" } });
        if (rm.ok) out.notes += "README (start):\n" + (await rm.text()).slice(0, 5e3) + "\n";
        return out;
      }
    }
    const isFb = /facebook\.com|fb\.watch/i.test(raw);
    const r = await fetchWithTimeout(raw, {
      headers: {
        "User-Agent": isFb ? "facebookexternalhit/1.1" : "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9,he;q=0.8"
      }
    });
    out.finalUrl = cleanUrl(r.url || raw);
    const html = (await r.text()).slice(0, 6e5);
    const title = metaTag(html, "og:title") || decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();
    const desc = metaTag(html, "og:description") || metaTag(html, "description");
    const body = decodeEntities(
      html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ")
    ).replace(/\s+/g, " ").trim().slice(0, 4e3);
    out.notes += `Fetched ${out.finalUrl} (HTTP ${r.status}).
Title: ${title}
Description: ${desc}
Page text (start): ${body}
`;
  } catch (e) {
    out.notes += `Could not fetch this link (${e?.message ?? e}).
`;
  }
  return out;
}

// convex/llm.ts
import { ConvexError as ConvexError2 } from "convex/values";
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

// convex/install.ts
var SYSTEM = `You are a senior developer-tools engineer. Your job: research ONE AI tool / resource and write a complete, copy-paste-ready PROMPT that a capable AI agent (Claude Code, Cursor, Codex, Gemini CLI, ChatGPT agent mode, or a browser agent) can follow to get it FULLY installed, configured and working for the user.

STEP 1 \u2014 RESEARCH (use Google Search; prefer official sources: the GitHub README, official docs, the product's own site, package registries).
Work out exactly what this thing is, and which kind it is:
 a) Agent skill / plugin (e.g. Claude Code skills, SKILL.md folders, plugin marketplaces) \u2014 exact install commands, where files go (~/.claude/skills, project .claude/skills, etc.), how to verify it loads.
 b) MCP server \u2014 install command, the exact JSON config block for each common client (Claude Code \`claude mcp add\`, Claude Desktop config file, Cursor), required env vars / API keys.
 c) CLI or library (npm / pip / brew / cargo / docker) \u2014 prerequisites + versions, install, first-run config, a smoke-test command.
 d) Self-hosted app / open-source repo \u2014 clone, env file, dependencies, build, run, open locally.
 e) Desktop app or browser extension \u2014 official download/store URL, permissions, first-run setup.
 f) Web app / SaaS \u2014 exact URL, sign-up, plan/billing notes, which settings pages to visit and what to click, API key creation if relevant, and how to connect it to the user's other tools.
 g) A guide, course, video, prompt, technique or news item (nothing to install) \u2014 then the prompt should set the user up to APPLY it: extract the concrete steps/prompts/settings and turn them into actions (e.g. create the CLAUDE.md, save the custom instructions, create the project, bookmark the course).
 If a social post points to a tool, research the tool it points to. If the item is several tools, cover each.

STEP 2 \u2014 WRITE THE PROMPT. Output ONLY the prompt text (plain Markdown, no preamble, no closing remarks). Structure:
# Install & set up: <tool name>
## Goal \u2014 one or two sentences: what will be working at the end.
## What this is \u2014 kind (from the list above), official links (repo / docs / site).
## Before you start \u2014 ask the user for anything only they can provide (OS if unknown, API keys, account choice, target folder/project). Check prerequisites with commands and install missing ones.
## Steps \u2014 numbered, exact commands in code blocks, exact file paths and config snippets. Give macOS/Linux and Windows variants where they differ. Mark steps that need a human (signing in, paying, approving OAuth, CAPTCHAs) with "\u{1F464} USER ACTION:" and tell the agent to pause and wait. For web steps give the exact URL and what to click.
## Verify it works \u2014 a concrete test the agent must run, and what success looks like.
## If something goes wrong \u2014 3-6 likely problems with fixes; and: "If anything here doesn't match what you see, check the official docs at <URL> and follow them instead."
## Rules for the agent \u2014 never invent API keys or credentials; don't run destructive commands; ask before installing anything system-wide; report what was done at the end.

Be precise and current: use commands exactly as the official docs give them today. If a fact can't be confirmed, say so in the prompt and tell the agent how to check. Never fabricate URLs, package names or flags.`;
async function buildAndSavePrompt(ctx, id2, today, thinking = "high") {
  const item = await ctx.runQuery(internal.items.getItem, { id: id2 });
  if (!item) throw new ConvexError3("That item no longer exists.");
  const links = [item.url, item.mentioned, item.docs, item.savedFrom].filter((u) => u && /^https?:\/\//.test(u)).slice(0, 3);
  const fetched = await Promise.all(links.map(gatherUrl));
  const context = fetched.map((f) => f.notes).join("\n---\n").slice(0, 14e3);
  const card = {
    title: item.title,
    summary: item.summary,
    kind: item.type,
    shelf: item.cat,
    openSource: item.os,
    url: item.url,
    alsoLinked: item.mentioned || "",
    docs: item.docs || "",
    savedFromPost: item.savedFrom || "",
    knownInstallCommands: item.install || [],
    installAlt: item.installAlt || [],
    installNote: item.installNote || ""
  };
  const user = `Today is ${today}. Research this saved library item and write the install prompt.

LIBRARY CARD:
${JSON.stringify(card, null, 1)}

` + (context ? `WHAT I FOUND AT ITS LINKS (may be partial \u2014 e.g. Facebook often blocks reading; verify with search):
${context}
` : "");
  const model = MODELS.install();
  const res = await callGemini({ model, system: SYSTEM, turns: [{ role: "user", text: user }], search: true, thinking, maxTokens: 16e3 });
  let text = res.text.replace(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/m, "$1").trim();
  if (res.sources.length) {
    text += "\n\n## Sources checked while writing this\n" + res.sources.slice(0, 8).map((s) => `- ${s.title || "source"}: ${s.url}`).join("\n");
  }
  const saved = { itemId: id2, text, sources: res.sources.slice(0, 8), model, createdAt: today };
  await ctx.runMutation(internal.items.savePrompt, saved);
  return { text, sources: saved.sources, model, createdAt: today };
}
var generatePrompt = action({
  args: { key: v.string(), id: v.number(), today: v.string() },
  handler: async (ctx, { key, id: id2, today }) => {
    checkKey(key);
    return buildAndSavePrompt(ctx, id2, today, "high");
  }
});
export {
  buildAndSavePrompt,
  generatePrompt
};
