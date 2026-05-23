/**
 * Formatter runner — diagnose and fix modes
 *
 * Runs formatters (e.g., prettier) to detect or fix formatting issues.
 * Diagnose mode checks which files need formatting.
 * Fix mode applies formatting changes to disk.
 */

import * as path from "node:path";
import { execCommand } from "../utils/spawn.js";
import type { DetectedFormatter, FormatterResult } from "./types.js";

/**
 * Filter a list of file paths to those matching the formatter's supported extensions.
 */
function filterToSupportedExtensions(
  files: string[],
  extensions: string[],
): string[] {
  const extSet = new Set(extensions);
  return files.filter((f) => extSet.has(path.extname(f).toLowerCase()));
}

/**
 * Run a single formatter in diagnose mode (check only — does NOT write).
 *
 * - Exit code 0: all files are formatted correctly
 * - Exit code 1: some files need formatting (parse via definition.parseOutput)
 * - Other exit codes or errors: return error results
 */
export async function runFormatterDiagnose(
  formatter: DetectedFormatter,
  files: string[],
  cwd: string,
  signal?: AbortSignal,
  timeoutCap?: number,
): Promise<FormatterResult[]> {
  const supportedFiles = filterToSupportedExtensions(files, formatter.definition.extensions);
  if (supportedFiles.length === 0) return [];

  const args = formatter.definition.diagnoseCommand(supportedFiles);
  const command = args[0];
  const commandArgs = args.slice(1);
  const effectiveTimeout =
    timeoutCap != null
      ? Math.min(formatter.definition.timeout, timeoutCap)
      : formatter.definition.timeout;

  try {
    const result = await execCommand(command, commandArgs, {
      cwd,
      timeout: effectiveTimeout,
      signal,
      maxBuffer: 10 * 1024 * 1024,
    });

    if (result.exitCode === 0) {
      // All files are formatted correctly
      return supportedFiles.map((file) => ({
        source: formatter.definition.name,
        file,
        changed: false,
      }));
    }

    if (result.exitCode === 1 && result.stdout && result.stdout.trim()) {
      // Some files need formatting — parse stdout
      const diagnosed = formatter.definition.parseOutput(result.stdout, cwd);
      // Build a set of files that need formatting for quick lookup
      const needsFormatting = new Set(diagnosed.filter((r) => r.changed).map((r) => path.resolve(r.file)));
      return supportedFiles.map((file) => {
        const resolved = path.resolve(file);
        if (needsFormatting.has(resolved) || needsFormatting.has(file)) {
          return { source: formatter.definition.name, file, changed: true };
        }
        return { source: formatter.definition.name, file, changed: false };
      });
    }

    // Unexpected exit code — treat as error for all files
    return supportedFiles.map((file) => ({
      source: formatter.definition.name,
      file,
      changed: false,
      error: `formatter exited with code ${result.exitCode}: ${result.stderr.trim()}`,
    }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return supportedFiles.map((file) => ({
      source: formatter.definition.name,
      file,
      changed: false,
      error: message,
    }));
  }
}

/**
 * Run a single formatter in fix mode (writes changes to disk).
 *
 * - Exit code 0: all files fixed successfully
 * - Exit code non-zero: some files had errors
 */
export async function runFormatterFix(
  formatter: DetectedFormatter,
  files: string[],
  cwd: string,
  signal?: AbortSignal,
  timeoutCap?: number,
): Promise<FormatterResult[]> {
  const supportedFiles = filterToSupportedExtensions(files, formatter.definition.extensions);
  if (supportedFiles.length === 0) return [];

  const args = formatter.definition.fixCommand(supportedFiles);
  const command = args[0];
  const commandArgs = args.slice(1);
  const effectiveTimeout =
    timeoutCap != null
      ? Math.min(formatter.definition.timeout, timeoutCap)
      : formatter.definition.timeout;

  try {
    const result = await execCommand(command, commandArgs, {
      cwd,
      timeout: effectiveTimeout,
      signal,
      maxBuffer: 10 * 1024 * 1024,
    });

    if (result.exitCode === 0) {
      return supportedFiles.map((file) => ({
        source: formatter.definition.name,
        file,
        changed: true,
      }));
    }

    // Non-zero exit — some files had errors
    const errorMessage = result.stderr.trim() || `formatter exited with code ${result.exitCode}`;
    return supportedFiles.map((file) => ({
      source: formatter.definition.name,
      file,
      changed: false,
      error: errorMessage,
    }));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return supportedFiles.map((file) => ({
      source: formatter.definition.name,
      file,
      changed: false,
      error: message,
    }));
  }
}

/**
 * Run multiple formatters in diagnose mode, in parallel.
 * Each formatter only processes files matching its extensions.
 */
export async function runFormattersDiagnose(
  formatters: DetectedFormatter[],
  files: string[],
  cwd: string,
  signal?: AbortSignal,
  timeoutCap?: number,
): Promise<FormatterResult[]> {
  if (formatters.length === 0 || files.length === 0) return [];

  const results = await Promise.all(
    formatters.map((formatter) =>
      runFormatterDiagnose(formatter, files, cwd, signal, timeoutCap),
    ),
  );
  return results.flat();
}

/**
 * Run multiple formatters in fix mode, in parallel.
 * Each formatter only processes files matching its extensions.
 */
export async function runFormattersFix(
  formatters: DetectedFormatter[],
  files: string[],
  cwd: string,
  signal?: AbortSignal,
  timeoutCap?: number,
): Promise<FormatterResult[]> {
  if (formatters.length === 0 || files.length === 0) return [];

  const results = await Promise.all(
    formatters.map((formatter) =>
      runFormatterFix(formatter, files, cwd, signal, timeoutCap),
    ),
  );
  return results.flat();
}

/**
 * Format formatter results into a human-readable string.
 * Uses relative paths to avoid leaking absolute filesystem paths.
 */
export function formatFormatterResults(results: FormatterResult[], cwd?: string): string {
  if (results.length === 0) return "";

  const lines = results.map((r) => {
    const displayPath = cwd ? path.relative(cwd, r.file) || r.file : r.file;
    if (r.error) {
      return ` ❌ ${displayPath} — error: ${r.error}`;
    }
    return r.changed
      ? ` ❌ ${displayPath} — needs formatting`
      : ` ✅ ${displayPath} — formatted correctly`;
  });

  // Truncate output to prevent context overflow
  const MAX_LINES = 2000;
  const MAX_BYTES = 50 * 1024;
  let truncated = false;
  let result: string;
  if (lines.length > MAX_LINES) {
    result = lines.slice(0, MAX_LINES).join("\n");
    truncated = true;
  } else {
    result = lines.join("\n");
  }
  if (Buffer.byteLength(result, "utf-8") > MAX_BYTES) {
    result = result.slice(0, MAX_BYTES);
    truncated = true;
  }
  if (truncated) {
    result += "\n\n... (output truncated)";
  }

  // Append summary line — single-pass count
  let needFormatting = 0;
  let correct = 0;
  let errors = 0;
  for (const r of results) {
    if (r.error) errors++;
    else if (r.changed) needFormatting++;
    else correct++;
  }
  if (needFormatting > 0) {
    result += `\n${needFormatting} file(s) need formatting`;
  } else {
    result += `\n${correct} file(s) formatted correctly`;
  }
  if (errors > 0) {
    result += `, ${errors} file(s) had errors`;
  }

  return result;
}

/**
 * Produce a one-line summary of formatter results.
 */
export function summarizeFormatterResults(results: FormatterResult[]): string {
  if (results.length === 0) return "No formatter results.";

  let needFormatting = 0;
  let correct = 0;
  let errors = 0;
  for (const r of results) {
    if (r.error) errors++;
    else if (r.changed) needFormatting++;
    else correct++;
  }

  const parts: string[] = [];
  if (needFormatting > 0) parts.push(`${needFormatting} file(s) need formatting`);
  if (correct > 0) parts.push(`${correct} file(s) formatted correctly`);
  if (errors > 0) parts.push(`${errors} file(s) had errors`);

  return `Formatter Results: ${parts.join(", ")}`;
}
