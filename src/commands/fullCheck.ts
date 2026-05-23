/**
 * fullCheck command: Run all checks concurrently
 *
 * Runs prettier, linters, and LSP diagnostics concurrently.
 * This is the primary command pi-lens calls in Phase 2+.
 * Each check is gated by its config flag and availability.
 *
 * Linter and formatter detection is cached at the registry level
 * (linter-registry / formatter-registry), so no command-level cache
 * is needed here.
 */

import * as path from "node:path";
import { registerCommand } from "../daemon/server.js";
import type { LspManager } from "../lsp/lsp-manager.js";
import { languageFromPath } from "../lsp/language-config.js";
import { countSeverities } from "../formatting/diagnostics.js";
import type { Diagnostic } from "vscode-languageserver-types";
import { ok, err, sanitizeError } from "../formatting/output.js";
import { resolveFile } from "../utils/paths.js";
import { detectLinters, getRelevantLinters } from "../linting/linter-registry.js";
import { runLinter } from "../linting/linter-runner.js";
import { detectFormatters, getRelevantFormatters } from "../linting/formatter-registry.js";
import { runFormatterDiagnose } from "../linting/formatter-runner.js";
import { formatIssues, summarizeIssues } from "../linting/output-formatter.js";
import type { DetectedLinter, DetectedFormatter, LintIssue, FormatterResult, CheckStatus } from "../linting/types.js";

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
  lspDelayMs?: number;
  maxConcurrency?: number;
  prettierTimeoutMs?: number;
  linterTimeoutMs?: number;
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
    const [linters, formatters] = await Promise.all([
      detectLinters(cwd),
      detectFormatters(cwd),
    ]);

    const [prettierResult, linterResult, lspResult] = await Promise.all([
      runPrettierCheck(safeFiles, cwd, config, formatters),
      runLinterCheck(safeFiles, cwd, config, linters),
      runLspCheck(safeFiles, cwd, config, manager),
    ]);

    const { sections, statuses, hasIssues } = collectResults(
      prettierResult, linterResult, lspResult,
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
  results?: FormatterResult[];
}

async function runPrettierCheck(
  files: string[],
  cwd: string,
  config: FullCheckConfig,
  detectedFormatters: DetectedFormatter[],
): Promise<PrettierCheckResult> {
  if (!config.prettier) return { section: null, status: "skipped", hasIssues: false };
  if (detectedFormatters.length === 0) return { section: null, status: "skipped", hasIssues: false };

  // Filter to formatters relevant for the given files
  const relevantMap = getRelevantFormatters(detectedFormatters, files);
  if (relevantMap.size === 0) return { section: null, status: "skipped", hasIssues: false };

  try {
    const allResultArrays = await Promise.all(
      [...relevantMap.entries()].map(([formatter, formatterFiles]) =>
        runFormatterDiagnose(formatter, formatterFiles, cwd, undefined, config.prettierTimeoutMs),
      ),
    );
    const allResults = allResultArrays.flat();

    const needFormatting = allResults.filter((r) => r.changed);
    const errored = allResults.filter((r) => r.error);

    if (needFormatting.length > 0) {
      const fileNames = needFormatting.map((r) => path.relative(cwd, r.file) || r.file);
      return {
        section: `  ⚠ prettier: ${needFormatting.length} file(s) need formatting\n    ${fileNames.join("\n    ")}`,
        status: "issues",
        hasIssues: true,
        results: allResults,
      };
    }

    if (errored.length > 0) {
      return {
        section: `  ⚠ prettier: ${errored.length} file(s) had errors`,
        status: "error",
        hasIssues: false,
        results: allResults,
      };
    }

    if (allResults.length > 0) {
      return {
        section: `  ✅ prettier: ${allResults.length} file(s) formatted correctly`,
        status: "clean",
        hasIssues: false,
        results: allResults,
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
  const relevantMap = getRelevantLinters(detectedLinters, files);
  if (relevantMap.size === 0) {
    return { section: null, status: "skipped", hasIssues: false };
  }

  try {
    const issueArrays = await Promise.all(
      [...relevantMap.entries()].map(([linter, linterFiles]) =>
        runLinter(linter, linterFiles, cwd, undefined, config.linterTimeoutMs),
      ),
    );
    const issues = issueArrays.flat();

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
): { sections: string[]; statuses: Record<string, CheckStatus>; hasIssues: boolean } {
  const sections: string[] = [];
  const statuses: Record<string, CheckStatus> = {};
  let hasIssues = false;

  const allResults: [string, CheckResult][] = [
    ["prettier", prettierResult],
    ["linters", linterResult],
    ["lsp", lspResult],
  ];

  for (const [key, result] of allResults) {
    statuses[key] = result.status;
    if (result.section) sections.push(result.section);
    if (result.hasIssues) hasIssues = true;
  }

  return { sections, statuses, hasIssues };
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
