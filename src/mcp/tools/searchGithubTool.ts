import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadConfig } from "../../config.js";
import { searchGithub } from "../../core/searchGithub.js";

export function registerSearchGithubTool(server: McpServer): void {
  server.registerTool(
    "search_github_repos",
    {
      title: "Search GitHub repositories",
      description:
        "Search public GitHub repositories by keyword. Returns repo metadata " +
        "plus a readme_url for each result that can be passed to fetch_page " +
        "to read the README.",
      inputSchema: {
        query: z.string().describe("Search keywords, e.g. 'mcp server typescript'"),
        language: z
          .string()
          .optional()
          .describe("Filter by primary language, e.g. 'typescript'"),
        max_results: z
          .number()
          .int()
          .min(1)
          .max(20)
          .default(5)
          .describe("Max number of repos to return (1-20)"),
      },
    },
    async ({ query, language, max_results }) => {
      const { githubToken } = loadConfig();
      const { results, totalCount } = await searchGithub(query, {
        token: githubToken,
        language,
        maxResults: max_results,
      });

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({ results, total_count: totalCount }, null, 2),
          },
        ],
      };
    },
  );
}
