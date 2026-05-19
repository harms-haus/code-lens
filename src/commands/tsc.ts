/**
 * tsc command: Run TypeScript type checking
 *
 * Checks if tsc is available (cached at module level for the daemon
 * lifetime) and runs tsc --noEmit, filtering results to the specified files.
 */

import * as path from "node:path";
import { registerCommand } from "../daemon/server.js";
import { ok, err, sanitizeError } from "../formatting/output.js";
import { resolveFile } from "../utils/paths.js";
import { isTscAvailable, runTsc } from "../linting/tsc-runner.js";
import type { TscIssue } from "../linting/types.js";

// ── Module-level Cache ─────────────────────────────────────────────────────

/** Cached tsc availability (persists across daemon calls) */
let cachedTscAvailable: boolean | null = null;
/** The cwd used for the last check (invalidate if cwd changes) */
let cachedCwd: string | null = null;

/**
 * Check if tsc is available, using cache when possible.
 * Re-checks if the cwd changes or cache is empty.
 */
async function checkTscAvailable(cwd: string): Promise<boolean> {
  if (cachedTscAvailable !== null && cachedCwd === cwd) {
    return cachedTscAvailable;
  }
  cachedTscAvailable = await isTscAvailable(cwd);
  cachedCwd = cwd;
  return cachedTscAvailable;
}

/**
 * Invalidate the tsc cache.
 * Exported for use by other commands if needed.
 */
export function invalidateTscCache(): void {
  cachedTscAvailable = null;
  cachedCwd = null;
}

// ── Command Handler ────────────────────────────────────────────────────────

registerCommand("tsc", async (params, _manager, cwd) => {
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
    // 1. Check if tsc is available (cached)
    const available = await checkTscAvailable(cwd);
    if (!available) {
      return ok("tsc: not available", { available: false, issues: [] });
    }

    // 2. Filter to TypeScript/JavaScript files
    const tsFiles = filterToTsFiles(safeFiles);
    if (tsFiles.length === 0) {
      return ok("tsc: no TypeScript files to check", { available: true, issues: [] });
    }

    // 3. Run tsc --noEmit
    const tscResult = await runTsc(cwd, tsFiles, undefined, timeoutMs);

    if (tscResult.error) {
      return ok(
        `tsc: ${tscResult.error}`,
        { available: true, issues: [], error: tscResult.error, durationMs: tscResult.durationMs },
      );
    }

    // 4. Format output
    const issues: TscIssue[] = tscResult.issues;
    if (issues.length === 0) {
      return ok(
        `tsc: 0 errors (${tscResult.durationMs}ms)`,
        { available: true, issues: [], durationMs: tscResult.durationMs },
      );
    }

    const errorCount = issues.filter((i) => i.severity === "error").length;
    const warningCount = issues.filter((i) => i.severity === "warning").length;
    const issueLines = formatTscIssues(issues, cwd);
    return ok(
      `tsc: ${errorCount} error(s), ${warningCount} warning(s) (${tscResult.durationMs}ms)\n${issueLines}`,
      { available: true, issues, durationMs: tscResult.durationMs },
    );
  } catch (e) {
    return err(sanitizeError(e, "Failed to run tsc"), { files });
  }
});

// ── Internal Helpers ───────────────────────────────────────────────────────

/** Filter files to TypeScript/JavaScript extensions */
function filterToTsFiles(files: string[]): string[] {
  const tsExts = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);
  return files.filter((f) => tsExts.has(path.extname(f).toLowerCase()));
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
      return `  ${icon} ${relativePath}:${i.line}:${i.column}: ${i.message} (${i.code ?? "TS"})`;
    })
    .join("\n");
}
