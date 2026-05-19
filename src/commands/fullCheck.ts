/**
 * fullCheck command: Run all checks concurrently
 *
 * Runs prettier, linters, LSP diagnostics, and tsc checks concurrently.
 * This is the primary command pi-lens calls in Phase 2+.
 * Each check is gated by its config flag and availability.
 */

import * as path from "node:path";
import { registerCommand } from "../daemon/server.js";
import type { LspManager } from "../lsp/lsp-manager.js";
import { languageFromPath } from "../lsp/language-config.js";
import { countSeverities } from "../formatting/diagnostics.js";
import type { Diagnostic } from "vscode-languageserver-types";
import { ok, err, sanitizeError } from "../formatting/output.js";
import { resolveFile } from "../utils/paths.js";
import { detectLinters, getLintersForFile } from "../linting/linter-registry.js";
import { runLinters } from "../linting/linter-runner.js";
import { isPrettierAvailable, runPrettier } from "../linting/prettier-runner.js";
import { isTscAvailable, runTsc } from "../linting/tsc-runner.js";
import { formatIssues, summarizeIssues } from "../linting/output-formatter.js";
import type { DetectedLinter, LintIssue, PrettierResult, TscIssue, CheckStatus } from "../linting/types.js";

// ── Module-level Cache ─────────────────────────────────────────────────────

let cachedLinters: DetectedLinter[] | null = null;
let cachedPrettierAvailable: boolean | null = null;
let cachedTscAvailable: boolean | null = null;
let cachedCwd: string | null = null;

async function ensureCache(cwd: string): Promise<{ linters: DetectedLinter[]; prettierAvailable: boolean; tscAvailable: boolean }> {
  if (cachedCwd === cwd && cachedLinters !== null && cachedPrettierAvailable !== null && cachedTscAvailable !== null) {
    return { linters: cachedLinters, prettierAvailable: cachedPrettierAvailable, tscAvailable: cachedTscAvailable };
  }

  // Only re-detect what hasn't been cached yet or if cwd changed
  if (cachedCwd !== cwd) {
    // cwd changed — invalidate everything
    cachedLinters = null;
    cachedPrettierAvailable = null;
    cachedTscAvailable = null;
    cachedCwd = cwd;
  }

  const [linters, prettier, tsc] = await Promise.all([
    cachedLinters ?? detectLinters(cwd),
    cachedPrettierAvailable ?? isPrettierAvailable(cwd),
    cachedTscAvailable ?? isTscAvailable(cwd),
  ]);

  cachedLinters = linters;
  cachedPrettierAvailable = prettier;
  cachedTscAvailable = tsc;

  return { linters, prettierAvailable: prettier, tscAvailable: tsc };
}

/**
 * Invalidate all caches (e.g., after config changes).
 * Exported for use by other commands if needed.
 */
export function invalidateFullCheckCache(): void {
  cachedLinters = null;
  cachedPrettierAvailable = null;
  cachedTscAvailable = null;
  cachedCwd = null;
}

// ── Types ──────────────────────────────────────────────────────────────────

/** Per-check status */
interface CheckResult {
  section: string | null;
  status: CheckStatus;
  hasIssues: boolean;
}

/** Full check config passed in params */
interface FullCheckConfig {
  prettier?: boolean;
  linters?: boolean;
  lsp?: boolean;
  tsc?: boolean;
  lspDelayMs?: number;
  maxConcurrency?: number;
  prettierTimeoutMs?: number;
  linterTimeoutMs?: number;
  tscTimeoutMs?: number;
}

// ── Command Handler ────────────────────────────────────────────────────────

registerCommand("fullCheck", async (params, manager, cwd) => {
  const startTime = Date.now();
  const files = params.files as string[] | undefined;
  const config = (params.config ?? {}) as FullCheckConfig;

  if (!Array.isArray(files) || files.length === 0) {
    return err("Missing or empty 'files' parameter.", { files });
  }

  const safeFilesResult = validateAndResolveFiles(files, cwd);
  if (!Array.isArray(safeFilesResult)) return safeFilesResult;
  const safeFiles = safeFilesResult;

  try {
    const { linters, prettierAvailable, tscAvailable } = await ensureCache(cwd);

    const [prettierResult, linterResult, lspResult, tscResult] = await Promise.all([
      runPrettierCheck(safeFiles, cwd, config, prettierAvailable),
      runLinterCheck(safeFiles, cwd, config, linters),
      runLspCheck(safeFiles, cwd, config, manager),
      runTscCheck(safeFiles, cwd, config, tscAvailable),
    ]);

    const { sections, statuses, hasIssues } = collectResults(
      prettierResult, linterResult, lspResult, tscResult,
    );

    const durationMs = Date.now() - startTime;
    const details: Record<string, unknown> = {
      statuses,
      hasIssues,
      fileCount: safeFiles.length,
      durationMs,
    };

    const text = sections.length > 0
      ? sections.join("\n")
      : "All checks passed (no issues found).";

    return ok(text, details);
  } catch (e) {
    return err(sanitizeError(e, "Failed to run full check"), { files });
  }
});

