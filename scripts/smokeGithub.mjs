import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const tempDirectory = await mkdtemp(join(tmpdir(), "mcp-scout-github-smoke-"));
let client;

try {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["dist/server.js"],
    cwd: process.cwd(),
    env: {
      ...process.env,
      GITHUB_TOKEN: "invalid-smoke-token",
      CACHE_DB_PATH: ":memory:",
      LOG_FILE_PATH: join(tempDirectory, "toolkit.log"),
    },
    stderr: "pipe",
  });

  client = new Client({ name: "github-smoke", version: "1.0.0" });
  await client.connect(transport);

  const result = await client.callTool({
    name: "search_github_repos",
    arguments: {
      query: "modelcontextprotocol/typescript-sdk",
      max_results: 1,
      force_refresh: true,
    },
  });
  const textBlock = result.content.find((item) => item.type === "text");
  if (!textBlock || result.isError) {
    throw new Error(`GitHub search failed: ${textBlock?.text ?? "no text content"}`);
  }

  const payload = JSON.parse(textBlock.text);
  if (payload.results[0]?.fullName !== "modelcontextprotocol/typescript-sdk") {
    throw new Error("GitHub search did not return the expected repository.");
  }
  if (!payload.auth_warning) {
    throw new Error("The invalid-token fallback was not reported.");
  }

  const pageResult = await client.callTool({
    name: "fetch_page",
    arguments: { url: payload.results[0].readmeUrl, force_refresh: true },
  });
  const pageBlock = pageResult.content.find((item) => item.type === "text");
  if (!pageBlock || pageResult.isError) {
    throw new Error(`README fetch failed: ${pageBlock?.text ?? "no text content"}`);
  }
  const page = JSON.parse(pageBlock.text);
  if (!page.content || page.content.length < 500) {
    throw new Error("README fetch returned too little content.");
  }

  console.log(JSON.stringify({
    search: "ok",
    repository: payload.results[0].fullName,
    auth_warning: payload.auth_warning,
    fetch_page: "ok",
    readme_characters: page.content.length,
  }, null, 2));
} finally {
  if (client) await client.close().catch(() => {});
  await rm(tempDirectory, { recursive: true, force: true });
}
