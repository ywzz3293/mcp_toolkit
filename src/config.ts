import { existsSync } from "node:fs";

export interface Config {
  githubToken?: string;
}

export function loadConfig(envPath = ".env"): Config {
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }

  const githubToken = process.env.GITHUB_TOKEN || undefined;
  return { githubToken };
}
