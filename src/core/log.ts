import { appendFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type CacheStatus = "hit" | "miss" | "refresh";

export interface LogEntry {
  tool: string;
  cache: CacheStatus;
  ms: number;
  ok: boolean;
  err?: string;
}

function defaultLogPath(): string {
  // Compiles to dist/core/log.js, so the project root is two levels up.
  const here = fileURLToPath(import.meta.url);
  const projectRoot = join(dirname(here), "..", "..");
  return join(projectRoot, "data", "toolkit.log");
}

export function logCacheEvent(entry: LogEntry): void {
  console.error(`[cache] ${entry.cache} ${entry.tool}`);

  const path = process.env.LOG_FILE_PATH ?? defaultLogPath();
  try {
    const dir = dirname(path);
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const line = JSON.stringify({ ts: new Date().toISOString(), ...entry });
    appendFileSync(path, line + "\n");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[log] failed to write to ${path}: ${message}`);
  }
}
