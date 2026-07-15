const JINA_READER_BASE = "https://r.jina.ai";
const DEFAULT_TIMEOUT_MS = 15_000;

export interface FetchPageResult {
  url: string;
  title: string | null;
  content: string;
  contentLength: number;
}

export interface FetchPageOptions {
  timeoutMs?: number;
}

function validateUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error(
      `Invalid URL: "${url}". Must include a protocol, e.g. https://example.com/page`,
    );
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(
      `Unsupported protocol "${parsed.protocol}" in URL: "${url}". Use http or https.`,
    );
  }
}

function parseJinaResponse(raw: string): { title: string | null; content: string } {
  const titleMatch = raw.match(/^Title:\s*(.*)$/m);
  const title = titleMatch ? titleMatch[1].trim() : null;

  const marker = "Markdown Content:";
  const markerIndex = raw.indexOf(marker);
  const content = markerIndex === -1 ? raw.trim() : raw.slice(markerIndex + marker.length).trim();

  return { title, content };
}

export async function fetchPage(
  url: string,
  options: FetchPageOptions = {},
): Promise<FetchPageResult> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  validateUrl(url);

  const readerUrl = `${JINA_READER_BASE}/${url}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(readerUrl, {
      headers: {
        "User-Agent": "research-toolkit-mcp",
        Accept: "text/plain",
      },
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Request to ${url} timed out after ${timeoutMs}ms.`);
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Network error while fetching ${url}: ${message}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch page (HTTP ${response.status}): ${url}`);
  }

  const raw = (await response.text()).trim();

  const upstreamError = raw.match(/^Warning: Target URL returned error (\d+):\s*(.*)$/m);
  if (upstreamError) {
    throw new Error(`Failed to fetch page (HTTP ${upstreamError[1]}: ${upstreamError[2]}): ${url}`);
  }

  const { title, content } = parseJinaResponse(raw);

  return { url, title, content, contentLength: content.length };
}
