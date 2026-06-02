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
      // 1.5. Normalize backslashes to forward slashes (Windows)
      .replace(/\\/g, "/")
      // 2. Replace file:// URIs containing the fixture dir (after step 1 these are file://<ROOT>)
      //    No additional step needed — step 1 already handles the path inside URIs.
      // 3. Replace home directory paths (various platforms)
      .replace(/\/home\/[^/\s)"']+/g, "~")
      .replace(/\/Users\/[^/\s)"']+/g, "~")
      .replace(/\/root\b/g, "~")
      // 3.5. Normalize Windows home directory patterns (now using forward slashes)
      .replace(/[A-Za-z]:\/Users\/[^\/\s)"']+/g, "~")
      // 4. Replace PIDs — handles both `(pid: 12345)` and bare `pid: 12345`
      .replace(/\(pid: \d+\)/g, "(pid: <PID>)")
      .replace(/\bpid: \d+/g, "pid: <PID>")
      // 5. Normalize socket paths (derived from cwd hash)
      .replace(/code-lens-[a-f0-9]{16}\.sock/g, "code-lens-<HASH>.sock")
      .replace(/code-lens-[a-f0-9]{16}/g, "code-lens-<HASH>")
      // 6. Normalize other temp directory patterns
      .replace(/\/tmp\/code-lens-reg-[^/\s)"']+/g, "<TMPDIR>")
      .replace(/\/var\/folders\/[^/\s)"']+/g, "<TMPDIR>")
      // 6.5. Normalize Windows temp directory patterns (e.g., C:\\Users\\...\\AppData\\Local\\Temp)
      .replace(/[A-Za-z]:\/Users\/[^\/\s)"']+\/AppData\/Local\/Temp[^\s)"']*/g, "<TMPDIR>")
      // 7. Normalize timing values (e.g., "123ms", "45.6s")
      .replace(/\b\d+ms\b/g, "<TIME>")
      .replace(/\b\d+\.\d+s\b/g, "<TIME>")
      // 8. Normalize TypeScript version numbers in error messages
      //    e.g., "TypeScript Server Error (5.9.3)" → "TypeScript Server Error (<TS_VERSION>)"
      .replace(/TypeScript Server Error \(\d+\.\d+\.\d+\)/g, "TypeScript Server Error (<TS_VERSION>)")
      // 9. Normalize TypeScript file paths in stack traces
      //    e.g., "/path/to/typescript/lib/typescript.js:186170:11" → "<TS_PATH>/typescript.js:<LINE>:<COL>"
      .replace(/([^\s("']+\/typescript\.js):\d+:\d+/g, "$1:<LINE>:<COL>")
      .replace(/([^\s("']+\/_tsserver\.js):\d+:\d+/g, "$1:<LINE>:<COL>")
      // 10. Normalize all node_modules paths (npm-global, CI toolcache, etc.)
      .replace(/~\/\.npm-global\/lib\/node_modules/g, "<NODE_MODULES>")
      .replace(/\/opt\/hostedtoolcache\/node\/[^/]+\/x64\/lib\/node_modules/g, "<NODE_MODULES>")
      // 10.5. Normalize Windows global node_modules pattern (Roaming\npm\node_modules)
      .replace(/[A-Za-z]:\/Users\/[^\/\s)"']+\/AppData\/Roaming\/npm\/node_modules/g, "<NODE_MODULES>")
      // 11. Normalize Node.js internal line numbers (differ between versions)
      .replace(/(node:events):\d+:\d+/g, "$1:<LINE>:<COL>")
      .replace(/(node:internal\/child_process):\d+:\d+/g, "$1:<LINE>:<COL>")
      .replace(/(node:internal\/process\/task_queues):\d+:\d+/g, "$1:<LINE>:<COL>")
      // 12. Trim trailing whitespace on each line, then leading/trailing blank lines
      .split("\n")
      .map((line) => line.trimEnd())
      .join("\n")
      .trim()
  );
}

