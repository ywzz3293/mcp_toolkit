import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.off("error", reject);
      resolve();
    });
  });
}

function closeServer(server) {
  return new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

function textPayload(result) {
  const block = result.content.find((item) => item.type === "text");
  assert.ok(block, "tool result should contain a text block");
  return JSON.parse(block.text);
}

test("stdio server calls both tools through a local fake upstream", { timeout: 15_000 }, async () => {
  const requests = { github: 0, jina: 0 };
  const upstream = createServer((request, response) => {
    const url = request.url ?? "";

    if (url.startsWith("/search/repositories")) {
      requests.github += 1;
      response.writeHead(200, { "content-type": "application/json" });
      response.end(
        JSON.stringify({
          total_count: 1,
          items: [
            {
              full_name: "fixture/example-repo",
              description: "Repository returned by the local e2e upstream",
              html_url: "https://github.com/fixture/example-repo",
              stargazers_count: 42,
            },
          ],
        }),
      );
      return;
    }

    if (url.startsWith("/https://example.com/e2e-article")) {
      requests.jina += 1;
      response.writeHead(200, { "content-type": "text/plain" });
      response.end(
        "Title: E2E Fixture Article\n\nMarkdown Content:\nLocal upstream content for the stdio test.",
      );
      return;
    }

    response.writeHead(404, { "content-type": "text/plain" });
    response.end(`Unexpected test request: ${url}`);
  });

  const tempDirectory = await mkdtemp(join(tmpdir(), "research-toolkit-e2e-"));
  let client;

  try {
    await listen(upstream);
    const address = upstream.address();
    assert.ok(address && typeof address === "object");
    const upstreamBase = `http://127.0.0.1:${address.port}`;

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["dist/server.js"],
      cwd: process.cwd(),
      env: {
        ...process.env,
        GITHUB_TOKEN: "e2e-placeholder-token",
        GITHUB_API_BASE_URL: upstreamBase,
        JINA_READER_BASE_URL: upstreamBase,
        CACHE_DB_PATH: ":memory:",
        LOG_FILE_PATH: join(tempDirectory, "toolkit.log"),
      },
      stderr: "pipe",
    });

    client = new Client({ name: "research-toolkit-e2e", version: "1.0.0" });
    await client.connect(transport);

    const searchResult = textPayload(
      await client.callTool({
        name: "search_github_repos",
        arguments: { query: "fixture query", max_results: 1 },
      }),
    );
    assert.equal(searchResult.total_count, 1);
    assert.equal(searchResult.results[0].fullName, "fixture/example-repo");
    assert.equal(searchResult.results[0].stars, 42);

    const pageResult = textPayload(
      await client.callTool({
        name: "fetch_page",
        arguments: { url: "https://example.com/e2e-article" },
      }),
    );
    assert.equal(pageResult.title, "E2E Fixture Article");
    assert.equal(pageResult.content, "Local upstream content for the stdio test.");

    assert.deepEqual(requests, { github: 1, jina: 1 });
  } finally {
    if (client) {
      await client.close().catch(() => {});
    }
    if (upstream.listening) {
      await closeServer(upstream);
    }
    await rm(tempDirectory, { recursive: true, force: true });
  }
});
