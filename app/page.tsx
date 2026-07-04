"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Check, Copy, CopyCheck, Download, FileText, RefreshCw, Sparkles, Swords, TriangleAlert } from "lucide-react";
import type { PageBrief, GenOutput, CompareOutput } from "@/lib/schemas";
import { LIMITS, adsEditorRsaCsv } from "@/lib/platforms";
import { SAMPLE_REPORT } from "@/lib/sample-report";

type AnalyzeResponse =
  | { ok: true; url: string; title: string; source: "firecrawl" | "fallback" | "screenshot"; brief: PageBrief }
  | { ok: false; error: string };

type GenerateResponse = { ok: true; assets: GenOutput } | { ok: false; error: string };
type CompareResponse = { ok: true; comparison: CompareOutput } | { ok: false; error: string };
type Comparison = { competitor: Extract<AnalyzeResponse, { ok: true }>; gaps: CompareOutput };

/* ---------- The six persuasion angles, arranged around the dial ---------- */

const ANGLES = [
  { key: "fear", label: "Fear", gloss: "Sells what's at stake" },
  { key: "urgency", label: "Urgency", gloss: "Sells the closing window" },
  { key: "value", label: "Value", gloss: "Sells the math" },
  { key: "trust", label: "Trust", gloss: "Sells proof and safety" },
  { key: "curiosity", label: "Curiosity", gloss: "Sells the open loop" },
  { key: "aspiration", label: "Aspiration", gloss: "Sells the better self" },
] as const;

const ANALYZE_STAGES = [
  "Fetching the page",
  "Reading the copy like a buyer",
  "Screenshotting if the page hides its text",
  "Mapping pains and proof",
  "Locating the angle",
];

const GENERATE_STAGES = [
  "Studying the brief",
  "Cutting Google headlines to 30 characters",
  "Drafting Meta variants by angle",
  "Writing TikTok hooks out loud",
  "Designing the A/B test plan",
];

const COMPARE_STAGES = [
  "Reading the competitor's page",
  "Extracting their persuasion brief",
  "Mapping angle and proof gaps",
  "Drafting counter-angles",
];

const SAMPLE_URLS = ["https://stripe.com", "https://linear.app", "https://www.notion.com"];

