/**
 * find-symbols command: Search for symbols across the workspace
 */

import { registerCommand } from "../daemon/server.js";
import { uriToFilePath, resolveFile } from "../utils/paths.js";
import {
  SYMBOL_KIND_NAMES,
  parseSymbolKind,
  MAX_SYMBOL_RESULTS,
} from "../formatting/symbols.js";
import { ok, err, sanitizeError } from "../formatting/output.js";
import type { LspManager } from "../lsp/lsp-manager.js";

// ── Handler ────────────────────────────────────────────────────────────────

registerCommand("find-symbols", async (params, manager, cwd) => {
  const query = params.query as string;
  const kind = params.kind as string | undefined;
  const file = params.file as string | undefined;

  if (!query || query.length < 1) {
    return err("Please provide a symbol query to search for.");
  }

  let client: Awaited<ReturnType<LspManager["getClientForConfig"]>> | null = null;

  if (file) {
    // File-based routing: detect language and use the correct LSP server
    const filePath = resolveFile(file, cwd);
    client = await manager.getClientForFile(filePath);
  } else {
    // Fallback: use any running server
    for (const [, value] of manager.getClientMap()) {
      client = value;
      break;
    }
  }

  if (!client) {
    return err(
      file
        ? `No LSP server available for "${file}". Open a file first to start an LSP server.`
        : "No LSP server running. Open a file first to start an LSP server.",
    );
  }

  try {
    const result = await client.workspaceSymbol(query);
    const symbols = Array.isArray(result) ? result : [];

    let filtered = symbols;
    let kindWarning: string | undefined;

    if (kind) {
      const kindNum = parseSymbolKind(kind);
      if (kindNum !== undefined) {
        filtered = symbols.filter((s) => s.kind === kindNum);
      } else {
        kindWarning = `"${kind}" is not a valid symbol kind. Showing all results.`;
      }
    }

    if (filtered.length === 0) {
      return ok(`No symbols found matching "${query}".`, { query, kind, count: 0 });
    }

    const formatted = filtered
      .slice(0, MAX_SYMBOL_RESULTS)
      .map((s) => {
        const name = s.name || "(unknown)";
        const kindName = SYMBOL_KIND_NAMES[s.kind] || `Kind(${s.kind})`;
        const location = s.location;
        const uri = location.uri;
        const filePath = uriToFilePath(uri);
        const line = "range" in location ? location.range.start.line + 1 : "?";
        const container = s.containerName ? ` [${s.containerName}]` : "";
        return `  ${name}${container} (${kindName}) — ${filePath}:${line}`;
      })
      .join("\n");

    const more =
      filtered.length > MAX_SYMBOL_RESULTS
        ? `\n  ... and ${filtered.length - MAX_SYMBOL_RESULTS} more`
        : "";

    const suffix = kindWarning ? ` — ${kindWarning}` : "";
    const countLabel = kind
      ? `Symbols matching "${query}" (kind: ${kind}): ${filtered.length}${suffix}`
      : `Symbols matching "${query}": ${filtered.length}`;

    return ok(`${countLabel}\n\n${formatted}${more}`, {
      query,
      kind,
      count: filtered.length,
      symbols: filtered.slice(0, MAX_SYMBOL_RESULTS).map((s) => {
        const location = s.location;
        const uri = location.uri;
        const line = "range" in location ? location.range.start.line + 1 : 0;
        return { name: s.name, kind: SYMBOL_KIND_NAMES[s.kind] || "", uri, line };
      }),
    });
  } catch (e) {
    return err(sanitizeError(e, "Failed to find symbols"), { query });
  }
});
