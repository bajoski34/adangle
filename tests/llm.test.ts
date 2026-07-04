import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { z } from "zod";
import { LLMQuotaError, quotaErrorMessage, structured } from "@/lib/llm";

// tests/setup.ts pins the chain: primary-model → fallback-a → fallback-b

const Shape = z.object({ text: z.string() });

let fetchMock: Mock;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

// The llm module memoizes by (model, system, prompt), and the cache survives
// across tests — every test must use a unique prompt.
function opts(prompt: string) {
  return { system: "test system", prompt, schema: Shape };
}

function llmOk(content: string, finish = "stop") {
  return new Response(
    JSON.stringify({ choices: [{ finish_reason: finish, message: { content } }], usage: {} }),
    { status: 200 },
  );
}

function llm429(kind: "daily" | "transient") {
  const body =
    kind === "daily"
      ? '{"error":{"message":"quota exceeded","quotaId":"GenerateRequestsPerDayPerProjectPerModel-FreeTier"}}'
      : '{"error":{"message":"quota exceeded. Please retry in 0.2s."}}';
  return new Response(body, { status: 429 });
}

function sentBodies() {
  return fetchMock.mock.calls.map((c) => JSON.parse(c[1].body));
}

describe("structured — parsing", () => {
  it("parses clean JSON in one call", async () => {
    fetchMock.mockResolvedValueOnce(llmOk('{"text":"hi"}'));
    expect(await structured(opts("clean"))).toEqual({ text: "hi" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("strips markdown fences", async () => {
    fetchMock.mockResolvedValueOnce(llmOk('```json\n{"text":"fenced"}\n```'));
    expect(await structured(opts("fenced"))).toEqual({ text: "fenced" });
  });

  it("repairs almost-JSON without a second LLM call", async () => {
    fetchMock.mockResolvedValueOnce(llmOk('{"text": "trailing",}'));
    expect(await structured(opts("repairable"))).toEqual({ text: "trailing" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries once with the validation error fed back, then parses", async () => {
    fetchMock
      .mockResolvedValueOnce(llmOk('{"wrong":"shape"}'))
      .mockResolvedValueOnce(llmOk('{"text":"fixed"}'));
    expect(await structured(opts("structural-retry"))).toEqual({ text: "fixed" });
    const [, second] = sentBodies();
    expect(second.messages[0].content).toContain("Your previous output was invalid");
  });

  it("treats truncation as a hard error, not a parse problem", async () => {
    fetchMock.mockResolvedValueOnce(llmOk('{"text":"cut off', "length"));
    await expect(structured(opts("truncated"))).rejects.toThrow(/truncated at max_tokens/);
  });

  it("rejects an empty response with the finish reason in the message", async () => {
    fetchMock.mockResolvedValueOnce(llmOk(""));
    await expect(structured(opts("empty"))).rejects.toThrow(/Empty LLM response/);
  });
});

describe("structured — model fallback chain", () => {
  it("fails fast on non-throttle HTTP errors without trying fallbacks", async () => {
    fetchMock.mockResolvedValueOnce(new Response("bad request", { status: 400 }));
    await expect(structured(opts("hard-400"))).rejects.toThrow(/LLM API 400/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("hops to the next model on 429 without waiting", async () => {
    fetchMock.mockResolvedValueOnce(llm429("transient")).mockResolvedValueOnce(llmOk('{"text":"from fallback"}'));
    const start = Date.now();
    expect(await structured(opts("hop"))).toEqual({ text: "from fallback" });
    expect(Date.now() - start).toBeLessThan(1000);
    expect(sentBodies().map((b) => b.model)).toEqual(["primary-model", "fallback-a"]);
  });

  it("throws a daily-flagged LLMQuotaError immediately when every model hit a per-day cap", async () => {
    fetchMock.mockImplementation(async () => llm429("daily")); // fresh Response per call — bodies are single-read
    const start = Date.now();
    const err = await structured(opts("all-daily")).catch((e) => e);
    expect(err).toBeInstanceOf(LLMQuotaError);
    expect((err as LLMQuotaError).daily).toBe(true);
    expect(Date.now() - start).toBeLessThan(1000); // no pointless waiting
    expect(fetchMock).toHaveBeenCalledTimes(3); // one per model in the chain
  });

  it("waits once and retries the last model when throttles are transient", async () => {
    fetchMock
      .mockResolvedValueOnce(llm429("transient"))
      .mockResolvedValueOnce(llm429("transient"))
      .mockResolvedValueOnce(llm429("transient"))
      .mockResolvedValueOnce(llmOk('{"text":"after wait"}'));
    expect(await structured(opts("transient-wait"))).toEqual({ text: "after wait" });
    const models = sentBodies().map((b) => b.model);
    expect(models).toEqual(["primary-model", "fallback-a", "fallback-b", "fallback-b"]);
  });
});

describe("structured — soft validation (character limits)", () => {
  const softOpts = (prompt: string) => ({
    ...opts(prompt),
    softValidate: (v: { text: string }) => (v.text.length > 5 ? [`text is ${v.text.length} chars (limit 5)`] : []),
  });

  it("asks for a rewrite with the violations listed, and returns the compliant result", async () => {
    fetchMock
      .mockResolvedValueOnce(llmOk('{"text":"way too long"}'))
      .mockResolvedValueOnce(llmOk('{"text":"fits"}'));
    expect(await structured(softOpts("soft-fix"))).toEqual({ text: "fits" });
    const [, second] = sentBodies();
    expect(second.messages[0].content).toContain("broke hard character limits");
    expect(second.messages[0].content).toContain("limit 5");
  });

  it("returns the first result when the rewrite is no better", async () => {
    fetchMock
      .mockResolvedValueOnce(llmOk('{"text":"seven77"}'))
      .mockResolvedValueOnce(llmOk('{"wrong":"shape entirely"}')); // rewrite fails schema
    expect(await structured(softOpts("soft-best-effort"))).toEqual({ text: "seven77" });
  });

  it("skips the rewrite entirely when copy is already compliant", async () => {
    fetchMock.mockResolvedValueOnce(llmOk('{"text":"ok"}'));
    expect(await structured(softOpts("soft-clean"))).toEqual({ text: "ok" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("structured — multimodal and caching", () => {
  it("sends images as image_url content parts", async () => {
    fetchMock.mockResolvedValueOnce(llmOk('{"text":"saw it"}'));
    await structured({ ...opts("with-image"), images: ["data:image/png;base64,AAAA"] });
    const [body] = sentBodies();
    expect(body.messages[1].content).toEqual([
      { type: "text", text: "with-image" },
      { type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } },
    ]);
  });

  it("memoizes identical requests", async () => {
    fetchMock.mockResolvedValue(llmOk('{"text":"cached"}'));
    await structured(opts("memoized"));
    await structured(opts("memoized"));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("quotaErrorMessage", () => {
  it("tells the truth about per-day caps", () => {
    expect(quotaErrorMessage(new LLMQuotaError("x", true))).toContain("resets at midnight Pacific");
  });

  it("suggests a short wait for transient throttles", () => {
    expect(quotaErrorMessage(new LLMQuotaError("x", false))).toContain("wait a minute");
  });
});
