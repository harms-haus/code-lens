/**
 * prettier command: Run prettier --check on files
 *
 * Checks if prettier is available (cached at module level for the daemon
 * lifetime) and runs prettier --check on the specified files.
 */

import * as path from "node:path";
import { registerCommand } from "../daemon/server.js";
import { ok, err, sanitizeError } from "../formatting/output.js";
import { resolveFile } from "../utils/paths.js";
import { isPrettierAvailable, runPrettier } from "../linting/prettier-runner.js";
import type { PrettierResult } from "../linting/types.js";

// ── Module-level Cache ─────────────────────────────────────────────────────

/** Cached prettier availability (persists across daemon calls) */
let cachedPrettierAvailable: boolean | null = null;
/** The cwd used for the last check (invalidate if cwd changes) */
let cachedCwd: string | null = null;

/**
 * Check if prettier is available, using cache when possible.
 * Re-checks if the cwd changes or cache is empty.
 */
async function checkPrettierAvailable(cwd: string): Promise<boolean> {
  if (cachedPrettierAvailable !== null && cachedCwd === cwd) {
    return cachedPrettierAvailable;
  }
  cachedPrettierAvailable = await isPrettierAvailable(cwd);
  cachedCwd = cwd;
  return cachedPrettierAvailable;
}

/**
 * Invalidate the prettier cache.
 * Exported for use by other commands if needed.
 */
export function invalidatePrettierCache(): void {
  cachedPrettierAvailable = null;
  cachedCwd = null;
}

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
    // 1. Check if prettier is available (cached)
    const available = await checkPrettierAvailable(cwd);
    if (!available) {
      return ok("prettier: not available", { available: false, results: [] });
    }

    // 2. Run prettier --check
    const results: PrettierResult[] = await runPrettier(
      safeFiles,
      cwd,
      undefined,
      timeoutMs,
    );

    // 3. Format output
    const needFormatting = results.filter((r) => r.changed);
    const errored = results.filter((r) => r.error);

    if (needFormatting.length > 0) {
      const fileNames = needFormatting.map((r) => path.relative(cwd, r.file) || r.file);
      return ok(
        `prettier: ${needFormatting.length} file(s) need formatting\n  ${fileNames.join("\n  ")}`,
        { results, available: true, needsFormatting: needFormatting.length },
      );
    }

    if (errored.length > 0) {
      return ok(
        `prettier: ${errored.length} file(s) had errors`,
        { results, available: true, errorCount: errored.length },
      );
    }

    if (results.length > 0) {
      return ok(
        `prettier: ${results.length} file(s) formatted correctly`,
        { results, available: true, needsFormatting: 0 },
      );
    }

    return ok("prettier: no supported files to check", { results: [], available: true });
  } catch (e) {
    return err(sanitizeError(e, "Failed to run prettier"), { files });
  }
});
