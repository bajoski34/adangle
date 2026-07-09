import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { structured, LLMQuotaError, quotaErrorMessage } from "@/lib/llm";
import { BrandProfile, PageBrief, RewriteOutput } from "@/lib/schemas";
import { GENERATE_SYSTEM, rewritePrompt } from "@/lib/prompts";

export const maxDuration = 60;

const Body = z.object({
  text: z.string().min(1).max(500),
  kind: z.string().min(1).max(60),
  limit: z.number().int().min(10).max(500),
  tone: z.string().min(1).max(40),
  title: z.string().max(200).default(""),
  brief: PageBrief,
  brandProfile: BrandProfile.optional(),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid rewrite payload." }, { status: 400 });
  }
  const { text, kind, limit, tone, title, brief, brandProfile } = parsed.data;

  try {
    const { rewrite } = await structured({
      system: GENERATE_SYSTEM,
      // Random seed in the prompt: repeat clicks should give fresh takes, so this
      // request intentionally bypasses the prompt-keyed cache.
      prompt: rewritePrompt({ text, kind, limit, tone, title, brief, brandProfile, seed: Math.floor(Math.random() * 1_000_000) }),
      schema: RewriteOutput,
      maxTokens: 1000,
      softValidate: (r) => {
        const violations: string[] = [];
        if (r.rewrite.length > limit) violations.push(`rewrite is ${r.rewrite.length} chars (limit ${limit}): "${r.rewrite}"`);
        if (brandProfile?.bannedPhrases.some((p) => p.trim() && r.rewrite.toLowerCase().includes(p.trim().toLowerCase()))) {
          violations.push(`rewrite includes banned phrase: "${r.rewrite}"`);
        }
        if (brandProfile?.requiredProof.length) {
          for (const proof of brandProfile.requiredProof) {
            if (!r.rewrite.toLowerCase().includes(proof.toLowerCase())) {
              violations.push(`rewrite missing required proof token: "${proof}"`);
            }
          }
        }
        return violations;
      },
    });
    return NextResponse.json({ ok: true, rewrite });
  } catch (e) {
    console.error("[rewrite] failure:", e);
    if (e instanceof LLMQuotaError) {
      return NextResponse.json(
        { ok: false, error: quotaErrorMessage(e), code: "quota", daily: e.daily },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: false, error: "Rewrite failed — try again." }, { status: 502 });
  }
}
