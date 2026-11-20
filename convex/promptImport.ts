"use node";
// Copies the prompts out of an open-source GitHub repo into the finder.
// It recognizes the common layouts of prompt libraries:
//   1. a CSV / JSON file with a prompt column (e.g. prompts.chat)
//   2. one folder per prompt with the same file name in each (system.md, PROMPT.md, SKILL.md, DESIGN.md…)
//   3. a folder of many prompt files (one .md / .txt per prompt)
//   4. otherwise: the README, one prompt per "## " section
import { internalAction } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { fetchWithTimeout } from "./web";
import { addInBatches, PromptRow, parseRepoUrl } from "./promptRows";

const MAX_PROMPTS = 5000;
const MAX_BYTES = 40_000_000;
const MAX_TEXT = 60_000;
const BAD = /jailbreak|\bDAN\b|uncensored|nsfw/i;
const SKIP_PATH = /(^|\/)(node_modules|\.github|\.git|vendor|dist|build|tests?|__tests__|\.vscode|\.idea)(\/|$)/i;
const SKIP_FILE = /^(license|licence|changelog|contributing|code_of_conduct|security|governance|owners|agents|claude|support|funding|history|notice|authors)(\.[a-z]+)?$/i;
const TEXT_EXT = /\.(md|mdx|txt|prompt)$/i;

