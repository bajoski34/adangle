import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PerformanceSignal } from "@/lib/schemas";
import { getReport, mergePerformance, updateReport } from "@/lib/report-store";

const Body = z.object({
  signals: z.array(PerformanceSignal).max(200),
});

function score(signal: z.infer<typeof PerformanceSignal>) {
  const ctr = signal.impressions ? signal.clicks / signal.impressions : 0;
  const cvr = signal.clicks ? signal.conversions / signal.clicks : 0;
  const cpa = signal.conversions ? signal.spend / signal.conversions : Infinity;
  return { ctr, cvr, cpa };
}

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) return NextResponse.json({ ok: false, error: "Report not found." }, { status: 404 });
  const byAngle = new Map<string, { impressions: number; clicks: number; conversions: number; spend: number }>();
  for (const s of report.performance) {
    const row = byAngle.get(s.angle) ?? { impressions: 0, clicks: 0, conversions: 0, spend: 0 };
    row.impressions += s.impressions;
    row.clicks += s.clicks;
    row.conversions += s.conversions;
    row.spend += s.spend;
    byAngle.set(s.angle, row);
  }
  const leaderboard = [...byAngle.entries()]
    .map(([angle, agg]) => ({
      angle,
      ...agg,
      ctr: agg.impressions ? agg.clicks / agg.impressions : 0,
      cvr: agg.clicks ? agg.conversions / agg.clicks : 0,
      cpa: agg.conversions ? agg.spend / agg.conversions : null,
    }))
    .sort((a, b) => (b.ctr + b.cvr) - (a.ctr + a.cvr));
  return NextResponse.json({ ok: true, signals: report.performance, leaderboard });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) return NextResponse.json({ ok: false, error: "Report not found." }, { status: 404 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid performance payload." }, { status: 400 });
  const merged = mergePerformance(report.performance, parsed.data.signals);
  const updated = await updateReport(id, { performance: merged });
  return NextResponse.json({
    ok: true,
    report: updated,
    imported: parsed.data.signals.length,
    signalsWithScores: parsed.data.signals.map((s) => ({ id: s.id, angle: s.angle, ...score(s) })),
  });
}
