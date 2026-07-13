import { existsSync } from "node:fs";

export interface Config {
  githubToken: string;
}

export function loadConfig(envPath = ".env"): Config {
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }

  const githubToken = process.env.GITHUB_TOKEN;
  if (!githubToken) {
    throw new Error(
      "Missing GITHUB_TOKEN. Set it in a .env file (copy .env.example) or " +
        "as a real environment variable. Create a token at " +
        "https://github.com/settings/tokens (public_repo scope is enough).",
    );
  }
  return { githubToken };
}
