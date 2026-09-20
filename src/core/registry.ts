import { retry, RetryableError } from "./retry.js";

const DEFAULT_BASE_URL = "https://registry.modelcontextprotocol.io";
const DEFAULT_TIMEOUT_MS = 15_000;
const RETRY_OPTIONS = { attempts: 3, delays: [500, 1500] };

export interface RegistryRepository {
  url: string;
  source: string;
  id?: string;
  subfolder?: string;
}

export interface RegistryServer {
  name: string;
  version: string;
  title?: string;
  description?: string;
  repository?: RegistryRepository;
  packages?: unknown[];
  remotes?: unknown[];
  [key: string]: unknown;
}

export interface RegistryServerResponse {
  server: RegistryServer;
  _meta?: Record<string, unknown>;
}

export interface RegistryListMetadata {
  count?: number;
  nextCursor?: string;
}

export interface RegistrySearchResult {
  servers: RegistryServerResponse[];
  metadata: RegistryListMetadata;
}

export interface RegistryRequestOptions {
  baseUrl?: string;
  timeoutMs?: number;
}

function registryBaseUrl(override?: string): string {
  return (override ?? process.env.MCP_REGISTRY_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseServerResponse(value: unknown, context: string): RegistryServerResponse {
  if (!isRecord(value) || !isRecord(value.server)) {
    throw new Error(`Invalid MCP Registry response for ${context}: missing server object.`);
  }

  const { server } = value;
  if (typeof server.name !== "string" || server.name.length === 0) {
    throw new Error(`Invalid MCP Registry response for ${context}: missing server name.`);
  }
  if (typeof server.version !== "string" || server.version.length === 0) {
    throw new Error(`Invalid MCP Registry response for ${context}: missing server version.`);
  }

  return value as unknown as RegistryServerResponse;
}

async function attemptRequest(url: URL, timeoutMs: number, context: string): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Accept: "application/json",
        "User-Agent": "mcp-scout",
      },
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new RetryableError(`MCP Registry request timed out after ${timeoutMs}ms: ${context}`);
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new RetryableError(`Network error while calling MCP Registry (${context}): ${message}`);
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 429) {
    throw new RetryableError(`MCP Registry rate limit exceeded (HTTP 429): ${context}`);
  }
  if (response.status >= 500) {
    throw new RetryableError(`MCP Registry request failed with HTTP ${response.status}: ${context}`);
  }
  if (!response.ok) {
    throw new Error(`MCP Registry request failed with HTTP ${response.status}: ${context}`);
  }

  try {
    return (await response.json()) as unknown;
  } catch {
    throw new Error(`Invalid JSON from MCP Registry: ${context}`);
  }
}

async function requestRegistry(url: URL, timeoutMs: number, context: string): Promise<unknown> {
  return retry(() => attemptRequest(url, timeoutMs, context), RETRY_OPTIONS);
}

export async function searchRegistryServers(
  query: string,
  maxResults = 5,
  options: RegistryRequestOptions = {},
): Promise<RegistrySearchResult> {
  const normalizedQuery = query.trim();
  if (!normalizedQuery) {
    throw new Error("MCP Registry search query must not be empty.");
  }
  if (!Number.isInteger(maxResults) || maxResults < 1 || maxResults > 100) {
    throw new Error("MCP Registry maxResults must be an integer between 1 and 100.");
  }

  const url = new URL(`${registryBaseUrl(options.baseUrl)}/v0.1/servers`);
  url.searchParams.set("search", normalizedQuery);
  url.searchParams.set("version", "latest");
  url.searchParams.set("limit", String(maxResults));

  const data = await requestRegistry(
    url,
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    `search "${normalizedQuery}"`,
  );

  if (!isRecord(data) || !Array.isArray(data.servers)) {
    throw new Error("Invalid MCP Registry search response: missing servers array.");
  }

  const servers = data.servers.map((item, index) =>
    parseServerResponse(item, `search result ${index + 1}`),
  );
  const metadata = isRecord(data.metadata) ? (data.metadata as RegistryListMetadata) : {};

  return { servers, metadata };
}

export async function getRegistryServer(
  name: string,
  options: RegistryRequestOptions = {},
): Promise<RegistryServerResponse> {
  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new Error("MCP Registry server name must not be empty.");
  }

  const encodedName = encodeURIComponent(normalizedName);
  const url = new URL(
    `${registryBaseUrl(options.baseUrl)}/v0.1/servers/${encodedName}/versions/latest`,
  );
  const data = await requestRegistry(
    url,
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    `server "${normalizedName}"`,
  );

  return parseServerResponse(data, `server "${normalizedName}"`);
}
