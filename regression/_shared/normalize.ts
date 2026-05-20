/**
 * Output normalization for snapshot comparison.
 *
 * Replaces environment-specific values (absolute paths, PIDs, temp dirs,
 * timing values) with stable placeholders so snapshots are reproducible
 * across different machines and runs.
 */

import type { NormalizeOptions } from "./types.js";

/**
 * Normalize CLI output for snapshot comparison.
 *
 * Replacement order matters: paths first (so embedded URIs get normalized),
 * then PIDs, then timing, then whitespace cleanup.
 */
export function normalizeOutput(output: string, options: NormalizeOptions): string {
  // Escape the fixture dir for use in regex (handles paths with dots, parens, etc.)
  const escapedDir = options.fixtureDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return (
    output
      // 1. Replace absolute fixture dir with <ROOT>
      .replace(new RegExp(escapedDir, "g"), "<ROOT>")
      // 2. Replace file:// URIs containing the fixture dir (after step 1 these are file://<ROOT>)
      //    No additional step needed — step 1 already handles the path inside URIs.
      // 3. Replace home directory paths (various platforms)
      .replace(/\/home\/[^/\s)"']+/g, "~")
      .replace(/\/Users\/[^/\s)"']+/g, "~")
      .replace(/\/root\b/g, "~")
      // 4. Replace PIDs — handles both `(pid: 12345)` and bare `pid: 12345`
      .replace(/\(pid: \d+\)/g, "(pid: <PID>)")
      .replace(/\bpid: \d+/g, "pid: <PID>")
      // 5. Normalize socket paths (derived from cwd hash)
      .replace(/code-lens-[a-f0-9]{16}\.sock/g, "code-lens-<HASH>.sock")
      .replace(/code-lens-[a-f0-9]{16}/g, "code-lens-<HASH>")
      // 6. Normalize other temp directory patterns
      .replace(/\/tmp\/code-lens-reg-[^/\s)"']+/g, "<TMPDIR>")
      .replace(/\/var\/folders\/[^/\s)"']+/g, "<TMPDIR>")
      // 7. Normalize timing values (e.g., "123ms", "45.6s")
      .replace(/\b\d+ms\b/g, "<TIME>")
      .replace(/\b\d+\.\d+s\b/g, "<TIME>")
      // 8. Normalize line numbers in diff output that may shift
      //    (not applied — line numbers are deterministic for fixed fixtures)
      // 9. Trim trailing whitespace on each line, then leading/trailing blank lines
      .split("\n")
      .map((line) => line.trimEnd())
      .join("\n")
      .trim()
  );
}

