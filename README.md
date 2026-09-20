# mcp-scout

> A local MCP server that lets AI editors (Cursor, Claude Code, Codex CLI) search GitHub, fetch web pages, and discover candidate MCP servers in the official Registry.

**Status: Phase 4 Registry-search learning slice completed and signed off on 2026-09-20.** TypeScript, stdio transport, three tools, SQLite exact-match cache, unit tested, and connected to Cursor / Claude Code / Codex CLI. The Registry path has local stdio e2e coverage and a repeatable real-network smoke test. Phase 5 has not started.

---

## What it does

Three MCP tools, callable by any MCP-compatible client over stdio:

```
AI editor (Cursor / Claude Code / Codex CLI)
    │
    ▼
mcp-scout (stdio)
    │
    ├── search_github_repos(query, language?, max_results=5)   → GitHub REST API
    ├── fetch_page(url)                                         → Jina Reader
    └── search_mcp_servers(query, max_results=5)                → Official MCP Registry
```

**Current scope does not include** a knowledge base, notes/workspace search, a vector DB, a web UI, a semantic RAG pipeline, or a hosted service. It is a local stdio process. Those are possible future directions only if real usage justifies them; they are not part of the current product contract.

**Version note:** the historical demo baseline is tagged `v0.2-demo`, while the package/server still report `0.1.0`. There is no current demo commitment; the mismatch is a known maintenance item for a future small work session.

---

## Tools

### `search_github_repos(query, language?, max_results=5)`

Searches public GitHub repos via `/search/repositories`. Returns `{results: [...], total_count}`, with a `readme_url` on each result for chaining into `fetch_page`. Empty results return `[]`, not an error. Requires a GitHub token (`public_repo` scope is enough).

### `fetch_page(url)`

Fetches a page via Jina Reader (`r.jina.ai`) and returns clean text. No API key needed.

### `search_mcp_servers(query, max_results=5)`

Searches the official MCP Registry for latest server versions whose names contain the supplied keyword. The tool description tells an AI agent to translate a capability request into short keywords such as `filesystem`, `browser`, or `postgres`. Results include Registry identity, repository, package/remote metadata, source URL, and an explicit limitation.

This is candidate discovery, not semantic search, installation, comparison, or a security review. It does not modify MCP client configuration or run discovered servers. No API key is required for the public Registry read API.

---

## Subagent: `research-assistant` (Claude Code)

A Claude Code subagent (`.claude/agents/research-assistant.md`) that chains the two tools above into a structured research report — no manual back-and-forth.

```
research question
    │
    ▼
research-assistant subagent (isolated context; tools: search_github_repos, fetch_page only)
    │
    ├── search_github_repos × 1-3   (keyword groups, optional language filter)
    ├── fetch_page × ~3             (read README of top matches)
    └── → report: overview, per-repo notes, comparison, recommendation, sources
```

Invoke explicitly ("use the research-assistant subagent to research: ...") or let Claude Code auto-delegate based on the agent's description. Project-level, so it's only available when working in this repo with Claude Code.

---

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in `GITHUB_TOKEN`
3. `npm run build`
4. `npm test` (unit tests, no network calls)

## Connecting a CLI

See [CLI_SETUP.md](CLI_SETUP.md) for Cursor, Claude Code, and Codex CLI configuration — same `dist/server.js`, no code changes needed per client.

## Manual smoke test

To exercise the built MCP server over stdio against the real official Registry:

```
npm run smoke:registry
```

The script asks for `filesystem`, prints a compact candidate list, uses an in-memory cache and temporary log, and cleans up after itself. Exact candidates are intentionally not hard-coded because Registry contents change.

For a real AI client, use the [temporary Codex example](CLI_SETUP.md#phase-4-example-temporary-connection-no-global-config-edits). On 2026-09-20, an explicit Codex CLI tool call returned 5 Registry candidates; two natural-language CLI trials chose web search only. In a later interactive Codex conversation, the same natural-language request prompted a `search_mcp_servers` call with `query="filesystem"`, `max_results=3`, returning 3 candidates alongside web research. This demonstrates autonomous selection in that conversation, not guaranteed tool preference or that the final recommendation came from the Registry results. Phase 4 was then signed off by the user.

For the original GitHub → README chain, use a known-stable query instead of picking a random one:

```
search_github_repos(query: "modelcontextprotocol/typescript-sdk")
```

The top result should be `modelcontextprotocol/typescript-sdk` (an exact repo-name match always ranks first). Then:

```
fetch_page(url: <that result's readme_url>)
```

should return several thousand characters of real README content, not an empty/short stub.

**Important**: always pass the result's `readme_url` field to `fetch_page`, not its `url` field. `readme_url` points at the raw file on `raw.githubusercontent.com`, which works reliably. `url` points at the repo's normal `github.com` web page, which Jina Reader cannot always fetch (GitHub's site has bot protection that blocks it, returning an HTTP 403) — that's a difference in the *target site*, not a bug in this server.

---

## License

MIT.

---

*Started 2026-06-28. Rewrite to TypeScript started 2026-07-08. Phase 1 (multi-CLI MCP server) completed 2026-07-15.*
