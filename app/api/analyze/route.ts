import { NextRequest, NextResponse } from "next/server";
import { lookup } from "node:dns/promises";
import { z } from "zod";
import { LLMQuotaError, quotaErrorMessage } from "@/lib/llm";
import { FunnelStep } from "@/lib/schemas";
import { checkPublicUrl, isPublicIp } from "@/lib/url-guard";
import { analyzeFunnel, analyzeUrl } from "@/lib/analysis";

export const maxDuration = 120; // scrape + LLM, plus the screenshot+vision fallback (Vercel hobby clamps to 60).

const Body = z.object({
  url: z.string().min(1).max(2048),
  funnelSteps: z.array(FunnelStep).max(8).optional(),
});

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
  try {
    const funnelSteps = parsed.data.funnelSteps ?? [];
    for (const step of funnelSteps) {
      const stepTarget = await validateTarget(step.url);
      if (!stepTarget.ok) {
        return NextResponse.json({ ok: false, error: `Funnel step "${step.label}" is invalid: ${stepTarget.error}` }, { status: 400 });
      }
    }
    const base = await analyzeUrl(url);
    if (!base.ok) {
      return NextResponse.json(
        { ok: false, error: `Analysis failed on both the page text and screenshot path (${base.error}). Try a different URL.` },
        { status: 502 },
      );
    }
    const funnel = await analyzeFunnel(funnelSteps);
    return NextResponse.json({ ok: true, ...base, funnel });
  } catch (e) {
    if (e instanceof LLMQuotaError) return quotaResponse(e);
    return NextResponse.json(
      { ok: false, error: "Analysis failed — try again with a different URL or reduce funnel steps." },
      { status: 502 },
    );
  }
}
