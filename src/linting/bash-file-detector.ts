/**
 * Bash command file detector
 *
 * Detects which files are affected by a bash command by analyzing the command
 * string for common file-writing patterns (sed, cat, echo, tee, perl, awk,
 * python, dd, mv, cp, shell redirects).
 *
 * IMPORTANT: This is BEST-EFFORT detection. Bash command analysis is inherently
 * limited — it cannot handle:
 * - Arbitrary shell functions or aliases
 * - Complex variable expansion (e.g., `echo > $OUTFILE`)
 * - Commands inside subshells or eval strings
 * - Indirect file operations (e.g., `xargs -I{} mv {} {}.bak`)
 * - Tools not explicitly listed below
 *
 * When unsure whether a file is written or read, we conservatively include it
 * in the `written` set to avoid missing real changes.
 */

import * as path from "node:path";
import * as os from "node:os";

/** Result of detecting file paths from a bash command */
export interface DetectedBashFiles {
  /** Files that were likely created or modified */
  written: string[];
  /** Files that were likely read (informational) */
  read: string[];
}

/**
 * Expand tilde (`~` or `~/path`) to the user's home directory.
 */
function expandTilde(filePath: string): string {
  if (filePath === "~") return os.homedir();
  if (filePath.startsWith("~/")) {
    return path.join(os.homedir(), filePath.slice(2));
  }
  return filePath;
}

/**
 * Resolve a file path to an absolute path, handling tilde expansion.
 */
function resolvePath(filePath: string, cwd: string): string {
  const expanded = expandTilde(filePath);
  if (path.isAbsolute(expanded)) return path.normalize(expanded);
  return path.normalize(path.resolve(cwd, expanded));
}

/**
 * Extract a file path from a regex match group, stripping quotes and resolving.
 */