// ── Individual Check Runners ───────────────────────────────────────────────

interface PrettierCheckResult extends CheckResult {
  results?: PrettierResult[];
}

async function runPrettierCheck(
  files: string[],
  cwd: string,
  config: FullCheckConfig,
  prettierAvailable: boolean,
): Promise<PrettierCheckResult> {
  if (!config.prettier) return { section: null, status: "skipped", hasIssues: false };
  if (!prettierAvailable) return { section: null, status: "skipped", hasIssues: false };

  try {
    const results = await runPrettier(files, cwd, undefined, config.prettierTimeoutMs);
    const needFormatting = results.filter((r) => r.changed);
    const errored = results.filter((r) => r.error);

    if (needFormatting.length > 0) {
      const fileNames = needFormatting.map((r) => path.relative(cwd, r.file) || r.file);
      return {
        section: `  ⚠ prettier: ${needFormatting.length} file(s) need formatting\n    ${fileNames.join("\n    ")}`,
        status: "issues",
        hasIssues: true,
        results,
      };
    }

    if (errored.length > 0) {
      return {
        section: `  ⚠ prettier: ${errored.length} file(s) had errors`,
        status: "error",
        hasIssues: false,
        results,
      };
    }

    if (results.length > 0) {
      return {
        section: `  ✅ prettier: ${results.length} file(s) formatted correctly`,
        status: "clean",
        hasIssues: false,
        results,
      };
    }

    return { section: null, status: "clean", hasIssues: false, results: [] };
  } catch {
    return { section: "  ⚠ prettier: check failed", status: "error", hasIssues: false };
  }
}

interface LinterCheckResult extends CheckResult {
  issues?: LintIssue[];
}

async function runLinterCheck(
  files: string[],
  cwd: string,
  config: FullCheckConfig,
  detectedLinters: DetectedLinter[],
): Promise<LinterCheckResult> {
  if (!config.linters || detectedLinters.length === 0) {
    return { section: null, status: "skipped", hasIssues: false };
  }

  // Get relevant linters for these files
  const relevantLinters = getRelevantLinters(files, detectedLinters);
  if (relevantLinters.length === 0) {
    return { section: null, status: "skipped", hasIssues: false };
  }

  try {
    const issues = await runLinters(
      relevantLinters,
      files,
      cwd,
      undefined,
      config.maxConcurrency,
      config.linterTimeoutMs,
    );

    if (issues.length > 0) {
      const summary = summarizeIssues(issues);
      const formatted = formatIssues(issues, cwd);
      return {
        section: `  ⚠ ${summary}\n${formatted}`,
        status: "issues",
        hasIssues: true,
        issues,
      };
    }

    return { section: "  ✅ linters: 0 issues", status: "clean", hasIssues: false, issues: [] };
  } catch {
    return { section: "  ⚠ linters: check failed", status: "error", hasIssues: false };
  }
}

interface LspCheckResult extends CheckResult {
  diagnostics?: { file: string; diagnostics: Diagnostic[] }[];
}

async function runLspCheck(
  files: string[],
  cwd: string,
  config: FullCheckConfig,
  manager: LspManager,
): Promise<LspCheckResult> {
  if (!config.lsp) return { section: null, status: "skipped", hasIssues: false };

  const filesWithLanguage = files.filter((f) => languageFromPath(f) !== undefined);
  if (filesWithLanguage.length === 0) {
    return { section: null, status: "skipped", hasIssues: false };
  }

  try {
    // Notify the LSP manager about changed files
    await Promise.all(filesWithLanguage.map(f => manager.onFileChanged(f)));

    // Wait for diagnostics to settle
    const delayMs = config.lspDelayMs ?? 500;
    await sleep(delayMs);

    // Collect diagnostics
    const allDiags: { file: string; diagnostics: Diagnostic[] }[] = [];
    for (const file of filesWithLanguage) {
      const diagnostics = await manager.getDiagnostics(file, true);
      if (diagnostics.length > 0) {
        allDiags.push({ file, diagnostics });
      }
    }

    if (allDiags.length === 0) {
      return { section: "  ✅ lsp: 0 diagnostics", status: "clean", hasIssues: false };
    }

    const totalDiags = allDiags.reduce((sum, d) => sum + d.diagnostics.length, 0);
    const { errors, warnings } = countSeverities(allDiags.flatMap((d) => d.diagnostics));

    const diagLines = formatDiagnosticSections(allDiags, cwd);
    return {
      section: `  ⚠ lsp: ${totalDiags} diagnostic(s) (${errors} error(s), ${warnings} warning(s))\n${diagLines}`,
      status: "issues",
      hasIssues: true,
      diagnostics: allDiags,
    };
  } catch {
    return { section: "  ⚠ lsp: check failed", status: "error", hasIssues: false };
  }
}

