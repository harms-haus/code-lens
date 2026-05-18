/**
 * find-type-hierarchy command: Show the inheritance chain for a type
 */

import { registerCommand } from "../daemon/server.js";
import { executePreamble } from "./preamble.js";
import { uriToFilePath } from "../utils/paths.js";
import { SYMBOL_KIND_NAMES } from "../formatting/symbols.js";
import { ok } from "../formatting/output.js";
import type { TypeHierarchyItem } from "../lsp/lsp-protocol.js";
import type { LspClientMethods } from "../lsp/lsp-client-methods.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function formatHierarchyItem(item: TypeHierarchyItem): string {
  const name = item.name;
  const kind = SYMBOL_KIND_NAMES[item.kind] ?? "Unknown";
  const fp = uriToFilePath(item.uri);
  const line = item.range.start.line + 1;
  return `  ${name} (${kind}) — ${fp}:${line}`;
}

function formatSection(title: string, items: TypeHierarchyItem[]): string {
  let output = `\n${title} (${items.length}) ───\n`;
  if (items.length > 0) {
    output += items.map((s) => formatHierarchyItem(s)).join("\n");
  } else {
    output += "  (none found)";
  }
  return output;
}

async function fetchHierarchyItems(
  client: LspClientMethods,
  method: "supertypes" | "subtypes",
  item: TypeHierarchyItem,
  depth: number,
): Promise<TypeHierarchyItem[]> {
  try {
    const raw =
      method === "supertypes"
        ? await client.typeHierarchySupertypes(item, depth)
        : await client.typeHierarchySubtypes(item, depth);
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

// ── Handler ────────────────────────────────────────────────────────────────

registerCommand("find-type-hierarchy", async (params, manager, cwd) => {
  const file = params.file as string;
  const line = params.line as number;
  const col = params.col as number;

  const rawDirection = (params.direction as string) || "both";
  const validDirections = new Set(["supertypes", "subtypes", "both"]);
  const direction = validDirections.has(rawDirection) ? rawDirection : "both";
  const depth = (params.depth as number) || 2;

  const preamble = await executePreamble(file, manager, cwd);
  if ("error" in preamble) return preamble.error;

  const { client, uri } = preamble.ok;

  // Prepare type hierarchy at position
  let prepareResult: TypeHierarchyItem[];
  try {
    const raw = await client.prepareTypeHierarchy(uri, line - 1, col - 1);
    prepareResult = Array.isArray(raw) ? raw : [];
  } catch {
    return ok("Type hierarchy is not supported by this language server, or no type at this position.", {
      file,
      supported: false,
    });
  }

  if (prepareResult.length === 0) {
    return ok("Type hierarchy is not supported by this language server, or no type at this position.", {
      file,
      supported: false,
    });
  }

  const item = prepareResult[0];
  const typeName = item.name;

  // Fetch supertypes and/or subtypes based on direction
  const wantSuper = direction === "supertypes" || direction === "both";
  const wantSub = direction === "subtypes" || direction === "both";

  const supertypes = wantSuper ? await fetchHierarchyItems(client, "supertypes", item, depth) : [];
  const subtypes = wantSub ? await fetchHierarchyItems(client, "subtypes", item, depth) : [];

  // Build output
  let output = `Type hierarchy for "${typeName}" in ${file}:${line}:${col}\n`;

  if (wantSuper) {
    output += formatSection("─── Supertypes", supertypes);
  }
  if (wantSub) {
    output += formatSection("─── Subtypes", subtypes);
  }

  return ok(output, {
    file,
    line,
    col,
    typeName,
    supertypes: supertypes.map((s) => ({
      name: s.name,
      kind: s.kind,
      uri: uriToFilePath(s.uri),
      line: s.range.start.line + 1,
    })),
    subtypes: subtypes.map((s) => ({
      name: s.name,
      kind: s.kind,
      uri: uriToFilePath(s.uri),
      line: s.range.start.line + 1,
    })),
    supported: true,
  });
});
