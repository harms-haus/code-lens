/**
 * rename-symbol command: Rename a symbol across the codebase
 *
 * Returns a unified diff patch — does NOT apply changes.
 */

import * as fs from "node:fs";
import { registerCommand } from "../daemon/server.js";
import { executePreamble } from "./preamble.js";
import type { PreambleResult } from "./preamble.js";
import { uriToFilePath, isWithinWorkspace } from "../utils/paths.js";
import { applyEdits, buildDiff } from "../formatting/diff.js";
import { ok, err, sanitizeError } from "../formatting/output.js";
import type { TextEdit, Range, WorkspaceEdit } from "vscode-languageserver-types";

// ── Helpers ────────────────────────────────────────────────────────────────

/** Extract old name from prepareRename result */
async function getOldName(
  client: PreambleResult["client"],
  uri: string,
  line: number,
  col: number,
  filePath: string,
): Promise<string> {
  let oldName = "(unknown)";
  let renameRange: Range | null = null;

  try {
    const prepareResult = await client.prepareRename(uri, line, col);
    if (prepareResult && typeof prepareResult === "object") {
      if ("placeholder" in prepareResult) {
        const prep = prepareResult as { placeholder: string; range?: Range };
        oldName = prep.placeholder;
        renameRange = prep.range ?? null;
      } else if ("start" in prepareResult && "end" in prepareResult) {
        renameRange = prepareResult;
      }
    }
  } catch {
    // prepareRename not supported
  }

  if (oldName === "(unknown)" && renameRange) {
    oldName = extractTextFromRange(filePath, renameRange);
  }

  if (oldName === "(unknown)") {
    oldName = extractWordAtPosition(filePath, line, col);
  }

  return oldName;
}

/** Extract text from a file at the given range */
function extractTextFromRange(filePath: string, range: Range): string {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const startLine = lines[range.start.line] ?? "";
    if (range.start.line === range.end.line) {
      return startLine.slice(range.start.character, range.end.character);
    }
    const endLine = lines[range.end.line] ?? "";
    return (
      startLine.slice(range.start.character) +
      "\n" +
      endLine.slice(0, range.end.character)
    );
  } catch {
    return "(unknown)";
  }
}

/** Extract word at cursor position as fallback */
function extractWordAtPosition(filePath: string, line: number, col: number): string {
  try {
    const content = fs.readFileSync(filePath, "utf-8");
    const lines = content.split("\n");
    const lineContent = lines[line] ?? "";
    const before = lineContent.slice(0, col).match(/[\w$]+$/)?.[0] ?? "";
    const after = lineContent.slice(col).match(/^[\w$]+/)?.[0] ?? "";
    return before + after || "(unknown)";
  } catch {
    return "(unknown)";
  }
}

/** Process edits for a single file, producing a diff */
function processEditChange(changePath: string, sorted: TextEdit[]): string {
  try {
    const original = fs.readFileSync(changePath, "utf-8");
    const modified = applyEdits(original, sorted);
    return buildDiff(changePath, original, modified);
  } catch {
    const newText = sorted.map((e) => e.newText).join("");
    const lineCount = newText ? newText.split("\n").length : 0;
    return (
      `--- /dev/null\n+++ ${changePath}\n@@ -0,0 +1,${lineCount} @@\n` +
      newText
        .split("\n")
        .map((l) => "+" + l)
        .join("\n")
    );
  }
}

