import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { initCache } from "./core/cache.js";
import { registerSearchGithubTool } from "./mcp/tools/searchGithubTool.js";
import { registerFetchPageTool } from "./mcp/tools/fetchPageTool.js";
import { registerSearchMcpServersTool } from "./mcp/tools/searchMcpServersTool.js";
import { registerTranscribeVideoTool } from "./mcp/tools/transcribeVideoTool.js";

initCache();

const server = new McpServer({
  name: "mcp-scout",
  version: "0.1.0",
});

registerSearchGithubTool(server);
registerFetchPageTool(server);
registerSearchMcpServersTool(server);
registerTranscribeVideoTool(server);

const transport = new StdioServerTransport();
await server.connect(transport);
