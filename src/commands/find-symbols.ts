/**
 * find-symbols command: Search for symbols across the workspace
 */

import { registerCommand } from "../daemon/server.js";
import { uriToFilePath } from "../utils/paths.js";
import {
  SYMBOL_KIND_NAMES,
  parseSymbolKind,
  MAX_SYMBOL_RESULTS,
} from "../formatting/symbols.js";
import { ok, err, sanitizeError } from "../formatting/output.js";
import { LANGUAGE_SERVERS, isServerInstalled } from "../lsp/language-config.js";
import type { LspManager } from "../lsp/lsp-manager.js";

// ── Helpers ────────────────────────────────────────────────────────────────

/** Try to find an available LSP client (prefer TypeScript, fallback to any running) */
async function findAvailableClient(
  manager: LspManager,
): Promise<ReturnType<LspManager["getClientForConfig"]> | null> {
  // Prefer TypeScript server (best workspace symbol support)
  const tsConfig = LANGUAGE_SERVERS.find((c) => c.language === "typescript");
  if (tsConfig) {
    const installed = await isServerInstalled(tsConfig);
    if (installed) {
      const client = await manager.getClientForConfig(tsConfig);
      if (client) return client;
    }
  }

  // Fall back to any running server
  for (const serverConfig of LANGUAGE_SERVERS) {
    const client = manager.getClientMap().get(serverConfig.language);
    if (client) return client;
  }

  return null;
}

// ── Handler ────────────────────────────────────────────────────────────────

registerCommand("find-symbols", async (params, manager, _cwd) => {
  const query = params.query as string;
  const kind = params.kind as string | undefined;

  if (!query || query.length < 1) {
    return err("Please provide a symbol query to search for.");
  }

  const client = await findAvailableClient(manager);
  if (!client) {
    return err("No LSP server running. Open a file first to start an LSP server.");
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
