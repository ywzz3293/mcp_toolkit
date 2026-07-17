import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const AGENT_PATH = join(REPO_ROOT, ".claude", "agents", "research-assistant.md");

const ALLOWED_TOOLS = [
  "mcp__research-toolkit__search_github_repos",
  "mcp__research-toolkit__fetch_page",
];

function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  assert.ok(match, "expected a --- frontmatter block at the top of the file");
  const block = match[1];

  const toolsLine = block.match(/^tools:\s*(.+)$/m);
  const descriptionLine = block.match(/^description:\s*(.+)$/m);
  const modelLine = block.match(/^model:\s*(.+)$/m);

  return {
    tools: toolsLine ? toolsLine[1].split(",").map((t) => t.trim()) : [],
    description: descriptionLine ? descriptionLine[1].trim() : "",
    model: modelLine ? modelLine[1].trim() : "",
  };
}

test("research-assistant tools whitelist contains exactly the two research-toolkit tools", () => {
  const content = readFileSync(AGENT_PATH, "utf8");
  const { tools } = parseFrontmatter(content);

  assert.deepEqual([...tools].sort(), [...ALLOWED_TOOLS].sort());
});

test("research-assistant has a non-empty description", () => {
  const content = readFileSync(AGENT_PATH, "utf8");
  const { description } = parseFrontmatter(content);

  assert.ok(description.length > 0, "description must not be empty");
});

test("research-assistant declares a model", () => {
  const content = readFileSync(AGENT_PATH, "utf8");
  const { model } = parseFrontmatter(content);

  assert.ok(model.length > 0, "model must not be empty");
});
