import { scrapePage, screenshotPage } from "./firecrawl";
import { structured, LLMQuotaError } from "./llm";
import { EXTRACT_SYSTEM, extractPrompt, extractVisionPrompt, funnelPrompt } from "./prompts";
import { FunnelAnalysis, PageBrief, type FunnelStep } from "./schemas";

export async function analyzeUrl(url: string) {
  const scrape = await scrapePage(url);
  const hasText = scrape.ok && scrape.markdown.length >= 200;

  if (hasText) {
    try {
      const brief = await structured({
        system: EXTRACT_SYSTEM,
        prompt: extractPrompt(scrape.title, scrape.markdown),
        schema: PageBrief,
      });
      return { ok: true as const, url, title: scrape.title, source: scrape.source, brief };
    } catch (e) {
      if (e instanceof LLMQuotaError) throw e;
    }
  }

  const shot = await screenshotPage(url);
  if (!shot.ok) {
    return { ok: false as const, error: shot.error };
  }

  const brief = await structured({
    system: EXTRACT_SYSTEM,
    prompt: extractVisionPrompt(shot.title),
    images: [shot.imageDataUrl],
    schema: PageBrief,
  });
  return { ok: true as const, url, title: shot.title, source: "screenshot" as const, brief };
}

export async function analyzeFunnel(steps: FunnelStep[]) {
  if (!steps.length) return { steps: [], issues: [], summary: "" };
  const briefs: Array<{ label: string; url: string; brief: PageBrief }> = [];
  for (const step of steps) {
    const result = await analyzeUrl(step.url);
    if (!result.ok) continue;
    briefs.push({ label: step.label, url: step.url, brief: result.brief });
  }
  if (briefs.length < 2) return { steps, issues: [], summary: "Need at least two successfully analyzed funnel steps." };
  return structured({
    system: EXTRACT_SYSTEM,
    prompt: funnelPrompt(briefs),
    schema: FunnelAnalysis,
    maxTokens: 4000,
  });
}
