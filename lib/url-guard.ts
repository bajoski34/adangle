// Validates that a user-supplied URL is well-formed and plausibly *public*.
// Policy: https only, real domain names only (no IP literals), and nothing
// local — no localhost in any label, no loopback, no private/reserved ranges.
// Used in the browser for instant feedback and on the server as the real
// enforcement (the analyze route also resolves DNS; fallbackScrape re-checks
// after redirects). Isomorphic on purpose — no Node imports here.

export type UrlCheck =
  | { ok: true; url: string; host: string }
  | { ok: false; reason: string };

export function checkPublicUrl(raw: string): UrlCheck {
  const input = raw.trim();
  if (!input) return { ok: false, reason: "Enter a page URL to analyze." };

  let u: URL;
  try {
    // Accept schemeless input ("stripe.com") — people type hostnames.
    u = new URL(/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(input) ? input : `https://${input}`);
  } catch {
    return { ok: false, reason: `"${input.slice(0, 80)}" isn't a valid URL.` };
  }

  if (u.protocol !== "https:") {
    return {
      ok: false,
      reason:
        u.protocol === "http:"
          ? "Plain http isn't supported — use the https:// version of the page."
          : "Only https pages can be analyzed.",
    };
  }
  if (u.username || u.password) {
    return { ok: false, reason: "URLs with embedded credentials aren't supported." };
  }

  const host = u.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!host) return { ok: false, reason: "That URL has no hostname." };

  if (isIpLiteral(host)) {
    return { ok: false, reason: "IP addresses can't be analyzed — use the site's public domain name." };
  }

  const labels = host.split(".");
  if (
    labels.includes("localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".home.arpa") ||
    labels.length < 2
  ) {
    return { ok: false, reason: `"${host}" isn't a publicly reachable hostname.` };
  }

  return { ok: true, url: u.href, host };
}

export function isIpLiteral(host: string): boolean {
  return isIpv4(host) || host.includes(":");
}

function isIpv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  return !!m && m.slice(1).every((o) => Number(o) <= 255);
}

/** True only for globally routable unicast addresses (v4 or v6). */
export function isPublicIp(ip: string): boolean {
  const addr = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (isIpv4(addr)) return isPublicIpv4(addr);
  if (addr.includes(":")) return isPublicIpv6(addr);
  return false;
}

function isPublicIpv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  if (a === 0 || a === 10 || a === 127) return false; // "this", private, loopback
  if (a === 100 && b >= 64 && b <= 127) return false; // CGNAT
  if (a === 169 && b === 254) return false; // link-local (cloud metadata lives here)
  if (a === 172 && b >= 16 && b <= 31) return false; // private
  if (a === 192 && b === 168) return false; // private
  if (a === 192 && b === 0) return false; // 192.0.0/24 special + 192.0.2/24 docs
  if (a === 198 && (b === 18 || b === 19)) return false; // benchmarking
  if (a === 198 && b === 51) return false; // 198.51.100/24 docs
  if (a === 203 && b === 0) return false; // 203.0.113/24 docs
  if (a >= 224) return false; // multicast, reserved, broadcast
  return true;
}

function isPublicIpv6(ip: string): boolean {
  if (ip === "::" || ip === "::1") return false; // unspecified, loopback
  // v4-mapped, dotted form (::ffff:192.168.0.1) or the hex form the WHATWG
  // URL parser normalizes it to (::ffff:c0a8:1).
  const mappedDotted = ip.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (mappedDotted) return isPublicIpv4(mappedDotted[1]);
  const mappedHex = ip.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const hi = parseInt(mappedHex[1], 16);
    const lo = parseInt(mappedHex[2], 16);
    return isPublicIpv4(`${hi >> 8}.${hi & 255}.${lo >> 8}.${lo & 255}`);
  }
  if (/^f[cd]/.test(ip)) return false; // fc00::/7 unique-local
  if (/^fe[89ab]/.test(ip)) return false; // fe80::/10 link-local
  if (/^ff/.test(ip)) return false; // multicast
  if (ip.startsWith("2001:db8")) return false; // documentation
  return true;
}
