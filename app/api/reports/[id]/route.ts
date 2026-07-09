import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { BrandProfile, CompareOutput, FunnelAnalysis, GenOutput } from "@/lib/schemas";
import { deleteReport, getReport, updateReport } from "@/lib/report-store";

const PatchBody = z.object({
  assets: z.custom<GenOutput>().nullable().optional(),
  comparison: CompareOutput.nullable().optional(),
  competitorUrl: z.string().url().nullable().optional(),
  brandProfile: BrandProfile.optional(),
  watchlist: z.array(z.string().url()).max(20).optional(),
  funnel: FunnelAnalysis.optional(),
});

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const report = await getReport(id);
  if (!report) return NextResponse.json({ ok: false, error: "Report not found." }, { status: 404 });
  return NextResponse.json({ ok: true, report });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const parsed = PatchBody.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid patch payload." }, { status: 400 });
  const updated = await updateReport(id, parsed.data);
  if (!updated) return NextResponse.json({ ok: false, error: "Report not found." }, { status: 404 });
  return NextResponse.json({ ok: true, report: updated });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const deleted = await deleteReport(id);
  if (!deleted) return NextResponse.json({ ok: false, error: "Report not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
