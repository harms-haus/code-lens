/**
 * Diagnostic formatting utilities
 */

import type { Diagnostic } from "vscode-languageserver-types";

// ── Constants ──────────────────────────────────────────────────────────────

/** Diagnostic severity names indexed by LSP DiagnosticSeverity enum */
export const SEVERITY_NAMES = ["?", "Error", "Warning", "Info", "Hint"] as const;

// ── Diagnostics Helpers ───────────────────────────────────────────────────

/** Count diagnostics by severity */
export function countSeverities(diagnostics: Diagnostic[]): {
  errors: number;
  warnings: number;
  info: number;
} {
  let errors = 0;
  let warnings = 0;
  let info = 0;
  for (const d of diagnostics) {
    if (d.severity === 1) errors++;
    else if (d.severity === 2) warnings++;
    else if (d.severity === 3 || d.severity === 4) info++;
  }
  return { errors, warnings, info };
}

/** Format a single diagnostic as `severity: line:col: [source] message (code)` */
export function formatDiagnosticLine(d: Diagnostic): string {
  const startLine = d.range.start.line + 1;
  const startCol = d.range.start.character + 1;
  const severity = SEVERITY_NAMES[d.severity ?? 0] ?? "?";
  const source = d.source ? `[${d.source}] ` : "";
  const codeVal = d.code !== undefined ? ` (${d.code})` : "";
  return `  ${severity}: ${startLine}:${startCol}: ${source}${d.message}${codeVal}`;
}
