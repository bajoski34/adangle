import { describe, expect, it, vi } from "vitest";
import { cacheKey, cached } from "@/lib/cache";

describe("cacheKey", () => {
  it("is deterministic", () => {
    expect(cacheKey("a", "b")).toBe(cacheKey("a", "b"));
  });

  it("differs when any part differs", () => {
    expect(cacheKey("a", "b")).not.toBe(cacheKey("a", "c"));
    expect(cacheKey("ab")).not.toBe(cacheKey("a", "b"));
  });

  it("is a short fixed-length hex digest", () => {
    expect(cacheKey("anything at all")).toMatch(/^[0-9a-f]{32}$/);
  });
});

describe("cached", () => {
  it("computes once and serves the memoized value inside the TTL", async () => {
    const fn = vi.fn(async () => "value");
    const key = cacheKey("cached-test", "memoize");
    expect(await cached(key, 60_000, fn)).toBe("value");
    expect(await cached(key, 60_000, fn)).toBe("value");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("recomputes after the TTL expires", async () => {
    const fn = vi.fn(async () => Math.random());
    const key = cacheKey("cached-test", "ttl");
    const first = await cached(key, 5, fn);
    await new Promise((r) => setTimeout(r, 20));
    await cached(key, 5, fn);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(first).toEqual(expect.any(Number));
  });

  it("does not cache rejections", async () => {
    const fn = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce("recovered");
    const key = cacheKey("cached-test", "rejection");
    await expect(cached(key, 60_000, fn)).rejects.toThrow("boom");
    expect(await cached(key, 60_000, fn)).toBe("recovered");
  });
});
