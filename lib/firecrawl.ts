import type { ScrapeResult } from "./schemas";
import { cached, cacheKey } from "./cache";

export async function scrapePage(url: string): Promise<ScrapeResult> {
  const key = cacheKey("firecrawl", url);
  return cached(key, 60_000, () => scrapePageImpl(url));
}

async function scrapePageImpl(url: string): Promise<ScrapeResult> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
      signal: AbortSignal.timeout(30_000),
    });
    if (res.ok) {
      const json = await res.json();
      if (json?.data?.markdown) {
        return { ok: true, markdown: json.data.markdown.slice(0, 40_000), title: json.data.metadata?.title ?? url, source: "firecrawl" };
      }
    }
  } catch { /* fall through to fallback */ }
  return fallbackScrape(url);
}

export type ScreenshotResult =
  | { ok: true; imageDataUrl: string; title: string }
  | { ok: false; error: string };

// Vision fallback for JS-rendered pages and bot walls: Firecrawl renders the page
// in a headless browser and returns a full-page screenshot we can hand to the LLM.
export async function screenshotPage(url: string): Promise<ScreenshotResult> {
  const key = cacheKey("firecrawl-shot", url);
  return cached(key, 60_000, () => screenshotPageImpl(url));
}

async function screenshotPageImpl(url: string): Promise<ScreenshotResult> {
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.FIRECRAWL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, formats: ["screenshot@fullPage"], waitFor: 2500 }),
      signal: AbortSignal.timeout(40_000),
    });
    if (!res.ok) return { ok: false, error: `Firecrawl ${res.status}` };
    const json = await res.json();
    const shotUrl: string | undefined = json?.data?.screenshot;
    if (!shotUrl) return { ok: false, error: "No screenshot returned" };

    const img = await fetch(shotUrl, { signal: AbortSignal.timeout(20_000) });
    if (!img.ok) return { ok: false, error: `Screenshot fetch failed: ${img.status}` };
    const buf = Buffer.from(await img.arrayBuffer());
    if (buf.byteLength > 14_000_000) return { ok: false, error: "Screenshot too large to analyze" };
    const mime = img.headers.get("content-type")?.split(";")[0] || "image/png";
    return {
      ok: true,
      imageDataUrl: `data:${mime};base64,${buf.toString("base64")}`,
      title: json?.data?.metadata?.title ?? new URL(url).hostname,
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Screenshot failed" };
  }
}

async function fallbackScrape(url: string): Promise<ScrapeResult> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; AdAngleBot/1.0)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { ok: false, error: `Fetch failed: ${res.status}` };
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? url;
    return { ok: true, markdown: text.slice(0, 40_000), title, source: "fallback" };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Unknown fetch error" };
  }
}