export default function Home() {
  const [url, setUrl] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<Extract<AnalyzeResponse, { ok: true }> | null>(null);
  const [assets, setAssets] = useState<GenOutput | null>(null);
  const [competitorUrl, setCompetitorUrl] = useState("");
  const [comparing, setComparing] = useState(false);
  const [comparison, setComparison] = useState<Comparison | null>(null);

  // Demo mode: a real, pre-baked report — zero network calls, nothing to rate-limit.
  function loadSample() {
    setError(null);
    setUrl(SAMPLE_REPORT.url);
    setAnalysis({ ok: true, url: SAMPLE_REPORT.url, title: SAMPLE_REPORT.title, source: SAMPLE_REPORT.source, brief: SAMPLE_REPORT.brief });
    setAssets(SAMPLE_REPORT.assets);
    setComparison(null);
    setCompetitorUrl("");
  }

  async function analyze(target: string) {
    if (!target.trim()) return;
    setError(null);
    setAnalysis(null);
    setAssets(null);
    setComparison(null);
    setCompetitorUrl("");
    setAnalyzing(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: target.trim() }),
      });
      const data: AnalyzeResponse = await res.json();
      if (!data.ok) throw new Error(data.error);
      setAnalysis(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function generate() {
    if (!analysis) return;
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: analysis.title, brief: analysis.brief }),
      });
      const data: GenerateResponse = await res.json();
      if (!data.ok) throw new Error(data.error);
      setAssets(data.assets);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed.");
    } finally {
      setGenerating(false);
    }
  }

  async function compare() {
    if (!analysis || !competitorUrl.trim()) return;
    setError(null);
    setComparison(null);
    setComparing(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: competitorUrl.trim() }),
      });
      const data: AnalyzeResponse = await res.json();
      if (!data.ok) throw new Error(data.error);

      const cres = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          you: { title: analysis.title, brief: analysis.brief },
          competitor: { title: data.title, brief: data.brief },
        }),
      });
      const cdata: CompareResponse = await cres.json();
      if (!cdata.ok) throw new Error(cdata.error);
      setComparison({ competitor: data, gaps: cdata.comparison });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Comparison failed.");
    } finally {
      setComparing(false);
    }
  }

  const atWork = analyzing || analysis !== null;
  const kitIndex = comparison || comparing ? "03" : "02";

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24">
      <header className="flex items-center justify-between py-5">
        <Wordmark />
        {atWork && (
          <form
            className="flex w-full max-w-md gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!analyzing) analyze(url);
            }}
          >
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://another-page.com"
              className="font-mono text-xs"
              aria-label="Landing page URL"
            />
            <Button type="submit" disabled={analyzing || !url.trim()}>
              Analyze
            </Button>
          </form>
        )}
      </header>

      {!atWork && (
        <Hero
          url={url}
          setUrl={setUrl}
          onAnalyze={(u) => analyze(u)}
          onLoadSample={loadSample}
          disabled={analyzing}
        />
      )}

      {error && (
        <div
          role="alert"
          className="animate-rise mt-6 flex items-start gap-2.5 rounded-lg border border-signal/40 bg-signal/5 p-3.5 text-sm text-signal"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">That didn't work.</p>
            <p className="mt-0.5 text-signal/80">{error}</p>
          </div>
        </div>
      )}

      {analyzing && (
        <StageLoader title="Reading the page" stages={ANALYZE_STAGES} className="mt-10" />
      )}

      {analysis && (
        <div className="mt-8 space-y-10">
          <section className="animate-rise space-y-4">
            <SectionMark index="01" title="Persuasion brief" />
            <BriefDossier analysis={analysis} />
            <CompareBar
              value={competitorUrl}
              onChange={setCompetitorUrl}
              onCompare={compare}
              disabled={comparing}
            />
            {!assets && !generating && (
              <Button
                onClick={generate}
                className="h-12 w-full px-6 text-base font-semibold"
              >
                <Sparkles data-icon="inline-start" className="size-4.5" />
                Write the campaign kit
              </Button>
            )}
          </section>

          {comparing && <StageLoader title="Sizing up the competitor" stages={COMPARE_STAGES} />}

          {comparison && (
            <section className="animate-rise space-y-4">
              <SectionMark index="02" title="Competitor gap analysis" />
              <CompareSection you={analysis} comparison={comparison} />
            </section>
          )}

          {generating && <StageLoader title="Writing the kit" stages={GENERATE_STAGES} />}

          {assets && (
            <section className="animate-rise space-y-4">
              <SectionMark index={kitIndex} title="Campaign kit" />
              <AssetTabs
                assets={assets}
                url={analysis.url}
                title={analysis.title}
                brief={analysis.brief}
                onAssetsChange={setAssets}
              />
            </section>
          )}
        </div>
      )}
    </main>
  );
}

/* ---------- Identity ---------- */

function AngleGlyph({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M4 19.5 19 4.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" className="text-primary" />
      <path d="M4 19.5h16.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M12.5 19.5a8.5 8.5 0 0 0-2.5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="text-primary/70" />
    </svg>
  );
}

function Wordmark() {
  return (
    <div className="flex items-center gap-2.5">
      <AngleGlyph className="size-5" />
      <span className="font-display font-stretch-expanded text-[15px] font-black tracking-[0.14em] uppercase">
        AdAngle
      </span>
    </div>
  );
}

function SectionMark({ index, title }: { index: string; title: string }) {
  return (
    <div className="flex items-baseline gap-3">
      <span className="font-mono text-xs font-medium text-primary">{index}</span>
      <h2 className="font-display font-stretch-expanded text-lg font-extrabold tracking-wide uppercase">
        {title}
      </h2>
      <div className="h-px flex-1 self-center bg-border" />
    </div>
  );
}

/* ---------- Hero ---------- */

