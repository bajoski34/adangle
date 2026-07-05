import { NextRequest, NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import { z } from "zod";
import { scrapePage, screenshotPage } from "@/lib/firecrawl";
import { structured, LLMQuotaError, quotaErrorMessage } from "@/lib/llm";
import { PageBrief } from "@/lib/schemas";
import { EXTRACT_SYSTEM, extractPrompt, extractVisionPrompt } from "@/lib/prompts";
import { checkPublicUrl, isPublicIp } from "@/lib/url-guard";

export const maxDuration = 120; // scrape + LLM, plus the screenshot+vision fallback (Vercel hobby clamps to 60).

const Body = z.object({ url: z.string().min(1).max(2048) });

// This route is the security boundary: fallbackScrape fetches the URL from this
// server, so a hostname must be well-formed, resolvable, and resolve only to
// public addresses (SSRF guard — cloud metadata, localhost, LAN). The guard
// rejects IP literals outright, so every target goes through DNS.
async function validateTarget(raw: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const check = checkPublicUrl(raw);
  if (!check.ok) return { ok: false, error: check.reason };
  let addrs: { address: string }[];
  try {
    addrs = await lookup(check.host, { all: true });
  } catch {
    return { ok: false, error: `"${check.host}" doesn't resolve. Check the URL — the page must be publicly accessible.` };
  }
  if (addrs.some((a) => !isPublicIp(a.address))) {
    return { ok: false, error: `"${check.host}" resolves to a private or internal address — the page must be publicly accessible.` };
  }
  return { ok: true, url: check.url };
}

// Same API key, same quota — a vision retry can't succeed, so tell the truth instead.
function quotaResponse(e: LLMQuotaError) {
  return NextResponse.json(
    { ok: false, error: quotaErrorMessage(e), code: "quota", daily: e.daily },
    { status: 503 },
  );
}

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Provide a valid http(s) URL." }, { status: 400 });
  }
  const target = await validateTarget(parsed.data.url);
  if (!target.ok) {
    return NextResponse.json({ ok: false, error: target.error }, { status: 400 });
  }
  const { url } = target;

  // Path 1: text. Fails on JS-rendered shells, bot walls, and content the model can't parse.
  const scrape = await scrapePage(url);
  const hasText = scrape.ok && scrape.markdown.length >= 200;

  if (hasText) {
    try {
      const brief = await structured({
        system: EXTRACT_SYSTEM,
        prompt: extractPrompt(scrape.title, scrape.markdown),
        schema: PageBrief,
      });
      return NextResponse.json({
        ok: true,
        url,
        title: scrape.title,
        source: scrape.source, // surfaces whether fallback was used — nice honesty signal in the UI
        brief,
      });
    } catch (e) {
      if (e instanceof LLMQuotaError) return quotaResponse(e);
      /* fall through to the vision path */
    }
  }

  // Path 2: vision. Render the page in a headless browser, hand the screenshot to the LLM.
  const textFailure = !scrape.ok
    ? `Couldn't read that page: ${scrape.error}`
    : !hasText
      ? "Page returned almost no text — likely JS-rendered or blocking bots"
      : "Text analysis failed";

  const shot = await screenshotPage(url);
  if (!shot.ok) {
    return NextResponse.json(
      { ok: false, error: `${textFailure}, and the screenshot fallback also failed (${shot.error}). Try another URL.` },
      { status: 422 },
    );
  }

  try {
    const brief = await structured({
      system: EXTRACT_SYSTEM,
      prompt: extractVisionPrompt(shot.title),
      images: [shot.imageDataUrl],
      schema: PageBrief,
    });
    return NextResponse.json({ ok: true, url, title: shot.title, source: "screenshot", brief });
  } catch (e) {
    if (e instanceof LLMQuotaError) return quotaResponse(e);
    return NextResponse.json(
      { ok: false, error: "Analysis failed on both the page text and a rendered screenshot — the page may be blocking automated access. Try a different URL." },
      { status: 502 },
    );
  }
}
