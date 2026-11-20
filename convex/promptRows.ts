// Helpers shared by the prompt importer (Node runtime) and the add flow. No Convex functions here.
import { internal } from "./_generated/api";

export type PromptRow = { libId: string; title: string; desc: string; text: string; url: string };

// Sends rows to the database in pieces small enough for one mutation.
// runId: only the current copy job for a library may write (an old, abandoned job is ignored).
export async function addInBatches(ctx: any, rows: PromptRow[], runId?: string, onBatch?: (done: number) => Promise<void>) {
  let batch: PromptRow[] = [], size = 0, done = 0;
  for (const r of rows) {
    const s = r.text.length + r.title.length + r.desc.length + r.url.length + 100;
    if (batch.length && (size + s > 900_000 || batch.length >= 300)) {
      await ctx.runMutation(internal.promptLibs.addPrompts, { rows: batch, runId });
      done += batch.length;
      if (onBatch) await onBatch(done);
      batch = []; size = 0;
    }
    batch.push(r); size += s;
  }
  if (batch.length) await ctx.runMutation(internal.promptLibs.addPrompts, { rows: batch, runId });
}

export function parseRepoUrl(url: string): { owner: string; repo: string; branch: string; sub: string } | null {
  const m = String(url || "").match(/github\.com\/([\w.-]+)\/([\w.-]+)(?:\/(?:tree|blob)\/([^/]+)\/?(.*))?/i);
  if (!m) return null;
  return { owner: m[1], repo: m[2].replace(/\.git$/, ""), branch: m[3] || "", sub: (m[4] || "").replace(/\/+$/, "") };
}
