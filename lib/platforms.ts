import type { AdCopy } from "./schemas";

export const LIMITS = {
  googleRSA: { headline: 30, description: 90 },
  meta: { primaryText: 125, headline: 40, description: 30 }, // truncation-safe recommendations
  tiktok: { adText: 100 },
  taboola: { headline: 60 }, // best-practice ceiling — verify current spec
} as const;

export function charStatus(text: string, limit: number) {
  return { count: text.length, limit, over: text.length > limit };
}

// Every hard character-limit violation in a generated ad-copy payload, as compact
// messages the LLM can act on when asked to rewrite (path, actual vs limit, text).
export function adCopyViolations(copy: AdCopy): string[] {
  const v: string[] = [];
  const check = (path: string, text: string, limit: number) => {
    if (text.length > limit) v.push(`${path} is ${text.length} chars (limit ${limit}): "${text}"`);
  };
  copy.googleRSA.headlines.forEach((h, i) => check(`googleRSA.headlines[${i}]`, h, LIMITS.googleRSA.headline));
  copy.googleRSA.descriptions.forEach((d, i) => check(`googleRSA.descriptions[${i}]`, d, LIMITS.googleRSA.description));
  copy.meta.forEach((m, i) => {
    check(`meta[${i}].primaryText`, m.primaryText, LIMITS.meta.primaryText);
    check(`meta[${i}].headline`, m.headline, LIMITS.meta.headline);
    check(`meta[${i}].description`, m.description, LIMITS.meta.description);
  });
  copy.tiktokHooks.forEach((t, i) => check(`tiktokHooks[${i}]`, t, LIMITS.tiktok.adText));
  copy.taboolaHeadlines.forEach((t, i) => check(`taboolaHeadlines[${i}]`, t, LIMITS.taboola.headline));
  return v;
}

// Google Ads Editor bulk-import CSV for one responsive search ad. Column headers
// match Ads Editor's own RSA export format (Campaign / Ad group / Ad type /
// Headline 1-15 / Description 1-4). Status is Paused so an import never goes live
// by accident.
export function adsEditorRsaCsv(opts: {
  campaign: string;
  adGroup: string;
  finalUrl: string;
  headlines: string[];
  descriptions: string[];
}): string {
  const esc = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const pad = (items: string[], n: number) =>
    Array.from({ length: n }, (_, i) => items[i] ?? "");

  const headers = [
    "Campaign",
    "Ad group",
    "Ad type",
    "Status",
    "Final URL",
    "Path 1",
    "Path 2",
    ...Array.from({ length: 15 }, (_, i) => `Headline ${i + 1}`),
    ...Array.from({ length: 4 }, (_, i) => `Description ${i + 1}`),
  ];
  const row = [
    opts.campaign,
    opts.adGroup,
    "Responsive search ad",
    "Paused",
    opts.finalUrl,
    "",
    "",
    ...pad(opts.headlines, 15),
    ...pad(opts.descriptions, 4),
  ];
  return [headers, row].map((r) => r.map(esc).join(",")).join("\r\n");
}