/**
 * lint command: Run detected linters on files
 *
 * Detects available linters (cached at registry level for the daemon lifetime)
 * and runs relevant linters against the specified files.
 */

import { registerCommand } from "../daemon/server.js";
import { ok, err, sanitizeError } from "../formatting/output.js";
import { resolveFile } from "../utils/paths.js";
import { detectLinters, getRelevantLinters } from "../linting/linter-registry.js";
import { runLinters } from "../linting/linter-runner.js";
import { formatIssues, summarizeIssues } from "../linting/output-formatter.js";
import type { LintIssue } from "../linting/types.js";

// ── Command Handler ────────────────────────────────────────────────────────

registerCommand("lint", async (params, _manager, cwd) => {
  const files = params.files as string[] | undefined;
  const maxConcurrency = typeof params.maxConcurrency === "number" ? params.maxConcurrency : undefined;
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
    // 1. Detect available linters (cached at registry level)
    const detected = await detectLinters(cwd);
    if (detected.length === 0) {
      return ok("No linters detected.", { issues: [], linterCount: 0 });
    }

    // 2. Collect relevant linters for the given files
    const relevantMap = getRelevantLinters(detected, safeFiles);
    if (relevantMap.size === 0) {
      return ok("No linters match the provided files.", {
        issues: [],
        linterCount: detected.length,
        relevantCount: 0,
      });
    }

    const relevantLinters = [...relevantMap.keys()];

    // 3. Run linters
    const issues: LintIssue[] = await runLinters(
      relevantLinters,
      safeFiles,
      cwd,
      undefined,
      maxConcurrency,
      timeoutMs,
    );

    // 4. Format output
    const linterNames = relevantLinters.map((l) => l.definition.name);
    if (issues.length === 0) {
      return ok(
        `Lint: 0 issues (${linterNames.join(", ")})`,
        { issues: [], linterNames, linterCount: detected.length },
      );
    }

    const summary = summarizeIssues(issues);
    const formatted = formatIssues(issues, cwd);
    return ok(
      `Lint: ${summary}\n${formatted}`,
      { issues, linterNames, linterCount: detected.length },
    );
  } catch (e) {
    return err(sanitizeError(e, "Failed to run linters"), { files });
  }
});
