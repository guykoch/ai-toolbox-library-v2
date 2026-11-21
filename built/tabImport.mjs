"use node";

// stub:server
var id = (d) => d;
var internalAction = id;

// convex/tabImport.ts
import { v } from "convex/values";

// stub:api
var mk = (m) => new Proxy({}, { get: (_, f) => m + ":" + String(f) });
var internal = { items: mk("items"), ingest: mk("ingest"), install: mk("install"), advisor: mk("advisor"), pipeline: mk("pipeline"), enrich: mk("enrich"), credit: mk("credit"), hype: mk("hype"), alts: mk("alts"), promptFinder: mk("promptFinder"), promptLibs: mk("promptLibs"), promptImport: mk("promptImport"), promptAdd: mk("promptAdd"), snapshot: mk("snapshot"), siteCheck: mk("siteCheck"), webjobs: mk("webjobs"), webcopy: mk("webcopy"), promptGen: mk("promptGen"), tabs: mk("tabs"), tabImport: mk("tabImport"), tabAdd: mk("tabAdd"), playbooks: mk("playbooks"), playbookAi: mk("playbookAi"), addAny: mk("addAny") };

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

// convex/promptRows.ts
function parseRepoUrl(url) {
  const m = String(url || "").match(/github\.com\/([\w.-]+)\/([\w.-]+)(?:\/(?:tree|blob)\/([^/]+)\/?(.*))?/i);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/, ""), branch: m[3] || "", sub: (m[4] || "").replace(/\/+$/, "") };
}

