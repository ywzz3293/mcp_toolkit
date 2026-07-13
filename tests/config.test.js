import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadConfig } from "../dist/config.js";

const MISSING_ENV_PATH = "does-not-exist/.env";

function withoutToken(fn) {
  const original = process.env.GITHUB_TOKEN;
  delete process.env.GITHUB_TOKEN;
  try {
    fn();
  } finally {
    if (original === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = original;
  }
}

test("loadConfig throws when GITHUB_TOKEN is missing and no .env file exists", () => {
  withoutToken(() => {
    assert.throws(() => loadConfig(MISSING_ENV_PATH), /GITHUB_TOKEN/);
  });
});

test("loadConfig returns the token when GITHUB_TOKEN is already set", () => {
  withoutToken(() => {
    process.env.GITHUB_TOKEN = "test-token-123";
    const config = loadConfig(MISSING_ENV_PATH);
    assert.equal(config.githubToken, "test-token-123");
  });
});

test("loadConfig reads GITHUB_TOKEN from a .env file", () => {
  withoutToken(() => {
    const dir = mkdtempSync(join(tmpdir(), "mcp-toolkit-test-"));
    const envPath = join(dir, ".env");
    writeFileSync(envPath, "GITHUB_TOKEN=from-dotenv-456\n");
    try {
      const config = loadConfig(envPath);
      assert.equal(config.githubToken, "from-dotenv-456");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
