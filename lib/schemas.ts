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

export const BrandProfile = z.object({
  tone: z.string().max(120).default("clear, direct, concrete"),
  bannedPhrases: z.array(z.string().min(1).max(120)).max(30).default([]),
  requiredProof: z.array(z.string().min(1).max(160)).max(20).default([]),
  ctaStyle: z.string().max(120).default("specific, low-friction CTA"),
  readingLevel: z.enum(["elementary", "middle-school", "high-school", "college", "expert"]).default("high-school"),
});
export type BrandProfile = z.infer<typeof BrandProfile>;

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

// ---------- Persistence + monitoring + learnings ----------

export const CompetitorSnapshot = z.object({
  at: z.string(),
  url: z.string().url(),
  title: z.string(),
  emotionalAngle: z.enum(["fear", "aspiration", "urgency", "trust", "curiosity", "value"]),
  proofElements: z.array(z.string()),
  primaryHook: z.string(),
});
export type CompetitorSnapshot = z.infer<typeof CompetitorSnapshot>;

export const MonitoringSummary = z.object({
  at: z.string(),
  changedCompetitors: z.array(z.string().url()),
  angleShifts: z.array(z.string()),
  proofShifts: z.array(z.string()),
  notes: z.array(z.string()),
});
export type MonitoringSummary = z.infer<typeof MonitoringSummary>;

export const PerformanceSignal = z.object({
  id: z.string(),
  createdAt: z.string(),
  platform: z.enum(["google", "meta", "tiktok", "taboola", "other"]),
  angle: z.string(),
  variantLabel: z.string(),
  impressions: z.number().nonnegative(),
  clicks: z.number().nonnegative(),
  conversions: z.number().nonnegative(),
  spend: z.number().nonnegative(),
});
export type PerformanceSignal = z.infer<typeof PerformanceSignal>;

export const FunnelStep = z.object({
  label: z.string().min(1).max(80),
  url: z.string().url(),
});
export type FunnelStep = z.infer<typeof FunnelStep>;

export const FunnelIssue = z.object({
  step: z.string(),
  mismatch: z.string(),
  friction: z.string(),
  priority: z.enum(["high", "medium", "low"]),
});
export type FunnelIssue = z.infer<typeof FunnelIssue>;

export const FunnelAnalysis = z.object({
  steps: z.array(FunnelStep).max(8).default([]),
  issues: z.array(FunnelIssue).max(20).default([]),
  summary: z.string().default(""),
});
export type FunnelAnalysis = z.infer<typeof FunnelAnalysis>;

export const ReportRecord = z.object({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  sourceUrl: z.string().url(),
  sourceTitle: z.string(),
  source: z.enum(["firecrawl", "fallback", "screenshot"]),
  analysis: PageBrief,
  assets: z.custom<GenOutput>().nullable(),
  comparison: CompareOutput.nullable().default(null),
  competitorUrl: z.string().url().nullable().default(null),
  brandProfile: BrandProfile.default({
    tone: "clear, direct, concrete",
    bannedPhrases: [],
    requiredProof: [],
    ctaStyle: "specific, low-friction CTA",
    readingLevel: "high-school",
  }),
  watchlist: z.array(z.string().url()).max(20).default([]),
  monitoring: z.array(MonitoringSummary).max(30).default([]),
  competitorSnapshots: z.record(z.string(), z.array(CompetitorSnapshot).max(30)).default({}),
  performance: z.array(PerformanceSignal).max(500).default([]),
  funnel: FunnelAnalysis.default({ steps: [], issues: [], summary: "" }),
});
export type ReportRecord = z.infer<typeof ReportRecord>;