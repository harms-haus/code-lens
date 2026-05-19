import { describe, it, expect } from "vitest";
import {
  parseSymbolKind,
  MAX_SYMBOL_RESULTS,
  SYMBOL_KIND_NAMES,
  formatDocumentSymbols,
  formatSymbolInformationList,
} from "../../src/formatting/symbols.js";

// ═══════════════════════════════════════════════════════════════════════════
// parseSymbolKind
// ═══════════════════════════════════════════════════════════════════════════

describe("parseSymbolKind", () => {
  it("parses a valid numeric string", () => {
    expect(parseSymbolKind("5")).toBe(5);
    expect(parseSymbolKind("12")).toBe(12);
  });

  it("parses a kind name case-insensitively", () => {
    expect(parseSymbolKind("class")).toBe(5);
    expect(parseSymbolKind("Class")).toBe(5);
    expect(parseSymbolKind("CLASS")).toBe(5);
    expect(parseSymbolKind("function")).toBe(12);
    expect(parseSymbolKind("Interface")).toBe(11);
  });

  it("returns undefined for invalid input", () => {
    expect(parseSymbolKind("invalid")).toBeUndefined();
    expect(parseSymbolKind("999")).toBeUndefined();
    expect(parseSymbolKind("")).toBeUndefined();
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
// SYMBOL_KIND_NAMES
// ═══════════════════════════════════════════════════════════════════════════

describe("SYMBOL_KIND_NAMES", () => {
  it("has entries for kinds 1 through 26", () => {
    for (let i = 1; i <= 26; i++) {
      expect(SYMBOL_KIND_NAMES[i]).toBeDefined();
      expect(typeof SYMBOL_KIND_NAMES[i]).toBe("string");
    }
  });

  it("maps 5 to 'Class'", () => {
    expect(SYMBOL_KIND_NAMES[5]).toBe("Class");
  });

  it("maps 12 to 'Function'", () => {
    expect(SYMBOL_KIND_NAMES[12]).toBe("Function");
  });

  it("maps 11 to 'Interface'", () => {
    expect(SYMBOL_KIND_NAMES[11]).toBe("Interface");
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
// formatSymbolInformationList
// ═══════════════════════════════════════════════════════════════════════════

describe("formatSymbolInformationList", () => {
  it("returns empty string for an empty array", () => {
    expect(formatSymbolInformationList([])).toBe("");
  });

  it("formats a single symbol correctly", () => {
    const symbols = [
      {
        name: "MyFunc",
        kind: 12,
        location: {
          uri: "file:///src/index.ts",
          range: { start: { line: 4, character: 0 }, end: { line: 4, character: 10 } },
        },
      },
    ];
    const result = formatSymbolInformationList(symbols as any);
    expect(result).toBe("  Function MyFunc (line 5)");
  });

  it("joins multiple symbols with newlines", () => {
    const symbols = [
      {
        name: "Foo",
        kind: 5,
        location: {
          uri: "file:///src/a.ts",
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
        },
      },
      {
        name: "bar",
        kind: 6,
        location: {
          uri: "file:///src/a.ts",
          range: { start: { line: 3, character: 0 }, end: { line: 3, character: 1 } },
        },
      },
    ];
    const result = formatSymbolInformationList(symbols as any);
    const lines = result.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("  Class Foo (line 1)");
    expect(lines[1]).toBe("  Method bar (line 4)");
  });

  it("shows Kind(N) for unknown symbol kinds", () => {
    const symbols = [
      {
        name: "Weird",
        kind: 99,
        location: {
          uri: "file:///src/a.ts",
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
        },
      },
    ];
    const result = formatSymbolInformationList(symbols as any);
    expect(result).toBe("  Kind(99) Weird (line 1)");
  });
});