// convex/tabImport.ts
var MAX_ITEMS = 2500;
var MAX_TEXT = 1e5;
var TIME_BUDGET_MS = 7 * 60 * 1e3;
var SKIP_PATH = /(^|\/)(node_modules|\.git|vendor|dist|build|__tests__|\.vscode|\.idea|\.devcontainer|\.playwright-mcp|docs\/api)(\/|$)/i;
function ghHeaders() {
  const h = { "User-Agent": "ai-toolbox", Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}
var clean = (s) => String(s || "").replace(/\s+/g, " ").trim();
function short(s, n = 220) {
  const t = clean(String(s || "").replace(/^---[\s\S]*?---/, "").replace(/<[^>]+>/g, " ").replace(/[#*`>_|]/g, " "));
  return t.length <= n ? t : t.slice(0, n).replace(/\s+\S*$/, "") + "\u2026";
}
function frontmatter(text, key) {
  const fm = text.match(/^---\s*\n([\s\S]*?)\n---/);
  const m = fm && fm[1].match(new RegExp("^" + key + ":\\s*(.+)$", "m"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "").replace(/\\n/g, " ") : "";
}
var pretty = (s) => s.replace(/\.(md|mdc|json|cursorrules|txt)$/i, "").replace(/^\d{2,5}[-_ ]/, "").replace(/-?cursorrules-prompt(-file)?-?/gi, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().replace(/\b\w/g, (c) => c.toUpperCase());
var prettyTag = (dir) => pretty(dir.replace(/^\d+[-_]/, ""));
function nodeName(type) {
  const t = String(type || "").split(".").pop() || "";
  return t.replace(/Trigger$|Tool$/, "").replace(/^lmChat|^lm/, "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (c) => c.toUpperCase()).trim();
}
var GENERIC = /^(set|if|switch|merge|no ?op|code|function( item)?|sticky ?note|split in batches|split out|item lists|wait|filter|aggregate|sort|limit|date time|move binary data|respond to webhook|execute workflow|start|manual|schedule|cron|interval|webhook|html|markdown|xml|crypto|edit fields|summarize|remove duplicates|compare datasets|rename keys|split in batches v3|loop over items|form|chat)$/i;
async function extractFiles(tab, repoUrl, progress, deadline) {
  const r = parseRepoUrl(repoUrl);
  if (!r) throw new Error("Not a GitHub repo link.");
  await progress("Reading the repo on GitHub\u2026");
  const info = await fetchWithTimeout(`https://api.github.com/repos/${r.owner}/${r.repo}`, { headers: ghHeaders() }, 15e3);
  if (!info.ok) throw new Error(info.status === 404 ? "GitHub repo not found (or it's private)." : `GitHub said ${info.status}.`);
  const branch = r.branch || (await info.json()).default_branch || "main";
  const tr = await fetchWithTimeout(`https://api.github.com/repos/${r.owner}/${r.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`, { headers: ghHeaders() }, 3e4);
  if (!tr.ok) throw new Error(`Couldn't list the repo's files (GitHub ${tr.status}).`);
  const tree = (await tr.json()).tree;
  const files = tree.filter((t) => t.type === "blob" && (!r.sub || t.path.startsWith(r.sub + "/")) && !SKIP_PATH.test(t.path)).map((t) => ({ path: t.path, size: t.size || 0, name: t.path.split("/").pop() || "", dir: t.path.split("/").slice(0, -1).join("/") }));
  const raw = (p) => `https://raw.githubusercontent.com/${r.owner}/${r.repo}/${encodeURIComponent(branch)}/${p.split("/").map(encodeURIComponent).join("/")}`;
  const page = (p) => `https://github.com/${r.owner}/${r.repo}/blob/${branch}/${p.split("/").map(encodeURIComponent).join("/")}`;
  let pick;
  if (tab === "autos") pick = files.filter((f) => /\.json$/i.test(f.name) && f.size > 300 && f.size < 6e5 && !/package(-lock)?\.json|tsconfig|manifest|schema|settings|config|marketplace|plugin\.json|categories|\.lock/i.test(f.path));
  else if (tab === "rules") pick = files.filter((f) => /(^|\/)\.cursorrules$|\.mdc$|(^|\/)\.windsurfrules$|(^|\/)\.clinerules|copilot-instructions\.md$|\.instructions\.md$/i.test(f.path) || /^(CLAUDE|AGENTS|GEMINI)\.md$/i.test(f.name) && f.dir !== "");
  else {
    pick = files.filter((f) => /\.md$/i.test(f.name) && !/^(readme|contributing|changelog|license|claude|agents|code_of_conduct|security)\.md$/i.test(f.name) && f.size < 2e5);
    const inAgents = pick.filter((f) => /(^|\/)agents\//i.test(f.path));
    if (inAgents.length >= 5) pick = inAgents;
  }
  pick = pick.slice(0, MAX_ITEMS);
  if (!pick.length) return { rows: [], how: "", partial: false };
  const rows = [];
  let partial = false;
  for (let i = 0; i < pick.length; i += 16) {
    if (Date.now() > deadline) {
      partial = true;
      break;
    }
    if (i % 160 === 0) await progress(`Reading files: ${i.toLocaleString()} of ${pick.length.toLocaleString()}\u2026`);
    const part = pick.slice(i, i + 16);
    const got = await Promise.all(part.map(async (f) => {
      try {
        const res = await fetchWithTimeout(raw(f.path), {}, 2e4);
        return res.ok ? { f, text: await res.text() } : null;
      } catch {
        return null;
      }
    }));
    for (const g of got) {
      if (!g) continue;
      const { f, text } = g;
      const folder = f.dir.split("/").pop() || "";
      if (tab === "agents") {
        const name = frontmatter(text, "name"), desc = frontmatter(text, "description");
        if (!name || !desc) continue;
        const parts = f.dir.split("/");
        const tagDir = /^agents$/i.test(folder) && parts.length >= 2 ? parts[parts.length - 2] : folder;
        rows.push({ title: pretty(name), desc: short(desc, 260), tag: tagDir && !/^(agents|categories|plugins)$/i.test(tagDir) ? prettyTag(tagDir) : "", text: text.slice(0, MAX_TEXT), url: page(f.path) });
      } else if (tab === "rules") {
        const title = /^(\.cursorrules|CLAUDE\.md|AGENTS\.md|GEMINI\.md|copilot-instructions\.md)$/i.test(f.name) ? pretty(folder || f.name) : pretty(f.name);
        const desc = frontmatter(text, "description") || short(text, 220);
        if (text.trim().length < 60) continue;
        const kind = /\.mdc$|\.cursorrules$/i.test(f.name) ? "Cursor" : /CLAUDE\.md$/i.test(f.name) ? "Claude Code" : /AGENTS\.md$/i.test(f.name) ? "AGENTS.md" : /GEMINI\.md$/i.test(f.name) ? "Gemini CLI" : /copilot|\.instructions\.md$/i.test(f.name) ? "Copilot" : /windsurf/i.test(f.name) ? "Windsurf" : "Cline";
        rows.push({ title, desc, tag: kind, text: text.slice(0, MAX_TEXT), url: page(f.path) });
      } else {
        let j;
        try {
          j = JSON.parse(text);
        } catch {
          continue;
        }
        const nodes = Array.isArray(j?.nodes) ? j.nodes : [];
        if (nodes.length < 2) continue;
        const trig = nodes.find((n) => /trigger|webhook|cron|schedule|interval|manual|start/i.test(String(n?.type || "")));
        const trigger = trig ? /manual/i.test(trig.type) ? "Run by hand" : /schedule|cron|interval/i.test(trig.type) ? "On a schedule" : /webhook/i.test(trig.type) ? "Webhook (another app calls it)" : /chatTrigger/i.test(trig.type) ? "Chat message" : /formTrigger/i.test(trig.type) ? "Form submitted" : nodeName(trig.type) + " event" : "Started by another workflow";
        const apps = [...new Set(nodes.map((n) => nodeName(n?.type)).filter((a) => a && !GENERIC.test(a) && !/sticky/i.test(a)))].slice(0, 8);
        const title = clean(j.name && !/^my workflow/i.test(j.name) ? j.name : pretty(f.name)).slice(0, 160);
        const tag = f.dir.split("/").filter((d) => !/^workflows$/i.test(d)).pop() || "";
        rows.push({ title, desc: `Trigger: ${trigger}` + (apps.length ? ` \xB7 Uses: ${apps.join(", ")}` : "") + ` \xB7 ${nodes.length} steps`, tag: prettyTag(tag), text: text.slice(0, MAX_TEXT), url: page(f.path) });
      }
    }
  }
  const what = tab === "agents" ? "agents" : tab === "rules" ? "rule files" : "workflows";
  return { rows, how: `${rows.length.toLocaleString()} ${what}${partial ? " (stopped early: the repo is very big)" : ""}`, partial };
}
var run = internalAction({
  args: { cid: v.string(), tab: v.string(), repo: v.string(), runId: v.string() },
  handler: async (ctx, { cid, tab, repo, runId }) => {
    const deadline = Date.now() + TIME_BUDGET_MS;
    const progress = async (note) => {
      await ctx.runMutation(internal.tabs.progress, { cid, runId, note });
    };
    try {
      await progress("Clearing old copy\u2026");
      while (await ctx.runMutation(internal.tabs.clearItems, { cid, runId }) > 0) {
      }
      const { rows, how } = await extractFiles(tab, repo, progress, deadline);
      if (!rows.length) {
        await ctx.runMutation(internal.tabs.setImp, { cid, runId, state: "failed", note: "Couldn't find " + (tab === "agents" ? "agent files" : tab === "rules" ? "rule files" : "n8n workflow files") + " in this repo." });
        return;
      }
      await progress(`Found ${rows.length.toLocaleString()} \u2014 saving\u2026`);
      let batch = [], size = 0, n = 0;
      const flush = async () => {
        if (!batch.length) return true;
        const ok = await ctx.runMutation(internal.tabs.addItems, { cid, runId, start: n, rows: batch });
        n += batch.length;
        batch = [];
        size = 0;
        return ok;
      };
      for (const row of rows) {
        const s = row.text.length + row.title.length + row.desc.length + 200;
        if (batch.length && (size + s > 9e5 || batch.length >= 200)) {
          if (!await flush()) return;
        }
        batch.push(row);
        size += s;
      }
      if (!await flush()) return;
      await ctx.runMutation(internal.tabs.setImp, { cid, runId, state: "done", note: how });
    } catch (e) {
      await ctx.runMutation(internal.tabs.setImp, { cid, runId, state: "failed", note: String(e?.message || e).slice(0, 200) });
    }
  }
});
export {
  extractFiles,
  run
};
