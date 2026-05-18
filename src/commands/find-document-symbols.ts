/**
 * find-document-symbols command: Get an outline of all symbols in a file
 */

import { registerCommand } from "../daemon/server.js";
import { executePreamble } from "./preamble.js";
import { ok, err, sanitizeError } from "../formatting/output.js";
import {
  formatDocumentSymbols,
  formatSymbolInformationList,
} from "../formatting/symbols.js";
import type { DocumentSymbol, SymbolInformation } from "vscode-languageserver-types";

// ── Handler ────────────────────────────────────────────────────────────────

registerCommand("find-document-symbols", async (params, manager, cwd) => {
  const file = params.file as string;

  const preamble = await executePreamble(file, manager, cwd);
  if ("error" in preamble) return preamble.error;

  const { client, uri } = preamble.ok;

  try {
    const result = await client.documentSymbol(uri);

    if (!result || result.length === 0) {
      return ok(`No symbols found in ${file}.`, { file, count: 0, symbols: [] });
    }

    let formatted: string;
    let symbolCount: number;

    // DocumentSymbol has a `children` property; SymbolInformation has a `location` property
    if ("children" in result[0]) {
      const docSymbols = result as DocumentSymbol[];
      const flat: { name: string; kind: string; line: number }[] = [];
      formatted = formatDocumentSymbols(docSymbols, "");
      // Count symbols from the hierarchical output
      symbolCount = formatted.split("\n").length;
      // Build flat list for details
      collectDocSymbols(docSymbols, flat);
      symbolCount = flat.length;

      return ok(
        `Document symbols for ${file}:\n${symbolCount} symbols found\n\n${formatted}`,
        { file, count: symbolCount, symbols: flat },
      );
    } else {
      const symInfo = result as SymbolInformation[];
      formatted = formatSymbolInformationList(symInfo);
      symbolCount = symInfo.length;

      const flat = symInfo.map((s) => ({
        name: s.name,
        kind: s.kind.toString(),
        line: s.location.range.start.line + 1,
      }));

      return ok(
        `Document symbols for ${file}:\n${symbolCount} symbols found\n\n${formatted}`,
        { file, count: symbolCount, symbols: flat },
      );
    }
  } catch (e) {
    return err(sanitizeError(e, "Failed to get document symbols"), { file });
  }
});

// ── Helpers ────────────────────────────────────────────────────────────────

function collectDocSymbols(
  symbols: DocumentSymbol[],
  flat: { name: string; kind: string; line: number }[],
): void {
  for (const sym of symbols) {
    flat.push({
      name: sym.name,
      kind: sym.kind.toString(),
      line: sym.range.start.line + 1,
    });
    if (sym.children) {
      collectDocSymbols(sym.children, flat);
    }
  }
}
