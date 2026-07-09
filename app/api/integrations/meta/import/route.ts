import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { PerformanceSignal } from "@/lib/schemas";

const Body = z.object({
  reportId: z.string().min(1),
  rows: z.array(z.object({
    id: z.string(),
    angle: z.string(),
    variantLabel: z.string(),
    impressions: z.number().nonnegative(),
    clicks: z.number().nonnegative(),
    conversions: z.number().nonnegative(),
    spend: z.number().nonnegative(),
  })).max(500),
});

export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ ok: false, error: "Invalid Meta import payload." }, { status: 400 });
  const signals = parsed.data.rows.map((r) =>
    PerformanceSignal.parse({
      id: `meta-${r.id}`,
      createdAt: new Date().toISOString(),
      platform: "meta",
      angle: r.angle,
      variantLabel: r.variantLabel,
      impressions: r.impressions,
      clicks: r.clicks,
      conversions: r.conversions,
      spend: r.spend,
    }),
  );
  return NextResponse.json({
    ok: true,
    reportId: parsed.data.reportId,
    signals,
    next: `POST /api/reports/${parsed.data.reportId}/performance`,
  });
}
