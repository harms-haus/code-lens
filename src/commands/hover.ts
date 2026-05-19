/**
 * hover command: Get type information, signature, and documentation at a position
 */

import { registerCommand } from "../daemon/server.js";
import { executePreamble } from "./preamble.js";
import { ok, err, sanitizeError } from "../formatting/output.js";
import { extractPositionParams } from "./params.js";
import type { Hover } from "vscode-languageserver-types";

// ── Helpers ────────────────────────────────────────────────────────────────

function formatHoverContents(contents: Hover["contents"]): string {
  if (typeof contents === "string") return contents;
  if (Array.isArray(contents)) return contents.map(formatHoverContents).join("\n\n");
  if (typeof contents === "object") {
    if ("kind" in contents && "value" in contents) {
      // MarkupContent — after narrowing, contents has .value
      return contents.value;
    }
    if ("language" in contents && "value" in contents) {
      // MarkedString (code block)
      return "```" + contents.language + "\n" + contents.value + "\n```";
    }
  }
  return String(contents);
}

interface HoverRange {
  startLine: number;
  startCol: number;
  endLine: number;
  endCol: number;
}

function extractRange(result: Hover): HoverRange | null {
  if (!result.range) return null;
  return {
    startLine: result.range.start.line + 1,
    startCol: result.range.start.character + 1,
    endLine: result.range.end.line + 1,
    endCol: result.range.end.character + 1,
  };
}

// ── Handler ────────────────────────────────────────────────────────────────

registerCommand("hover", async (params, manager, cwd) => {
  const extracted = extractPositionParams(params);
  if (!extracted.ok) return extracted.error;
  const { file, line, col } = extracted.params;

  const preamble = await executePreamble(file, manager, cwd);
  if ("error" in preamble) return preamble.error;

  const { client, uri } = preamble.ok;

  try {
    const result = await client.hover(uri, line - 1, col - 1);

    if (!result) {
      return ok("No hover information available at this position.", {
        file,
        line,
        col,
        hoverContent: null,
        range: null,
      });
    }

    const hoverContent = formatHoverContents(result.contents);
    const range = extractRange(result);

    let text = `Hover info at ${file}:${line}:${col}:\n\n${hoverContent}`;
    if (range) {
      text += `\n\nRange: line ${range.startLine}:${range.startCol} to line ${range.endLine}:${range.endCol}`;
    }

    return ok(text, { file, line, col, hoverContent, range });
  } catch (e) {
    return err(sanitizeError(e, "Failed to get hover information"), { file, line, col });
  }
});
