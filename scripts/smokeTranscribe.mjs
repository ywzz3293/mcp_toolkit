import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const [path, start = "0", duration = "10"] = process.argv.slice(2);
if (!path) {
  console.error("Usage: node scripts/smokeTranscribe.mjs <absolute-video-path> [start-seconds] [duration-seconds]");
  process.exit(2);
}

const client = new Client({ name: "transcribe-smoke", version: "1.0.0" });
try {
  await client.connect(new StdioClientTransport({
    command: process.execPath,
    args: ["dist/server.js"],
    cwd: process.cwd(),
    env: { ...process.env, CACHE_DB_PATH: ":memory:" },
    stderr: "pipe",
  }));
  const result = await client.callTool({
    name: "transcribe_local_video",
    arguments: { path, start_seconds: Number(start), duration_seconds: Number(duration) },
  });
  const block = result.content?.find((item) => item.type === "text");
  if (result.isError || !block) throw new Error(block?.text || "MCP tool returned no text");
  const payload = JSON.parse(block.text);
  console.log(JSON.stringify({
    cuda_verified: payload.cuda_verified,
    detected_language: payload.detected_language,
    transcribe_seconds: payload.transcribe_seconds,
    transcript: payload.transcript,
    transcript_preview: payload.transcript_text?.slice(0, 400),
  }, null, 2));
  if (!payload.cuda_verified || !payload.transcript_text) process.exitCode = 1;
} finally {
  await client.close();
}
