import { describe, it, expect } from "vitest";
import type { Diagnostic } from "vscode-languageserver-types";

import {
  formatDiagnosticLine,
  countSeverities,
  SEVERITY_NAMES,
} from "../../src/formatting/diagnostics.js";

// ═══════════════════════════════════════════════════════════════════════════
// SEVERITY_NAMES
// ═══════════════════════════════════════════════════════════════════════════

describe("SEVERITY_NAMES", () => {
  it("contains correct values", () => {
    expect(SEVERITY_NAMES).toEqual(["?", "Error", "Warning", "Info", "Hint"]);
  });

  it("has index 0 = '?', 1 = 'Error', 2 = 'Warning', 3 = 'Info', 4 = 'Hint'", () => {
    expect(SEVERITY_NAMES[0]).toBe("?");
    expect(SEVERITY_NAMES[1]).toBe("Error");
    expect(SEVERITY_NAMES[2]).toBe("Warning");
    expect(SEVERITY_NAMES[3]).toBe("Info");
    expect(SEVERITY_NAMES[4]).toBe("Hint");
  });
});

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
