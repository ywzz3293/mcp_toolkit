import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fetchPage } from "../../core/fetchPage.js";
import { getCached, setCached, makeCacheKey } from "../../core/cache.js";
import { logCacheEvent } from "../../core/log.js";

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
        force_refresh: z
          .boolean()
          .default(false)
          .describe("Bypass the cache and re-fetch, even if a cached result exists"),
      },
    },
    async ({ url, force_refresh }) => {
      const cacheKey = makeCacheKey("fetch_page", { url });

      if (!force_refresh) {
        const readStart = performance.now();
        const cached = getCached(cacheKey);
        if (cached !== undefined) {
          logCacheEvent({
            tool: "fetch_page",
            cache: "hit",
            ms: Math.round(performance.now() - readStart),
            ok: true,
          });
          return { content: [{ type: "text", text: cached }] };
        }
      }

      const callStart = performance.now();
      try {
        const result = await fetchPage(url);
        const payload = JSON.stringify(
          {
            url: result.url,
            title: result.title,
            content: result.content,
            content_length: result.contentLength,
            truncated: result.truncated,
          },
          null,
          2,
        );

        setCached(cacheKey, payload);
        logCacheEvent({
          tool: "fetch_page",
          cache: force_refresh ? "refresh" : "miss",
          ms: Math.round(performance.now() - callStart),
          ok: true,
        });

        return { content: [{ type: "text", text: payload }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logCacheEvent({
          tool: "fetch_page",
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
