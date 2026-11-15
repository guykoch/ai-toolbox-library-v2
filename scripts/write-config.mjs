// Writes public/config.js so the page knows which Convex backend to talk to.
// On Vercel, `npx convex deploy` sets CONVEX_URL for this command automatically.
import { writeFileSync } from "node:fs";
const url = process.env.CONVEX_URL || process.env.VITE_CONVEX_URL || "";
if (!url) {
  console.error("CONVEX_URL is not set — run this through `npx convex deploy --cmd ...` (see vercel.json).");
  process.exit(1);
}
writeFileSync(new URL("../public/config.js", import.meta.url), `window.CONVEX_URL = ${JSON.stringify(url)};\n`);
console.log("Wrote public/config.js →", url);
