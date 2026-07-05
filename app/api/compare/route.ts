import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { structured, LLMQuotaError, quotaErrorMessage } from "@/lib/llm";
import { PageBrief, CompareOutput } from "@/lib/schemas";
import { COMPARE_SYSTEM, comparePrompt } from "@/lib/prompts";

export const maxDuration = 120;

const Side = z.object({ title: z.string().default("Untitled page"), brief: PageBrief });
const Body = z.object({ you: Side, competitor: Side });

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid comparison payload." }, { status: 400 });
  }
  const { you, competitor } = parsed.data;

  try {
    const comparison = await structured({
      system: COMPARE_SYSTEM,
      prompt: comparePrompt(you, competitor),
      schema: CompareOutput,
      maxTokens: 4000,
    });
    return NextResponse.json({ ok: true, comparison });
  } catch (e) {
    console.error("[compare] failure:", e);
    if (e instanceof LLMQuotaError) {
      return NextResponse.json(
        { ok: false, error: quotaErrorMessage(e), code: "quota", daily: e.daily },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: false, error: "Comparison failed after retry." }, { status: 502 });
  }
}
