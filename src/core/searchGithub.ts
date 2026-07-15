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
}

export interface SearchGithubOptions {
  token: string;
  language?: string;
  maxResults?: number;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;

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

export async function searchGithub(
  query: string,
  options: SearchGithubOptions,
): Promise<SearchGithubResult> {
  const { token, language, maxResults = 5, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  if (!token) {
    throw new Error("Missing GitHub token: searchGithub() requires options.token.");
  }

  const q = language ? `${query} language:${language}` : query;
  const url = new URL("https://api.github.com/search/repositories");
  url.searchParams.set("q", q);
  url.searchParams.set("per_page", String(maxResults));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "User-Agent": "research-toolkit-mcp",
      },
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`GitHub search timed out after ${timeoutMs}ms.`);
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Network error while searching GitHub: ${message}`);
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 401) {
    throw new Error(
      "GitHub rejected the token (401 Unauthorized). Check that GITHUB_TOKEN is valid.",
    );
  }
  if (response.status === 403 || response.status === 429) {
    throw new Error(
      `GitHub API rate limit or permission error (HTTP ${response.status}). ` +
        "Wait a bit and try again, or check the token's scopes.",
    );
  }
  if (!response.ok) {
    throw new Error(`GitHub search failed with HTTP ${response.status}`);
  }

  const data = (await response.json()) as GithubSearchResponse;

  const results: GithubRepoResult[] = data.items.map((item) => ({
    fullName: item.full_name,
    description: item.description,
    url: item.html_url,
    stars: item.stargazers_count,
    readmeUrl: `https://raw.githubusercontent.com/${item.full_name}/HEAD/README.md`,
  }));

  return { results, totalCount: data.total_count };
}
