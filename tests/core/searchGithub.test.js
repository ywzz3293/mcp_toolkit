import { test } from "node:test";
import assert from "node:assert/strict";
import { searchGithub } from "../../dist/core/searchGithub.js";

function withMockedFetch(mockFn, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = mockFn;
  return Promise.resolve(fn()).finally(() => {
    globalThis.fetch = original;
  });
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("searchGithub throws when token is missing", async () => {
  await assert.rejects(() => searchGithub("mcp", { token: "" }), /token/i);
});

test("searchGithub returns empty results without throwing", async () => {
  await withMockedFetch(
    async () => jsonResponse(200, { total_count: 0, items: [] }),
    async () => {
      const result = await searchGithub("no-such-repo-xyz", { token: "fake" });
      assert.deepEqual(result, { results: [], totalCount: 0 });
    },
  );
});

test("searchGithub maps repo fields and computes readmeUrl", async () => {
  await withMockedFetch(
    async () =>
      jsonResponse(200, {
        total_count: 1,
        items: [
          {
            full_name: "octocat/Hello-World",
            description: "My first repo",
            html_url: "https://github.com/octocat/Hello-World",
            stargazers_count: 42,
          },
        ],
      }),
    async () => {
      const result = await searchGithub("hello", { token: "fake" });
      assert.equal(result.totalCount, 1);
      assert.deepEqual(result.results[0], {
        fullName: "octocat/Hello-World",
        description: "My first repo",
        url: "https://github.com/octocat/Hello-World",
        stars: 42,
        readmeUrl: "https://raw.githubusercontent.com/octocat/Hello-World/HEAD/README.md",
      });
    },
  );
});

test("searchGithub throws a clear error on 401 Unauthorized", async () => {
  await withMockedFetch(
    async () => jsonResponse(401, { message: "Bad credentials" }),
    async () => {
      await assert.rejects(
        () => searchGithub("mcp", { token: "bad-token" }),
        /401|Unauthorized/i,
      );
    },
  );
});

test("searchGithub throws a clear error on 429 rate limit", async () => {
  await withMockedFetch(
    async () => jsonResponse(429, { message: "rate limited" }),
    async () => {
      await assert.rejects(
        () => searchGithub("mcp", { token: "fake" }),
        /rate limit|429/i,
      );
    },
  );
});

test("searchGithub wraps network errors with a clear message", async () => {
  await withMockedFetch(
    async () => {
      throw new Error("ECONNRESET");
    },
    async () => {
      await assert.rejects(
        () => searchGithub("mcp", { token: "fake" }),
        /Network error/i,
      );
    },
  );
});
