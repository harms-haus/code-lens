/**
 * Shared types and constants for regression tests
 */

import path from "node:path";

/** Absolute path to the compiled CLI entry point */
export const CLI_PATH = path.resolve(import.meta.dirname, "../../dist/cli.js");

/** Result of running a code-lens CLI command as a subprocess */
export interface CLIExecutionResult {
  /** Combined stdout from the CLI process */
  stdout: string;
  /** Combined stderr from the CLI process */
  stderr: string;
  /** Process exit code (0 = success, 1 = error) */
  exitCode: number;
}

/** Options for output normalization */
export interface NormalizeOptions {
  /** The absolute path of the per-test temp fixture directory */
  fixtureDir: string;
}
