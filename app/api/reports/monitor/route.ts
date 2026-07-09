import { NextResponse } from "next/server";
import { listReports } from "@/lib/report-store";

export async function POST() {
  const reports = await listReports();
  const jobs = reports
    .filter((r) => r.watchlist.length)
    .map((r) => ({ id: r.id, url: `/api/reports/${r.id}/rerun` }));
  return NextResponse.json({
    ok: true,
    queued: jobs.length,
    jobs,
    note: "Call each rerun URL on a schedule (cron) to keep watchlist snapshots fresh.",
  });
}
