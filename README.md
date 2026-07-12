# Personal Research MCP

> A local MCP server that lets AI editors (Cursor, Claude Code, etc.) search GitHub and fetch web pages directly — no need to leave the editor.

**Status: rewrite in progress.** Rebuilding in TypeScript. Project scaffolding is in place (`package.json`, `tsconfig.json`, `src/core/`, `src/mcp/tools/`); the server and tools themselves are not implemented yet.

---

## What it does (target behavior, being reimplemented)

Two MCP tools, callable by any MCP-compatible client over stdio:

```
AI editor (Cursor / Claude Code / ...)
    │
    ▼
Personal Research MCP (stdio)
    │
    ├── search_github(query)   → GitHub REST API
    └── fetch_page(url)         → Jina Reader
```

**Not**: a knowledge base / notes search, a vector DB, a web UI, a RAG pipeline, or a hosted service. Pure local stdio process.

---

## Tools

### `search_github(query, language?, max_results=5)`

Searches public GitHub repos via `/search/repositories`. Returns `{results: [...], total_count}`. Empty results return `[]`, not an error. Requires a GitHub token (`public_repo` scope is enough).

### `fetch_page(url)`

Fetches a page via Jina Reader (`r.jina.ai`) and returns clean text. No API key needed.

---

## License

MIT.

---

*Started 2026-06-28. Rewrite to TypeScript started 2026-07-08. Scaffolding added 2026-07-12.*
