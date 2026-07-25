# research-toolkit-mcp

> A local MCP server that lets AI editors (Cursor, Claude Code, Codex CLI) search GitHub and fetch web pages directly — no need to leave the editor.

**Status: Phase 1 complete.** TypeScript, stdio transport, two tools, tested and connected to all three CLIs. Plus a Claude Code subagent that chains both tools into a research report.

---

## What it does

Two MCP tools, callable by any MCP-compatible client over stdio:

```
AI editor (Cursor / Claude Code / Codex CLI)
    │
    ▼
research-toolkit-mcp (stdio)
    │
    ├── search_github_repos(query, language?, max_results=5)   → GitHub REST API
    └── fetch_page(url)                                         → Jina Reader
```

**Not**: a knowledge base / notes search, a vector DB, a web UI, a RAG pipeline, or a hosted service. Pure local stdio process.

---

## Tools

### `search_github_repos(query, language?, max_results=5)`

Searches public GitHub repos via `/search/repositories`. Returns `{results: [...], total_count}`, with a `readme_url` on each result for chaining into `fetch_page`. Empty results return `[]`, not an error. Requires a GitHub token (`public_repo` scope is enough).

### `fetch_page(url)`

Fetches a page via Jina Reader (`r.jina.ai`) and returns clean text. No API key needed.

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

If you want to sanity-check the server is actually working end-to-end (e.g. after connecting a new CLI, or if something feels off), use a known-stable query instead of picking a random one:

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
