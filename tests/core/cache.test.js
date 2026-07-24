import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  initCache,
  getCached,
  setCached,
  stableStringify,
  makeCacheKey,
} from "../../dist/core/cache.js";

test("cache: miss, then set, then hit round-trip", () => {
  initCache(":memory:");
  const key = makeCacheKey("search_github_repos", { query: "mcp" });

  assert.equal(getCached(key), undefined);

  setCached(key, JSON.stringify({ results: [] }));
  assert.equal(getCached(key), JSON.stringify({ results: [] }));
});

test("setCached overwrites an existing key with a new value", () => {
  initCache(":memory:");
  const key = makeCacheKey("search_github_repos", { query: "mcp" });

  setCached(key, JSON.stringify({ results: [], version: 1 }));
  setCached(key, JSON.stringify({ results: [], version: 2 }));

  assert.equal(getCached(key), JSON.stringify({ results: [], version: 2 }));
});

test("different keys are stored independently and don't collide", () => {
  initCache(":memory:");
  const keyA = makeCacheKey("search_github_repos", { query: "mcp" });
  const keyB = makeCacheKey("fetch_page", { url: "https://example.com" });

  setCached(keyA, "value-a");
  setCached(keyB, "value-b");

  assert.equal(getCached(keyA), "value-a");
  assert.equal(getCached(keyB), "value-b");
});

test("stableStringify sorts object keys regardless of insertion order", () => {
  assert.equal(stableStringify({ b: 2, a: 1 }), stableStringify({ a: 1, b: 2 }));
  assert.equal(stableStringify({ a: 1, b: 2 }), '{"a":1,"b":2}');
});

test("makeCacheKey produces the same key regardless of argument order", () => {
  const keyA = makeCacheKey("search_github_repos", { a: 1, b: 2 });
  const keyB = makeCacheKey("search_github_repos", { b: 2, a: 1 });
  assert.equal(keyA, keyB);
});

test("makeCacheKey produces different keys for different tool names or args", () => {
  const key1 = makeCacheKey("search_github_repos", { query: "mcp" });
  const key2 = makeCacheKey("fetch_page", { query: "mcp" });
  const key3 = makeCacheKey("search_github_repos", { query: "other" });
  assert.notEqual(key1, key2);
  assert.notEqual(key1, key3);
});

test("cache works via CACHE_DB_PATH env var, isolated from the real data/cache.db", () => {
  const tmpDir = mkdtempSync(join(tmpdir(), "cache-test-"));
  const dbPath = join(tmpDir, "isolated.db");
  const original = process.env.CACHE_DB_PATH;
  process.env.CACHE_DB_PATH = dbPath;

  try {
    initCache();
    const key = makeCacheKey("fetch_page", { url: "https://example.com" });
    setCached(key, "cached content");
    assert.equal(getCached(key), "cached content");
  } finally {
    if (original === undefined) {
      delete process.env.CACHE_DB_PATH;
    } else {
      process.env.CACHE_DB_PATH = original;
    }
  }
});

test("initCache creates missing parent directories for the db file", () => {
  const tmpDir = mkdtempSync(join(tmpdir(), "cache-test-nested-"));
  const dbPath = join(tmpDir, "nested", "subdir", "cache.db");
  assert.equal(existsSync(dbPath), false);

  initCache(dbPath);
  const key = makeCacheKey("search_github_repos", { query: "nested-dir" });
  setCached(key, "created via nested dirs");

  assert.equal(existsSync(dbPath), true);
  assert.equal(getCached(key), "created via nested dirs");
});

test("getCached/setCached do not throw when the database can't be opened", () => {
  const tmpDir = mkdtempSync(join(tmpdir(), "cache-test-unopenable-"));
  // Pass a directory as the "db file" path — SQLite can't open a directory as a database file.
  initCache(tmpDir);

  assert.doesNotThrow(() => setCached("some-key", "some-value"));
  assert.equal(getCached("some-key"), undefined);
});
