import { describe, expect, it } from "vitest";
import { AdCopy, CompareOutput, PageBrief, RewriteOutput, Strategy } from "@/lib/schemas";

const validBrief = {
  offer: "Free trial of a spend platform",
  audience: "Finance leaders",
  primaryHook: "Close the books faster",
  painPoints: ["Manual work"],
  proofElements: ["10k customers"],
  cta: { text: "Get started", placement: "hero" },
  emotionalAngle: "value",
  weaknesses: ["Vague headline"],
};

describe("PageBrief", () => {
  it("accepts a complete brief", () => {
    expect(PageBrief.parse(validBrief).emotionalAngle).toBe("value");
  });

  it("rejects unknown emotional angles", () => {
    expect(() => PageBrief.parse({ ...validBrief, emotionalAngle: "rage" })).toThrow();
  });

  it("caps painPoints and weaknesses at 5", () => {
    const six = Array.from({ length: 6 }, (_, i) => `p${i}`);
    expect(() => PageBrief.parse({ ...validBrief, painPoints: six })).toThrow();
    expect(() => PageBrief.parse({ ...validBrief, weaknesses: six })).toThrow();
  });
});

describe("AdCopy", () => {
  const valid = {
    googleRSA: {
      headlines: Array.from({ length: 8 }, (_, i) => `H${i}`),
      descriptions: ["d1", "d2", "d3"],
    },
    meta: [
      { primaryText: "p", headline: "h", description: "d", angle: "a" },
      { primaryText: "p", headline: "h", description: "d", angle: "b" },
      { primaryText: "p", headline: "h", description: "d", angle: "c" },
    ],
    tiktokHooks: ["1", "2", "3", "4"],
    taboolaHeadlines: ["1", "2", "3", "4"],
  };

  it("accepts a complete kit", () => {
    expect(AdCopy.parse(valid).googleRSA.headlines).toHaveLength(8);
  });

  it("requires at least 8 RSA headlines", () => {
    expect(() =>
      AdCopy.parse({ ...valid, googleRSA: { ...valid.googleRSA, headlines: ["only", "seven", "h", "e", "a", "d", "s"] } }),
    ).toThrow();
  });

  it("requires 3-5 meta variants", () => {
    expect(() => AdCopy.parse({ ...valid, meta: valid.meta.slice(0, 2) })).toThrow();
  });
});

describe("Strategy", () => {
  const valid = {
    abTests: Array.from({ length: 3 }, () => ({
      hypothesis: "h", variantA: "a", variantB: "b", metric: "m", priority: "high",
    })),
    lpFixes: Array.from({ length: 3 }, () => ({ problem: "p", fix: "f", effort: "quick win" })),
  };

  it("accepts a valid plan", () => {
    expect(Strategy.parse(valid).abTests).toHaveLength(3);
  });

  it("rejects unknown effort levels", () => {
    expect(() =>
      Strategy.parse({ ...valid, lpFixes: [{ problem: "p", fix: "f", effort: "herculean" }, ...valid.lpFixes.slice(1)] }),
    ).toThrow();
  });
});

describe("CompareOutput", () => {
  const valid = {
    angleGaps: ["gap 1", "gap 2"],
    proofGaps: ["They: reviews"],
    positioningOpportunities: ["own mid-market", "own automation"],
    counterAngles: Array.from({ length: 3 }, () => ({ angle: "a", rationale: "r", exampleHook: "h" })),
  };

  it("accepts a valid comparison", () => {
    expect(CompareOutput.parse(valid).counterAngles).toHaveLength(3);
  });

  it("requires at least 3 counter-angles", () => {
    expect(() => CompareOutput.parse({ ...valid, counterAngles: valid.counterAngles.slice(0, 2) })).toThrow();
  });
});

describe("RewriteOutput", () => {
  it("rejects an empty rewrite", () => {
    expect(() => RewriteOutput.parse({ rewrite: "" })).toThrow();
    expect(RewriteOutput.parse({ rewrite: "New line" }).rewrite).toBe("New line");
  });
});
