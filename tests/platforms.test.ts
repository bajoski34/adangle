import { describe, expect, it } from "vitest";
import { LIMITS, adCopyViolations, adsEditorRsaCsv, charStatus } from "@/lib/platforms";
import type { AdCopy } from "@/lib/schemas";

describe("charStatus", () => {
  it("reports counts within the limit", () => {
    expect(charStatus("hello", 30)).toEqual({ count: 5, limit: 30, over: false });
  });

  it("flags text over the limit", () => {
    expect(charStatus("x".repeat(31), 30).over).toBe(true);
  });

  it("treats exactly-at-limit as compliant", () => {
    expect(charStatus("x".repeat(30), 30).over).toBe(false);
  });
});

describe("adsEditorRsaCsv", () => {
  const base = {
    campaign: "Test Campaign",
    adGroup: "example.com",
    finalUrl: "https://example.com",
    headlines: ["One", "Two"],
    descriptions: ["Desc one"],
  };

  function parse(csv: string) {
    const [headers, row] = csv.split("\r\n");
    return { headers: headers.split(","), row };
  }

  it("emits the Ads Editor RSA header set", () => {
    const { headers } = parse(adsEditorRsaCsv(base));
    expect(headers.slice(0, 7)).toEqual([
      "Campaign", "Ad group", "Ad type", "Status", "Final URL", "Path 1", "Path 2",
    ]);
    expect(headers).toContain("Headline 1");
    expect(headers).toContain("Headline 15");
    expect(headers).toContain("Description 1");
    expect(headers).toContain("Description 4");
    expect(headers).toHaveLength(7 + 15 + 4);
  });

  it("pads headline and description slots so every row has all columns", () => {
    const csv = adsEditorRsaCsv(base);
    const row = csv.split("\r\n")[1];
    expect(row.split(",")).toHaveLength(7 + 15 + 4);
  });

  it("marks the ad Paused so an import can never spend money", () => {
    expect(adsEditorRsaCsv(base)).toContain("Responsive search ad,Paused");
  });

  it("quotes fields containing commas and escapes embedded quotes", () => {
    const csv = adsEditorRsaCsv({
      ...base,
      headlines: ['Say "hi", world'],
      descriptions: [],
    });
    expect(csv).toContain('"Say ""hi"", world"');
  });

  it("uses CRLF line endings for Windows-first tooling", () => {
    expect(adsEditorRsaCsv(base)).toContain("\r\n");
  });
});

describe("adCopyViolations", () => {
  const compliant: AdCopy = {
    googleRSA: {
      headlines: Array.from({ length: 8 }, (_, i) => `Headline ${i}`),
      descriptions: ["A fine description.", "Another.", "Third."],
    },
    meta: [
      { primaryText: "Short.", headline: "H", description: "D", angle: "pain" },
      { primaryText: "Short.", headline: "H", description: "D", angle: "proof" },
      { primaryText: "Short.", headline: "H", description: "D", angle: "value" },
    ],
    tiktokHooks: ["hook", "hook", "hook", "hook"],
    taboolaHeadlines: ["native", "native", "native", "native"],
  };

  it("returns no violations for compliant copy", () => {
    expect(adCopyViolations(compliant)).toEqual([]);
  });

  it("reports every over-limit line with its path, length, and limit", () => {
    const bad: AdCopy = {
      ...compliant,
      googleRSA: {
        ...compliant.googleRSA,
        headlines: [
          "x".repeat(LIMITS.googleRSA.headline + 5),
          ...compliant.googleRSA.headlines.slice(1),
        ],
      },
      meta: [
        { ...compliant.meta[0], primaryText: "y".repeat(LIMITS.meta.primaryText + 1) },
        ...compliant.meta.slice(1),
      ],
    };
    const v = adCopyViolations(bad);
    expect(v).toHaveLength(2);
    expect(v[0]).toContain("googleRSA.headlines[0]");
    expect(v[0]).toContain(`is ${LIMITS.googleRSA.headline + 5} chars (limit ${LIMITS.googleRSA.headline})`);
    expect(v[1]).toContain("meta[0].primaryText");
  });

  it("checks every platform's list", () => {
    const bad: AdCopy = {
      ...compliant,
      tiktokHooks: ["z".repeat(LIMITS.tiktok.adText + 1), "ok", "ok", "ok"],
      taboolaHeadlines: ["w".repeat(LIMITS.taboola.headline + 1), "ok", "ok", "ok"],
      googleRSA: {
        headlines: compliant.googleRSA.headlines,
        descriptions: ["v".repeat(LIMITS.googleRSA.description + 1), "ok", "ok"],
      },
    };
    const paths = adCopyViolations(bad).join("\n");
    expect(paths).toContain("tiktokHooks[0]");
    expect(paths).toContain("taboolaHeadlines[0]");
    expect(paths).toContain("googleRSA.descriptions[0]");
  });
});
