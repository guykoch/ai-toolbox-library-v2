import { action } from "./_generated/server";
import { internal } from "./_generated/api";
import { v, ConvexError } from "convex/values";
import { checkKey } from "./auth";
import { callGemini, parseJson, MODELS } from "./llm";

// ---------------------------------------------------------------------------
// "What would you like to do?": a conversational advisor that recommends
// tools ONLY from your active library, ranked, with reasons.
// ---------------------------------------------------------------------------

const SHELVES: Record<string, string> = {
  "coding-agents": "Coding agents", "agent-skills": "Agent skills", "courses-guides": "Courses & guides", productivity: "Productivity",
  "app-building": "App building", video: "Video", image: "Image", audio: "Audio", "ai-models": "AI models",
  "news-analysis": "News & analysis", translation: "Translation", other: "Other",
};

const SYSTEM = `You are the advisor for the user's personal library of saved AI tools and resources. The user tells you, in casual language (maybe with typos, shorthand, Hebrew or English), what they want to do. You recommend items FROM THEIR LIBRARY ONLY.

Rules:
- Only recommend items listed in LIBRARY, by their exact id. Never invent tools or recommend tools that aren't in the list. You may mention in "reply" that a well-known outside tool exists, but only as a note, never as a pick.
- Understand intent, not keywords: "make a vid" = video generation; "turn pdf into word" = PDF conversion; "pretty slides" = presentation/design tools; a guide or course that teaches the task counts as a weaker match than a tool that does it.
- Rank best first. Prefer: does the job directly > partly / with setup > teaches how. Within that, weigh hype score, open source when the user wants free/local, and fit to any constraints they mention (free, Hebrew, no code, local, fast...).
- 0 to 5 picks. If nothing in the library really fits, return no picks, say so plainly, and say what kind of tool they'd need.
- If the request is too vague to rank well, still give your best picks and ask ONE short follow-up question.
- Keep it short and plain-English. "why" = one sentence on why it fits; "tradeoff" = one short caveat or how it compares to the others (or "").
- The conversation may continue ("what about free ones?", "the second one — is it hard?"): use earlier turns for context.

Return ONLY JSON:
{"reply": "1-3 sentence direct answer", "picks": [{"id": <number>, "fit": "best" | "good" | "partial", "why": "...", "tradeoff": "..."}], "followup": "optional short question or empty string"}`;

function libraryText(items: any[]) {
  return items
    .map((i) => {
      const shelves = [i.cat, ...(i.extra || [])].map((c: string) => SHELVES[c] || c).join("/");
      const os = i.os === true ? "open-source" : i.os === false ? "not-OS" : "OS?";
      const summary = String(i.summary || "").replace(/\s+/g, " ");
      return `${i.id} | ${i.title} | ${summary} | ${shelves} | ${i.type} | ${os} | hype ${i.pop} | ${i.host}${i.lang === "he" ? " | Hebrew post" : ""}`;
    })
    .join("\n");
}

export const ask = action({
  args: {
    key: v.string(),
    messages: v.array(v.object({ role: v.union(v.literal("user"), v.literal("assistant")), text: v.string() })),
  },
  handler: async (ctx, { key, messages }): Promise<{ reply: string; picks: { id: number; rank: number; fit: string; why: string; tradeoff: string }[]; followup: string }> => {
    checkKey(key);
    const turns = messages.slice(-12).filter((m) => m.text.trim());
    if (!turns.length || turns[turns.length - 1].role !== "user") throw new ConvexError("Type what you'd like to do first.");
    const items: any[] = await ctx.runQuery(internal.items.activeForAdvisor, {});
    if (!items.length) throw new ConvexError("Your library is empty.");
    const byId = new Map(items.map((i) => [i.id, i]));

    const system = SYSTEM + `\n\nLIBRARY (${items.length} items; columns: id | title | summary | shelf | format | open source | hype 1-100 | site):\n` + libraryText(items);
    const res = await callGemini({
      model: MODELS.advisor(),
      system,
      turns: turns.map((m) => ({ role: m.role === "assistant" ? "model" : "user", text: m.text.slice(0, 2000) })),
      json: true,
      thinking: "medium",
      maxTokens: 4096,
    });
    const raw = parseJson(res.text);

    // Keep only real, de-duplicated library items, in the model's order.
    const seen = new Set<number>();
    const picks = (Array.isArray(raw.picks) ? raw.picks : [])
      .map((p: any) => ({ ...p, id: Number(p?.id) }))
      .filter((p: any) => byId.has(p.id) && !seen.has(p.id) && seen.add(p.id))
      .slice(0, 5)
      .map((p: any, i: number) => ({
        id: p.id,
        rank: i + 1,
        fit: ["best", "good", "partial"].includes(p.fit) ? p.fit : "good",
        why: String(p.why || "").trim(),
        tradeoff: String(p.tradeoff || "").trim(),
      }));
    return {
      reply: String(raw.reply || (picks.length ? "" : "Nothing in your library fits that yet.")).trim(),
      picks,
      followup: String(raw.followup || "").trim(),
    };
  },
});
