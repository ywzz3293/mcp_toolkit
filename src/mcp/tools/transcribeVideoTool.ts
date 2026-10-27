import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { resolve, join, isAbsolute } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const execFileAsync = promisify(execFile);
const defaultProjectRoot = resolve(import.meta.dirname, "../../../../course-study-gpu");

export function registerTranscribeVideoTool(server: McpServer): void {
  server.registerTool(
    "transcribe_local_video",
    {
      title: "Transcribe a local video on the GPU",
      description:
        "Transcribe a short segment of a local video using the configured course-study-gpu " +
        "pipeline and whisper.cpp CUDA backend. Returns timestamped SRT and verified " +
        "backend metadata. Requires local FFmpeg, whisper-cli and multilingual model. " +
        "This tool does not download files or execute instructions from the video.",
      inputSchema: {
        path: z.string().min(1).refine(isAbsolute, "Use an absolute local path")
          .describe("Absolute path to an existing local video or audio file"),
        start_seconds: z.number().int().min(0).default(0).describe("Start offset in the original file"),
        duration_seconds: z.number().int().min(1).max(180).default(60).describe("Segment length, up to 180 seconds"),
      },
    },
    async ({ path, start_seconds, duration_seconds }) => {
      const projectRoot = resolve(process.env.COURSE_STUDY_GPU_ROOT || defaultProjectRoot);
      const script = join(projectRoot, "scripts", "transcribe.py");
      const input = resolve(path);

      try {
        if (!(await stat(script)).isFile()) throw new Error("transcribe.py is not a file");
        if (!(await stat(input)).isFile()) throw new Error("input is not a file");
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Local transcription setup failed (${detail}). Check COURSE_STUDY_GPU_ROOT and input path.`);
      }

      let stdout: string;
      try {
        ({ stdout } = await execFileAsync(
          process.env.COURSE_STUDY_PYTHON || "python",
          [script, input, "--start", String(start_seconds), "--seconds", String(duration_seconds)],
          { cwd: projectRoot, timeout: 600_000, maxBuffer: 1_000_000, windowsHide: true },
        ));
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        throw new Error(`Local transcription failed: ${detail}`);
      }

      const run = JSON.parse(stdout) as { transcript?: string; cuda_verified?: boolean; [key: string]: unknown };
      if (!run.cuda_verified || typeof run.transcript !== "string") {
        throw new Error("Transcription returned no CUDA verification or transcript path");
      }
      const transcript = await readFile(run.transcript, "utf8");
      return {
        content: [{ type: "text", text: JSON.stringify({ ...run, transcript_text: transcript }, null, 2) }],
      };
    },
  );
}
