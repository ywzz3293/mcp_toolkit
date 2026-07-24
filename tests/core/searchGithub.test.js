import { test } from "node:test";
import assert from "node:assert/strict";
import { searchGithub } from "../../dist/core/searchGithub.js";
import { withMockedFetch, jsonResponse } from "../helpers.js";

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

test("searchGithub retries on 429 and succeeds on the second attempt", async () => {
  let callCount = 0;
  await withMockedFetch(
    async () => {
      callCount++;
      if (callCount === 1) return jsonResponse(429, { message: "rate limited" });
      return jsonResponse(200, { total_count: 0, items: [] });
    },
    async () => {
      const result = await searchGithub("mcp", { token: "fake" });
      assert.deepEqual(result, { results: [], totalCount: 0 });
      assert.equal(callCount, 2);
    },
  );
});

test("searchGithub exhausts retries on a persistent 429 and throws", async () => {
  let callCount = 0;
  await withMockedFetch(
    async () => {
      callCount++;
      return jsonResponse(429, { message: "rate limited" });
    },
    async () => {
      await assert.rejects(
        () => searchGithub("mcp", { token: "fake" }),
        /rate limit|429/i,
      );
      assert.equal(callCount, 3);
    },
  );
});

test("searchGithub does not retry on 401 Unauthorized (single attempt)", async () => {
  let callCount = 0;
  await withMockedFetch(
    async () => {
      callCount++;
      return jsonResponse(401, { message: "Bad credentials" });
    },
    async () => {
      await assert.rejects(
        () => searchGithub("mcp", { token: "bad-token" }),
        /401|Unauthorized/i,
      );
      assert.equal(callCount, 1);
    },
  );
});
