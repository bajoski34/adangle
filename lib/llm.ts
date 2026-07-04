import { z } from "zod";
import { jsonrepair } from "jsonrepair";
import { cached, cacheKey } from "./cache";

const BASE = process.env.LLM_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai";
const MODEL = process.env.LLM_MODEL ?? "gemini-2.5-flash";
// Free-tier quotas are per-model-per-day buckets, so a throttled primary can fall
// back through a chain of siblings, each with its own allowance. Comma-separated;
// set to "" to disable. (Gemma models are excluded: they wrap JSON in <thought> preambles.)
const FALLBACK_MODELS = (
  process.env.LLM_FALLBACK_MODELS ??
  process.env.LLM_FALLBACK_MODEL ??
  "gemini-2.5-flash-lite,gemini-3-flash-preview,gemini-3.1-flash-lite-preview"
)
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
const KEY = process.env.LLM_API_KEY;

// Thrown when every model in the chain is rate-limited. `daily` means the quota
// failure was a per-day cap — waiting a minute won't help, only a new key or the
// midnight-Pacific reset will.
export class LLMQuotaError extends Error {
  daily: boolean;
  constructor(detail: string, daily = false) {
    super(`LLM quota exhausted: ${detail}`);
    this.name = "LLMQuotaError";
    this.daily = daily;
  }
}

export function quotaErrorMessage(e: LLMQuotaError): string {
  return e.daily
    ? "Today's free-tier AI quota is used up (a per-day cap on this API key — it resets at midnight Pacific). Nothing is wrong with the page. Use the sample report, or point LLM_API_KEY at a key with headroom."
    : "The AI provider is rate-limiting this app right now. Nothing is wrong with the page — wait a minute and try again.";
}

function parseLoose(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(jsonrepair(raw));
  }
}

type StructuredOpts<T> = {
  system: string;
  prompt: string;
  schema: z.ZodType<T>;
  maxTokens?: number;
  images?: string[]; // data URLs, sent as image_url parts (Gemini is multimodal)
  // Soft constraints (e.g. ad character limits): violations trigger one rewrite
  // retry with the messages fed back, but a still-violating result is returned
  // best-effort rather than failing the request.
  softValidate?: (value: T) => string[];
};

export async function structured<T>(opts: StructuredOpts<T>): Promise<T> {
  const key = cacheKey("llm", MODEL, opts.system, opts.prompt, ...(opts.images ?? []));
  return cached(key, 1000 * 60 * 60, () => structuredImpl(opts));
}

type AskResult = { ok: true; text: string } | { ok: false; status: number; body: string };

