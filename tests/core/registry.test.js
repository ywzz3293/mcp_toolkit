import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getRegistryServer,
  searchRegistryServers,
} from "../../dist/core/registry.js";
import { withMockedFetch, jsonResponse, textResponse } from "../helpers.js";

const BASE_URL = "https://registry.test";

function serverResponse(overrides = {}) {
  return {
    server: {
      name: "io.example/filesystem",
      version: "1.2.3",
      description: "Example filesystem server",
      ...overrides,
    },
    _meta: {
      "io.modelcontextprotocol.registry/official": {
        status: "active",
      },
    },
  };
}

test("searchRegistryServers sends latest name search and preserves Registry fields", async () => {
  let requestedUrl;
  await withMockedFetch(
    async (url) => {
      requestedUrl = new URL(url);
      return jsonResponse(200, {
        servers: [
          serverResponse({
            repository: {
              url: "https://github.com/example/filesystem",
              source: "github",
            },
            packages: [{ registryType: "npm", identifier: "example-filesystem" }],
          }),
        ],
        metadata: { count: 1, nextCursor: "next-page" },
      });
    },
    async () => {
      const result = await searchRegistryServers("  filesystem  ", 7, { baseUrl: BASE_URL });

      assert.equal(requestedUrl.origin, BASE_URL);
      assert.equal(requestedUrl.pathname, "/v0.1/servers");
      assert.equal(requestedUrl.searchParams.get("search"), "filesystem");
      assert.equal(requestedUrl.searchParams.get("version"), "latest");
      assert.equal(requestedUrl.searchParams.get("limit"), "7");
      assert.equal(result.servers[0].server.name, "io.example/filesystem");
      assert.equal(result.servers[0].server.repository.source, "github");
      assert.equal(result.servers[0].server.packages[0].registryType, "npm");
      assert.deepEqual(result.metadata, { count: 1, nextCursor: "next-page" });
    },
  );
});

test("searchRegistryServers accepts empty results and missing metadata", async () => {
  await withMockedFetch(
    async () => jsonResponse(200, { servers: [] }),
    async () => {
      const result = await searchRegistryServers("no-match", 5, { baseUrl: BASE_URL });
      assert.deepEqual(result, { servers: [], metadata: {} });
    },
  );
});

test("searchRegistryServers accepts a server without repository or packages", async () => {
  await withMockedFetch(
    async () => jsonResponse(200, { servers: [serverResponse()], metadata: { count: 1 } }),
    async () => {
      const result = await searchRegistryServers("filesystem", 5, { baseUrl: BASE_URL });
      assert.equal(result.servers[0].server.repository, undefined);
      assert.equal(result.servers[0].server.packages, undefined);
    },
  );
});

test("getRegistryServer URL-encodes the canonical name and returns latest detail", async () => {
  let requestedUrl;
  await withMockedFetch(
    async (url) => {
      requestedUrl = new URL(url);
      return jsonResponse(200, serverResponse());
    },
    async () => {
      const result = await getRegistryServer("io.example/filesystem", { baseUrl: BASE_URL });
      assert.equal(
        requestedUrl.pathname,
        "/v0.1/servers/io.example%2Ffilesystem/versions/latest",
      );
      assert.equal(result.server.version, "1.2.3");
    },
  );
});

test("getRegistryServer does not retry a 404", async () => {
  let callCount = 0;
  await withMockedFetch(
    async () => {
      callCount++;
      return jsonResponse(404, { error: "Server not found" });
    },
    async () => {
      await assert.rejects(
        () => getRegistryServer("io.example/missing", { baseUrl: BASE_URL }),
        /404.*io\.example\/missing/i,
      );
      assert.equal(callCount, 1);
    },
  );
});

test("searchRegistryServers retries 429 and succeeds", async () => {
  let callCount = 0;
  await withMockedFetch(
    async () => {
      callCount++;
      if (callCount === 1) return jsonResponse(429, { error: "rate limited" });
      return jsonResponse(200, { servers: [], metadata: { count: 0 } });
    },
    async () => {
      const result = await searchRegistryServers("filesystem", 5, { baseUrl: BASE_URL });
      assert.deepEqual(result.servers, []);
      assert.equal(callCount, 2);
    },
  );
});

test("Registry client rejects malformed success responses", async () => {
  await withMockedFetch(
    async () => jsonResponse(200, { servers: [{ server: { name: "missing-version" } }] }),
    async () => {
      await assert.rejects(
        () => searchRegistryServers("filesystem", 5, { baseUrl: BASE_URL }),
        /missing server version/i,
      );
    },
  );
});

test("Registry client rejects invalid JSON", async () => {
  await withMockedFetch(
    async () => textResponse(200, "not-json"),
    async () => {
      await assert.rejects(
        () => searchRegistryServers("filesystem", 5, { baseUrl: BASE_URL }),
        /Invalid JSON/i,
      );
    },
  );
});

test("Registry client validates query, name, and maxResults before fetch", async () => {
  await assert.rejects(() => searchRegistryServers("   "), /query.*empty/i);
  await assert.rejects(() => searchRegistryServers("filesystem", 0), /between 1 and 100/i);
  await assert.rejects(() => getRegistryServer("   "), /name.*empty/i);
});
