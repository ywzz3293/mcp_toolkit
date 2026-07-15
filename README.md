# research-toolkit-mcp

> A local MCP server that lets AI editors (Cursor, Claude Code, Codex CLI) search GitHub and fetch web pages directly — no need to leave the editor.

**Status: Phase 1 complete.** TypeScript, stdio transport, two tools, tested and connected to all three CLIs.

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

## Setup

1. `npm install`
2. Copy `.env.example` to `.env` and fill in `GITHUB_TOKEN`
3. `npm run build`
4. `npm test` (16 unit tests, no network calls)

## Connecting a CLI

See [CLI_SETUP.md](CLI_SETUP.md) for Cursor, Claude Code, and Codex CLI configuration — same `dist/server.js`, no code changes needed per client.

---

## License

MIT.

---

*Started 2026-06-28. Rewrite to TypeScript started 2026-07-08. Phase 1 (multi-CLI MCP server) completed 2026-07-15.*