function clean(s: string) {
  return String(s || "").replace(/\s+/g, " ").trim();
}
function short(s: string, n = 220) {
  const t = clean(String(s || "").replace(/^---[\s\S]*?---/, "").replace(/<[^>]+>/g, " ").replace(/[#*`>_|]/g, " "));
  return t.length <= n ? t : t.slice(0, n).replace(/\s+\S*$/, "") + "…";
}
function pretty(name: string) {
  return name.replace(/\.(md|mdx|txt|prompt)$/i, "").replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
}
function frontmatter(text: string, key: string) {
  const fm = text.match(/^---\s*\n([\s\S]*?)\n---/);
  const m = fm && fm[1].match(new RegExp("^" + key + ":\\s*(.+)$", "m"));
  return m ? m[1].trim().replace(/^["']|["']$/g, "") : "";
}

function ghHeaders(): Record<string, string> {
  const h: Record<string, string> = { "User-Agent": "ai-toolbox", Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) h.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  return h;
}

// Small CSV parser (quoted fields, commas and newlines inside quotes).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], f = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; }
      else f += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(f); f = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(f); f = ""; rows.push(row); row = [];
    } else f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  return rows;
}

const PROMPT_COLS = ["prompt", "content", "text", "system_prompt", "system", "instructions", "template"];
const TITLE_COLS = ["act", "title", "name", "role", "task", "persona", "id"];

export async function extractPrompts(libId: string, repoUrl: string): Promise<{ rows: PromptRow[]; how: string }> {
  const r = parseRepoUrl(repoUrl);
  if (!r) throw new Error("Not a GitHub repo link.");
  const info = await fetchWithTimeout(`https://api.github.com/repos/${r.owner}/${r.repo}`, { headers: ghHeaders() }, 15000);
  if (!info.ok) throw new Error(info.status === 404 ? "GitHub repo not found (or it's private)." : `GitHub said ${info.status}.`);
  const meta = await info.json();
  const branch = r.branch || meta.default_branch || "main";
  const tr = await fetchWithTimeout(`https://api.github.com/repos/${r.owner}/${r.repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`, { headers: ghHeaders() }, 30000);
  if (!tr.ok) throw new Error(`Couldn't list the repo's files (GitHub ${tr.status}).`);
  const tree = (await tr.json()).tree as { path: string; type: string; size?: number }[];
  const files = tree
    .filter((t) => t.type === "blob" && (!r.sub || t.path === r.sub || t.path.startsWith(r.sub + "/")) && !SKIP_PATH.test(t.path))
    .map((t) => ({ path: t.path, size: t.size || 0, name: t.path.split("/").pop() || "", dir: t.path.split("/").slice(0, -1).join("/") }));
  const raw = (p: string) => `https://raw.githubusercontent.com/${r.owner}/${r.repo}/${encodeURIComponent(branch)}/${p.split("/").map(encodeURIComponent).join("/")}`;
  const page = (p: string) => `https://github.com/${r.owner}/${r.repo}/blob/${branch}/${p}`;
  const get = async (p: string) => {
    const res = await fetchWithTimeout(raw(p), {}, 30000);
    if (!res.ok) throw new Error("fetch " + res.status);
    return await res.text();
  };
  const fetchMany = async (list: typeof files) => {
    const out: { f: (typeof files)[number]; text: string }[] = [];
    let bytes = 0;
    for (let i = 0; i < list.length; i += 10) {
      const part = list.slice(i, i + 10);
      const got = await Promise.all(part.map(async (f) => { try { return { f, text: await get(f.path) }; } catch { return null; } }));
      for (const g of got) if (g) { out.push(g); bytes += g.text.length; }
      if (bytes > MAX_BYTES) break;
    }
    return out;
  };
  const ok = (title: string, text: string) => title && text && text.trim().length >= 40 && !BAD.test(title) && !BAD.test(text.slice(0, 500));
  const row = (title: string, text: string, url: string, desc?: string): PromptRow => ({ libId, title: clean(title).slice(0, 200), desc: short(desc || text), text: text.trim().slice(0, MAX_TEXT), url });

  // 1. CSV / JSON with a prompt column.
  const tables = files.filter((f) => /\.(csv|json)$/i.test(f.name) && f.size > 2000 && f.size < 30_000_000 && !/package(-lock)?\.json|tsconfig|composer|manifest|schema|config|\.lock/i.test(f.name)).sort((a, b) => b.size - a.size).slice(0, 3);
  for (const f of tables) {
    let text = "";
    try { text = await get(f.path); } catch { continue; }
    const rows: PromptRow[] = [];
    if (/\.csv$/i.test(f.name)) {
      const t = parseCsv(text);
      const head = (t[0] || []).map((h) => h.trim().toLowerCase());
      const pc = head.findIndex((h) => PROMPT_COLS.includes(h));
      const tc = head.findIndex((h) => TITLE_COLS.includes(h));
      if (pc < 0) continue;
      for (const line of t.slice(1)) {
        const p = line[pc] || "", ti = (tc >= 0 ? line[tc] : "") || short(p, 60);
        if (ok(ti, p)) rows.push(row(ti, p, page(f.path)));
        if (rows.length >= MAX_PROMPTS) break;
      }
    } else {
      try {
        let j = JSON.parse(text);
        if (!Array.isArray(j)) j = Object.values(j).find((x) => Array.isArray(x)) || [];
        for (const o of j as any[]) {
          if (!o || typeof o !== "object") continue;
          const pk = Object.keys(o).find((k) => PROMPT_COLS.includes(k.toLowerCase()) && typeof o[k] === "string");
          if (!pk) continue;
          const tk = Object.keys(o).find((k) => TITLE_COLS.includes(k.toLowerCase()) && typeof o[k] === "string");
          const ti = (tk ? o[tk] : "") || short(o[pk], 60);
          if (ok(ti, o[pk])) rows.push(row(ti, o[pk], page(f.path), typeof o.description === "string" ? o.description : undefined));
          if (rows.length >= MAX_PROMPTS) break;
        }
      } catch { continue; }
    }
    if (rows.length >= 5) return { rows, how: `${rows.length} prompts from ${f.path}` };
  }

  const texts = files.filter((f) => TEXT_EXT.test(f.name) && !SKIP_FILE.test(f.name) && f.size < 400_000);

  // 2. One folder per prompt, same file name in each folder.
  const byName = new Map<string, typeof files>();
  for (const f of texts) {
    if (!f.dir) continue;
    const k = f.name.toLowerCase();
    if (!byName.has(k)) byName.set(k, []);
    byName.get(k)!.push(f);
  }
  const rank = (k: string) => (/^(system|prompt|skill|design)\.mdx?$/.test(k) ? 2 : k === "readme.md" ? 0 : 1);
  const perFolder = [...byName.entries()].filter(([, l]) => l.length >= 5).sort((a, b) => rank(b[0]) - rank(a[0]) || b[1].length - a[1].length)[0];

  // 3. A folder with many prompt files.
  const byDir = new Map<string, typeof files>();
  for (const f of texts) {
    if (/^readme/i.test(f.name)) continue;
    if (!byDir.has(f.dir)) byDir.set(f.dir, []);
    byDir.get(f.dir)!.push(f);
  }
  const flatDirs = [...byDir.entries()].filter(([, l]) => l.length >= 5).sort((a, b) => b[1].length - a[1].length);
  const flatCount = flatDirs.slice(0, 5).reduce((n, [, l]) => n + l.length, 0);

  if (perFolder && (rank(perFolder[0]) > 0 || perFolder[1].length >= flatCount)) {
    const got = await fetchMany(perFolder[1].slice(0, MAX_PROMPTS));
    const rows = got
      .map(({ f, text }) => {
        const folder = f.dir.split("/").pop() || f.name;
        return row(frontmatter(text, "name") || pretty(folder), text, page(f.path), frontmatter(text, "description") || undefined);
      })
      .filter((x) => ok(x.title, x.text));
    if (rows.length >= 3) return { rows, how: `${rows.length} prompts, one per folder (${perFolder[0]})` };
  }
  if (flatCount >= 5) {
    const list = flatDirs.slice(0, 5).flatMap(([, l]) => l).slice(0, MAX_PROMPTS);
    const got = await fetchMany(list);
    const rows = got.map(({ f, text }) => row(frontmatter(text, "title") || frontmatter(text, "name") || pretty(f.name), text, page(f.path), frontmatter(text, "description") || undefined)).filter((x) => ok(x.title, x.text));
    if (rows.length >= 3) return { rows, how: `${rows.length} prompt files` };
  }

  // 4. README sections.
  const readme = files.filter((f) => /^readme\.mdx?$/i.test(f.name)).sort((a, b) => a.path.split("/").length - b.path.split("/").length || b.size - a.size)[0];
  if (readme) {
    const text = await get(readme.path);
    const parts = text.split(/\n(?=##\s+[^#])/);
    const rows: PromptRow[] = [];
    for (const p of parts.slice(1)) {
      const h = clean(p.split("\n")[0].replace(/^##\s+/, "").replace(/[*_`[\]]/g, ""));
      const body = p.split("\n").slice(1).join("\n").trim();
      if (/contents|license|contributing|install|usage|credits|acknowledg|star history|sponsor|support|about/i.test(h)) continue;
      // Skip sections written mostly in Chinese/Japanese/Korean (the app's users read English and Hebrew).
      if ((body.match(/[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]/g) || []).length > body.length * 0.15 || /[\u3040-\u30ff\u4e00-\u9fff\uac00-\ud7af]{2}/.test(h)) continue;
      // Skip sections that are just lists of links (resources, not prompts).
      if ((body.match(/\]\(https?:/g) || []).length >= 3 && !/```/.test(body)) continue;
      const code = body.match(/```[\w-]*\n([\s\S]*?)```/);
      const promptText = code && code[1].trim().length > 60 ? code[1].trim() : body;
      if (ok(h, promptText) && promptText.length > 80) rows.push(row(h, promptText, page(readme.path)));
    }
    if (rows.length >= 3) return { rows, how: `${rows.length} prompts from README sections` };
  }
  return { rows: [], how: "" };
}

export const run = internalAction({
  args: { libId: v.string(), repo: v.string(), runId: v.optional(v.string()) },
  handler: async (ctx, { libId, repo, runId }) => {
    try {
      // Re-import: clear what this library had before.
      while ((await ctx.runMutation(internal.promptLibs.clearPrompts, { libId })) > 0) {}
      const { rows, how } = await extractPrompts(libId, repo);
      if (!rows.length) {
        await ctx.runMutation(internal.promptLibs.setImp, { libId, state: "failed", count: 0, note: "Couldn't find prompts in this repo's files.", runId });
        return;
      }
      await addInBatches(ctx, rows, runId);
      const count: number = await ctx.runQuery(internal.promptLibs.countFor, { libId });
      await ctx.runMutation(internal.promptLibs.setImp, { libId, state: "done", count, note: how, runId });
    } catch (e: any) {
      await ctx.runMutation(internal.promptLibs.setImp, { libId, state: "failed", count: 0, note: String(e?.message || e).slice(0, 200), runId });
    }
  },
});