/** Build patch from documentChanges (LSP 3.17+) */
function buildDocChangesPatch(
  docChanges: NonNullable<WorkspaceEdit["documentChanges"]>,
  cwd: string,
): { patchParts: string[]; fileCount: number; processedUris: Set<string> } {
  const patchParts: string[] = [];
  const processedUris = new Set<string>();
  let fileCount = 0;

  for (const dc of docChanges) {
    if (!("textDocument" in dc) || !("edits" in dc)) {
      continue;
    }
    const textDoc = dc as { textDocument: { uri: string }; edits: TextEdit[] };
    const changeUri = textDoc.textDocument.uri;
    processedUris.add(changeUri);
    const changePath = uriToFilePath(changeUri);

    if (!isWithinWorkspace(changePath, cwd)) {
      patchParts.push(`--- skipped: ${changePath} (outside workspace)`);
      continue;
    }

    const sorted = [...textDoc.edits].sort(
      (a, b) =>
        b.range.start.line - a.range.start.line ||
        b.range.start.character - a.range.start.character,
    );
    fileCount++;
    patchParts.push(processEditChange(changePath, sorted));
  }

  return { patchParts, fileCount, processedUris };
}

/** Build patch from legacy changes format */
function buildChangesPatch(
  changes: NonNullable<WorkspaceEdit["changes"]>,
  cwd: string,
  skipUris: Set<string>,
): { patchParts: string[]; fileCount: number } {
  const patchParts: string[] = [];
  let fileCount = 0;

  for (const [changeUri, edits] of Object.entries(changes)) {
    if (skipUris.has(changeUri)) continue;

    const changePath = uriToFilePath(changeUri);
    if (!isWithinWorkspace(changePath, cwd)) {
      patchParts.push(`--- skipped: ${changePath} (outside workspace)`);
      continue;
    }

    const sorted = [...edits].sort(
      (a, b) =>
        b.range.start.line - a.range.start.line ||
        b.range.start.character - a.range.start.character,
    );
    fileCount++;
    patchParts.push(processEditChange(changePath, sorted));
  }

  return { patchParts, fileCount };
}

/** Build patch from a WorkspaceEdit */
function buildPatchFromEdit(
  workspaceEdit: WorkspaceEdit | null,
  cwd: string,
): { patch: string; fileCount: number } {
  if (!workspaceEdit) {
    return { patch: "No changes generated.", fileCount: 0 };
  }

  const allParts: string[] = [];
  let totalFiles = 0;

  // Handle documentChanges format (LSP 3.17+)
  if (workspaceEdit.documentChanges) {
    const doc = buildDocChangesPatch(workspaceEdit.documentChanges, cwd);
    allParts.push(...doc.patchParts);
    totalFiles += doc.fileCount;

    // Handle legacy changes format, skipping already-processed URIs
    if (workspaceEdit.changes) {
      const legacy = buildChangesPatch(workspaceEdit.changes, cwd, doc.processedUris);
      allParts.push(...legacy.patchParts);
      totalFiles += legacy.fileCount;
    }
  } else if (workspaceEdit.changes) {
    const legacy = buildChangesPatch(workspaceEdit.changes, cwd, new Set());
    allParts.push(...legacy.patchParts);
    totalFiles += legacy.fileCount;
  }

  return {
    patch: allParts.join("\n\n") || "No changes generated.",
    fileCount: totalFiles,
  };
}

// ── Handler ────────────────────────────────────────────────────────────────

registerCommand("rename-symbol", async (params, manager, cwd) => {
  const file = params.file as string;
  const line = params.line as number;
  const col = params.col as number;
  const newName = params.newName as string;

  const preamble = await executePreamble(file, manager, cwd);
  if ("error" in preamble) return preamble.error;

  const { client, uri, filePath } = preamble.ok;

  try {
    const oldName = await getOldName(client, uri, line - 1, col - 1, filePath);
    const workspaceEdit = await client.rename(uri, line - 1, col - 1, newName);
    const { patch, fileCount } = buildPatchFromEdit(workspaceEdit, cwd);

    return ok(
      `Rename "${oldName}" → "${newName}"\nFile: ${file}\nFiles affected: ${fileCount}\n\nPatch:\n\`\`\`diff\n${patch}\n\`\`\``,
      { file, oldName, newName, patch, fileCount },
    );
  } catch (e) {
    return err(sanitizeError(e, "Failed to rename symbol"), { file });
  }
});
