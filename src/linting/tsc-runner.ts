/**
 * TypeScript compiler runner
 *
 * Runs `tsc --noEmit` on the project and parses diagnostics into TscIssue objects.
 * If a file list is provided, output is filtered to only include those files.
 */

import * as path from "node:path";
import * as fs from "node:fs";
import { execCommand } from "../utils/spawn.js";
import type { TscIssue } from "./types.js";

/** Result of running tsc */
export interface TscRunResult {
  /** Parsed diagnostics */
  issues: TscIssue[];
  /** Duration of the tsc run in milliseconds */
  durationMs: number;
  /** Error message if tsc failed to run entirely (not just compilation errors) */
  error?: string;
}

/** Regex to parse tsc diagnostic output lines */
const TSC_DIAGNOSTIC_REGEX = /^(.+?)\((\d+),(\d+)\):\s+(error|warning)\s+TS(\d+):\s+(.+)$/;

/**
 * Check if TypeScript compiler is available.
 * Requires both tsconfig.json and `tsc --version` to succeed.
 */
export async function isTscAvailable(cwd: string): Promise<boolean> {
  // Check for tsconfig.json first (fast fs check)
  if (!detectTsconfig(cwd)) return false;

  try {
    const result = await execCommand("npx", ["tsc", "--version"], {
      cwd,
      timeout: 10_000,
    });
    return result.exitCode === 0 && result.stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Detect tsconfig.json in the project root.
 * Returns the path to tsconfig.json if found, undefined otherwise.
 */
export function detectTsconfig(cwd: string): string | undefined {
  const tsconfigPath = path.join(cwd, "tsconfig.json");
  if (fs.existsSync(tsconfigPath)) {
    return tsconfigPath;
  }
  return undefined;
}

/**
 * Run `tsc --noEmit --pretty false` and parse diagnostics.
 *
 * - Exit code 0: clean, no issues
 * - Exit code 1: compilation errors/warnings (normal), parsed from stdout
 * - Other exit codes with no stdout: treated as execution error
 *
 * If `files` is provided, parsed issues are filtered to only include those files.
 */
export async function runTsc(
  cwd: string,
  files?: string[],
  signal?: AbortSignal,
  timeout: number = 30_000,
): Promise<TscRunResult> {
  const startTime = Date.now();

  try {
    const result = await execCommand("npx", ["tsc", "--noEmit", "--pretty", "false"], {
      cwd,
      timeout,
      signal,
      maxBuffer: 10 * 1024 * 1024,
    });

    const durationMs = Date.now() - startTime;

    // Exit code 0 means clean compilation
    if (result.exitCode === 0) {
      return { issues: [], durationMs };
    }

    // Exit code 1 with stdout = normal compilation errors
    if (result.exitCode === 1 || (result.exitCode !== 0 && result.stdout.trim().length > 0)) {
      const issues = parseTscOutput(result.stdout, cwd);

      // Filter to specific files if requested
      const filtered = filterIssues(issues, files);

      return { issues: filtered, durationMs };
    }

    // Non-standard exit code with no stdout — execution error
    return {
      issues: [],
      durationMs,
      error: `tsc exited with code ${result.exitCode}: ${result.stderr.trim()}`,
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    const message = err instanceof Error ? err.message : String(err);
    return {
      issues: [],
      durationMs,
      error: message,
    };
  }
}

/**
 * Parse tsc output into TscIssue objects.
 * Expected format: `file(line,col): error|warning TSnnnn: message`
 */
function parseTscOutput(stdout: string, cwd: string): TscIssue[] {
  const issues: TscIssue[] = [];
  const lines = stdout.split("\n");

  for (const line of lines) {
    const match = TSC_DIAGNOSTIC_REGEX.exec(line.trim());
    if (!match) continue;

    const [, filePath, lineStr, colStr, severity, code, message] = match;

    // Resolve file path relative to cwd
    const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(cwd, filePath);

    issues.push({
      file: resolved,
      line: parseInt(lineStr, 10),
      column: parseInt(colStr, 10),
      severity: severity as "error" | "warning",
      message,
      code: `TS${code}`,
    });
  }

  return issues;
}

/**
 * Filter issues to only include specific files.
 * If files is undefined or empty, return all issues.
 */
function filterIssues(issues: TscIssue[], files?: string[]): TscIssue[] {
  if (!files || files.length === 0) return issues;

  const fileSet = new Set(files.map((f) => path.resolve(f)));
  return issues.filter((issue) => fileSet.has(issue.file));
}
