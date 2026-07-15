# CLI Setup — research-toolkit-mcp

All three CLIs connect to the same `dist/server.js`; nothing under `src/` needs to change per client. Build once first:

```sh
npm install
cp .env.example .env   # fill in a real GITHUB_TOKEN
npm run build
```

With `dist/server.js` in place, configure your CLI below. Replace the absolute paths in the snippets with your local project path.

---

## Cursor

Create `.cursor/mcp.json` in the project root (gitignored — see `.cursor/mcp.json.example`):

```json
{
  "mcpServers": {
    "research-toolkit": {
      "command": "node",
      "args": ["C:/absolute/path/to/mcp_toolkit/dist/server.js"],
      "env": {
        "GITHUB_TOKEN": "your-github-token-here"
      }
    }
  }
}
```

**Verify**: Open Cursor — MCP settings should show `research-toolkit` as connected. In agent/chat, ask it to call `search_github_repos`, then call `fetch_page` on one of the returned `readme_url`s to confirm the search → fetch chain works.

---

## Claude Code

Two equivalent options (`claude mcp add` simply generates the same `.mcp.json` for you):

**Option 1: hand-write `.mcp.json`** (project root, gitignored — see `.mcp.json.example`):

```json
{
  "mcpServers": {
    "research-toolkit": {
      "command": "node",
      "args": ["C:/absolute/path/to/mcp_toolkit/dist/server.js"],
      "env": {
        "GITHUB_TOKEN": "your-github-token-here"
      }
    }
  }
}
```

**Option 2: command line**

```sh
claude mcp add research-toolkit -- node C:/absolute/path/to/mcp_toolkit/dist/server.js
```

**Note**: a project-level `.mcp.json` requires explicit approval on first use — `claude mcp list` shows `⏸ Pending approval` until you confirm once in an interactive `claude` session, after which it becomes `✓ Connected`. This is Claude Code's guard against silently trusting MCP configs checked into a repo.

**Verify**: `claude mcp list` shows the server as connected; in Claude Code, call `search_github_repos`, then `fetch_page` on a repo's README.

---

## Codex CLI

Registers globally (written to `~/.codex/config.toml` — applies to every Codex project on this machine, not project-scoped):

```sh
codex mcp add research-toolkit --env GITHUB_TOKEN=your-github-token-here -- node C:/absolute/path/to/mcp_toolkit/dist/server.js
```

Or hand-write `~/.codex/config.toml`:

```toml
[mcp_servers.research-toolkit]
command = "node"
args = ["C:/absolute/path/to/mcp_toolkit/dist/server.js"]
env = { GITHUB_TOKEN = "your-github-token-here" }
```

**Verify**: `codex mcp list` / `codex mcp get research-toolkit` parse the config correctly (`enabled: true`); call both tools in an interactive `codex` session.

---

## Comparison

| CLI | Scope | Format | Explicit approval |
|-----|-------|--------|-------------------|
| Cursor | Project | JSON (`.cursor/mcp.json`) | No (as observed; underlying mechanism not fully verified) |
| Claude Code | Project | JSON (`.mcp.json`) | Yes (one-time confirmation in an interactive session) |
| Codex CLI | Global | TOML (`~/.codex/config.toml`) | No |

Under the hood, all three configs express the same three things: `command` / `args` / `env`. Only the file format, location, and scope differ.