function Hero({
  url,
  setUrl,
  onAnalyze,
  onLoadSample,
  disabled,
}: {
  url: string;
  setUrl: (v: string) => void;
  onAnalyze: (u: string) => void;
  onLoadSample: () => void;
  disabled: boolean;
}) {
  const steps = [
    { n: "01", name: "Analyze", copy: "Paste a URL. We read the page the way a buyer would." },
    { n: "02", name: "Brief", copy: "The offer, the audience, the hook — and where the pitch leaks." },
    { n: "03", name: "Ship", copy: "Copy for Google, Meta, TikTok & Taboola, cut to the character." },
  ];

  return (
    <section className="mx-auto max-w-3xl pt-14 pb-10 sm:pt-24">
      <p className="animate-rise font-mono text-xs font-medium tracking-[0.22em] text-primary uppercase">
        Landing-page ad intelligence
      </p>
      <h1
        className="animate-rise mt-5 font-display font-stretch-expanded text-[2.6rem] font-extrabold leading-[1.02] tracking-tight sm:text-6xl sm:leading-[0.98]"
        style={{ animationDelay: "60ms" }}
      >
        Every page argues.
        <br />
        Find the <span className="text-primary">angle</span>.
      </h1>
      <p
        className="animate-rise mt-6 max-w-xl text-base text-muted-foreground sm:text-lg"
        style={{ animationDelay: "120ms" }}
      >
        AdAngle reads a landing page the way a strategist would — the offer, the audience, where
        the pitch leaks — then writes ad copy cut to each platform&apos;s limits.
      </p>

      <form
        className="animate-rise mt-9 flex flex-col gap-2 sm:flex-row"
        style={{ animationDelay: "180ms" }}
        onSubmit={(e) => {
          e.preventDefault();
          if (!disabled) onAnalyze(url);
        }}
      >
        <Input
          autoFocus
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com/landing-page"
          className="h-13 flex-1 rounded-xl border-2 bg-card px-4 font-mono text-sm shadow-xs"
          aria-label="Landing page URL"
        />
        <Button
          type="submit"
          disabled={disabled || !url.trim()}
          className="h-13 rounded-xl px-6 text-base font-semibold"
        >
          Analyze page
          <ArrowRight data-icon="inline-end" className="size-4.5" />
        </Button>
      </form>

      <div
        className="animate-rise mt-3 flex flex-wrap items-center gap-2"
        style={{ animationDelay: "240ms" }}
      >
        <span className="text-xs text-muted-foreground">Try one:</span>
        {SAMPLE_URLS.map((u) => (
          <button
            key={u}
            type="button"
            onClick={() => {
              setUrl(u);
              onAnalyze(u);
            }}
            className="rounded-full border bg-card px-3 py-1 font-mono text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
          >
            {u.replace(/^https:\/\/(www\.)?/, "")}
          </button>
        ))}
        <span className="text-xs text-muted-foreground">·</span>
        <button
          type="button"
          onClick={onLoadSample}
          className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-card px-3 py-1 text-xs font-medium text-primary transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50 outline-none"
        >
          <FileText className="size-3" />
          View a sample report
        </button>
      </div>

      <div
        className="animate-rise mt-16 grid gap-6 border-t pt-8 sm:grid-cols-3"
        style={{ animationDelay: "300ms" }}
      >
        {steps.map((s) => (
          <div key={s.n}>
            <p className="font-mono text-xs font-medium text-primary">{s.n}</p>
            <p className="mt-1.5 font-display font-stretch-expanded text-sm font-extrabold tracking-wide uppercase">
              {s.name}
            </p>
            <p className="mt-1.5 text-sm text-muted-foreground">{s.copy}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ---------- Staged loader ---------- */

function StageLoader({
  title,
  stages,
  className = "",
}: {
  title: string;
  stages: string[];
  className?: string;
}) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, stages.length - 1)), 1500);
    return () => clearInterval(t);
  }, [stages.length]);

  return (
    <Card className={`animate-rise mx-auto w-full max-w-md gap-0 p-6 ${className}`}>
      <p className="font-display font-stretch-expanded text-sm font-extrabold tracking-wide uppercase">
        {title}
      </p>
      <ul className="mt-4 space-y-2.5" aria-live="polite">
        {stages.map((s, i) => {
          const done = i < step;
          const current = i === step;
          return (
            <li key={s} className="flex items-center gap-2.5 text-sm">
              {done ? (
                <Check className="size-4 shrink-0 text-primary" />
              ) : (
                <span
                  className={`size-4 shrink-0 rounded-full border-2 ${
                    current ? "animate-pulse-soft border-primary" : "border-border"
                  }`}
                />
              )}
              <span className={done || current ? "" : "text-muted-foreground/60"}>
                {s}
                {current && "…"}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/* ---------- Persuasion brief ---------- */

function BriefDossier({ analysis }: { analysis: Extract<AnalyzeResponse, { ok: true }> }) {
  const b = analysis.brief;
  return (
    <Card className="gap-0 overflow-hidden p-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b px-5 py-4">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold">{analysis.title}</h3>
          <p className="mt-0.5 truncate font-mono text-xs text-muted-foreground">{analysis.url}</p>
        </div>
        <span className="font-mono text-[11px] text-muted-foreground">
          via{" "}
          {analysis.source === "firecrawl"
            ? "Firecrawl"
            : analysis.source === "screenshot"
              ? "screenshot + vision"
              : "fallback scrape"}
        </span>
      </div>

      <div className="grid lg:grid-cols-[1fr_310px]">
        <div className="grid gap-x-6 gap-y-5 p-5 sm:grid-cols-2">
          <Field label="Offer" value={b.offer} />
          <Field label="Audience" value={b.audience} />
          <Field label="Primary hook" value={b.primaryHook} />
          <Field label="Call to action" value={`“${b.cta.text}” — ${b.cta.placement}`} />
          <ListField label="Pain points" items={b.painPoints} />
          <ListField label="Proof elements" items={b.proofElements} />
        </div>

        <div className="flex flex-col items-center justify-center border-t bg-muted/50 px-6 py-7 lg:border-t-0 lg:border-l">
          <AngleDial active={b.emotionalAngle} />
        </div>
      </div>

      {b.weaknesses.length > 0 && (
        <div className="border-t bg-signal/[0.04] px-5 py-4">
          <p className="text-xs font-semibold tracking-widest text-signal uppercase">
            Where the pitch leaks
          </p>
          <ul className="mt-2 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
            {b.weaknesses.map((w, i) => (
              <li key={i} className="flex min-w-0 gap-2 text-sm [overflow-wrap:anywhere]">
                <span className="mt-[7px] size-1.5 shrink-0 rotate-45 bg-signal/70" aria-hidden />
                <span className="min-w-0">{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
        {label}
      </p>
      <p className="mt-1 text-sm leading-relaxed [overflow-wrap:anywhere]">{value}</p>
    </div>
  );
}

function ListField({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
        {label}
      </p>
      <ul className="mt-1 space-y-1">
        {items.map((it, i) => (
          <li key={i} className="flex min-w-0 gap-2 text-sm leading-relaxed [overflow-wrap:anywhere]">
            <span className="mt-[9px] h-px w-2.5 shrink-0 bg-primary/60" aria-hidden />
            <span className="min-w-0">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ---------- Competitor comparison ---------- */

function CompareBar({
  value,
  onChange,
  onCompare,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onCompare: () => void;
  disabled: boolean;
}) {
  return (
    <form
      className="flex flex-col gap-2 rounded-xl border border-dashed bg-card/60 p-3 sm:flex-row sm:items-center"
      onSubmit={(e) => {
        e.preventDefault();
        if (!disabled) onCompare();
      }}
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <Swords className="size-4 text-primary" />
        <span className="whitespace-nowrap">Compare against a competitor</span>
      </div>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="https://their-landing-page.com"
        className="flex-1 font-mono text-xs"
        aria-label="Competitor landing page URL"
      />
      <Button type="submit" variant="outline" disabled={disabled || !value.trim()}>
        Find the gaps
      </Button>
    </form>
  );
}

function CompareSection({
  you,
  comparison,
}: {
  you: Extract<AnalyzeResponse, { ok: true }>;
  comparison: Comparison;
}) {
  const { competitor, gaps } = comparison;
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <MiniBrief label="Your page" analysis={you} />
        <MiniBrief label="Competitor" analysis={competitor} rival />
      </div>

      <Card className="gap-0 p-5">
        <div className="grid gap-6 lg:grid-cols-3">
          <GapList
            title="Angle gaps"
            hint="claims they make that you don't"
            items={gaps.angleGaps}
          />
          <GapList
            title="Proof gaps"
            hint="credibility asymmetries"
            items={gaps.proofGaps}
          />
          <GapList
            title="Open positions"
            hint="ground they leave unclaimed"
            items={gaps.positioningOpportunities}
          />
        </div>
      </Card>

      <div>
        <p className="mb-2 text-sm font-semibold">
          Counter-angles{" "}
          <span className="ml-1 font-mono text-xs font-normal text-muted-foreground">
            built to exploit their weaknesses
          </span>
        </p>
        <div className="grid gap-3 lg:grid-cols-3">
          {gaps.counterAngles.map((c, i) => (
            <Card key={i} className="animate-rise gap-0 p-4" style={{ animationDelay: `${i * 60}ms` }}>
              <p className="text-sm font-semibold [overflow-wrap:anywhere]">{c.angle}</p>
              <p className="mt-1.5 flex-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">{c.rationale}</p>
              <HookLine text={c.exampleHook} />
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function MiniBrief({
  label,
  analysis,
  rival = false,
}: {
  label: string;
  analysis: Extract<AnalyzeResponse, { ok: true }>;
  rival?: boolean;
}) {
  const angle = ANGLES.find((a) => a.key === analysis.brief.emotionalAngle);
  return (
    <Card className="gap-0 p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className={`text-[11px] font-semibold tracking-widest uppercase ${rival ? "text-signal" : "text-primary"}`}>
            {label}
          </p>
          <p className="mt-1 truncate text-sm font-semibold">{analysis.title}</p>
          <p className="truncate font-mono text-xs text-muted-foreground">{analysis.url}</p>
        </div>
        <Badge variant={rival ? "outline" : "secondary"} className="shrink-0 capitalize">
          {angle?.label ?? analysis.brief.emotionalAngle}
        </Badge>
      </div>
      <div className="mt-3 space-y-2.5">
        <Field label="Offer" value={analysis.brief.offer} />
        <Field label="Primary hook" value={analysis.brief.primaryHook} />
      </div>
    </Card>
  );
}

function GapList({ title, hint, items }: { title: string; hint: string; items: string[] }) {
  return (
    <div>
      <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
        {title}
      </p>
      <p className="text-xs text-muted-foreground/70">{hint}</p>
      <ul className="mt-2 space-y-1.5">
        {items.map((it, i) => (
          <li key={i} className="flex min-w-0 gap-2 text-sm leading-relaxed [overflow-wrap:anywhere]">
            <span className="mt-[9px] h-px w-2.5 shrink-0 bg-primary/60" aria-hidden />
            <span className="min-w-0">{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function HookLine({ text }: { text: string }) {
  const [copied, copy] = useCopied();
  return (
    <div className="group mt-3 flex items-start justify-between gap-2 rounded-lg bg-muted/60 p-2.5">
      <p className="min-w-0 text-sm italic [overflow-wrap:anywhere]">“{text}”</p>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={() => copy(text)}
        aria-label={copied ? "Copied" : "Copy hook"}
        className="opacity-40 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
      >
        {copied ? <Check className="text-primary" /> : <Copy />}
      </Button>
    </div>
  );
}

/* ---------- The Angle Dial — the instrument the tool is named for ---------- */

function AngleDial({ active }: { active: PageBrief["emotionalAngle"] }) {
  const activeIndex = ANGLES.findIndex((a) => a.key === active);
  const targetDeg = 15 + activeIndex * 30;
  const [deg, setDeg] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setDeg(targetDeg), 150);
    return () => clearTimeout(t);
  }, [targetDeg]);

  const pos = (theta: number, r: number) => {
    const rad = (theta * Math.PI) / 180;
    return { x: 100 - r * Math.cos(rad), y: 96 - r * Math.sin(rad) };
  };

  const angleMeta = ANGLES[activeIndex] ?? ANGLES[0];

  return (
    <figure className="w-full max-w-[290px] text-center">
      <svg viewBox="-30 -16 260 130" className="w-full" role="img" aria-label={`Detected emotional angle: ${angleMeta.label}`}>
        <path
          d="M 22 96 A 78 78 0 0 1 178 96"
          fill="none"
          className="stroke-border"
          strokeWidth="1.5"
        />
        {ANGLES.map((a, i) => {
          const theta = 15 + i * 30;
          const tick = pos(theta, 78);
          const lbl = pos(theta, 96);
          const isActive = i === activeIndex;
          return (
            <g key={a.key}>
              <circle
                cx={tick.x}
                cy={tick.y}
                r={isActive ? 5 : 2.5}
                className={
                  isActive
                    ? "fill-primary motion-transition transition-all duration-500"
                    : "fill-muted-foreground/50"
                }
              />
              <text
                x={lbl.x}
                y={lbl.y}
                textAnchor="middle"
                className={`font-mono text-[8.5px] uppercase ${
                  isActive ? "fill-primary font-bold" : "fill-muted-foreground"
                }`}
              >
                {a.label}
              </text>
            </g>
          );
        })}
        <g
          className="motion-transition"
          style={{
            transform: `rotate(${deg}deg)`,
            transformOrigin: "100px 96px",
            transition: "transform 1.1s cubic-bezier(0.34, 1.3, 0.5, 1)",
          }}
        >
          <line x1="100" y1="96" x2="40" y2="96" className="stroke-foreground" strokeWidth="2" strokeLinecap="round" />
        </g>
        <circle cx="100" cy="96" r="4.5" className="fill-foreground" />
        <line x1="14" y1="96" x2="186" y2="96" className="stroke-border" strokeWidth="1.5" />
      </svg>
      <figcaption className="mt-3">
        <p className="text-[11px] font-semibold tracking-widest text-muted-foreground uppercase">
          Emotional angle
        </p>
        <p className="mt-0.5 font-display font-stretch-expanded text-xl font-extrabold uppercase">
          {angleMeta.label}
        </p>
        <p className="text-sm text-muted-foreground">{angleMeta.gloss}</p>
      </figcaption>
    </figure>
  );
}

/* ---------- Campaign kit ---------- */

function AssetTabs({
  assets,
  url,
  title,
  brief,
  onAssetsChange,
}: {
  assets: GenOutput;
  url: string;
  title: string;
  brief: PageBrief;
  onAssetsChange: (a: GenOutput) => void;
}) {
  const rewriteCtx = (kind: string, onItem: (i: number, t: string) => void) => ({ kind, title, brief, onItem });
  const setHeadline = (i: number, t: string) =>
    onAssetsChange({ ...assets, googleRSA: { ...assets.googleRSA, headlines: assets.googleRSA.headlines.map((h, j) => (j === i ? t : h)) } });
  const setDescription = (i: number, t: string) =>
    onAssetsChange({ ...assets, googleRSA: { ...assets.googleRSA, descriptions: assets.googleRSA.descriptions.map((d, j) => (j === i ? t : d)) } });
  const setTiktok = (i: number, t: string) =>
    onAssetsChange({ ...assets, tiktokHooks: assets.tiktokHooks.map((h, j) => (j === i ? t : h)) });
  const setTaboola = (i: number, t: string) =>
    onAssetsChange({ ...assets, taboolaHeadlines: assets.taboolaHeadlines.map((h, j) => (j === i ? t : h)) });

  function downloadCsv() {
    const csv = adsEditorRsaCsv({
      campaign: `AdAngle — ${title.slice(0, 60)}`,
      adGroup: new URL(url).hostname.replace(/^www\./, ""),
      finalUrl: url,
      headlines: assets.googleRSA.headlines,
      descriptions: assets.googleRSA.descriptions,
    });
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "adangle-google-rsa.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const tabs = [
    { value: "google", label: "Google RSA", count: assets.googleRSA.headlines.length + assets.googleRSA.descriptions.length },
    { value: "meta", label: "Meta", count: assets.meta.length },
    { value: "tiktok", label: "TikTok", count: assets.tiktokHooks.length },
    { value: "taboola", label: "Taboola", count: assets.taboolaHeadlines.length },
    { value: "abtests", label: "A/B tests", count: assets.abTests.length },
    { value: "fixes", label: "LP fixes", count: assets.lpFixes.length },
  ];

  return (
    <Tabs defaultValue="google">
      <TabsList variant="line" className="h-auto w-full flex-wrap justify-start gap-0 border-b pb-1">
        {tabs.map((t) => (
          <TabsTrigger
            key={t.value}
            value={t.value}
            className="flex-none px-3 py-1.5 data-active:text-primary after:bg-primary"
          >
            {t.label}
            <span className="font-mono text-[10px] text-muted-foreground">{t.count}</span>
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="google" className="space-y-5 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card p-3">
          <p className="text-sm">
            <span className="font-semibold">One paused RSA, ready for bulk upload.</span>{" "}
            <span className="text-muted-foreground">
              Import via Account → Import in Google Ads Editor, review, then enable.
            </span>
          </p>
          <Button variant="outline" size="sm" onClick={downloadCsv}>
            <Download data-icon="inline-start" />
            Download Ads Editor CSV
          </Button>
        </div>
        <CopyGroup
          title="Headlines"
          hint={`≤ ${LIMITS.googleRSA.headline} chars`}
          items={assets.googleRSA.headlines}
          limit={LIMITS.googleRSA.headline}
          rewrite={rewriteCtx("Google RSA headline", setHeadline)}
        />
        <CopyGroup
          title="Descriptions"
          hint={`≤ ${LIMITS.googleRSA.description} chars`}
          items={assets.googleRSA.descriptions}
          limit={LIMITS.googleRSA.description}
          rewrite={rewriteCtx("Google RSA description", setDescription)}
        />
      </TabsContent>

      <TabsContent value="meta" className="space-y-3 pt-3">
        <div className="flex justify-end">
          <CopyAllButton
            text={assets.meta
              .map((v, i) =>
                `Variant ${i + 1} — ${v.angle}\nPrimary text: ${v.primaryText}\nHeadline: ${v.headline}\nDescription: ${v.description}`,
              )
              .join("\n\n")}
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {assets.meta.map((v, i) => (
            <MetaVariant key={i} variant={v} index={i} />
          ))}
        </div>
      </TabsContent>

      <TabsContent value="tiktok" className="pt-3">
        <CopyGroup
          title="Spoken hooks"
          hint={`first 3 seconds · ≤ ${LIMITS.tiktok.adText} chars`}
          items={assets.tiktokHooks}
          limit={LIMITS.tiktok.adText}
          rewrite={rewriteCtx("TikTok spoken hook", setTiktok)}
        />
      </TabsContent>

      <TabsContent value="taboola" className="pt-3">
        <CopyGroup
          title="Native headlines"
          hint={`≤ ${LIMITS.taboola.headline} chars`}
          items={assets.taboolaHeadlines}
          limit={LIMITS.taboola.headline}
          rewrite={rewriteCtx("Taboola native headline", setTaboola)}
        />
      </TabsContent>

      <TabsContent value="abtests" className="space-y-3 pt-3">
        {assets.abTests.map((t, i) => (
          <Card key={i} className="animate-rise gap-0 p-5" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 text-sm font-semibold [overflow-wrap:anywhere]">{t.hypothesis}</p>
              <Badge
                variant={t.priority === "high" ? "default" : t.priority === "medium" ? "secondary" : "outline"}
                className="shrink-0 capitalize"
              >
                {t.priority}
              </Badge>
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <TestArm arm="A" text={t.variantA} />
              <TestArm arm="B" text={t.variantB} />
            </div>
            <p className="mt-3 font-mono text-xs text-muted-foreground [overflow-wrap:anywhere]">Measure: {t.metric}</p>
          </Card>
        ))}
      </TabsContent>

      <TabsContent value="fixes" className="space-y-3 pt-3">
        {assets.lpFixes.map((f, i) => (
          <Card key={i} className="animate-rise gap-0 p-5" style={{ animationDelay: `${i * 60}ms` }}>
            <div className="flex items-start justify-between gap-3">
              <p className="min-w-0 text-sm font-semibold text-signal [overflow-wrap:anywhere]">{f.problem}</p>
              <Badge
                variant={f.effort === "quick win" ? "default" : f.effort === "moderate" ? "secondary" : "outline"}
                className="shrink-0 capitalize"
              >
                {f.effort}
              </Badge>
            </div>
            <p className="mt-2 text-sm leading-relaxed [overflow-wrap:anywhere]">{f.fix}</p>
          </Card>
        ))}
      </TabsContent>
    </Tabs>
  );
}

function TestArm({ arm, text }: { arm: string; text: string }) {
  return (
    <div className="flex min-w-0 gap-2.5 rounded-lg bg-muted/60 p-3">
      <span className="font-mono text-xs font-bold text-primary">{arm}</span>
      <p className="min-w-0 text-sm [overflow-wrap:anywhere]">{text}</p>
    </div>
  );
}

/* ---------- Meta variant, shown the way it will run ---------- */

function MetaVariant({
  variant,
  index,
}: {
  variant: GenOutput["meta"][number];
  index: number;
}) {
  return (
    <Card className="animate-rise gap-0 overflow-hidden p-0" style={{ animationDelay: `${index * 60}ms` }}>
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="size-6 rounded-full bg-gradient-to-br from-primary to-primary/50" aria-hidden />
          <div className="leading-tight">
            <p className="text-xs font-semibold">Your brand</p>
            <p className="text-[10px] text-muted-foreground">Sponsored</p>
          </div>
        </div>
        <Badge variant="secondary" className="max-w-40 truncate">{variant.angle}</Badge>
      </div>
      <div className="px-4 py-3">
        <CopyLine bare text={variant.primaryText} limit={LIMITS.meta.primaryText} />
      </div>
      <div className="space-y-1 border-t bg-muted/60 px-4 py-3">
        <CopyLine bare emphasize text={variant.headline} limit={LIMITS.meta.headline} />
        <CopyLine bare muted text={variant.description} limit={LIMITS.meta.description} />
      </div>
    </Card>
  );
}

/* ---------- Copy primitives ---------- */

function useCopied(): [boolean, (text: string) => void] {
  const [copied, setCopied] = useState(false);
  function copy(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return [copied, copy];
}

function CopyAllButton({ text, label = "Copy all as text" }: { text: string; label?: string }) {
  const [copied, copy] = useCopied();
  return (
    <Button variant="ghost" size="sm" onClick={() => copy(text)}>
      {copied ? <CopyCheck data-icon="inline-start" className="text-primary" /> : <Copy data-icon="inline-start" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

type RewriteGroupCtx = {
  kind: string;
  title: string;
  brief: PageBrief;
  onItem: (index: number, newText: string) => void;
};

function CopyGroup({
  title,
  hint,
  items,
  limit,
  rewrite,
}: {
  title: string;
  hint: string;
  items: string[];
  limit: number;
  rewrite?: RewriteGroupCtx;
}) {
  const [copied, copy] = useCopied();
  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold">
          {title} <span className="ml-1 font-mono text-xs font-normal text-muted-foreground">{hint}</span>
        </p>
        <Button variant="ghost" size="sm" onClick={() => copy(items.join("\n"))}>
          {copied ? <CopyCheck data-icon="inline-start" className="text-primary" /> : <Copy data-icon="inline-start" />}
          {copied ? "Copied" : "Copy all"}
        </Button>
      </div>
      <div className="grid gap-1.5 sm:grid-cols-2">
        {items.map((it, i) => (
          <CopyLine
            key={i}
            text={it}
            limit={limit}
            delay={i * 40}
            rewrite={
              rewrite && {
                kind: rewrite.kind,
                title: rewrite.title,
                brief: rewrite.brief,
                onDone: (t: string) => rewrite.onItem(i, t),
              }
            }
          />
        ))}
      </div>
    </div>
  );
}

const TONES = ["punchier", "more concrete", "more urgent", "softer"] as const;

type RewriteLineCtx = {
  kind: string;
  title: string;
  brief: PageBrief;
  onDone: (newText: string) => void;
};

function CopyLine({
  text,
  limit,
  bare = false,
  emphasize = false,
  muted = false,
  delay = 0,
  rewrite,
}: {
  text: string;
  limit: number;
  bare?: boolean;
  emphasize?: boolean;
  muted?: boolean;
  delay?: number;
  rewrite?: RewriteLineCtx;
}) {
  const [copied, copy] = useCopied();
  const [tonesOpen, setTonesOpen] = useState(false);
  const [rewriting, setRewriting] = useState(false);
  const [rewriteError, setRewriteError] = useState<string | null>(null);
  const over = text.length > limit;
  const pct = Math.min(text.length / limit, 1) * 100;

  async function doRewrite(tone: string) {
    if (!rewrite) return;
    setRewriting(true);
    setRewriteError(null);
    try {
      const res = await fetch("/api/rewrite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, kind: rewrite.kind, limit, tone, title: rewrite.title, brief: rewrite.brief }),
      });
      const data: { ok: true; rewrite: string } | { ok: false; error: string } = await res.json();
      if (!data.ok) throw new Error(data.error);
      rewrite.onDone(data.rewrite);
      setTonesOpen(false);
    } catch (e) {
      setRewriteError(e instanceof Error ? e.message : "Rewrite failed.");
    } finally {
      setRewriting(false);
    }
  }

  return (
    <div
      className={
        bare
          ? "group -mx-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-accent/50"
          : "group animate-rise rounded-lg border bg-card p-3 transition-colors hover:border-primary/40"
      }
      style={delay ? { animationDelay: `${delay}ms` } : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={`min-w-0 text-sm [overflow-wrap:anywhere] ${emphasize ? "font-semibold" : ""} ${
            muted ? "text-muted-foreground" : ""
          }`}
        >
          {text}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className={`font-mono text-[11px] tabular-nums ${
              over ? "font-bold text-signal" : "text-muted-foreground"
            }`}
            title={over ? `${text.length - limit} characters over the limit` : `${limit - text.length} characters to spare`}
          >
            {text.length}/{limit}
          </span>
          {rewrite && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setTonesOpen((o) => !o)}
              aria-label="Rewrite this line"
              aria-expanded={tonesOpen}
              className="opacity-40 transition-opacity group-hover:opacity-100 focus-visible:opacity-100 aria-expanded:opacity-100"
            >
              <RefreshCw className={rewriting ? "animate-spin text-primary" : ""} />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => copy(text)}
            aria-label={copied ? "Copied" : "Copy text"}
            className="opacity-40 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
          >
            {copied ? <Check className="text-primary" /> : <Copy />}
          </Button>
        </div>
      </div>
      <div className="mt-2 h-0.5 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className={`motion-transition h-full rounded-full transition-[width] duration-700 ${
            over ? "bg-signal" : "bg-primary/70"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {tonesOpen && rewrite && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
            Rewrite
          </span>
          {TONES.map((tone) => (
            <button
              key={tone}
              type="button"
              disabled={rewriting}
              onClick={() => doRewrite(tone)}
              className="rounded-full border bg-card px-2.5 py-0.5 text-xs text-muted-foreground transition-colors hover:border-primary/50 hover:text-primary focus-visible:ring-3 focus-visible:ring-ring/50 outline-none disabled:opacity-50"
            >
              {tone}
            </button>
          ))}
          {rewriting && <span className="animate-pulse-soft text-xs text-muted-foreground">rewriting…</span>}
          {rewriteError && <span className="text-xs text-signal [overflow-wrap:anywhere]">{rewriteError}</span>}
        </div>
      )}
    </div>
  );
}
