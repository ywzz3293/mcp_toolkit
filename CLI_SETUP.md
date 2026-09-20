# CLI Setup — mcp-scout

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
    "mcp-scout": {
      "command": "node",
      "args": ["C:/absolute/path/to/mcp_toolkit/dist/server.js"],
      "env": {
        "GITHUB_TOKEN": "your-github-token-here"
      }
    }
  }
}
```

**Verify**: Open Cursor — MCP settings should show `mcp-scout` as connected. In agent/chat, ask it to call `search_github_repos`, then call `fetch_page` on one of the returned `readme_url`s to confirm the search → fetch chain works.

---

## Claude Code

Two equivalent options (`claude mcp add` simply generates the same `.mcp.json` for you):

**Option 1: hand-write `.mcp.json`** (project root, gitignored — see `.mcp.json.example`):

```json
{
  "mcpServers": {
    "mcp-scout": {
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
claude mcp add mcp-scout -- node C:/absolute/path/to/mcp_toolkit/dist/server.js
```

**Note**: a project-level `.mcp.json` requires explicit approval on first use — `claude mcp list` shows `⏸ Pending approval` until you confirm once in an interactive `claude` session, after which it becomes `✓ Connected`. This is Claude Code's guard against silently trusting MCP configs checked into a repo.

**Verify**: `claude mcp list` shows the server as connected; in Claude Code, call `search_github_repos`, then `fetch_page` on a repo's README.

---

## Codex CLI

### Phase 4 example: temporary connection (no global config edits)

The current package, MCP server identity, and example connection alias are `mcp-scout` (formerly `research-toolkit-mcp` / `research-toolkit`). The repository folder remains `mcp_toolkit`. Existing personal client configurations are not migrated automatically: an old connection alias can still launch this server, but namespaced tool references must match that alias. The checked-in `research-assistant` whitelist now expects `mcp-scout`; migrate your connection alias before using that agent, or keep its whitelist aligned with your existing alias.

The observations below were collected before the rename using the old alias; the reproduction commands use the new name. The rename is covered by the local stdio identity test, not a new AI selection run.

Verified with Codex CLI `0.155.1` on 2026-09-20. Build the project first and use an existing empty test folder outside the repo. Replace all `C:/absolute/path/...` paths below. The public Registry query does not require a GitHub token.

Windows PowerShell, **one line** (`--%` preserves the TOML quoting; `codex.cmd` avoids the PowerShell script execution-policy issue):

```powershell
codex.cmd --% exec --ignore-user-config --ephemeral --sandbox read-only --skip-git-repo-check -C C:/absolute/path/to/empty-test-folder --json -c "mcp_servers.mcp-scout.command='node'" -c "mcp_servers.mcp-scout.args=['C:/absolute/path/to/mcp_toolkit/dist/server.js']" -c "mcp_servers.mcp-scout.env={CACHE_DB_PATH=':memory:',LOG_FILE_PATH='C:/absolute/path/to/empty-test-folder/toolkit.log'}" -c mcp_servers.mcp-scout.required=true -c "mcp_servers.mcp-scout.tools.search_mcp_servers.approval_mode='approve'" "我想让 AI 读写本地文件，帮我找一个可能合适的 MCP server。"
```

This uses existing Codex authentication, skips user config, and supplies MCP settings only for this invocation. It keeps the shell sandbox read-only and explicitly preapproves only this project's Registry search tool. The MCP process writes its diagnostic log to the test folder; it does not install discovered servers. Use the approval override only after reviewing and trusting the local server code. Network access and a working Codex login are required.

Inspect `--json` events for `mcp_tool_call` with `server="mcp-scout"` and `tool="search_mcp_servers"`. A successful answer alone is not proof that MCP was used.

For a **separate connectivity diagnostic**, replace only the final prompt with:

> 这是连接诊断，不是自然选择测试。请调用 mcp-scout 的 search_mcp_servers，query 为 filesystem，max_results 为 5。只报告实际返回的候选数、来源和限制，不安装任何东西，不调用 shell 或网页搜索。

Observed results on 2026-09-20:

- Natural request: Codex chose built-in web search in both runs (before and after the scoped approval override); it did not call the Registry tool.
- Explicit diagnostic: initially blocked by `MCP tool call requires approval, but approval policy is never`; with the single-tool override, the call completed and returned 5 Registry candidates.
- Therefore the Codex → MCP → Registry connection works, but autonomous preference for this tool is **not demonstrated**. Do not count the explicit diagnostic as an autonomous-selection pass.

See the official [non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode) and [MCP configuration](https://learn.chatgpt.com/docs/extend/mcp?surface=cli) documentation for the flags and per-tool approval settings.

### Optional permanent registration

The following is an alternative, not required for the temporary example above. It changes your normal configuration; it was not executed for the Phase 4 test.

Registers globally (written to `~/.codex/config.toml` — applies to every Codex project on this machine, not project-scoped):

```sh
codex mcp add mcp-scout --env GITHUB_TOKEN=your-github-token-here -- node C:/absolute/path/to/mcp_toolkit/dist/server.js
```

Or hand-write `~/.codex/config.toml`:

```toml
[mcp_servers.mcp-scout]
command = "node"
args = ["C:/absolute/path/to/mcp_toolkit/dist/server.js"]
env = { GITHUB_TOKEN = "your-github-token-here" }
```

**Verify**: `codex mcp list` / `codex mcp get mcp-scout` parse the config correctly (`enabled: true`); call both tools in an interactive `codex` session.

---

## Comparison

| CLI | Scope | Format | Explicit approval |
|-----|-------|--------|-------------------|
| Cursor | Project | JSON (`.cursor/mcp.json`) | No (as observed; underlying mechanism not fully verified) |
| Claude Code | Project | JSON (`.mcp.json`) | Yes (one-time confirmation in an interactive session) |
| Codex CLI | Global | TOML (`~/.codex/config.toml`) | No |

Under the hood, all three configs express the same three things: `command` / `args` / `env`. Only the file format, location, and scope differ.
