import { describe, it, expect } from "vitest";
import {
  extractPositionParams,
  extractRenameParams,
} from "../../src/commands/params.js";

// ═══════════════════════════════════════════════════════════════════════════
// extractPositionParams
// ═══════════════════════════════════════════════════════════════════════════

describe("extractPositionParams", () => {
  it("returns ok with valid params", () => {
    const result = extractPositionParams({ file: "a.ts", line: 5, col: 10 });
    expect(result).toEqual({
      ok: true,
      params: { file: "a.ts", line: 5, col: 10 },
    });
  });

  it("returns error when file is missing", () => {
    const result = extractPositionParams({ line: 5, col: 10 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.isError).toBe(true);
      expect(result.error.content[0].text).toContain("file");
    }
  });

  it("returns error when file is empty string", () => {
    const result = extractPositionParams({ file: "", line: 5, col: 10 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.isError).toBe(true);
    }
  });

  it("returns error when line is missing", () => {
    const result = extractPositionParams({ file: "a.ts", col: 10 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.isError).toBe(true);
      expect(result.error.content[0].text).toContain("line");
    }
  });

  it("returns error when line is NaN", () => {
    const result = extractPositionParams({ file: "a.ts", line: NaN, col: 10 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.isError).toBe(true);
    }
  });

  it("returns error when line is Infinity", () => {
    const result = extractPositionParams({
      file: "a.ts",
      line: Infinity,
      col: 10,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.isError).toBe(true);
    }
  });

  it("returns error when line is 0", () => {
    const result = extractPositionParams({ file: "a.ts", line: 0, col: 10 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.isError).toBe(true);
    }
  });

  it("returns error when line is negative", () => {
    const result = extractPositionParams({ file: "a.ts", line: -1, col: 10 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.isError).toBe(true);
    }
  });

  it("returns error when col is missing", () => {
    const result = extractPositionParams({ file: "a.ts", line: 5 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.isError).toBe(true);
      expect(result.error.content[0].text).toContain("col");
    }
  });

  it("returns error when col is NaN", () => {
    const result = extractPositionParams({ file: "a.ts", line: 5, col: NaN });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.isError).toBe(true);
    }
  });

  it("returns error when col is 0", () => {
    const result = extractPositionParams({ file: "a.ts", line: 5, col: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.isError).toBe(true);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// extractRenameParams
// ═══════════════════════════════════════════════════════════════════════════

describe("extractRenameParams", () => {
  it("returns ok with valid params including newName", () => {
    const result = extractRenameParams({
      file: "a.ts",
      line: 5,
      col: 10,
      newName: "myNewName",
    });
    expect(result).toEqual({
      ok: true,
      params: { file: "a.ts", line: 5, col: 10, newName: "myNewName" },
    });
  });

  it("returns error when newName is missing", () => {
    const result = extractRenameParams({
      file: "a.ts",
      line: 5,
      col: 10,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.isError).toBe(true);
      expect(result.error.content[0].text).toContain("newName");
    }
  });

  it("returns error when newName is empty string", () => {
    const result = extractRenameParams({
      file: "a.ts",
      line: 5,
      col: 10,
      newName: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.isError).toBe(true);
      expect(result.error.content[0].text).toContain("newName");
    }
  });

  it("returns position error when position is invalid (even with valid newName)", () => {
    const result = extractRenameParams({
      file: "a.ts",
      col: 10,
      newName: "validName",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.isError).toBe(true);
      expect(result.error.content[0].text).toContain("line");
    }
  });
});