interface TscCheckResult extends CheckResult {
  issues?: TscIssue[];
}

async function runTscCheck(
  files: string[],
  cwd: string,
  config: FullCheckConfig,
  tscAvailable: boolean,
): Promise<TscCheckResult> {
  if (!config.tsc) return { section: null, status: "skipped", hasIssues: false };
  if (!tscAvailable) return { section: null, status: "skipped", hasIssues: false };

  const tsFiles = filterToTsFiles(files);
  if (tsFiles.length === 0) return { section: null, status: "skipped", hasIssues: false };

  try {
    const tscResult = await runTsc(cwd, tsFiles, undefined, config.tscTimeoutMs);

    if (tscResult.error) {
      return { section: `  ⚠ tsc: ${tscResult.error}`, status: "error", hasIssues: false };
    }

    if (tscResult.issues.length === 0) {
      return { section: "  ✅ tsc: 0 errors", status: "clean", hasIssues: false, issues: [] };
    }

    const errorCount = tscResult.issues.filter((i) => i.severity === "error").length;
    const warningCount = tscResult.issues.filter((i) => i.severity === "warning").length;
    const issueLines = formatTscIssues(tscResult.issues, cwd);
    return {
      section: `  ⚠ tsc: ${errorCount} error(s), ${warningCount} warning(s)\n${issueLines}`,
      status: "issues",
      hasIssues: true,
      issues: tscResult.issues,
    };
  } catch {
    return { section: "  ⚠ tsc: check failed", status: "error", hasIssues: false };
  }
}

// ── Internal Helpers ───────────────────────────────────────────────────────

/** Validate and resolve file paths, returning safe absolute paths or an error result. */
function validateAndResolveFiles(files: string[], cwd: string): string[] | ReturnType<typeof err> {
  const safeFiles: string[] = [];
  for (const f of files) {
    try {
      safeFiles.push(resolveFile(f, cwd));
    } catch {
      return err(`Path traversal rejected: "${f}"`, { files });
    }
  }
  return safeFiles;
}

/** Aggregate check results into sections, statuses, and an hasIssues flag. */
function collectResults(
  prettierResult: CheckResult,
  linterResult: CheckResult,
  lspResult: CheckResult,
  tscResult: CheckResult,
): { sections: string[]; statuses: Record<string, CheckStatus>; hasIssues: boolean } {
  const sections: string[] = [];
  const statuses: Record<string, CheckStatus> = {};
  let hasIssues = false;

  const allResults: [string, CheckResult][] = [
    ["prettier", prettierResult],
    ["linters", linterResult],
    ["lsp", lspResult],
    ["tsc", tscResult],
  ];

  for (const [key, result] of allResults) {
    statuses[key] = result.status;
    if (result.section) sections.push(result.section);
    if (result.hasIssues) hasIssues = true;
  }

  return { sections, statuses, hasIssues };
}

/** Get all linters relevant for at least one of the given files */
function getRelevantLinters(files: string[], detected: DetectedLinter[]): DetectedLinter[] {
  const relevant = new Set<string>();
  const result: DetectedLinter[] = [];
  for (const file of files) {
    for (const linter of getLintersForFile(file, detected)) {
      if (!relevant.has(linter.definition.name)) {
        relevant.add(linter.definition.name);
        result.push(linter);
      }
    }
  }
  return result;
}

/** Filter files to TypeScript/JavaScript extensions */
function filterToTsFiles(files: string[]): string[] {
  const tsExts = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
  return files.filter((f) => tsExts.has(path.extname(f).toLowerCase()));
}

/** Sleep for a given duration */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Format LSP diagnostic sections for output */
function formatDiagnosticSections(
  allDiags: { file: string; diagnostics: Diagnostic[] }[],
  cwd: string,
): string {
  return allDiags
    .map(({ file, diagnostics }) => {
      const relativePath = path.relative(cwd, file) || file;
      return diagnostics
        .slice(0, 20)
        .map((d) => {
          const icon = d.severity === 1 ? "✗" : d.severity === 2 ? "⚠" : "ℹ";
          const line = d.range.start.line + 1;
          const col = d.range.start.character + 1;
          const msg = d.message.split("\n")[0];
          return `    ${icon} ${relativePath}:${line}:${col}: ${msg}`;
        })
        .join("\n");
    })
    .join("\n");
}

/** Format TSC issues for output */
function formatTscIssues(
  issues: { file: string; line: number; column: number; severity: string; message: string; code?: string }[],
  cwd: string,
): string {
  return issues
    .slice(0, 50)
    .map((i) => {
      const icon = i.severity === "error" ? "✗" : "⚠";
      const relativePath = path.relative(cwd, i.file) || i.file;
      return `    ${icon} ${relativePath}:${i.line}:${i.column}: ${i.message} (${i.code ?? "TS"})`;
    })
    .join("\n");
}
