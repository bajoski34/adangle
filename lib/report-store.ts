import { promises as fs } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { ReportRecord, type CompareOutput, type MonitoringSummary, type PageBrief, type PerformanceSignal } from "./schemas";

const DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DIR, "reports.json");

type DB = { reports: unknown[] };

async function readDb(): Promise<DB> {
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as DB;
    if (!parsed || !Array.isArray(parsed.reports)) return { reports: [] };
    return parsed;
  } catch {
    return { reports: [] };
  }
}

async function writeDb(db: DB) {
  await fs.mkdir(DIR, { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(db), "utf8");
}

function nowIso() {
  return new Date().toISOString();
}

export async function listReports() {
  const db = await readDb();
  return db.reports
    .map((r) => ReportRecord.safeParse(r))
    .filter((r) => r.success)
    .map((r) => r.data)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getReport(id: string) {
  const reports = await listReports();
  return reports.find((r) => r.id === id) ?? null;
}

export async function createReport(input: {
  sourceUrl: string;
  sourceTitle: string;
  source: "firecrawl" | "fallback" | "screenshot";
  analysis: PageBrief;
  assets?: ReportRecord["assets"];
  comparison?: CompareOutput | null;
  competitorUrl?: string | null;
  brandProfile?: ReportRecord["brandProfile"];
  watchlist?: string[];
  funnel?: ReportRecord["funnel"];
}) {
  const db = await readDb();
  const stamp = nowIso();
  const report = ReportRecord.parse({
    id: crypto.randomUUID(),
    createdAt: stamp,
    updatedAt: stamp,
    sourceUrl: input.sourceUrl,
    sourceTitle: input.sourceTitle,
    source: input.source,
    analysis: input.analysis,
    assets: input.assets ?? null,
    comparison: input.comparison ?? null,
    competitorUrl: input.competitorUrl ?? null,
    brandProfile: input.brandProfile,
    watchlist: input.watchlist ?? [],
    funnel: input.funnel,
  });
  db.reports.unshift(report);
  await writeDb(db);
  return report;
}

export async function updateReport(id: string, patch: Partial<ReportRecord>) {
  const db = await readDb();
  const idx = db.reports.findIndex((r) => (r as { id?: string }).id === id);
  if (idx < 0) return null;
  const old = ReportRecord.parse(db.reports[idx]);
  const next = ReportRecord.parse({
    ...old,
    ...patch,
    updatedAt: nowIso(),
  });
  db.reports[idx] = next;
  await writeDb(db);
  return next;
}

export async function deleteReport(id: string) {
  const db = await readDb();
  const before = db.reports.length;
  db.reports = db.reports.filter((r) => (r as { id?: string }).id !== id);
  await writeDb(db);
  return db.reports.length !== before;
}

export function summarizeMonitoring(
  prev: { url: string; brief: Pick<PageBrief, "emotionalAngle" | "proofElements"> }[],
  curr: { url: string; brief: Pick<PageBrief, "emotionalAngle" | "proofElements"> }[],
) {
  const changedCompetitors: string[] = [];
  const angleShifts: string[] = [];
  const proofShifts: string[] = [];
  const notes: string[] = [];

  for (const c of curr) {
    const p = prev.find((x) => x.url === c.url);
    if (!p) {
      changedCompetitors.push(c.url);
      notes.push(`Started tracking ${c.url}`);
      continue;
    }
    if (p.brief.emotionalAngle !== c.brief.emotionalAngle) {
      changedCompetitors.push(c.url);
      angleShifts.push(`${c.url}: ${p.brief.emotionalAngle} → ${c.brief.emotionalAngle}`);
    }
    const prevProof = new Set(p.brief.proofElements.map((x) => x.toLowerCase()));
    const nextProof = new Set(c.brief.proofElements.map((x) => x.toLowerCase()));
    const added = [...nextProof].filter((x) => !prevProof.has(x));
    const removed = [...prevProof].filter((x) => !nextProof.has(x));
    if (added.length || removed.length) {
      changedCompetitors.push(c.url);
      if (added.length) proofShifts.push(`${c.url}: added proof (${added.slice(0, 3).join(", ")})`);
      if (removed.length) proofShifts.push(`${c.url}: removed proof (${removed.slice(0, 3).join(", ")})`);
    }
  }

  return {
    at: nowIso(),
    changedCompetitors: [...new Set(changedCompetitors)],
    angleShifts,
    proofShifts,
    notes,
  } satisfies MonitoringSummary;
}

export function mergePerformance(existing: PerformanceSignal[], incoming: PerformanceSignal[]) {
  const map = new Map(existing.map((s) => [s.id, s]));
  for (const sig of incoming) map.set(sig.id, sig);
  return [...map.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
