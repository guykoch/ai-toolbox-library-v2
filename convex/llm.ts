import { ConvexError } from "convex/values";
import { fetchWithTimeout } from "./web";

// Which model does what. Each can be changed in the Convex dashboard without touching code.
export const MODELS = {
  // Researches how to install a tool and writes the install prompt (uses Google Search).
  install: () => process.env.GEMINI_MODEL_INSTALL || "gemini-3.8-flash",
  // Answers "What would you like to do?" from your library.
  advisor: () => process.env.GEMINI_MODEL_ADVISOR || "gemini-3.8-flash",
  // Re-scores hype for "Update hype scores" (uses Google Search).
  hype: () => process.env.GEMINI_MODEL_HYPE || "gemini-3.8-flash",
  // Writes new cards from what you paste (Claude if ANTHROPIC_API_KEY is set, otherwise Gemini).
  addClaude: () => process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
  addGemini: () => process.env.GEMINI_MODEL_ADD || "gemini-3.8-flash",
};

export type ImageIn = { mime: string; data: string }; // base64, no data: prefix (images or PDFs)
export type DocIn = { name: string; text: string }; // text pulled out of Word / PowerPoint / Excel / text files in the browser
export const FILE_MIME = /^(image\/(png|jpeg|webp|gif)|application\/pdf)$/;
// Text files as a block the AI reads together with the message.
export function docsBlock(docs: DocIn[] | undefined, maxEach = 60000, maxAll = 200000) {
  let left = maxAll;
  const parts = (docs || []).slice(0, 20).map((d) => {
    const t = String(d.text || "").slice(0, Math.min(maxEach, Math.max(0, left)));
    left -= t.length;
    return t ? `--- FILE: ${String(d.name || "file").slice(0, 120)} ---\n${t}` : "";
  }).filter(Boolean);
  return parts.length ? `ATTACHED FILES (text extracted from them — read all of it):\n${parts.join("\n\n")}\n\n` : "";
}
export type GeminiTurn = { role: "user" | "model"; text: string; images?: ImageIn[] };
export type GeminiResult = { text: string; sources: { title: string; url: string }[] };

export async function callGemini(opts: {
  model: string;
  system: string;
  turns: GeminiTurn[];
  search?: boolean;
  json?: boolean;
  thinking?: "low" | "medium" | "high";
  maxTokens?: number;
}): Promise<GeminiResult> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new ConvexError("GEMINI_API_KEY is not set in the Convex dashboard (Settings → Environment Variables).");
  const generationConfig: any = { maxOutputTokens: opts.maxTokens ?? 8192 };
  if (opts.json) generationConfig.responseMimeType = "application/json";
  if (opts.thinking) generationConfig.thinkingConfig = { thinkingLevel: opts.thinking };
  const body: any = {
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: opts.turns.map((t) => ({ role: t.role, parts: [...(t.images || []).map((im) => ({ inline_data: { mime_type: im.mime, data: im.data } })), { text: t.text }] })),
    generationConfig,
  };
  if (opts.search) body.tools = [{ google_search: {} }];

  const send = async (b: any) => {
    const r = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(opts.model)}:generateContent`,
      { method: "POST", headers: { "x-goog-api-key": key, "content-type": "application/json" }, body: JSON.stringify(b) },
      240000,
    );
    const j: any = await r.json().catch(() => ({}));
    return { ok: r.ok, j };
  };

  let { ok, j } = await send(body);
  // Older/other models may reject some options — retry once with the plain request.
  if (!ok && /thinking|responseMimeType|google_search|tool/i.test(JSON.stringify(j?.error ?? ""))) {
    const plain = { ...body, generationConfig: { maxOutputTokens: generationConfig.maxOutputTokens } };
    if (opts.json && !opts.search) plain.generationConfig.responseMimeType = "application/json";
    ({ ok, j } = await send(plain));
  }
  if (!ok) throw new ConvexError("Gemini API error: " + (j?.error?.message || "unknown error"));

  const cand = j?.candidates?.[0];
  const text = (cand?.content?.parts || [])
    .filter((p: any) => typeof p.text === "string" && !p.thought)
    .map((p: any) => p.text)
    .join("")
    .trim();
  if (!text) throw new ConvexError("Gemini returned an empty answer" + (cand?.finishReason ? ` (${cand.finishReason})` : "") + ". Try again.");
  const seen = new Set<string>();
  const sources: { title: string; url: string }[] = [];
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

export async function callClaude(system: string, user: string, withSearch: boolean, images: ImageIn[] = []): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new ConvexError("ANTHROPIC_API_KEY is not set in the Convex dashboard (Settings → Environment Variables).");
  const body: any = {
    model: MODELS.addClaude(),
    max_tokens: 2000,
    system,
    messages: [{ role: "user", content: [...images.map((im) => ({ type: im.mime === "application/pdf" ? "document" : "image", source: { type: "base64", media_type: im.mime, data: im.data } })), { type: "text", text: user }] }],
  };
  if (withSearch) body.tools = [{ type: "web_search_20250305", name: "web_search", max_uses: 4 }];
  const r = await fetchWithTimeout(
    "https://api.anthropic.com/v1/messages",
    { method: "POST", headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" }, body: JSON.stringify(body) },
    180000,
  );
  const j: any = await r.json();
  if (!r.ok) {
    const msg = j?.error?.message || JSON.stringify(j).slice(0, 300);
    if (withSearch && /tool|web_search/i.test(msg)) return callClaude(system, user, false, images);
    throw new ConvexError("Claude API error: " + msg);
  }
  return (j.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
}

export function parseJson(text: string): any {
  try { const t = text.trim(); if (t.startsWith("{")) return JSON.parse(t); } catch { /* fall through */ }
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const src = fenced ? fenced[1] : text;
  const start = src.indexOf("{");
  const end = src.lastIndexOf("}");
  if (start < 0 || end < start) throw new ConvexError("Couldn't read the AI's answer. Please try again.");
  try {
    return JSON.parse(src.slice(start, end + 1));
  } catch {
    throw new ConvexError("Couldn't read the AI's answer. Please try again.");
  }
}
