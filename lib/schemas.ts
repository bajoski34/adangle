import { z } from "zod";

// ---------- Analysis ----------

export const PageBrief = z.object({
  offer: z.string(),
  audience: z.string(),
  primaryHook: z.string(),
  painPoints: z.array(z.string()).max(5),
  proofElements: z.array(z.string()),
  cta: z.object({ text: z.string(), placement: z.string() }),
  emotionalAngle: z.enum(["fear", "aspiration", "urgency", "trust", "curiosity", "value"]),
  // The page element that justifies the emotionalAngle call. Optional so briefs
  // cached before this field existed still parse.
  angleEvidence: z.string().optional(),
  weaknesses: z.array(z.string()).max(5),
});
export type PageBrief = z.infer<typeof PageBrief>;

export type ScrapeResult =
  | { ok: true; markdown: string; title: string; source: "firecrawl" | "fallback" }
  | { ok: false; error: string };

// ---------- Generation (split into two independent LLM calls) ----------

export const AdCopy = z.object({
  googleRSA: z.object({
    headlines: z.array(z.string()).min(8).max(15),   // ≤30 chars each
    descriptions: z.array(z.string()).min(3).max(4), // ≤90 chars each
  }),
  meta: z.array(z.object({
    primaryText: z.string(),
    headline: z.string(),
    description: z.string(),
    angle: z.string(), // which persuasion angle this variant tests
  })).min(3).max(5),
  tiktokHooks: z.array(z.string()).min(4).max(6),    // spoken-style openers, ≤100 chars
  taboolaHeadlines: z.array(z.string()).min(4).max(6),
});
export type AdCopy = z.infer<typeof AdCopy>;

export const Strategy = z.object({
  abTests: z.array(z.object({
    hypothesis: z.string(),
    variantA: z.string(),
    variantB: z.string(),
    metric: z.string(),
    priority: z.enum(["high", "medium", "low"]),
  })).min(3).max(5),
  lpFixes: z.array(z.object({
    problem: z.string(),
    fix: z.string(),
    effort: z.enum(["quick win", "moderate", "significant"]),
  })).min(3).max(5),
});
export type Strategy = z.infer<typeof Strategy>;

// Combined shape returned to the client (unchanged from before the split)
export type GenOutput = AdCopy & Strategy;

// ---------- Single-line rewrite ----------

export const RewriteOutput = z.object({ rewrite: z.string().min(1) });
export type RewriteOutput = z.infer<typeof RewriteOutput>;

// ---------- Competitor comparison ----------

export const CompareOutput = z.object({
  angleGaps: z.array(z.string()).min(2).max(5),      // claims/angles the competitor makes that your page doesn't
  proofGaps: z.array(z.string()).min(1).max(5),      // credibility elements they have that you lack (or vice versa)
  positioningOpportunities: z.array(z.string()).min(2).max(5),
  counterAngles: z.array(z.object({
    angle: z.string(),
    rationale: z.string(),   // which competitor weakness this exploits
    exampleHook: z.string(), // a ready-to-use opening line
  })).min(3).max(4),
});
export type CompareOutput = z.infer<typeof CompareOutput>;