function extractFile(match: RegExpMatchArray, groupIndex: number, cwd: string): string | null {
  const raw = match[groupIndex];
  if (!raw) return null;
  // Strip surrounding quotes
  const stripped = raw.replace(/^['"]|['"]$/g, "").trim();
  if (!stripped) return null;
  return resolvePath(stripped, cwd);
}

/** Pattern definition: regex and which group(s) to extract */
interface PatternDef {
  regex: RegExp;
  /** Group indices to extract as written files */
  writtenGroups: number[];
  /** Group indices to extract as read files */
  readGroups: number[];
}

// ── Regex Patterns ──────────────────────────────────────────────────────────
// Each pattern matches a specific command that writes to files.
// All patterns use 'g' flag and are designed to match the relevant portion
// of a single command segment.

const PATTERNS: PatternDef[] = [
  // sed -i [flags] [expr] file  →  file is written in-place
  {
    // Match sed with -i flag (with optional extension like -i.bak)
    regex:
      /\bsed\s+(?:[^;|&>]*?)?-i(?:\s+[^\s;|&>]+)?\s+(?:[^;|&>]*?\s+)?['"]?([^\s;|&>'"]+)['"]?/g,
    writtenGroups: [1],
    readGroups: [],
  },

  // sed ... > file  →  file written via redirect (non -i case)
  {
    regex: /\bsed\s+[^;]*?\b>\s*['"]?([^\s;|&'"]+)['"]?/g,
    writtenGroups: [1],
    readGroups: [],
  },

  // cat > file / cat >> file (also handles heredoc: cat > file << EOF)
  {
    regex: /\bcat\s+(?:-[A-Za-z]+\s+)*>{1,2}\s*['"]?([^\s;|&'"]+)['"]?/g,
    writtenGroups: [1],
    readGroups: [],
  },

  // echo/printf ... > file / >> file
  {
    regex: /\b(?:echo|printf)\s+(?:[^;|&]*?)\s*>{1,2}\s*['"]?([^\s;|&'"]+)['"]?/g,
    writtenGroups: [1],
    readGroups: [],
  },

  // tee [-a] file  →  file written
  {
    regex: /\btee\s+(?:-[aA]+\s+)*['"]?([^\s;|&'"]+)['"]?/g,
    writtenGroups: [1],
    readGroups: [],
  },

  // perl -i ... file  →  file modified in-place
  {
    regex:
      /\bperl\s+(?:[^;|&>]*?)?-i(?:\.[^\s;|&>]*)?(?:\s+[^;|&>]*?)?\s+['"]?([^\s;|&>'"]+)['"]?/g,
    writtenGroups: [1],
    readGroups: [],
  },

  // awk ... > file
  {
    regex: /\bawk\s+[^;]*?\b>\s*['"]?([^\s;|&'"]+)['"]?/g,
    writtenGroups: [1],
    readGroups: [],
  },

  // python -c "..." > file  (or python3)
  {
    regex: /\bpython[23]?\s+-c\s+[^;]*?\b>\s*['"]?([^\s;|&'"]+)['"]?/g,
    writtenGroups: [1],
    readGroups: [],
  },

  // dd ... of=file ...
  {
    regex: /\bdd\s+[^;]*?\bof=\s*['"]?([^\s;|&'"]+)['"]?/g,
    writtenGroups: [1],
    readGroups: [],
  },

  // mv src dst  →  dst written, src removed
  {
    regex: /\bmv\s+(?:-[a-zA-Z]+\s+)*['"]?([^\s;|&'"]+)['"]?\s+['"]?([^\s;|&'"]+)['"]?/g,
    writtenGroups: [2],
    readGroups: [1],
  },

  // cp src dst  →  dst written
  {
    regex: /\bcp\s+(?:-[a-zA-Z]+\s+)*['"]?([^\s;|&'"]+)['"]?\s+['"]?([^\s;|&'"]+)['"]?/g,
    writtenGroups: [2],
    readGroups: [1],
  },
];

/**
 * Generic shell redirect pattern: > file or >> file at end of command segment.
 * This is a fallback catch-all for commands not matched above.
 */
const REDIRECT_PATTERN = /(?:^|[\s;|&(])>{1,2}\s*['"]?([^\s;|&)'"]+)['"]?/g;

/**
 * Split a command string into individual command segments.
 * Handles: &&, ;, | (pipe), and newline separators.
 * This is intentionally simple — complex nested subshells are not fully supported.
 */
function splitCommands(command: string): string[] {
  // Replace newlines with semicolons for uniform splitting
  const normalized = command.replace(/\n/g, "; ");
  // Split on &&, ;, and |
  return normalized
    .split(/\s*(?:&&|;|\|)\s*/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Detect file paths affected by a bash command.
 * Scans for common patterns: sed, cat, echo/tee, perl, awk, python, dd, mv, cp, redirects.
 * Returns absolute paths resolved against cwd.
 *
 * This is BEST-EFFORT — see module-level documentation for known limitations.
 */
export function detectFilesFromBashCommand(command: string, cwd: string): DetectedBashFiles {
  const written = new Set<string>();
  const read = new Set<string>();

  if (!command || command.trim().length === 0) {
    return { written: [], read: [] };
  }

  const segments = splitCommands(command);

  for (const segment of segments) {
    // Try each known command pattern
    let matchedBySpecificPattern = false;

    for (const pattern of PATTERNS) {
      pattern.regex.lastIndex = 0;
      let match: RegExpMatchArray | null;
      while ((match = pattern.regex.exec(segment)) !== null) {
        matchedBySpecificPattern = true;
        for (const gi of pattern.writtenGroups) {
          const f = extractFile(match, gi, cwd);
          if (f) written.add(f);
        }
        for (const gi of pattern.readGroups) {
          const f = extractFile(match, gi, cwd);
          if (f) read.add(f);
        }
      }
    }

    // If no specific pattern matched, try generic redirect
    if (!matchedBySpecificPattern) {
      REDIRECT_PATTERN.lastIndex = 0;
      let match: RegExpMatchArray | null;
      while ((match = REDIRECT_PATTERN.exec(segment)) !== null) {
        const f = extractFile(match, 1, cwd);
        if (f) written.add(f);
      }
    }
  }

  // Remove read files that are also in written
  for (const f of written) {
    read.delete(f);
  }

  return {
    written: Array.from(written),
    read: Array.from(read),
  };
}
