import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { structured, LLMQuotaError, quotaErrorMessage } from "@/lib/llm";
import { PageBrief, AdCopy, Strategy } from "@/lib/schemas";
import { GENERATE_SYSTEM, adCopyPrompt, strategyPrompt } from "@/lib/prompts";
import { adCopyViolations } from "@/lib/platforms";

export const maxDuration = 60;

const Body = z.object({
  title: z.string().default("Untitled page"),
  brief: PageBrief,
});

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
  const { brief, title } = parsed.data;

  try {
    const [adCopy, strategy] = await Promise.all([
      structured({ system: GENERATE_SYSTEM, prompt: adCopyPrompt(brief, title), schema: AdCopy, maxTokens: 8000, softValidate: adCopyViolations }),
      structured({ system: GENERATE_SYSTEM, prompt: strategyPrompt(brief, title), schema: Strategy, maxTokens: 8000 }),
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