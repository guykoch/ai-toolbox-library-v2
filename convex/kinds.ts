// Tool types ("what kind of thing is it?") and how much effort it takes to start.
// Kept in sync with the same lists in public/index.html.

export const KINDS = ["skill", "connector", "plugin", "webapp", "app", "devtool", "model", "learn", "news"] as const;
export type Kind = (typeof KINDS)[number];

export const KIND_LABEL: Record<Kind, string> = {
  skill: "Skill", connector: "Connector (MCP)", plugin: "Plugin / extension", webapp: "Web app", app: "Desktop / phone app",
  devtool: "Developer tool", model: "AI model", learn: "Learn", news: "News",
};

export const EFFORT: Record<Kind, "ready" | "quick" | "tech"> = {
  webapp: "ready", learn: "ready", news: "ready",
  skill: "quick", plugin: "quick", app: "quick", connector: "quick",
  devtool: "tech", model: "tech",
};

// Best guess for a card that has no type yet (the AI or Claude sets it for everything else).
export function guessKind(it: any): Kind {
  if (KINDS.includes(it?.kind)) return it.kind;
  const t = `${it?.title || ""} ${it?.summary || ""}`.toLowerCase();
  const url = String(it?.url || "").toLowerCase();
  const type = String(it?.type || "");
  if (type === "news") return "news";
  // Guides, courses, videos and posts are things to learn from, even when they talk about skills or MCP.
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
