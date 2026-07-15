import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fetchPage } from "../../core/fetchPage.js";

export function registerFetchPageTool(server: McpServer): void {
  server.registerTool(
    "fetch_page",
    {
      title: "Fetch web page content",
      description:
        "Fetch a web page via Jina Reader and return its cleaned text content. " +
        "Works for any public URL, not just GitHub — pass a readme_url from " +
        "search_github_repos to read a README.",
      inputSchema: {
        url: z.string().describe("Full URL including protocol, e.g. https://example.com/page"),
      },
    },
    async ({ url }) => {
      const result = await fetchPage(url);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                url: result.url,
                title: result.title,
                content: result.content,
                content_length: result.contentLength,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
