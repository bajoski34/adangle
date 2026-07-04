import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";

const mem = new Map<string, { value: unknown; expires: number }>();
const DEV = process.env.NODE_ENV === "development";
const DIR = path.join(process.cwd(), ".cache");

export function cacheKey(...parts: string[]): string {
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}

export async function cached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
): Promise<T> {
  const hit = mem.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;

  if (DEV) {
    try {
      const raw = await fs.readFile(path.join(DIR, `${key}.json`), "utf8");
      const { value, expires } = JSON.parse(raw);
      if (expires > Date.now()) {
        mem.set(key, { value, expires });
        return value as T;
      }
    } catch { /* miss */ }
  }

  const value = await fn();
  const expires = Date.now() + ttlMs;
  mem.set(key, { value, expires });
  if (DEV) {
    await fs.mkdir(DIR, { recursive: true }).catch(() => {});
    await fs.writeFile(path.join(DIR, `${key}.json`), JSON.stringify({ value, expires })).catch(() => {});
  }
  return value;
}