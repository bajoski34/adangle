import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { structured, LLMQuotaError, quotaErrorMessage } from "@/lib/llm";
import { PageBrief, AdCopy, Strategy, BrandProfile } from "@/lib/schemas";
import { GENERATE_SYSTEM, adCopyPrompt, strategyPrompt } from "@/lib/prompts";
import { adCopyViolations } from "@/lib/platforms";

export const maxDuration = 60;

const Body = z.object({
  title: z.string().default("Untitled page"),
  brief: PageBrief,
  brandProfile: BrandProfile.optional(),
});

function brandViolations(value: z.infer<typeof AdCopy>, brand?: z.infer<typeof BrandProfile>) {
  if (!brand) return [];
  const lines: string[] = [];
  const phraseBlocked = (text: string) =>
    brand.bannedPhrases.some((p) => p.trim() && text.toLowerCase().includes(p.trim().toLowerCase()));

  const allLines = [
    ...value.googleRSA.headlines,
    ...value.googleRSA.descriptions,
    ...value.meta.flatMap((m) => [m.primaryText, m.headline, m.description]),
    ...value.tiktokHooks,
    ...value.taboolaHeadlines,
  ];
  for (const l of allLines) {
    if (phraseBlocked(l)) lines.push(`line contains a banned phrase: "${l}"`);
  }
  if (brand.requiredProof.length) {
    const hay = allLines.join(" ").toLowerCase();
    for (const proof of brand.requiredProof) {
      if (!hay.includes(proof.toLowerCase())) lines.push(`required proof token missing: "${proof}"`);
    }
  }
  return lines;
}

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        error: "Invalid brief payload.",
        ...(process.env.NODE_ENV === "development" && { detail: parsed.error.flatten() }),
      },
      { status: 400 },
    );
  }
  const { brief, title, brandProfile } = parsed.data;

  try {
    const [adCopy, strategy] = await Promise.all([
      structured({
        system: GENERATE_SYSTEM,
        prompt: adCopyPrompt(brief, title, brandProfile),
        schema: AdCopy,
        maxTokens: 8000,
        softValidate: (copy) => [...adCopyViolations(copy), ...brandViolations(copy, brandProfile)],
      }),
      structured({ system: GENERATE_SYSTEM, prompt: strategyPrompt(brief, title, brandProfile), schema: Strategy, maxTokens: 8000 }),
    ]);
    return NextResponse.json({ ok: true, assets: { ...adCopy, ...strategy } });
  } catch (e) {
    console.error("[generate] failure:", e);
    if (e instanceof LLMQuotaError) {
      return NextResponse.json(
        { ok: false, error: quotaErrorMessage(e), code: "quota", daily: e.daily },
        { status: 503 },
      );
    }
    return NextResponse.json(
      {
        ok: false,
        error: "Generation failed after retry.",
        ...(process.env.NODE_ENV === "development" && {
          detail: e instanceof Error ? e.message : String(e),
        }),
      },
      { status: 502 },
    );
  }
}