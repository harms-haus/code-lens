/**
 * CLI subprocess runner for regression tests.
 */

import { execa } from "execa";
import { CLI_PATH } from "./types.js";
import type { CLIExecutionResult } from "./types.js";

/** Environment keys required for CLI and LSP servers to function. */
const REQUIRED_ENV_KEYS = [
  "PATH",
  "HOME",
  "LANG",
  "LC_ALL",
  "TERM",
  "NODE_PATH",
  "GOPATH",
  "PYTHONPATH",
  "CARGO_HOME",
  "RUSTUP_HOME",
  "TMPDIR",
  "npm_config_prefix",
  "NVM_DIR",
];

/**
 * Build a minimal environment with only essential variables.
 * Prevents test environment contamination.
 */
function buildEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {};
  for (const key of REQUIRED_ENV_KEYS) {
    if (process.env[key] !== undefined) {
      env[key] = process.env[key];
    }
  }
  return env;
}

/**
 * Run a code-lens CLI command as a subprocess.
 */
export async function runCLI(
  cwd: string,
  args: string[],
  options?: { timeout?: number },
): Promise<CLIExecutionResult> {
  const result = await execa("node", [CLI_PATH, ...args], {
    cwd,
    reject: false,
    timeout: options?.timeout ?? 30_000,
    env: buildEnv(),
    extendEnv: false,
  });

  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.exitCode ?? 0,
  };
}

/**
 * Run the CLI with extended timeout for slow operations
 * (first-time server initialization, large workspaces).
 */
export async function runCLISlow(
  cwd: string,
  args: string[],
): Promise<CLIExecutionResult> {
  return runCLI(cwd, args, { timeout: 60_000 });
}

/**
 * Run a CLI command with retry logic for navigation queries that may
 * return empty results while the LSP server is still indexing.
 * Retries until the result contains actual data (not "0 location" or
 * "No hover information"), up to `maxAttempts` times.
 */
export async function runCLIWithRetry(
  cwd: string,
  args: string[],
  options?: { timeout?: number; maxAttempts?: number; delayMs?: number },
): Promise<CLIExecutionResult> {
  const maxAttempts = options?.maxAttempts ?? 5;
  const delayMs = options?.delayMs ?? 3_000;
  let lastResult: CLIExecutionResult;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    lastResult = await runCLI(cwd, args, { timeout: options?.timeout });
    const out = lastResult.stdout;

    // Check if result has real data
    const isEmpty =
      out.includes("0 locations") ||
      out.includes("0 location\n") ||
      out.includes("No hover information") ||
      out.includes("No hover info") ||
      out.includes("No symbols found") ||
      out.includes("Failed to get hover information") ||
      out.includes("content modified");

    if (!isEmpty) return lastResult;

    // Wait before retrying
    if (attempt < maxAttempts - 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return lastResult!;
}
