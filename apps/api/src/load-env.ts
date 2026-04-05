import { existsSync } from "fs";
import { resolve } from "path";
import { config as loadDotenv } from "dotenv";

/**
 * Load .env before any other app modules import `configuration.ts`.
 * Otherwise top-level / import-time reads of process.env see undefined even when .env exists.
 */
function loadEnvDir(dir: string): void {
  const env = resolve(dir, ".env");
  const local = resolve(dir, ".env.local");
  if (existsSync(env)) loadDotenv({ path: env });
  if (existsSync(local)) loadDotenv({ path: local, override: true });
}

const cwd = process.cwd();
loadEnvDir(cwd);
loadEnvDir(resolve(cwd, "backend"));
loadEnvDir(resolve(cwd, "apps", "api"));
