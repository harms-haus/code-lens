/**
 * Symbol formatting utilities
 */

import type { DocumentSymbol, SymbolInformation } from "vscode-languageserver-types";

// ── Constants ──────────────────────────────────────────────────────────────

/** Symbol kind names indexed by LSP SymbolKind enum */
export const SYMBOL_KIND_NAMES: Record<number, string> = {
  1: "File",
  2: "Module",
  3: "Namespace",
  4: "Package",
  5: "Class",
  6: "Method",
  7: "Property",
  8: "Field",
  9: "Constructor",
  10: "Enum",
  11: "Interface",
  12: "Function",
  13: "Variable",
  14: "Constant",
  15: "String",
  16: "Number",
  17: "Boolean",
  18: "Array",
  19: "Object",
  20: "Key",
  21: "Null",
  22: "EnumMember",
  23: "Struct",
  24: "Event",
  25: "Operator",
  26: "TypeParameter",
};

/** Maximum number of symbol results to display */
export const MAX_SYMBOL_RESULTS = 50;

/** Reverse lookup: kind name (lowercase) → SymbolKind number */
const SYMBOL_KIND_BY_NAME: Record<string, number> = Object.fromEntries(
  Object.entries(SYMBOL_KIND_NAMES).map(([num, name]) => [name.toLowerCase(), Number(num)]),
);

/** Parse a kind name or number string into a SymbolKind number, or undefined */
export function parseSymbolKind(kind: string): number | undefined {
  // Try as number first
  const num = Number(kind);
  if (!Number.isNaN(num) && SYMBOL_KIND_NAMES[num]) return num;
  // Try as name (case-insensitive)
  return SYMBOL_KIND_BY_NAME[kind.toLowerCase()];
}

/** Format DocumentSymbol[] as a hierarchical outline */
export function formatDocumentSymbols(
  symbols: DocumentSymbol[],
  indent: string = "",
): string {
  const lines: string[] = [];
  for (const sym of symbols) {
    const kindName = SYMBOL_KIND_NAMES[sym.kind] || `Kind(${sym.kind})`;
    const line = sym.range.start.line + 1;
    lines.push(`${indent}${kindName} ${sym.name} (line ${line})`);
    if (sym.children && sym.children.length > 0) {
      lines.push(formatDocumentSymbols(sym.children, indent + "  "));
    }
  }
  return lines.join("\n");
}

/** Format SymbolInformation[] as a flat list */
export function formatSymbolInformationList(symbols: SymbolInformation[]): string {
  const lines: string[] = [];
  for (const sym of symbols) {
    const kindName = SYMBOL_KIND_NAMES[sym.kind] || `Kind(${sym.kind})`;
    const line = sym.location.range.start.line + 1;
    lines.push(`  ${kindName} ${sym.name} (line ${line})`);
  }
  return lines.join("\n");
}
