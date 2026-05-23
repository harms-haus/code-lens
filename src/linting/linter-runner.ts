import * as path from "node:path";
import type { DetectedLinter, LintIssue } from "./types.js";
import { execCommand } from "../utils/spawn.js";

/**
 * Run a single linter against a set of files.
 */
export async function runLinter(
  linter: DetectedLinter,
  files: string[],
  cwd: string,
  signal?: AbortSignal,
  timeoutCap?: number,
): Promise<LintIssue[]> {
  if (files.length === 0) return [];
  const args = linter.definition.lintCommand(files);
  const command = args[0];
  const commandArgs = args.slice(1);
  const effectiveTimeout =
    timeoutCap != null
      ? Math.min(linter.definition.timeout, timeoutCap)
      : linter.definition.timeout;
  try {
    const result = await execCommand(command, commandArgs, {
      cwd,
      timeout: effectiveTimeout,
      signal,
      maxBuffer: 10 * 1024 * 1024,
    });
    // Linters often exit with code 1 when issues are found — that's normal.
    // We only care about stdout content.
    if (result.stdout && result.stdout.trim()) {
      return linter.definition.parseOutput(result.stdout, cwd);
    }
    return [];
  } catch {
    return [];
  }
}

/**
 * Run multiple linters against a set of files, in parallel.
 * Each linter only processes files matching its extensions.
 */
export async function runLinters(
  linters: DetectedLinter[],
  files: string[],
  cwd: string,
  signal?: AbortSignal,
  maxConcurrency?: number,
  timeoutCap?: number,
): Promise<LintIssue[]> {
  if (linters.length === 0 || files.length === 0) return [];
  return runLintersInParallel(linters, files, cwd, signal, maxConcurrency, timeoutCap);
}

/**
 * Shared helper for parallel linter execution with optional concurrency limit.
 */
async function runLintersInParallel(
  linters: DetectedLinter[],
  files: string[],
  cwd: string,
  signal?: AbortSignal,
  maxConcurrency?: number,
  timeoutCap?: number,
): Promise<LintIssue[]> {
  // Pre-group files by extension for O(1) lookup per linter
  const filesByExt = new Map<string, string[]>();
  for (const f of files) {
    const ext = path.extname(f).toLowerCase();
    let arr = filesByExt.get(ext);
    if (!arr) {
      arr = [];
      filesByExt.set(ext, arr);
    }
    arr.push(f);
  }

  // Build linter tasks with their matching files
  const tasks: { linter: DetectedLinter; matchingFiles: string[] }[] = [];
  for (const linter of linters) {
    const matchingFiles: string[] = [];
    for (const ext of linter.definition.extensions) {
      const extFiles = filesByExt.get(ext);
      if (extFiles) {
        for (const f of extFiles) matchingFiles.push(f);
      }
    }
    if (matchingFiles.length > 0) {
      tasks.push({ linter, matchingFiles });
    }
  }

  if (tasks.length === 0) return [];

  // Determine batch size from maxConcurrency
  const limit = maxConcurrency != null && maxConcurrency > 0 ? maxConcurrency : tasks.length;

  const allIssues: LintIssue[] = [];
  for (let i = 0; i < tasks.length; i += limit) {
    const batch = tasks.slice(i, i + limit);
    const batchResults = await Promise.allSettled(
      batch.map(({ linter, matchingFiles }) =>
        runLinter(linter, matchingFiles, cwd, signal, timeoutCap),
      ),
    );
    allIssues.push(...batchResults.flatMap((r) => (r.status === "fulfilled" ? r.value : [])));
  }
  return allIssues;
}

/**
 * Result of running fix for a single linter.
 */
export interface LinterFixRunResult {
  linter: string;
  fixed: string[];
  errors: string[];
}

/**
 * Filter files down to those matching the linter's extensions.
 */
function filterFilesByExtensions(files: string[], extensions: string[]): string[] {
  const extSet = new Set(extensions);
  return files.filter((f) => extSet.has(path.extname(f).toLowerCase()));
}

/**
 * Run a single linter's auto-fix command against a set of files.
 */
export async function runLinterFix(
  linter: DetectedLinter,
  files: string[],
  cwd: string,
): Promise<LinterFixRunResult> {
  const name = linter.definition.name;
  const empty: LinterFixRunResult = { linter: name, fixed: [], errors: [] };

  if (!linter.definition.fixCommand) return empty;

  const relevantFiles = filterFilesByExtensions(files, linter.definition.extensions);
  if (relevantFiles.length === 0) return empty;

  const args = linter.definition.fixCommand(relevantFiles);
  const command = args[0];
  const commandArgs = args.slice(1);

  try {
    const result = await execCommand(command, commandArgs, {
      cwd,
      timeout: linter.definition.timeout,
      maxBuffer: 10 * 1024 * 1024,
    });
    if (result.exitCode === 0) {
      return { linter: name, fixed: relevantFiles, errors: [] };
    }
    return {
      linter: name,
      fixed: [],
      errors: [
        result.stderr.trim() || `Linter ${name} exited with code ${result.exitCode}`,
      ],
    };
  } catch (err) {
    return {
      linter: name,
      fixed: [],
      errors: [err instanceof Error ? err.message : String(err)],
    };
  }
}

/**
 * Run multiple linters' auto-fix commands in parallel.
 */
export async function runLintersFix(
  linters: DetectedLinter[],
  files: string[],
  cwd: string,
): Promise<LinterFixRunResult[]> {
  if (linters.length === 0 || files.length === 0) return [];
  return Promise.all(linters.map((linter) => runLinterFix(linter, files, cwd)));
}
