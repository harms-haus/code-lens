import { describe, it, expect } from "vitest";
import type { Diagnostic, Location } from "vscode-languageserver-types";

// ── Diagnostics ────────────────────────────────────────────────────────────
import {
  formatDiagnosticLine,
  countSeverities,
  SEVERITY_NAMES,
} from "../../src/formatting/diagnostics.js";

// ── Symbols ────────────────────────────────────────────────────────────────
import {
  parseSymbolKind,
  MAX_SYMBOL_RESULTS,
  SYMBOL_KIND_NAMES,
  formatDocumentSymbols,
  formatSymbolInformationList,
} from "../../src/formatting/symbols.js";

// ── Diff ───────────────────────────────────────────────────────────────────
import { applyEdits, buildDiff } from "../../src/formatting/diff.js";
import type { TextEdit } from "vscode-languageserver-types";

// ── Path/Location helpers (in paths.ts) ────────────────────────────────────
import { flattenLocations, formatLocations } from "../../src/utils/paths.js";

// ── Output builder ─────────────────────────────────────────────────────────
import { ok, err, sanitizeError } from "../../src/formatting/output.js";

// ═══════════════════════════════════════════════════════════════════════════
// formatDiagnosticLine
// ═══════════════════════════════════════════════════════════════════════════

describe("formatDiagnosticLine", () => {
  function makeDiagnostic(overrides: Partial<Diagnostic> = {}): Diagnostic {
    return {
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 1 },
      },
      message: "test message",
      severity: 1,
      ...overrides,
    };
  }

  it("formats an Error severity diagnostic", () => {
    const d = makeDiagnostic({ severity: 1, message: "Something went wrong" });
    const line = formatDiagnosticLine(d);
    expect(line).toContain("Error");
    expect(line).toContain("Something went wrong");
    expect(line).toContain("1:1");
  });

  it("formats a Warning severity diagnostic", () => {
    const d = makeDiagnostic({ severity: 2, message: "Be careful" });
    const line = formatDiagnosticLine(d);
    expect(line).toContain("Warning");
    expect(line).toContain("Be careful");
  });

  it("formats an Info severity diagnostic", () => {
    const d = makeDiagnostic({ severity: 3, message: "FYI" });
    const line = formatDiagnosticLine(d);
    expect(line).toContain("Info");
    expect(line).toContain("FYI");
  });

  it("formats a Hint severity diagnostic", () => {
    const d = makeDiagnostic({ severity: 4, message: "Try this" });
    const line = formatDiagnosticLine(d);
    expect(line).toContain("Hint");
    expect(line).toContain("Try this");
  });

  it("includes source when present", () => {
    const d = makeDiagnostic({ source: "typescript" });
    const line = formatDiagnosticLine(d);
    expect(line).toContain("[typescript]");
  });

  it("omits source when absent", () => {
    const d = makeDiagnostic();
    const line = formatDiagnosticLine(d);
    expect(line).not.toContain("[");
  });

  it("includes code when present", () => {
    const d = makeDiagnostic({ code: 2322 });
    const line = formatDiagnosticLine(d);
    expect(line).toContain("(2322)");
  });

  it("omits code when undefined", () => {
    const d = makeDiagnostic();
    const line = formatDiagnosticLine(d);
    expect(line).not.toContain("()");
  });

  it("uses correct line/col (1-indexed)", () => {
    const d = makeDiagnostic({
      range: {
        start: { line: 5, character: 10 },
        end: { line: 5, character: 15 },
      },
    });
    const line = formatDiagnosticLine(d);
    // line 5 → displayed as 6, char 10 → displayed as 11
    expect(line).toContain("6:11");
  });

  it("defaults to '?' severity when severity is undefined", () => {
    const d = makeDiagnostic({ severity: undefined });
    const line = formatDiagnosticLine(d);
    expect(line).toContain("?:");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// countSeverities
// ═══════════════════════════════════════════════════════════════════════════

describe("countSeverities", () => {
  function makeDiagnostic(severity: number): Diagnostic {
    return {
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 1 },
      },
      message: "",
      severity,
    };
  }

  it("returns zeros for empty array", () => {
    const result = countSeverities([]);
    expect(result).toEqual({ errors: 0, warnings: 0, info: 0 });
  });

  it("counts errors (severity 1)", () => {
    const result = countSeverities([makeDiagnostic(1), makeDiagnostic(1)]);
    expect(result).toEqual({ errors: 2, warnings: 0, info: 0 });
  });

  it("counts warnings (severity 2)", () => {
    const result = countSeverities([makeDiagnostic(2), makeDiagnostic(2), makeDiagnostic(2)]);
    expect(result).toEqual({ errors: 0, warnings: 3, info: 0 });
  });

  it("counts info (severity 3 and 4)", () => {
    const result = countSeverities([makeDiagnostic(3), makeDiagnostic(4)]);
    expect(result).toEqual({ errors: 0, warnings: 0, info: 2 });
  });

  it("handles mixed severities", () => {
    const diagnostics = [
      makeDiagnostic(1),
      makeDiagnostic(2),
      makeDiagnostic(3),
      makeDiagnostic(4),
      makeDiagnostic(1),
      makeDiagnostic(2),
    ];
    const result = countSeverities(diagnostics);
    expect(result).toEqual({ errors: 2, warnings: 2, info: 2 });
  });

  it("ignores undefined severity (counts as neither)", () => {
    const d: Diagnostic = {
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
      message: "",
    };
    const result = countSeverities([d]);
    expect(result).toEqual({ errors: 0, warnings: 0, info: 0 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// formatLocations
// ═══════════════════════════════════════════════════════════════════════════

describe("formatLocations", () => {
  function makeLocation(uri: string, line: number, character: number): Location {
    return {
      uri,
      range: {
        start: { line, character },
        end: { line, character: character + 1 },
      },
    };
  }

  it("returns '(none)' for empty array", () => {
    expect(formatLocations([])).toBe("(none)");
  });

  it("formats a single location", () => {
    const locations = [makeLocation("file:///src/index.ts", 4, 10)];
    const result = formatLocations(locations);
    expect(result).toContain("/src/index.ts");
    expect(result).toContain("5:11");
  });

  it("formats multiple locations", () => {
    const locations = [
      makeLocation("file:///src/a.ts", 0, 0),
      makeLocation("file:///src/b.ts", 9, 5),
    ];
    const result = formatLocations(locations);
    const lines = result.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("/src/a.ts");
    expect(lines[1]).toContain("/src/b.ts");
    expect(lines[0]).toContain("1:1");
    expect(lines[1]).toContain("10:6");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// flattenLocations
// ═══════════════════════════════════════════════════════════════════════════

describe("flattenLocations", () => {
  function makeLocation(uri: string): Location {
    return {
      uri,
      range: {
        start: { line: 0, character: 0 },
        end: { line: 0, character: 1 },
      },
    };
  }

  it("returns empty array for null", () => {
    expect(flattenLocations(null)).toEqual([]);
  });

  it("wraps a single Location in an array", () => {
    const loc = makeLocation("file:///a.ts");
    expect(flattenLocations(loc)).toEqual([loc]);
  });

  it("returns Location[] as-is", () => {
    const locs = [makeLocation("file:///a.ts"), makeLocation("file:///b.ts")];
    expect(flattenLocations(locs)).toEqual(locs);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// applyEdits
// ═══════════════════════════════════════════════════════════════════════════

describe("applyEdits", () => {
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

  it("applies a single edit", () => {
    const text = "hello world";
    const edits = [makeTextEdit(0, 0, 0, 5, "goodbye")];
    expect(applyEdits(text, edits)).toBe("goodbye world");
  });

  it("applies multiple edits (reverse order)", () => {
    const text = "line1\nline2\nline3";
    const edits = [
      makeTextEdit(0, 0, 0, 5, "LINE1"),
      makeTextEdit(2, 0, 2, 5, "LINE3"),
    ];
    // Should be applied in reverse position order, so later edits don't shift earlier ones
    const result = applyEdits(text, edits);
    expect(result).toBe("LINE1\nline2\nLINE3");
  });

  it("handles insertion (empty range)", () => {
    const text = "hello";
    const edits = [makeTextEdit(0, 5, 0, 5, " world")];
    expect(applyEdits(text, edits)).toBe("hello world");
  });

  it("handles deletion (empty newText)", () => {
    const text = "hello world";
    const edits = [makeTextEdit(0, 5, 0, 11, "")];
    expect(applyEdits(text, edits)).toBe("hello");
  });

  it("handles multiline replacement", () => {
    const text = "a\nb\nc";
    const edits = [makeTextEdit(0, 1, 2, 0, "X\nY\n")];
    expect(applyEdits(text, edits)).toBe("aX\nY\nc");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// buildDiff
// ═══════════════════════════════════════════════════════════════════════════

describe("buildDiff", () => {
  it("produces unified diff with header and hunk markers", () => {
    const original = "foo\nbar\nbaz";
    const modified = "foo\nqux\nbaz";
    const diff = buildDiff("test.txt", original, modified);
    expect(diff).toContain("--- a/test.txt");
    expect(diff).toContain("+++ b/test.txt");
    expect(diff).toContain("-bar");
    expect(diff).toContain("+qux");
  });

  it("shows (no changes) when content is identical", () => {
    const text = "same content";
    const diff = buildDiff("same.txt", text, text);
    expect(diff).toContain("(no changes)");
  });

  it("handles added lines", () => {
    const original = "a\nb";
    const modified = "a\nb\nc";
    const diff = buildDiff("add.txt", original, modified);
    expect(diff).toContain("+c");
  });

  it("handles removed lines", () => {
    const original = "a\nb\nc";
    const modified = "a\nc";
    const diff = buildDiff("remove.txt", original, modified);
    expect(diff).toContain("-b");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// parseSymbolKind
// ═══════════════════════════════════════════════════════════════════════════

describe("parseSymbolKind", () => {
  it("parses a numeric string to SymbolKind", () => {
    expect(parseSymbolKind("5")).toBe(5); // Class
  });

  it("parses a kind name (case-insensitive) to SymbolKind", () => {
    expect(parseSymbolKind("class")).toBe(5);
    expect(parseSymbolKind("Class")).toBe(5);
    expect(parseSymbolKind("CLASS")).toBe(5);
  });

  it("parses function kind", () => {
    expect(parseSymbolKind("function")).toBe(12);
    expect(parseSymbolKind("12")).toBe(12);
  });

  it("returns undefined for invalid kind", () => {
    expect(parseSymbolKind("invalid")).toBeUndefined();
    expect(parseSymbolKind("999")).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// MAX_SYMBOL_RESULTS
// ═══════════════════════════════════════════════════════════════════════════

describe("MAX_SYMBOL_RESULTS", () => {
  it("is 50", () => {
    expect(MAX_SYMBOL_RESULTS).toBe(50);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// formatDocumentSymbols
// ═══════════════════════════════════════════════════════════════════════════

describe("formatDocumentSymbols", () => {
  it("formats a flat list of symbols", () => {
    const symbols = [
      {
        name: "MyClass",
        kind: 5,
        range: { start: { line: 2, character: 0 }, end: { line: 10, character: 1 } },
        children: [],
      },
    ];
    const result = formatDocumentSymbols(symbols as any);
    expect(result).toContain("Class MyClass (line 3)");
  });

  it("formats nested children with indentation", () => {
    const symbols = [
      {
        name: "Outer",
        kind: 5,
        range: { start: { line: 0, character: 0 }, end: { line: 5, character: 1 } },
        children: [
          {
            name: "inner",
            kind: 6,
            range: { start: { line: 1, character: 0 }, end: { line: 3, character: 1 } },
            children: [],
          },
        ],
      },
    ];
    const result = formatDocumentSymbols(symbols as any);
    expect(result).toContain("Class Outer (line 1)");
    expect(result).toContain("  Method inner (line 2)");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ok() / err() / sanitizeError()
// ═══════════════════════════════════════════════════════════════════════════

describe("ok()", () => {
  it("builds a successful result with text content", () => {
    const result = ok("all good");
    expect(result.isError).toBe(false);
    expect(result.content).toEqual([{ type: "text", text: "all good" }]);
  });

  it("includes details when provided", () => {
    const result = ok("done", { count: 5 });
    expect(result.details).toEqual({ count: 5 });
  });

  it("defaults details to empty object", () => {
    const result = ok("done");
    expect(result.details).toEqual({});
  });
});

describe("err()", () => {
  it("builds an error result with text content", () => {
    const result = err("something failed");
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: "something failed" }]);
  });

  it("includes details when provided", () => {
    const result = err("fail", { code: -32001 });
    expect(result.details).toEqual({ code: -32001 });
  });

  it("defaults details to empty object", () => {
    const result = err("fail");
    expect(result.details).toEqual({});
  });
});

describe("sanitizeError()", () => {
  it("sanitizes home directory paths", () => {
    const result = sanitizeError(new Error("/home/user/secret/file.ts"), "test");
    expect(result).toContain("test:");
    expect(result).toContain("~/secret/file.ts");
    expect(result).not.toContain("/home/user");
  });

  it("handles non-Error values", () => {
    const result = sanitizeError("plain string error", "ctx");
    expect(result).toContain("ctx: plain string error");
  });

  it("prefixes with context", () => {
    const result = sanitizeError(new Error("bad"), "MyContext");
    expect(result).toMatch(/^MyContext:/);
  });
});
