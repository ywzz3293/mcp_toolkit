import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { searchRegistryServers } from "../../core/registry.js";
import { getCached, setCached, makeCacheKey } from "../../core/cache.js";
import { logCacheEvent } from "../../core/log.js";

const DEFAULT_REGISTRY_BASE_URL = "https://registry.modelcontextprotocol.io";
const OFFICIAL_METADATA_KEY = "io.modelcontextprotocol.registry/official";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function registryStatus(meta: Record<string, unknown> | undefined): string {
  const official = meta?.[OFFICIAL_METADATA_KEY];
  if (!isRecord(official) || typeof official.status !== "string") {
    return "unknown";
  }
  return official.status;
}

function sourceUrl(query: string, maxResults: number): string {
  const baseUrl = (
    process.env.MCP_REGISTRY_BASE_URL ?? DEFAULT_REGISTRY_BASE_URL
  ).replace(/\/+$/, "");
  const url = new URL(`${baseUrl}/v0.1/servers`);
  url.searchParams.set("search", query);
  url.searchParams.set("version", "latest");
  url.searchParams.set("limit", String(maxResults));
  return url.toString();
}

export function registerSearchMcpServersTool(server: McpServer): void {
  server.registerTool(
    "search_mcp_servers",
    {
      title: "Search the official MCP Registry",
      description:
        "Find candidate MCP servers in the official Registry by server-name keyword. " +
        "When a user describes a capability they need, translate it into one or more short " +
        "keywords such as 'filesystem', 'browser', or 'postgres' and search each keyword. " +
        "This is name-substring discovery, not semantic search, installation, or a safety endorsement.",
      inputSchema: {
        query: z
          .string()
          .min(1)
          .describe("Short server-name keyword, e.g. 'filesystem', 'browser', or 'postgres'"),
        max_results: z
          .number()
          .int()
          .min(1)
          .max(20)
          .default(5)
          .describe("Maximum number of Registry candidates to return (1-20)"),
        force_refresh: z
          .boolean()
          .default(false)
          .describe("Bypass the local cache and query the Registry again"),
      },
    },
    async ({ query, max_results, force_refresh }) => {
      const normalizedQuery = query.trim();
      const cacheKey = makeCacheKey("search_mcp_servers", {
        query: normalizedQuery,
        max_results,
      });

      if (!force_refresh) {
        const readStart = performance.now();
        const cached = getCached(cacheKey);
        if (cached !== undefined) {
          logCacheEvent({
            tool: "search_mcp_servers",
            cache: "hit",
            ms: Math.round(performance.now() - readStart),
            ok: true,
          });
          return { content: [{ type: "text", text: cached }] };
        }
      }

      const callStart = performance.now();
      try {
        const result = await searchRegistryServers(normalizedQuery, max_results);
        const candidates = result.servers.map(({ server: item, _meta }) => ({
          name: item.name,
          title: item.title ?? null,
          description: item.description ?? null,
          version: item.version,
          status: registryStatus(_meta),
          repository: item.repository ?? null,
          packages: item.packages ?? [],
          remotes: item.remotes ?? [],
        }));
        const payload = JSON.stringify(
          {
            query: normalizedQuery,
            search_mode: "registry_name_substring",
            candidates,
            result_count: candidates.length,
            registry_count: result.metadata.count ?? candidates.length,
            next_cursor: result.metadata.nextCursor ?? null,
            source_url: sourceUrl(normalizedQuery, max_results),
            fetched_at: new Date().toISOString(),
            limitation:
              "Candidates only. The Registry search matches server names, not full semantic intent; results are not installed or security-reviewed.",
          },
          null,
          2,
        );

        setCached(cacheKey, payload);
        logCacheEvent({
          tool: "search_mcp_servers",
          cache: force_refresh ? "refresh" : "miss",
          ms: Math.round(performance.now() - callStart),
          ok: true,
        });

        return { content: [{ type: "text", text: payload }] };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logCacheEvent({
          tool: "search_mcp_servers",
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
