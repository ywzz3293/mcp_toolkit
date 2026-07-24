import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchPage } from "../../dist/core/fetchPage.js";
import { withMockedFetch, textResponse } from "../helpers.js";

test("fetchPage throws on a URL with no protocol", async () => {
  await assert.rejects(() => fetchPage("example.com/page"), /protocol/i);
});

test("fetchPage throws on an unsupported protocol", async () => {
  await assert.rejects(() => fetchPage("ftp://example.com/page"), /protocol/i);
});

test("fetchPage parses title and content out of the Jina Reader response", async () => {
  await withMockedFetch(
    async () =>
      textResponse(
        200,
        "Title: Example Domain\n\nURL Source: https://example.com\n\nMarkdown Content:\nThis domain is for use in examples.",
      ),
    async () => {
      const result = await fetchPage("https://example.com");
      assert.deepEqual(result, {
        url: "https://example.com",
        title: "Example Domain",
        content: "This domain is for use in examples.",
        contentLength: "This domain is for use in examples.".length,
        truncated: false,
      });
    },
  );
});

test("fetchPage returns empty content without throwing", async () => {
  await withMockedFetch(
    async () => textResponse(200, ""),
    async () => {
      const result = await fetchPage("https://example.com/empty");
      assert.equal(result.content, "");
      assert.equal(result.contentLength, 0);
      assert.equal(result.title, null);
      assert.equal(result.truncated, false);
    },
  );
});

test("fetchPage throws a clear error on upstream 4xx/5xx", async () => {
  await withMockedFetch(
    async () => textResponse(502, "Bad Gateway"),
    async () => {
      await assert.rejects(() => fetchPage("https://example.com/broken"), /502/);
    },
  );
});

test("fetchPage throws when Jina Reader downgrades an upstream error to 200", async () => {
  await withMockedFetch(
    async () =>
      textResponse(
        200,
        "Title: \n\nURL Source: https://example.com/missing\n\nWarning: Target URL returned error 404: Not Found\n\nMarkdown Content:\n404: Not Found",
      ),
    async () => {
      await assert.rejects(() => fetchPage("https://example.com/missing"), /404/);
    },
  );
});

test("fetchPage wraps network errors with a clear message", async () => {
  await withMockedFetch(
    async () => {
      throw new Error("ECONNRESET");
    },
    async () => {
      await assert.rejects(() => fetchPage("https://example.com"), /Network error/i);
    },
  );
});

test("fetchPage truncates content over maxContentLength and marks truncated: true", async () => {
  const longContent = "x".repeat(30);
  await withMockedFetch(
    async () => textResponse(200, `Title: Long\n\nMarkdown Content:\n${longContent}`),
    async () => {
      const result = await fetchPage("https://example.com/long", { maxContentLength: 10 });
      assert.equal(result.truncated, true);
      assert.equal(result.content.length, 10);
      assert.equal(result.contentLength, 10);
      assert.equal(result.content, "x".repeat(10));
    },
  );
});

test("fetchPage retries on 429 and succeeds on the second attempt", async () => {
  let callCount = 0;
  await withMockedFetch(
    async () => {
      callCount++;
      if (callCount === 1) return textResponse(429, "rate limited");
      return textResponse(200, "Title: Retried\n\nMarkdown Content:\nok");
    },
    async () => {
      const result = await fetchPage("https://example.com/retry");
      assert.equal(result.content, "ok");
      assert.equal(callCount, 2);
    },
  );
});

test("fetchPage exhausts retries on a persistent 429 and throws", async () => {
  let callCount = 0;
  await withMockedFetch(
    async () => {
      callCount++;
      return textResponse(429, "rate limited");
    },
    async () => {
      await assert.rejects(() => fetchPage("https://example.com/limited"), /429/);
      assert.equal(callCount, 3);
    },
  );
});
