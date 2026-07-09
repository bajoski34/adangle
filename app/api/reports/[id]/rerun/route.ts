import { NextRequest, NextResponse } from "next/server";
import { analyzeUrl } from "@/lib/analysis";
import { LLMQuotaError, quotaErrorMessage } from "@/lib/llm";
import { summarizeMonitoring, updateReport } from "@/lib/report-store";
import { getReport } from "@/lib/report-store";
import type { CompetitorSnapshot } from "@/lib/schemas";

function diffLists(before: string[], after: string[]) {
  const b = new Set(before.map((x) => x.toLowerCase()));
  const a = new Set(after.map((x) => x.toLowerCase()));
  return {
    added: after.filter((x) => !b.has(x.toLowerCase())),
    removed: before.filter((x) => !a.has(x.toLowerCase())),
  };
}

export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) return NextResponse.json({ ok: false, error: "Report not found." }, { status: 404 });

  try {
    const refreshed = await analyzeUrl(report.sourceUrl);
    if (!refreshed.ok) return NextResponse.json({ ok: false, error: refreshed.error }, { status: 502 });

    const angleChanged =
      refreshed.brief.emotionalAngle === report.analysis.emotionalAngle
        ? null
        : `${report.analysis.emotionalAngle} → ${refreshed.brief.emotionalAngle}`;
    const proof = diffLists(report.analysis.proofElements, refreshed.brief.proofElements);
    const weaknesses = diffLists(report.analysis.weaknesses, refreshed.brief.weaknesses);

    const prevMon = Object.entries(report.competitorSnapshots).flatMap(([url, list]) => {
      const latest = list[0];
      if (!latest) return [];
      return [{ url, brief: { emotionalAngle: latest.emotionalAngle, proofElements: latest.proofElements } }];
    });
    const currMon: Array<{ url: string; brief: { emotionalAngle: typeof report.analysis.emotionalAngle; proofElements: string[] } }> = [];
    const nextSnapshots = { ...report.competitorSnapshots };
    for (const url of report.watchlist) {
      const rival = await analyzeUrl(url).catch(() => null);
      if (!rival || !rival.ok) continue;
      const snapshot: CompetitorSnapshot = {
        at: new Date().toISOString(),
        url,
        title: rival.title,
        emotionalAngle: rival.brief.emotionalAngle,
        proofElements: rival.brief.proofElements,
        primaryHook: rival.brief.primaryHook,
      };
      nextSnapshots[url] = [snapshot, ...(nextSnapshots[url] ?? [])].slice(0, 30);
      currMon.push({ url, brief: { emotionalAngle: rival.brief.emotionalAngle, proofElements: rival.brief.proofElements } });
    }
    const monitoringSummary = summarizeMonitoring(prevMon, currMon);

    const updated = await updateReport(id, {
      sourceTitle: refreshed.title,
      source: refreshed.source,
      analysis: refreshed.brief,
      funnel: report.funnel,
      competitorSnapshots: nextSnapshots,
      monitoring: [monitoringSummary, ...report.monitoring].slice(0, 30),
    });
    return NextResponse.json({
      ok: true,
      report: updated,
      diff: {
        angleChanged,
        proof,
        weaknesses,
      },
      monitoring: monitoringSummary,
    });
  } catch (e) {
    if (e instanceof LLMQuotaError) {
      return NextResponse.json({ ok: false, error: quotaErrorMessage(e), code: "quota", daily: e.daily }, { status: 503 });
    }
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "Rerun failed." }, { status: 502 });
  }
}
