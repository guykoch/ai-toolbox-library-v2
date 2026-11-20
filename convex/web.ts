// Shared helpers: clean links, label hosts, and read a page / GitHub repo for context.

const TRACKING = /^(utm_\w+|fbclid|gclid|mibextid|rdid|share_url|si|igsh|igshid|ref|ref_src|ref_url|s|t_?id|__cft__\[0\]|__tn__|_rdr|feature)$/i;

export function cleanUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    // Keep YouTube's v / list / t parameters; drop tracking parameters everywhere.
    const keys: string[] = [];
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

export function norm(u: string): string {
  // GitHub links count as the same repo whatever comes after owner/repo (…/tree/main, …/blob/…, .git).
  const gh = String(u || "").match(/github\.com\/([\w.-]+)\/([\w.-]+)/i);
  if (gh && !["orgs", "topics", "search", "marketplace", "features", "apps", "settings"].includes(gh[1].toLowerCase())) {
    return ("github.com/" + gh[1] + "/" + gh[2].replace(/\.git$/, "")).toLowerCase();
  }
  return cleanUrl(u).replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/+$/, "").toLowerCase();
}

export function hostLabel(u: string): string {
  try {
    const h = new URL(u).hostname.replace(/^www\./, "").replace(/^m\./, "");
    if (/(^|\.)facebook\.com$|(^|\.)fb\.watch$/.test(h)) return "Facebook";
    if (/(^|\.)youtube\.com$|^youtu\.be$/.test(h)) return "YouTube";
    if (h === "github.com") return "GitHub";
    return h;
  } catch {
    return "";
  }
}


export async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 12000) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, redirect: "follow" });
  } finally {
    clearTimeout(timer);
  }
}

function decodeEntities(s: string) {
  return s
    .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function metaTag(html: string, name: string) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${name}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
  return content ? decodeEntities(content).trim() : "";
}

export type Fetched = { input: string; finalUrl: string; notes: string; github?: { stars: number; forks: number; license: string; commits?: number } };

export async function gatherUrl(raw: string): Promise<Fetched> {
  const out: Fetched = { input: raw, finalUrl: cleanUrl(raw), notes: "" };
  try {
    const gh = raw.match(/github\.com\/([\w.-]+)\/([\w.-]+)/i);
    if (gh && !["orgs", "topics", "search", "marketplace", "features"].includes(gh[1].toLowerCase())) {
      const repo = `${gh[1]}/${gh[2].replace(/\.git$/, "")}`;
      const headers: Record<string, string> = { "User-Agent": "ai-toolbox-library", Accept: "application/vnd.github+json" };
      if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
      const r = await fetchWithTimeout(`https://api.github.com/repos/${repo}`, { headers });
      if (r.ok) {
        const j: any = await r.json();
        out.github = { stars: j.stargazers_count, forks: j.forks_count, license: j.license?.spdx_id && j.license.spdx_id !== "NOASSERTION" ? j.license.spdx_id : "" };
        out.notes += `GitHub repo ${j.full_name}: "${j.description ?? ""}". Stars ${j.stargazers_count}, forks ${j.forks_count}, licence ${out.github.license || "none stated"}, homepage ${j.homepage || "none"}, language ${j.language || "?"}, topics ${(j.topics || []).join(", ")}.\n`;
        const rm = await fetchWithTimeout(`https://api.github.com/repos/${repo}/readme`, { headers: { ...headers, Accept: "application/vnd.github.raw" } });
        if (rm.ok) out.notes += "README (start):\n" + (await rm.text()).slice(0, 5000) + "\n";
        return out;
      }
    }
    const isFb = /facebook\.com|fb\.watch/i.test(raw);
    const r = await fetchWithTimeout(raw, {
      headers: {
        "User-Agent": isFb ? "facebookexternalhit/1.1" : "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9,he;q=0.8",
      },
    });
    out.finalUrl = cleanUrl(r.url || raw);
    const html = (await r.text()).slice(0, 600000);
    const title = metaTag(html, "og:title") || decodeEntities(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "").trim();
    const desc = metaTag(html, "og:description") || metaTag(html, "description");
    const body = decodeEntities(
      html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "),
    ).replace(/\s+/g, " ").trim().slice(0, 4000);
    out.notes += `Fetched ${out.finalUrl} (HTTP ${r.status}).\nTitle: ${title}\nDescription: ${desc}\nPage text (start): ${body}\n`;
  } catch (e: any) {
    out.notes += `Could not fetch this link (${e?.message ?? e}).\n`;
  }
  return out;
}


// Bare host name (no www), for matching links to a site.
export function hostOf(u: string) {
  try { return new URL(u).hostname.replace(/^www\./, "").toLowerCase(); } catch { return ""; }
}
export function pageText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<(br|p|div|li|h\d|pre|tr|section|article)[^>]*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&rsquo;|&lsquo;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}
