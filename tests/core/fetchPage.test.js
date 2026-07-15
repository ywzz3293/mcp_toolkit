import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchPage } from "../../dist/core/fetchPage.js";

function withMockedFetch(mockFn, fn) {
  const original = globalThis.fetch;
  globalThis.fetch = mockFn;
  return Promise.resolve(fn()).finally(() => {
    globalThis.fetch = original;
  });
}

function textResponse(status, body) {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain" },
  });
}

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
