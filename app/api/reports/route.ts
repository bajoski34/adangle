import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { BrandProfile, CompareOutput, FunnelAnalysis, GenOutput, PageBrief } from "@/lib/schemas";
import { createReport, listReports } from "@/lib/report-store";

const CreateBody = z.object({
  sourceUrl: z.string().url(),
  sourceTitle: z.string().min(1).max(300),
  source: z.enum(["firecrawl", "fallback", "screenshot"]),
  analysis: PageBrief,
  assets: z.custom<GenOutput>().nullable().optional(),
  comparison: CompareOutput.nullable().optional(),
  competitorUrl: z.string().url().nullable().optional(),
  brandProfile: BrandProfile.optional(),
  watchlist: z.array(z.string().url()).max(20).optional(),
  funnel: FunnelAnalysis.optional(),
});

export async function GET() {
  const reports = await listReports();
  return NextResponse.json({
    ok: true,
    reports: reports.map((r) => ({
      id: r.id,
      sourceTitle: r.sourceTitle,
      sourceUrl: r.sourceUrl,
      updatedAt: r.updatedAt,
      source: r.source,
      emotionalAngle: r.analysis.emotionalAngle,
    })),
  });
}

export async function POST(req: NextRequest) {
  const parsed = CreateBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid report payload." }, { status: 400 });
  }
  const report = await createReport(parsed.data);
  return NextResponse.json({ ok: true, report }, { status: 201 });
}
