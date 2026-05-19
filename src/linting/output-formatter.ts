/**
 * Output formatting utilities for lint issues
 */

import * as path from "node:path";
import type { LintIssue } from "./types.js";

// ═══════════════════════════════════════════════════════════════════════
// Linter Issue Formatting
// ═══════════════════════════════════════════════════════════════════════

/**
 * Format a list of lint issues into a human-readable string.
 * Uses relative paths to avoid leaking absolute filesystem paths.
 */
export function formatIssues(issues: LintIssue[], cwd?: string): string {
  if (issues.length === 0) return "";
  const icons: Record<string, string> = {
    error: "✗",
    warning: "⚠",
    info: "ℹ",
  };
  const lines = issues.map((issue) => {
    const icon = icons[issue.severity] || "·";
    const displayPath = cwd ? path.relative(cwd, issue.file) || issue.file : issue.file;
    const code = issue.code ? ` (${issue.code})` : "";
    const source = issue.source ? ` [${issue.source}]` : "";
    return ` ${icon} ${displayPath}:${issue.line}:${issue.column}: ${issue.message}${code}${source}`;
  });
  // Truncate output to prevent context overflow
  const MAX_LINES = 2000;
  const MAX_BYTES = 50 * 1024;
  let truncated = false;
  let result: string;
  if (lines.length > MAX_LINES) {
    result = lines.slice(0, MAX_LINES).join("\n");
    truncated = true;
  } else {
    result = lines.join("\n");
  }
  if (Buffer.byteLength(result, "utf-8") > MAX_BYTES) {
    result = result.slice(0, MAX_BYTES);
    truncated = true;
  }
  if (truncated) {
    result += "\n\n... (output truncated)";
  }
  return result;
}

/**
 * Produce a one-line summary of lint issues.
 */
export function summarizeIssues(issues: LintIssue[]): string {
  if (issues.length === 0) return "No lint issues found.";
  let errors = 0,
    warnings = 0,
    infos = 0;
  for (const i of issues) {
    if (i.severity === "error") errors++;
    else if (i.severity === "warning") warnings++;
    else infos++;
  }
  const parts: string[] = [];
  if (errors > 0) parts.push(`${errors} error(s)`);
  if (warnings > 0) parts.push(`${warnings} warning(s)`);
  if (infos > 0) parts.push(`${infos} info(s)`);
  const files = new Set(issues.map((i) => i.file)).size;
  parts.push(`in ${files} file(s)`);
  return `Lint Results: ${parts.join(", ")}`;
}
