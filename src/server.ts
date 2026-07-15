import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerSearchGithubTool } from "./mcp/tools/searchGithubTool.js";
import { registerFetchPageTool } from "./mcp/tools/fetchPageTool.js";

const server = new McpServer({
  name: "research-toolkit-mcp",
  version: "0.1.0",
});

registerSearchGithubTool(server);
registerFetchPageTool(server);

const transport = new StdioServerTransport();
await server.connect(transport);
