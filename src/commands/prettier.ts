/**
 * prettier command: Run prettier --check on files
 *
 * Checks if prettier is available (cached at registry level for the daemon
 * lifetime) and runs prettier --check on the specified files.
 *
 * Uses the formatter system (formatter-registry + formatter-runner)
 * but maintains the same output format for backward compatibility.
 */

import * as path from "node:path";
import { registerCommand } from "../daemon/server.js";
import { ok, err, sanitizeError } from "../formatting/output.js";
import { resolveFile } from "../utils/paths.js";
import { detectFormatters, getRelevantFormatters } from "../linting/formatter-registry.js";
import { runFormatterDiagnose } from "../linting/formatter-runner.js";

// ── Command Handler ────────────────────────────────────────────────────────

registerCommand("prettier", async (params, _manager, cwd) => {
  const files = params.files as string[] | undefined;
  const timeoutMs = typeof params.timeoutMs === "number" ? params.timeoutMs : undefined;

  if (!Array.isArray(files) || files.length === 0) {
    return err("Missing or empty 'files' parameter.", { files });
  }

  // Validate all file paths are within the workspace
  const safeFiles: string[] = [];
  for (const f of files) {
    try {
      safeFiles.push(resolveFile(f, cwd));
    } catch {
      return err(`Path traversal rejected: "${f}"`, { files });
    }
  }

  try {
    // 1. Detect available formatters (cached at registry level)
    const detected = await detectFormatters(cwd);
    if (detected.length === 0) {
      return ok("prettier: not available", { available: false, results: [] });
    }

    // 2. Filter to formatters relevant for the given files
    const relevantMap = getRelevantFormatters(detected, safeFiles);
    if (relevantMap.size === 0) {
      return ok("prettier: not available", { available: false, results: [] });
    }

    // 3. Run formatter diagnose mode (parallel, with per-formatter file lists)
    const allResultArrays = await Promise.all(
      [...relevantMap.entries()].map(([formatter, files]) =>
        runFormatterDiagnose(formatter, files, cwd, undefined, timeoutMs),
      ),
    );
    const allResults = allResultArrays.flat();

    // 4. Format output (maintain backward-compatible format)
    const needFormatting = allResults.filter((r) => r.changed);
    const errored = allResults.filter((r) => r.error);

    if (needFormatting.length > 0) {
      const fileNames = needFormatting.map((r) => path.relative(cwd, r.file) || r.file);
      return ok(
        `prettier: ${needFormatting.length} file(s) need formatting\n  ${fileNames.join("\n  ")}`,
        { results: allResults, available: true, needsFormatting: needFormatting.length },
      );
    }

    if (errored.length > 0) {
      return ok(
        `prettier: ${errored.length} file(s) had errors`,
        { results: allResults, available: true, errorCount: errored.length },
      );
    }

    if (allResults.length > 0) {
      return ok(
        `prettier: ${allResults.length} file(s) formatted correctly`,
        { results: allResults, available: true, needsFormatting: 0 },
      );
    }

    return ok("prettier: no supported files to check", { results: [], available: true });
  } catch (e) {
    return err(sanitizeError(e, "Failed to run prettier"), { files });
  }
});