async function structuredImpl<T>(opts: StructuredOpts<T>): Promise<T> {
  const askModel = async (model: string, extra: string): Promise<AskResult> => {
    const res = await fetch(`${BASE}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens ?? 2000,
        reasoning_effort: "low",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `${opts.system}\nRespond with ONLY valid JSON matching the required structure. No markdown fences, no preamble.${extra}`,
          },
          {
            role: "user",
            content: opts.images?.length
              ? [
                  { type: "text", text: opts.prompt },
                  ...opts.images.map((url) => ({ type: "image_url", image_url: { url } })),
                ]
              : opts.prompt,
          },
        ],
      }),
      signal: AbortSignal.timeout(45_000),
    });
    if (!res.ok) return { ok: false, status: res.status, body: await res.text() };

    const json = await res.json();
    const choice = json.choices?.[0];
    const text: string = choice?.message?.content ?? "";

    if (process.env.NODE_ENV === "development") {
      console.log(`[llm] ${model} finish:`, choice?.finish_reason, "usage:", JSON.stringify(json.usage ?? {}));
      console.log("[llm] tail:", text.slice(-300));
    }

    if (!text.trim()) {
      throw new Error(
        `Empty LLM response (finish_reason: ${choice?.finish_reason ?? "unknown"}, usage: ${JSON.stringify(json.usage ?? {})})`,
      );
    }
    if (choice?.finish_reason === "length") {
      throw new Error(`Output truncated at max_tokens (usage: ${JSON.stringify(json.usage ?? {})})`);
    }
    return { ok: true, text: text.replace(/^```(?:json)?\s*|\s*```$/g, "").trim() };
  };

  // Throttle strategy: walk the model chain — each free-tier model has its own
  // quota bucket, so no waiting between hops. If every hop hit a per-day cap,
  // fail fast (waiting can't help); otherwise wait once (capped) and try the last
  // model again. Typed errors let routes skip doomed alternatives.
  const ask = async (extra = ""): Promise<string> => {
    const models = [MODEL, ...FALLBACK_MODELS.filter((m) => m !== MODEL)];
    let last: Extract<AskResult, { ok: false }> | null = null;
    let allDailyCaps = true;

    for (const model of models) {
      const r = await askModel(model, extra);
      if (r.ok) return r.text;
      if (r.status !== 429 && r.status < 500) {
        throw new Error(`LLM API ${r.status}: ${r.body.slice(0, 300)}`);
      }
      last = r;
      if (!(r.status === 429 && /PerDay/i.test(r.body))) allDailyCaps = false;
      if (process.env.NODE_ENV === "development") {
        console.log(`[llm] ${model} throttled (${r.status}), trying next option`);
      }
    }

    if (allDailyCaps) {
      throw new LLMQuotaError(last!.body.slice(0, 300), true);
    }

    const hinted = Number(last!.body.match(/retry in ([\d.]+)s/i)?.[1]);
    const delayMs = Math.min((Number.isFinite(hinted) ? hinted + 1 : 15) * 1000, 30_000);
    if (process.env.NODE_ENV === "development") {
      console.log(`[llm] all models throttled, waiting ${Math.round(delayMs / 1000)}s for one last try`);
    }
    await new Promise((r) => setTimeout(r, delayMs));

    const finalTry = await askModel(models[models.length - 1], extra);
    if (finalTry.ok) return finalTry.text;
    if (finalTry.status === 429) {
      throw new LLMQuotaError(finalTry.body.slice(0, 300), /PerDay/i.test(finalTry.body));
    }
    throw new Error(`LLM API ${finalTry.status}: ${finalTry.body.slice(0, 300)}`);
  };

  const violationsOf = (value: T) => opts.softValidate?.(value) ?? [];

  let raw = await ask();
  let first: T;
  try {
    first = opts.schema.parse(parseLoose(raw));
  } catch (e) {
    raw = await ask(
      `\nYour previous output was invalid: ${e instanceof Error ? e.message.slice(0, 500) : "parse error"}. Common cause: literal newlines inside string values — use \\n escapes, and include every required field. Return only corrected JSON.`,
    );
    // The structural retry is spent; accept the result even if soft limits slip.
    return opts.schema.parse(parseLoose(raw));
  }

  const violations = violationsOf(first);
  if (violations.length === 0) return first;

  if (process.env.NODE_ENV === "development") {
    console.log(`[llm] ${violations.length} length violation(s), asking for a rewrite`);
  }
  try {
    raw = await ask(
      `\nYour previous output broke hard character limits on these lines:\n${violations
        .slice(0, 12)
        .join("\n")}\nRewrite the FULL response with the same structure and the same number of items, shortening every offending line to fit under its limit — cut words, don't just abbreviate. Count characters before finalizing. Return only corrected JSON.`,
    );
    const second = opts.schema.parse(parseLoose(raw));
    const remaining = violationsOf(second);
    if (process.env.NODE_ENV === "development" && remaining.length > 0) {
      console.log(`[llm] rewrite still has ${remaining.length} violation(s), returning best effort`);
    }
    return remaining.length <= violations.length ? second : first;
  } catch {
    return first; // best effort: structurally valid, flagged in the UI
  }
}
