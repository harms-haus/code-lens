import { describe, it, expect } from "vitest";
import { FORMATTER_DEFINITIONS } from "../../src/linting/formatter-definitions.js";

const prettier = FORMATTER_DEFINITIONS[0]!;
const parseOutput = prettier.parseOutput;

describe("formatter-definitions", () => {
  describe("prettier parseOutput", () => {
    it("returns empty array for empty string", () => {
      const result = parseOutput("", "/test/cwd");
      expect(result).toEqual([]);
    });

    it("parses a single file path", () => {
      const result = parseOutput("src/foo.ts\n", "/test/cwd");
      expect(result).toEqual([
        { source: "prettier", file: "src/foo.ts", changed: true },
      ]);
    });

    it("parses multiple file paths", () => {
      const result = parseOutput("src/foo.ts\nsrc/bar.ts\nsrc/baz.css\n", "/test/cwd");
      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ source: "prettier", file: "src/foo.ts", changed: true });
      expect(result[1]).toEqual({ source: "prettier", file: "src/bar.ts", changed: true });
      expect(result[2]).toEqual({ source: "prettier", file: "src/baz.css", changed: true });
    });

    it("trims whitespace from file paths", () => {
      const result = parseOutput("  src/foo.ts  \n  src/bar.ts  \n", "/test/cwd");
      expect(result).toEqual([
        { source: "prettier", file: "src/foo.ts", changed: true },
        { source: "prettier", file: "src/bar.ts", changed: true },
      ]);
    });

    it("diagnoseCommand includes --list-different (regression guard)", () => {
      const args = prettier.diagnoseCommand(["a.ts"]);
      expect(args).toContain("--list-different");
      expect(args).not.toContain("--check");
    });
  });
});
