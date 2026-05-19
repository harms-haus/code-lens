/**
 * Prettier runner — REPORT-ONLY mode
 *
 * Runs `npx prettier --check` to detect files needing formatting.
 * Does NOT run `--write` — only reports which files need formatting.
 * The agent or user is responsible for applying fixes.
 */

import * as path from "node:path";
import { execCommand } from "../utils/spawn.js";
import type { PrettierResult } from "./types.js";

/** File extensions that prettier supports by default */
const PRETTIER_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".json",
  ".jsonc",
  ".css",
  ".scss",
  ".less",
  ".html",
  ".htm",
  ".md",
  ".mdx",
  ".yaml",
  ".yml",
  ".vue",
  ".svelte",
  ".graphql",
  ".gql",
]);

/**
 * Filter a list of file paths to those with prettier-supported extensions.
 */
function filterToSupportedExtensions(files: string[]): string[] {
  return files.filter((f) => {
    const ext = path.extname(f).toLowerCase();
    return PRETTIER_EXTENSIONS.has(ext);
  });
}

/**
 * Check if prettier is available by running `npx prettier --version`.
 * Uses a 10-second timeout to avoid hanging.
 */
export async function isPrettierAvailable(cwd: string): Promise<boolean> {
  try {
    const result = await execCommand("npx", ["prettier", "--version"], {
      cwd,
      timeout: 10_000,
    });
    return result.exitCode === 0 && result.stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Run `npx prettier --check` on the given files (REPORT-ONLY — does NOT write).
 *
 * - Exit code 0: all files are formatted correctly
 * - Exit code 1: some files need formatting (their paths are in stdout)
 * - Other exit codes or empty stdout: treated as error
 *
 * Returns per-file results indicating which files need formatting.
 */
export async function runPrettier(
  files: string[],
  cwd: string,
  signal?: AbortSignal,
  timeout: number = 15_000,
): Promise<PrettierResult[]> {
  const supportedFiles = filterToSupportedExtensions(files);
  if (supportedFiles.length === 0) return [];

  const results: PrettierResult[] = [];
  const args = ["prettier", "--check", "--no-error-on-unmatched-pattern", "--", ...supportedFiles];

  try {
    const result = await execCommand("npx", args, {
      cwd,
      timeout,
      signal,
      maxBuffer: 10 * 1024 * 1024,
    });

    if (result.exitCode === 0) {
      // All files are formatted correctly
      return supportedFiles.map((file) => ({ file, changed: false }));
    }

    if (result.exitCode === 1) {
      // Some files need formatting — parse stdout for file names
      const needsFormatting = new Set<string>();
      for (const line of result.stdout.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        // prettier --check outputs each file that needs formatting as a line
        // Try to resolve the path relative to cwd
        const resolved = path.resolve(cwd, trimmed);
        needsFormatting.add(resolved);
      }

      for (const file of supportedFiles) {
        const normalized = path.resolve(file);
        if (needsFormatting.has(normalized) || needsFormatting.has(file)) {
          results.push({ file, changed: true });
        } else {
          results.push({ file, changed: false });
        }
      }
      return results;
    }

    // Unexpected exit code — treat as error for all files
    return supportedFiles.map((file) => ({
      file,
      changed: false,
      error: `prettier exited with code ${result.exitCode}: ${result.stderr.trim()}`,
    }));
  } catch (err) {
    // Execution failed entirely
    const message = err instanceof Error ? err.message : String(err);
    return supportedFiles.map((file) => ({
      file,
      changed: false,
      error: message,
    }));
  }
}
