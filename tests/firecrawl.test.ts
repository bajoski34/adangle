import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { scrapePage, screenshotPage } from "@/lib/firecrawl";

let fetchMock: Mock;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// scrapePage/screenshotPage memoize by URL with a shared module-level cache,
// so every test must use a distinct URL.

function firecrawlOk(data: Record<string, unknown>) {
  return new Response(JSON.stringify({ data }), { status: 200 });
}

describe("scrapePage (frugal mode — the default)", () => {
  beforeEach(() => {
    vi.stubEnv("SCRAPE_MODE", "frugal");
  });

  it("uses the free direct fetch alone when the page has enough text", async () => {
    const rich = `<html><head><title>Rich Page</title></head><body>${"persuasive copy ".repeat(60)}</body></html>`;
    fetchMock.mockResolvedValueOnce(new Response(rich, { status: 200 }));
    const r = await scrapePage("https://f.example/rich");
    expect(r.ok && r.source).toBe("fallback");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://f.example/rich"); // no Firecrawl credit spent
  });

  it("spends a Firecrawl credit only when the free fetch comes back thin", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("<html><body>JS shell</body></html>", { status: 200 })) // thin
      .mockResolvedValueOnce(firecrawlOk({ markdown: "# Real content", metadata: { title: "Rendered" } }));
    const r = await scrapePage("https://f.example/shell");
    expect(r).toMatchObject({ ok: true, source: "firecrawl", title: "Rendered" });
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.firecrawl.dev/v1/scrape");
  });

  it("returns the thin free result when Firecrawl also fails", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("<html><body>tiny</body></html>", { status: 200 }))
      .mockRejectedValueOnce(new Error("firecrawl down"));
    const r = await scrapePage("https://f.example/thin-only");
    expect(r.ok && r.source).toBe("fallback");
    expect(r.ok && r.markdown).toBe("tiny");
  });
});

describe("scrapePage (quality mode: SCRAPE_MODE=quality leads with Firecrawl)", () => {
  beforeEach(() => {
    vi.stubEnv("SCRAPE_MODE", "quality");
  });
  it("returns Firecrawl markdown with its title", async () => {
    fetchMock.mockResolvedValueOnce(
      firecrawlOk({ markdown: "# Offer\nGreat product", metadata: { title: "Great Product" } }),
    );
    const r = await scrapePage("https://a.example/one");
    expect(r).toEqual({
      ok: true,
      markdown: "# Offer\nGreat product",
      title: "Great Product",
      source: "firecrawl",
    });
  });

  it("caps markdown at 40k characters", async () => {
    fetchMock.mockResolvedValueOnce(
      firecrawlOk({ markdown: "x".repeat(50_000), metadata: { title: "Big" } }),
    );
    const r = await scrapePage("https://a.example/big");
    expect(r.ok && r.markdown.length).toBe(40_000);
  });

  it("falls back to a raw fetch and strips scripts, styles, and tags", async () => {
    fetchMock
      .mockResolvedValueOnce(new Response("upstream broke", { status: 500 })) // firecrawl
      .mockResolvedValueOnce(
        new Response(
          "<html><head><title>Fallback Page</title><style>.x{color:red}</style></head>" +
            "<body><script>evil()</script><h1>Visible copy</h1></body></html>",
          { status: 200 },
        ),
      );
    const r = await scrapePage("https://a.example/two");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.source).toBe("fallback");
      expect(r.title).toBe("Fallback Page");
      expect(r.markdown).toContain("Visible copy");
      expect(r.markdown).not.toContain("evil()");
      expect(r.markdown).not.toContain("color:red");
      expect(r.markdown).not.toContain("<h1>");
    }
  });

  it("reports failure when both paths fail", async () => {
    fetchMock
      .mockRejectedValueOnce(new Error("network down")) // firecrawl
      .mockResolvedValueOnce(new Response("nope", { status: 404 })); // raw fetch
    const r = await scrapePage("https://a.example/three");
    expect(r).toEqual({ ok: false, error: "Fetch failed: 404" });
  });
});

describe("screenshotPage", () => {
  it("returns the rendered screenshot as a data URL with the right mime", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71]);
    fetchMock
      .mockResolvedValueOnce(
        firecrawlOk({ screenshot: "https://cdn.example/shot.png", metadata: { title: "Shot Title" } }),
      )
      .mockResolvedValueOnce(
        new Response(bytes, { status: 200, headers: { "Content-Type": "image/png" } }),
      );
    const r = await screenshotPage("https://b.example/one");
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.title).toBe("Shot Title");
      expect(r.imageDataUrl).toBe(`data:image/png;base64,${Buffer.from(bytes).toString("base64")}`);
    }
  });

  it("fails cleanly when Firecrawl returns no screenshot", async () => {
    fetchMock.mockResolvedValueOnce(firecrawlOk({ metadata: { title: "No Shot" } }));
    const r = await screenshotPage("https://b.example/two");
    expect(r).toEqual({ ok: false, error: "No screenshot returned" });
  });

  it("refuses screenshots too large to send to the model", async () => {
    fetchMock
      .mockResolvedValueOnce(firecrawlOk({ screenshot: "https://cdn.example/huge.png" }))
      .mockResolvedValueOnce(
        new Response(new Uint8Array(14_000_001), { status: 200, headers: { "Content-Type": "image/png" } }),
      );
    const r = await screenshotPage("https://b.example/three");
    expect(r).toEqual({ ok: false, error: "Screenshot too large to analyze" });
  });

  it("falls back to the hostname when the page has no title", async () => {
    fetchMock
      .mockResolvedValueOnce(firecrawlOk({ screenshot: "https://cdn.example/s.png" }))
      .mockResolvedValueOnce(new Response(new Uint8Array([1]), { status: 200 }));
    const r = await screenshotPage("https://b.example/four");
    expect(r.ok && r.title).toBe("b.example");
  });
});
