import { DatabaseSync } from "node:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

let db: DatabaseSync | null = null;

function defaultDbPath(): string {
  // Compiles to dist/core/cache.js, so the project root is two levels up.
  const here = fileURLToPath(import.meta.url);
  const projectRoot = join(dirname(here), "..", "..");
  return join(projectRoot, "data", "cache.db");
}

export function initCache(dbPath?: string): void {
  const path = dbPath ?? process.env.CACHE_DB_PATH ?? defaultDbPath();

  try {
    if (path !== ":memory:") {
      const dir = dirname(path);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }
    }
    db = new DatabaseSync(path);
    db.exec(
      "CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT NOT NULL, created_at TEXT NOT NULL)",
    );
  } catch (err) {
    db = null;
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[cache] failed to open database at ${path}: ${message}`);
  }
}

export function getCached(key: string): string | undefined {
  if (!db) return undefined;

  try {
    const row = db.prepare("SELECT value FROM cache WHERE key = ?").get(key) as
      | { value: string }
      | undefined;
    return row?.value;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[cache] read failed: ${message}`);
    return undefined;
  }
}

export function setCached(key: string, value: string): void {
  if (!db) return;

  try {
    db.prepare("INSERT OR REPLACE INTO cache (key, value, created_at) VALUES (?, ?, ?)").run(
      key,
      value,
      new Date().toISOString(),
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[cache] write failed: ${message}`);
  }
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  const entries = Object.keys(value as Record<string, unknown>)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`);
  return `{${entries.join(",")}}`;
}

export function makeCacheKey(toolName: string, args: unknown): string {
  return `${toolName}:${stableStringify(args)}`;
}
