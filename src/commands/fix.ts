/**
 * fix command: Run formatter and linter fix modes, writing changes to disk
 *
 * Detects available formatters and linters (cached at registry level for the
 * daemon lifetime) and runs their fix commands against the specified files.
 */

import * as path from "node:path";
import { registerCommand } from "../daemon/server.js";
import { ok, err, sanitizeError } from "../formatting/output.js";
import { resolveFile } from "../utils/paths.js";
import { detectFormatters, getRelevantFormatters } from "../linting/formatter-registry.js";
import { runFormatterFix } from "../linting/formatter-runner.js";
import { detectLinters, getRelevantLinters } from "../linting/linter-registry.js";
import { runLinterFix, type LinterFixRunResult } from "../linting/linter-runner.js";

// ── File Validation ────────────────────────────────────────────────────────

/**
 * Parse and validate the files parameter.
 * Returns safe absolute paths or an error CommandResult.
 */
function parseAndValidateFiles(
  filesParam: unknown,
  cwd: string,
): { safeFiles: string[] } | { error: ReturnType<typeof err> } {
  if (!filesParam || typeof filesParam !== "string" || filesParam.trim().length === 0) {
    return { error: err("Missing or empty 'files' parameter.", { files: filesParam }) };
  }

  const rawFiles = filesParam.split(",").map((f) => f.trim()).filter((f) => f.length > 0);
  if (rawFiles.length === 0) {
    return { error: err("Missing or empty 'files' parameter.", { files: filesParam }) };
  }

  const safeFiles: string[] = [];
  for (const f of rawFiles) {
    try {
      safeFiles.push(resolveFile(f, cwd));
    } catch {
      return { error: err(`Path traversal rejected: "${f}"`, { files: rawFiles }) };
    }
  }
  return { safeFiles };
}

// ── Formatter Fix ──────────────────────────────────────────────────────────

interface FormatterFixOutput {
  lines: string[];
  fixedFiles: string[];
  errors: string[];
}

/**
 * Run formatter fixes and collect output lines, fixed files, and errors.
 * Uses the per-formatter file lists from getRelevantFormatters to avoid
 * redundant extension filtering in the runner.
 */
async function executeFormatterFixes(
  safeFiles: string[],
  cwd: string,
): Promise<FormatterFixOutput> {
  const result: FormatterFixOutput = { lines: [], fixedFiles: [], errors: [] };

  const detected = await detectFormatters(cwd);
  if (detected.length === 0) return result;

  const relevantMap = getRelevantFormatters(detected, safeFiles);
  if (relevantMap.size === 0) return result;

  // Run each formatter with only its matching files (from the Map entries)
  const formatterResults = (
    await Promise.all(
      [...relevantMap.entries()].map(([formatter, files]) =>
        runFormatterFix(formatter, files, cwd),
      ),
    )
  ).flat();
  if (formatterResults.length === 0) return result;

  result.lines.push("Formatters:");
  for (const r of formatterResults) {
    const displayPath = path.relative(cwd, r.file) || r.file;
    if (r.error) {
      result.lines.push(`  ❌ ${displayPath} — error: ${r.error}`);
      result.errors.push(r.error);
    } else if (r.changed) {
      result.lines.push(`  ✅ ${displayPath} — fixed`);
      result.fixedFiles.push(r.file);
    } else {
      result.lines.push(`  ✅ ${displayPath} — already formatted`);
    }
  }
  return result;
}

// ── Linter Fix ─────────────────────────────────────────────────────────────

interface LinterFixOutput {
  lines: string[];
  fixedFiles: string[];
  errors: string[];
}

/**
 * Run linter fixes and collect output lines, fixed files, and errors.
 * Uses the per-linter file lists from getRelevantLinters to avoid
 * redundant extension filtering in the runner.
 */
async function executeLinterFixes(
  safeFiles: string[],
  cwd: string,
): Promise<LinterFixOutput> {
  const result: LinterFixOutput = { lines: [], fixedFiles: [], errors: [] };

  const detected = await detectLinters(cwd);
  if (detected.length === 0) return result;

  const relevantMap = getRelevantLinters(detected, safeFiles);
  // Filter to linters that have a fix command and build entries with their matching files
  const fixableEntries = [...relevantMap.entries()]
    .filter(([linter]) => linter.definition.fixCommand !== undefined);
  if (fixableEntries.length === 0) return result;

  // Run each linter with only its matching files (from the Map entries)
  const linterResults: LinterFixRunResult[] = await Promise.all(
    fixableEntries.map(([linter, files]) =>
      runLinterFix(linter, files, cwd),
    ),
  );
  if (linterResults.length === 0) return result;

  result.lines.push("Linters:");
  for (const r of linterResults) {
    for (const f of r.fixed) {
      const displayPath = path.relative(cwd, f) || f;
      result.lines.push(`  ✅ ${displayPath} — fixed (${r.linter})`);
      result.fixedFiles.push(f);
    }
    for (const e of r.errors) {
      result.lines.push(`  ❌ ${r.linter} — error: ${e}`);
      result.errors.push(e);
    }
  }
  return result;
}

// ── Command Handler ────────────────────────────────────────────────────────

registerCommand("fix", async (params, _manager, cwd) => {
  const runFormatters = typeof params.formatters === "boolean" ? params.formatters : true;
  const runLinters = typeof params.linters === "boolean" ? params.linters : true;

  // Parse and validate files
  const parsed = parseAndValidateFiles(params.files, cwd);
  if ("error" in parsed) return parsed.error;
  const { safeFiles } = parsed;

  try {
    // Run formatter and linter fixes in parallel
    const [fmtResult, lintResult] = await Promise.all([
      runFormatters ? executeFormatterFixes(safeFiles, cwd) : Promise.resolve(null),
      runLinters ? executeLinterFixes(safeFiles, cwd) : Promise.resolve(null),
    ]);

    const outputLines: string[] = [];
    const fixedFiles: string[] = [];
    const errors: string[] = [];

    if (fmtResult) {
      outputLines.push(...fmtResult.lines);
      fixedFiles.push(...fmtResult.fixedFiles);
      errors.push(...fmtResult.errors);
    }

    if (lintResult) {
      outputLines.push(...lintResult.lines);
      fixedFiles.push(...lintResult.fixedFiles);
      errors.push(...lintResult.errors);
    }

    // Summary
    const uniqueFixed = [...new Set(fixedFiles)];
    outputLines.push(`${uniqueFixed.length} file(s) fixed, ${errors.length} error(s)`);

    return ok(
      outputLines.join("\n"),
      { fixedFiles: uniqueFixed, errors },
    );
  } catch (e) {
    return err(sanitizeError(e, "Failed to run fix"), { files: safeFiles });
  }
});
