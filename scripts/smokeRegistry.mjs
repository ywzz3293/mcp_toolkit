import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const tempDirectory = await mkdtemp(join(tmpdir(), "mcp-scout-registry-smoke-"));
let client;

try {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: ["dist/server.js"],
    cwd: process.cwd(),
    env: {
      ...process.env,
      CACHE_DB_PATH: ":memory:",
      LOG_FILE_PATH: join(tempDirectory, "toolkit.log"),
    },
    stderr: "pipe",
  });

  client = new Client({ name: "registry-smoke", version: "1.0.0" });
  await client.connect(transport);

  const tools = await client.listTools();
  const searchTool = tools.tools.find((tool) => tool.name === "search_mcp_servers");
  if (!searchTool) {
    throw new Error("search_mcp_servers was not listed by the MCP server.");
  }

  const result = await client.callTool({
    name: "search_mcp_servers",
    arguments: { query: "filesystem", max_results: 5, force_refresh: true },
  });
  const textBlock = result.content.find((item) => item.type === "text");
  if (!textBlock) {
    throw new Error("search_mcp_servers returned no text content.");
  }
  if (result.isError) {
    throw new Error(`search_mcp_servers failed: ${textBlock.text}`);
  }

  const payload = JSON.parse(textBlock.text);
  console.log(
    JSON.stringify(
      {
        tool: searchTool.name,
        query: payload.query,
        search_mode: payload.search_mode,
        result_count: payload.result_count,
        candidates: payload.candidates.map((candidate) => ({
          name: candidate.name,
          version: candidate.version,
          status: candidate.status,
          repository: candidate.repository?.url ?? null,
        })),
        source_url: payload.source_url,
        fetched_at: payload.fetched_at,
      },
      null,
      2,
    ),
  );
} finally {
  if (client) {
    await client.close().catch(() => {});
  }
  await rm(tempDirectory, { recursive: true, force: true });
}
