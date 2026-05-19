import { describe, it, expect } from "vitest";
import {
  // output
  ok,
  err,
  sanitizeError,
  // diagnostics
  formatDiagnosticLine,
  countSeverities,
  SEVERITY_NAMES,
  // paths
  flattenLocations,
  formatLocations,
  // symbols
  SYMBOL_KIND_NAMES,
  parseSymbolKind,
  formatDocumentSymbols,
  formatSymbolInformationList,
  MAX_SYMBOL_RESULTS,
  // diff
  applyEdits,
  buildDiff,
  sortEdits,
  extractTextFromRange,
  extractWordAtPosition,
  applyEditsAndDiff,
} from "../../src/formatting/index.js";

// ═══════════════════════════════════════════════════════════════════════════
// Barrel export verification — ensures the index re-exports every symbol
// ═══════════════════════════════════════════════════════════════════════════

describe("formatting/index barrel exports", () => {
  describe("output exports (ok, err, sanitizeError)", () => {
    it("exports ok as a defined function", () => {
      expect(ok).toBeDefined();
      expect(typeof ok).toBe("function");
    });

    it("exports err as a defined function", () => {
      expect(err).toBeDefined();
      expect(typeof err).toBe("function");
    });

    it("exports sanitizeError as a defined function", () => {
      expect(sanitizeError).toBeDefined();
      expect(typeof sanitizeError).toBe("function");
    });
  });

  describe("diagnostics exports (formatDiagnosticLine, countSeverities, SEVERITY_NAMES)", () => {
    it("exports formatDiagnosticLine as a defined function", () => {
      expect(formatDiagnosticLine).toBeDefined();
      expect(typeof formatDiagnosticLine).toBe("function");
    });

    it("exports countSeverities as a defined function", () => {
      expect(countSeverities).toBeDefined();
      expect(typeof countSeverities).toBe("function");
    });

    it("exports SEVERITY_NAMES as a defined array", () => {
      expect(SEVERITY_NAMES).toBeDefined();
      expect(Array.isArray(SEVERITY_NAMES)).toBe(true);
    });
  });

  describe("paths exports (flattenLocations, formatLocations)", () => {
    it("exports flattenLocations as a defined function", () => {
      expect(flattenLocations).toBeDefined();
      expect(typeof flattenLocations).toBe("function");
    });

    it("exports formatLocations as a defined function", () => {
      expect(formatLocations).toBeDefined();
      expect(typeof formatLocations).toBe("function");
    });
  });

  describe("symbols exports", () => {
    it("exports SYMBOL_KIND_NAMES as a defined object", () => {
      expect(SYMBOL_KIND_NAMES).toBeDefined();
      expect(typeof SYMBOL_KIND_NAMES).toBe("object");
    });

    it("exports parseSymbolKind as a defined function", () => {
      expect(parseSymbolKind).toBeDefined();
      expect(typeof parseSymbolKind).toBe("function");
    });

    it("exports formatDocumentSymbols as a defined function", () => {
      expect(formatDocumentSymbols).toBeDefined();
      expect(typeof formatDocumentSymbols).toBe("function");
    });

    it("exports formatSymbolInformationList as a defined function", () => {
      expect(formatSymbolInformationList).toBeDefined();
      expect(typeof formatSymbolInformationList).toBe("function");
    });

    it("exports MAX_SYMBOL_RESULTS as a defined number", () => {
      expect(MAX_SYMBOL_RESULTS).toBeDefined();
      expect(typeof MAX_SYMBOL_RESULTS).toBe("number");
    });
  });

  describe("diff exports", () => {
    it("exports applyEdits as a defined function", () => {
      expect(applyEdits).toBeDefined();
      expect(typeof applyEdits).toBe("function");
    });

    it("exports buildDiff as a defined function", () => {
      expect(buildDiff).toBeDefined();
      expect(typeof buildDiff).toBe("function");
    });

    it("exports sortEdits as a defined function", () => {
      expect(sortEdits).toBeDefined();
      expect(typeof sortEdits).toBe("function");
    });

    it("exports extractTextFromRange as a defined function", () => {
      expect(extractTextFromRange).toBeDefined();
      expect(typeof extractTextFromRange).toBe("function");
    });

    it("exports extractWordAtPosition as a defined function", () => {
      expect(extractWordAtPosition).toBeDefined();
      expect(typeof extractWordAtPosition).toBe("function");
    });

    it("exports applyEditsAndDiff as a defined function", () => {
      expect(applyEditsAndDiff).toBeDefined();
      expect(typeof applyEditsAndDiff).toBe("function");
    });
  });
});
