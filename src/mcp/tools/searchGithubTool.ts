import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadConfig } from "../../config.js";
import { searchGithub } from "../../core/searchGithub.js";
import { getCached, setCached, makeCacheKey } from "../../core/cache.js";
import { logCacheEvent } from "../../core/log.js";

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
        force_refresh: z
          .boolean()
          .default(false)
          .describe("Bypass the cache and re-search, even if a cached result exists"),
      },
    },
    async ({ query, language, max_results, force_refresh }) => {
      const cacheKey = makeCacheKey("search_github_repos", { query, language, max_results });

      if (!force_refresh) {
        const readStart = performance.now();
        const cached = getCached(cacheKey);
        if (cached !== undefined) {
          logCacheEvent({
            tool: "search_github_repos",
            cache: "hit",
            ms: Math.round(performance.now() - readStart),
            ok: true,
          });
          return { content: [{ type: "text", text: cached }] };
        }
      }

      const callStart = performance.now();
      try {
        const { githubToken } = loadConfig();
        const { results, totalCount } = await searchGithub(query, {
          token: githubToken,
          language,
          maxResults: max_results,
        });
        const payload = JSON.stringify({ results, total_count: totalCount }, null, 2);

        setCached(cacheKey, payload);
        logCacheEvent({
          tool: "search_github_repos",
          cache: force_refresh ? "refresh" : "miss",
          ms: Math.round(performance.now() - callStart),
          ok: true,
        });

        return { content: [{ type: "text", text: payload }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logCacheEvent({
          tool: "search_github_repos",
          cache: force_refresh ? "refresh" : "miss",
          ms: Math.round(performance.now() - callStart),
          ok: false,
          err: message,
        });
        throw err;
      }
    },
  );
}
