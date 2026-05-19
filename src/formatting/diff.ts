/**
 * Diff/text editing utilities
 */

import * as fs from "node:fs";
import type { TextEdit, Range } from "vscode-languageserver-types";

// ── Text/Diff Utilities ────────────────────────────────────────────────────

/** Sort TextEdits in reverse document order (last edit first) for safe application */
export function sortEdits(edits: readonly TextEdit[]): TextEdit[] {
  return [...edits].sort(
    (a, b) =>
      b.range.start.line - a.range.start.line ||
      b.range.start.character - a.range.start.character,
  );
}

/** Apply LSP TextEdits to source text, returning the modified text */
export function applyEdits(text: string, edits: TextEdit[]): string {
  const sorted = sortEdits(edits);

  const lines = text.split("\n");
  for (const edit of sorted) {
    const { start, end } = edit.range;
    const prefix = (lines[start.line] ?? "").slice(0, start.character);
    const suffix = (lines[end.line] ?? "").slice(end.character);
    const newContent = prefix + edit.newText + suffix;
    const newLinesArr = newContent.split("\n");

    const newArr = [
      ...(start.line > 0 ? lines.slice(0, start.line) : []),
      ...newLinesArr,
      ...(end.line + 1 < lines.length ? lines.slice(end.line + 1) : []),
    ];

    lines.length = 0;
    lines.push(...newArr);
  }

  return lines.join("\n");
}

/** A single line operation in a diff */
export interface ChangeOp {
  type: "context" | "delete" | "insert";
  text: string;
  origLine?: number;
  modLine?: number;
}

/** Build change operations by comparing original and modified line arrays */
export function buildChangeOps(origLines: string[], modLines: string[]): ChangeOp[] {
  const maxLines = Math.max(origLines.length, modLines.length);
  const ops: ChangeOp[] = [];

  for (let i = 0; i < maxLines; i++) {
    const orig = i < origLines.length ? origLines[i] : undefined;
    const mod = i < modLines.length ? modLines[i] : undefined;
    if (orig === mod) {
      ops.push({ type: "context", text: orig ?? "", origLine: i + 1, modLine: i + 1 });
    } else {
      if (orig !== undefined) ops.push({ type: "delete", text: orig, origLine: i + 1 });
      if (mod !== undefined) ops.push({ type: "insert", text: mod, modLine: i + 1 });
    }
  }

  return ops;
}

/** Group change operations into hunks separated by context gaps */
export function groupOpsIntoHunks(ops: ChangeOp[], contextLines: number): ChangeOp[][] {
  const hunks: ChangeOp[][] = [];
  let currentHunk: ChangeOp[] = [];
  let trailingContext: ChangeOp[] = [];

  for (const op of ops) {
    if (op.type === "context") {
      trailingContext.push(op);
      if (trailingContext.length > contextLines) {
        if (currentHunk.length > 0) {
          currentHunk.push(...trailingContext.slice(0, contextLines));
          hunks.push(currentHunk);
          currentHunk = [];
        }
        trailingContext = trailingContext.slice(contextLines);
      }
    } else {
      currentHunk.push(...trailingContext);
      trailingContext = [];
      currentHunk.push(op);
    }
  }
  currentHunk.push(...trailingContext);
  if (currentHunk.some((h) => h.type !== "context")) {
    hunks.push(currentHunk);
  }

  return hunks;
}

/** Format a single hunk into a unified diff string */
export function formatHunk(hunk: ChangeOp[]): string {
  const firstOrig = hunk.find((op) => op.origLine !== undefined)?.origLine ?? 0;
  const firstMod = hunk.find((op) => op.modLine !== undefined)?.modLine ?? 0;
  const origCount = hunk.filter((op) => op.type === "context" || op.type === "delete").length;
  const modCount = hunk.filter((op) => op.type === "context" || op.type === "insert").length;

  const header = `@@ -${firstOrig},${origCount} +${firstMod},${modCount} @@`;
  const body = hunk.map((op) => {
    switch (op.type) {
      case "context": return ` ${op.text}`;
      case "delete": return `-${op.text}`;
      case "insert": return `+${op.text}`;
    }
  }).join("\n");
  return header + "\n" + body;
}

/** Build a unified diff string from original and modified text */
export function buildDiff(filePath: string, original: string, modified: string): string {
  const origLines = original.split("\n");
  const modLines = modified.split("\n");
  const ops = buildChangeOps(origLines, modLines);

  if (ops.length === 0 || ops.every((op) => op.type === "context")) {
    return `--- a/${filePath}\n+++ b/${filePath}\n (no changes)`;
  }

  const hunks = groupOpsIntoHunks(ops, 3);
  const hunkStrings = hunks.map(formatHunk);

  return `--- a/${filePath}\n+++ b/${filePath}\n${hunkStrings.join("\n")}`;
}

// ── Text Extraction Utilities ─────────────────────────────────────────────

/** Extract text from a file at the given range */
export function extractTextFromRange(filePath: string, range: Range): string {
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
export function extractWordAtPosition(filePath: string, line: number, col: number): string {
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

/** Apply sorted edits to a file and produce a unified diff */
export function applyEditsAndDiff(changePath: string, sorted: TextEdit[]): string {
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
