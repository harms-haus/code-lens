import { describe, it, expect } from "vitest";
import type { TextEdit, Range } from "vscode-languageserver-types";
import {
  sortEdits,
  applyEdits,
  buildDiff,
  extractTextFromRange,
  extractWordAtPosition,
  applyEditsAndDiff,
} from "../../src/formatting/diff.js";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeTextEdit(
  startLine: number,
  startChar: number,
  endLine: number,
  endChar: number,
  newText: string,
): TextEdit {
  return {
    range: {
      start: { line: startLine, character: startChar },
      end: { line: endLine, character: endChar },
    },
    newText,
  };
}

function makeRange(
  startLine: number,
  startChar: number,
  endLine: number,
  endChar: number,
): Range {
  return {
    start: { line: startLine, character: startChar },
    end: { line: endLine, character: endChar },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// sortEdits
// ═══════════════════════════════════════════════════════════════════════════

describe("sortEdits", () => {
  it("sorts 3 edits in descending position order", () => {
    const edits: TextEdit[] = [
      makeTextEdit(0, 0, 0, 3, "first"),
      makeTextEdit(5, 0, 5, 3, "third"),
      makeTextEdit(2, 0, 2, 3, "second"),
    ];
    const sorted = sortEdits(edits);
    // Descending by line, so last line first
    expect(sorted[0].newText).toBe("third");
    expect(sorted[1].newText).toBe("second");
    expect(sorted[2].newText).toBe("first");
  });

  it("returns empty array for empty input", () => {
    expect(sortEdits([])).toEqual([]);
  });

  it("returns singleton array for single edit", () => {
    const edit = makeTextEdit(0, 0, 0, 5, "hello");
    const sorted = sortEdits([edit]);
    expect(sorted).toHaveLength(1);
    expect(sorted[0]).toBe(edit);
  });

  it("sorts same-line edits by character descending", () => {
    const edits: TextEdit[] = [
      makeTextEdit(0, 0, 0, 3, "A"),
      makeTextEdit(0, 10, 0, 13, "C"),
      makeTextEdit(0, 5, 0, 8, "B"),
    ];
    const sorted = sortEdits(edits);
    // Descending by character on same line
    expect(sorted[0].newText).toBe("C"); // char 10
    expect(sorted[1].newText).toBe("B"); // char 5
    expect(sorted[2].newText).toBe("A"); // char 0
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// applyEdits
// ═══════════════════════════════════════════════════════════════════════════

describe("applyEdits", () => {
  it("applies a single edit that replaces text at a position", () => {
    const text = "hello world";
    const edits = [makeTextEdit(0, 0, 0, 5, "goodbye")];
    expect(applyEdits(text, edits)).toBe("goodbye world");
  });

  it("applies multiple edits in reverse order (bottom-up)", () => {
    const text = "line1\nline2\nline3";
    const edits = [
      makeTextEdit(0, 0, 0, 5, "LINE1"),
      makeTextEdit(2, 0, 2, 5, "LINE3"),
    ];
    const result = applyEdits(text, edits);
    expect(result).toBe("LINE1\nline2\nLINE3");
  });

  it("handles insertion (empty range)", () => {
    const text = "hello";
    const edits = [makeTextEdit(0, 5, 0, 5, " world")];
    expect(applyEdits(text, edits)).toBe("hello world");
  });

  it("handles deletion (same start and end)", () => {
    const text = "hello world";
    const edits = [makeTextEdit(0, 5, 0, 11, "")];
    expect(applyEdits(text, edits)).toBe("hello");
  });

  it("handles multiline edit", () => {
    const text = "a\nb\nc\nd";
    const edits = [makeTextEdit(0, 1, 2, 1, "X\nY\nZ")];
    const result = applyEdits(text, edits);
    // prefix = "a", suffix from end of line 2 char 1 = "c\n" → wait let me think...
    // line 0 = "a", line 1 = "b", line 2 = "c", line 3 = "d"
    // start = line 0, char 1 → prefix = "a"
    // end = line 2, char 1 → suffix = lines[2].slice(1) = ""
    // newContent = "a" + "X\nY\nZ" + "" = "aX\nY\nZ"
    // lines before edit = ["a", "b", "c", "d"]
    // After: lines[0..start.line-1] + newContent.split("\n") + lines[end.line+1..]
    // = [] + ["aX", "Y", "Z"] + ["d"]
    // = ["aX", "Y", "Z", "d"] → "aX\nY\nZ\nd"
    expect(result).toBe("aX\nY\nZ\nd");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// buildDiff
// ═══════════════════════════════════════════════════════════════════════════

describe("buildDiff", () => {
  it("identical content contains 'no changes'", () => {
    const text = "same\ncontent\nhere";
    const diff = buildDiff("file.txt", text, text);
    expect(diff).toContain("no changes");
  });

  it("single line change produces correct @@ header with accurate line counts", () => {
    const original = "foo\nbar\nbaz";
    const modified = "foo\nqux\nbaz";
    const diff = buildDiff("test.txt", original, modified);
    // The changed line is line 2 (1-indexed). With 3 lines of context on each side,
    // all lines will be in one hunk.
    // origCount = context + delete lines, modCount = context + insert lines
    // Both have 2 context lines + 1 change = 3 total
    expect(diff).toMatch(/@@ -\d+,\d+ \+\d+,\d+ @@/);
    expect(diff).toContain("-bar");
    expect(diff).toContain("+qux");
    // Verify header counts: 3 orig lines (2 context + 1 delete), 3 mod lines (2 context + 1 insert)
    const match = diff.match(/@@ -(\d+),(\d+) \+(\d+),(\d+) @@/);
    expect(match).not.toBeNull();
    expect(Number(match![1])).toBe(1); // first orig line
    expect(Number(match![2])).toBe(3); // orig count
    expect(Number(match![3])).toBe(1); // first mod line
    expect(Number(match![4])).toBe(3); // mod count
  });

  it("multiple non-adjacent changes produce separate hunks with correct @@ headers", () => {
    // Build content with changes far apart (> 3 context lines between them)
    const original = [
      "change1",   // line 1 - changed
      "ctx1",
      "ctx2",
      "ctx3",
      "ctx4",
      "ctx5",
      "ctx6",
      "ctx7",
      "change2",   // line 9 - changed
      "ctx8",
    ].join("\n");
    const modified = [
      "CHANGED1",  // line 1
      "ctx1",
      "ctx2",
      "ctx3",
      "ctx4",
      "ctx5",
      "ctx6",
      "ctx7",
      "CHANGED2",  // line 9
      "ctx8",
    ].join("\n");
    const diff = buildDiff("multi.txt", original, modified);
    // Should have two separate hunks
    const hunkHeaders = diff.match(/@@[^@]+@@/g);
    expect(hunkHeaders).not.toBeNull();
    expect(hunkHeaders!.length).toBe(2);
    expect(diff).toContain("-change1");
    expect(diff).toContain("+CHANGED1");
    expect(diff).toContain("-change2");
    expect(diff).toContain("+CHANGED2");
  });

  it("handles added lines only", () => {
    const original = "a\nb";
    const modified = "a\nb\nc\nd";
    const diff = buildDiff("add.txt", original, modified);
    expect(diff).toContain("+c");
    expect(diff).toContain("+d");
    expect(diff).not.toContain("-a");
    expect(diff).not.toContain("-b");
  });

  it("handles removed lines only", () => {
    const original = "a\nb\nc\nd";
    const modified = "a\nd";
    const diff = buildDiff("remove.txt", original, modified);
    expect(diff).toContain("-b");
    expect(diff).toContain("-c");
    expect(diff).not.toContain("+b");
    expect(diff).not.toContain("+c");
  });

  it("handles mixed additions and removals", () => {
    const original = "alpha\nbeta\ngamma";
    const modified = "alpha\ndelta\ngamma\nepsilon";
    const diff = buildDiff("mixed.txt", original, modified);
    expect(diff).toContain("-beta");
    expect(diff).toContain("+delta");
    expect(diff).toContain("+epsilon");
  });

  it("handles empty original with non-empty modified", () => {
    const original = "";
    const modified = "new line\nanother line";
    const diff = buildDiff("newfile.txt", original, modified);
    expect(diff).toContain("+new line");
    expect(diff).toContain("+another line");
  });

  it("handles non-empty original with empty modified", () => {
    const original = "to be removed\nall gone";
    const modified = "";
    const diff = buildDiff("deleted.txt", original, modified);
    expect(diff).toContain("-to be removed");
    expect(diff).toContain("-all gone");
  });

  it("output has valid unified diff format starting with --- a/ and +++ b/", () => {
    const original = "foo\nbar";
    const modified = "foo\nbaz";
    const diff = buildDiff("path/to/file.ts", original, modified);
    expect(diff).toMatch(/^--- a\/path\/to\/file\.ts/);
    expect(diff).toContain("+++ b/path/to/file.ts");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// extractTextFromRange
// ═══════════════════════════════════════════════════════════════════════════

describe("extractTextFromRange", () => {
  it("extracts text from a single-line range", () => {
    // Use a temp file for testing
    const fs = require("node:fs");
    const path = require("node:path");
    const tmpFile = path.join(__dirname, "__tmp_extract_test__.txt");
    fs.writeFileSync(tmpFile, "hello world\nsecond line\n");

    const range = makeRange(0, 6, 0, 11);
    const result = extractTextFromRange(tmpFile, range);
    expect(result).toBe("world");

    fs.unlinkSync(tmpFile);
  });

  it("extracts text from a multi-line range", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const tmpFile = path.join(__dirname, "__tmp_extract_multi__.txt");
    fs.writeFileSync(tmpFile, "first line\nsecond line\nthird line\n");

    const range = makeRange(0, 5, 1, 6);
    const result = extractTextFromRange(tmpFile, range);
    expect(result).toBe(" line\nsecond");

    fs.unlinkSync(tmpFile);
  });

  it("returns '(unknown)' for nonexistent file", () => {
    const range = makeRange(0, 0, 0, 5);
    const result = extractTextFromRange("/nonexistent/path/to/file.txt", range);
    expect(result).toBe("(unknown)");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// extractWordAtPosition
// ═══════════════════════════════════════════════════════════════════════════

describe("extractWordAtPosition", () => {
  it("extracts a word at cursor position spanning before and after col", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const tmpFile = path.join(__dirname, "__tmp_word_test__.txt");
    fs.writeFileSync(tmpFile, "hello world fooBar\n");

    // Cursor at column 7 (between 'w' and 'o' in 'world')
    const result = extractWordAtPosition(tmpFile, 0, 3);
    expect(result).toBe("hello");

    fs.unlinkSync(tmpFile);
  });

  it("extracts a word when cursor is in the middle", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const tmpFile = path.join(__dirname, "__tmp_word_mid__.txt");
    fs.writeFileSync(tmpFile, "  myVariable = 42;\n");

    // Cursor at column 5 (middle of 'myVariable')
    const result = extractWordAtPosition(tmpFile, 0, 5);
    expect(result).toBe("myVariable");

    fs.unlinkSync(tmpFile);
  });

  it("returns '(unknown)' for nonexistent file", () => {
    const result = extractWordAtPosition("/nonexistent/file.txt", 0, 0);
    expect(result).toBe("(unknown)");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// applyEditsAndDiff
// ═══════════════════════════════════════════════════════════════════════════

describe("applyEditsAndDiff", () => {
  it("applies edits to a file and produces a unified diff", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const tmpFile = path.join(__dirname, "__tmp_applydiff__.txt");
    fs.writeFileSync(tmpFile, "hello world\nsecond line\n");

    const edits = [makeTextEdit(0, 0, 0, 5, "goodbye")];
    const diff = applyEditsAndDiff(tmpFile, edits);

    expect(diff).toContain("--- a/");
    expect(diff).toContain("+++ b/");
    expect(diff).toContain("-hello");
    expect(diff).toContain("+goodbye");

    // Verify the file was NOT mutated (only read)
    expect(fs.readFileSync(tmpFile, "utf-8")).toBe("hello world\nsecond line\n");

    fs.unlinkSync(tmpFile);
  });

  it("returns diff from /dev/null for nonexistent file", () => {
    const edits = [makeTextEdit(0, 0, 0, 0, "new content\nline2")];
    const diff = applyEditsAndDiff("/nonexistent/file.txt", edits);

    expect(diff).toContain("--- /dev/null");
    expect(diff).toContain("+new content");
    expect(diff).toContain("+line2");
  });
});
