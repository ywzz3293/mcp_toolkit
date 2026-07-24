import { retry, RetryableError } from "./retry.js";

const JINA_READER_BASE = "https://r.jina.ai";
const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_CONTENT_LENGTH = 25_000;
const RETRY_OPTIONS = { attempts: 3, delays: [500, 1500] };

export interface FetchPageResult {
  url: string;
  title: string | null;
  content: string;
  contentLength: number;
  truncated: boolean;
}

export interface FetchPageOptions {
  timeoutMs?: number;
  maxContentLength?: number;
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

async function attemptFetch(url: string, readerUrl: string, timeoutMs: number): Promise<string> {
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
      throw new RetryableError(`Request to ${url} timed out after ${timeoutMs}ms.`);
    }
    const message = err instanceof Error ? err.message : String(err);
    throw new RetryableError(`Network error while fetching ${url}: ${message}`);
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 429 || response.status === 403 || response.status >= 500) {
    throw new RetryableError(`Failed to fetch page (HTTP ${response.status}): ${url}`);
  }
  if (!response.ok) {
    throw new Error(`Failed to fetch page (HTTP ${response.status}): ${url}`);
  }

  return (await response.text()).trim();
}

export async function fetchPage(
  url: string,
  options: FetchPageOptions = {},
): Promise<FetchPageResult> {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxContentLength = DEFAULT_MAX_CONTENT_LENGTH,
  } = options;

  validateUrl(url);

  const readerUrl = `${JINA_READER_BASE}/${url}`;

  const raw = await retry(() => attemptFetch(url, readerUrl, timeoutMs), RETRY_OPTIONS);

  const upstreamError = raw.match(/^Warning: Target URL returned error (\d+):\s*(.*)$/m);
  if (upstreamError) {
    throw new Error(`Failed to fetch page (HTTP ${upstreamError[1]}: ${upstreamError[2]}): ${url}`);
  }

  const { title, content } = parseJinaResponse(raw);

  const truncated = content.length > maxContentLength;
  const finalContent = truncated ? content.slice(0, maxContentLength) : content;

  return { url, title, content: finalContent, contentLength: finalContent.length, truncated };
}
