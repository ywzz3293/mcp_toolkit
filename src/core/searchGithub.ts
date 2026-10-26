import { retry, RetryableError } from "./retry.js";

export interface GithubRepoResult {
  fullName: string;
  description: string | null;
  url: string;
  stars: number;
  readmeUrl: string;
}

export interface SearchGithubResult {
  results: GithubRepoResult[];
  totalCount: number;
  authWarning?: string;
}

export interface SearchGithubOptions {
  token?: string;
  language?: string;
  maxResults?: number;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const RETRY_OPTIONS = { attempts: 3, delays: [500, 1500] };
const GITHUB_API_BASE = process.env.GITHUB_API_BASE_URL ?? "https://api.github.com";

interface GithubSearchResponseItem {
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
}

interface GithubSearchResponse {
  total_count: number;
  items: GithubSearchResponseItem[];
}

class InvalidTokenError extends Error {}

async function attemptSearch(
  url: URL,
  token: string | undefined,
  timeoutMs: number,
): Promise<GithubSearchResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        Accept: "application/vnd.github+json",
        "User-Agent": "mcp-scout",
      },
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new RetryableError(`GitHub search timed out after ${timeoutMs}ms.`);
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new RetryableError(`Network error while searching GitHub: ${message}`);
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 401) {
    if (token) throw new InvalidTokenError("GitHub rejected the token (401 Unauthorized).");
    throw new Error("GitHub public search returned 401 Unauthorized.");
  }
  if (response.status === 403 || response.status === 429) {
    throw new RetryableError(
      `GitHub API rate limit or permission error (HTTP ${response.status}). ` +
        "Wait a bit and try again, or check the token's permissions if configured.",
    );
  }
  if (response.status >= 500) {
    throw new RetryableError(`GitHub search failed with HTTP ${response.status}`);
  }
  if (!response.ok) {
    throw new Error(`GitHub search failed with HTTP ${response.status}`);
  }

  return (await response.json()) as GithubSearchResponse;
}

export async function searchGithub(
  query: string,
  options: SearchGithubOptions,
): Promise<SearchGithubResult> {
  const { token, language, maxResults = 5, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  const q = language ? `${query} language:${language}` : query;
  const url = new URL(`${GITHUB_API_BASE}/search/repositories`);
  url.searchParams.set("q", q);
  url.searchParams.set("per_page", String(maxResults));

  let data: GithubSearchResponse;
  let authWarning: string | undefined;
  try {
    data = await retry(() => attemptSearch(url, token, timeoutMs), RETRY_OPTIONS);
  } catch (err) {
    if (!(err instanceof InvalidTokenError) || !token) throw err;
    data = await retry(() => attemptSearch(url, undefined, timeoutMs), RETRY_OPTIONS);
    authWarning =
      "GitHub token was rejected (401); public search succeeded without authentication. " +
      "Unauthenticated rate limits apply.";
  }

  const results: GithubRepoResult[] = data.items.map((item) => ({
    fullName: item.full_name,
    description: item.description,
    url: item.html_url,
    stars: item.stargazers_count,
    readmeUrl: `https://raw.githubusercontent.com/${item.full_name}/HEAD/README.md`,
  }));

  return { results, totalCount: data.total_count, ...(authWarning ? { authWarning } : {}) };
}
