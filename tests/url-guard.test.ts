import { describe, expect, it } from "vitest";
import { checkPublicUrl, isPublicIp } from "@/lib/url-guard";

describe("checkPublicUrl", () => {
  it("accepts normal https URLs", () => {
    const r = checkPublicUrl("https://stripe.com/pricing");
    expect(r).toMatchObject({ ok: true, url: "https://stripe.com/pricing", host: "stripe.com" });
  });

  it("normalizes schemeless input to https", () => {
    const r = checkPublicUrl("stripe.com");
    expect(r).toMatchObject({ ok: true, url: "https://stripe.com/" });
  });

  it("rejects plain http — https only", () => {
    for (const bad of [
      "http://stripe.com",
      "http://example.com/page",
      "http:localhost.com", // special-scheme shorthand still parses as http
      "http:stripe.com",
    ]) {
      const r = checkPublicUrl(bad);
      expect(r.ok, bad).toBe(false);
      if (!r.ok) expect(r.reason).toMatch(/https/);
    }
  });

  it("rejects empty and garbage input", () => {
    expect(checkPublicUrl("").ok).toBe(false);
    expect(checkPublicUrl("   ").ok).toBe(false);
    expect(checkPublicUrl("ht tp://nope").ok).toBe(false);
  });

  it("rejects non-http(s) schemes", () => {
    expect(checkPublicUrl("ftp://example.com").ok).toBe(false);
    expect(checkPublicUrl("file:///etc/passwd").ok).toBe(false);
    expect(checkPublicUrl("javascript:alert(1)").ok).toBe(false);
  });

  it("rejects embedded credentials", () => {
    expect(checkPublicUrl("https://user:pass@example.com").ok).toBe(false);
  });

  it("rejects localhost in any label, and local/internal hostnames", () => {
    for (const bad of [
      "https://localhost",
      "https://localhost:3000",
      "https://localhost.com",
      "https://app.localhost.com",
      "https://api.localhost",
      "https://printer.local",
      "https://db.internal",
      "https://router.home.arpa",
      "https://intranet", // no dot
    ]) {
      expect(checkPublicUrl(bad).ok, bad).toBe(false);
    }
  });

  it("rejects ALL IP literals — public or private, v4 or v6", () => {
    for (const bad of [
      "https://127.0.0.1",
      "https://10.0.0.5",
      "https://172.16.0.1",
      "https://192.168.1.1",
      "https://169.254.169.254", // cloud metadata
      "https://1.1.1.1", // public, still rejected: domains only
      "https://8.8.8.8/page",
      "https://0.0.0.0",
      "https://[::1]",
      "https://[fe80::1]",
      "https://[fc00::1]",
      "https://[::ffff:192.168.0.1]",
      "https://[2606:4700:4700::1111]", // public v6, still rejected
    ]) {
      expect(checkPublicUrl(bad).ok, bad).toBe(false);
    }
  });
});

describe("isPublicIp", () => {
  it("classifies resolved addresses (used by the analyze route DNS check)", () => {
    expect(isPublicIp("93.184.215.14")).toBe(true);
    expect(isPublicIp("10.1.2.3")).toBe(false);
    expect(isPublicIp("127.0.0.1")).toBe(false);
    expect(isPublicIp("169.254.169.254")).toBe(false);
    expect(isPublicIp("100.64.0.1")).toBe(false); // CGNAT
    expect(isPublicIp("192.0.2.1")).toBe(false); // docs range
    expect(isPublicIp("224.0.0.1")).toBe(false); // multicast
    expect(isPublicIp("::1")).toBe(false);
    expect(isPublicIp("fe80::1")).toBe(false);
    expect(isPublicIp("fd00::1")).toBe(false);
    expect(isPublicIp("::ffff:c0a8:1")).toBe(false); // v4-mapped private, hex form
    expect(isPublicIp("2606:4700:4700::1111")).toBe(true);
    expect(isPublicIp("not-an-ip")).toBe(false);
  });
});
