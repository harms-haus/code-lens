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
