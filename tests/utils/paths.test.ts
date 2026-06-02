import { describe, it, expect, vi } from "vitest";
import * as path from "node:path";
import type { Location } from "vscode-languageserver-types";
import {
  resolveFile,
  uriToFilePath,
  filePathToUri,
  isWithinWorkspace,
  flattenLocations,
  formatLocations,
} from "../../src/utils/paths.js";

describe("paths", () => {
  describe("resolveFile", () => {
    it("resolves a relative path against cwd", () => {
      const cwd = process.cwd();
      const result = resolveFile("src/index.ts", cwd);
      // Should be normalized and absolute
      expect(path.isAbsolute(result)).toBe(true);
      expect(result).toBe(path.normalize(path.join(cwd, "src/index.ts")));
    });

    it("returns an absolute path as-is (normalized)", () => {
      const cwd = process.cwd();
      const absFile = path.join(cwd, "src", "index.ts");
      const result = resolveFile(absFile, cwd);
      expect(result).toBe(path.normalize(absFile));
    });

    it("normalizes path traversal attempts with ..", () => {
      // Using a real temp directory so fs.realpathSync works
      const cwd = process.cwd();
      const result = resolveFile("src/../package.json", cwd);
      expect(result).toBe(path.normalize(path.join(cwd, "package.json")));
    });

    it("throws for paths that escape the workspace", () => {
      const cwd = process.cwd();
      expect(() => resolveFile("../../../../etc/passwd", cwd)).toThrow("Path traversal");
    });

    it("handles paths with ./ prefix", () => {
      const cwd = process.cwd();
      const result = resolveFile("./src/file.ts", cwd);
      expect(result).toBe(path.normalize(path.join(cwd, "src/file.ts")));
    });

    it("throws when cwd does not exist on disk", () => {
      expect(() => resolveFile("src/index.ts", "/nonexistent/workspace"))
        .toThrow("Workspace directory is inaccessible");
    });
  });

  describe("uriToFilePath", () => {
    it("strips file:// prefix", () => {
      expect(uriToFilePath("file:///home/user/project/src/index.ts")).toBe(
        "/home/user/project/src/index.ts",
      );
    });

    it("decodes URI-encoded characters", () => {
      expect(uriToFilePath("file:///path/with%20spaces/file.ts")).toBe(
        "/path/with spaces/file.ts",
      );
    });

    it("throws for URI without file:// prefix", () => {
      expect(() => uriToFilePath("/just/a/path")).toThrow();
    });

    it("handles Windows file URIs with drive letters", () => {
      const result = uriToFilePath("file:///C:/Users/test/file.ts");
      // Should NOT start with /C: (leading slash before drive letter is wrong)
      expect(result).not.toMatch(/^\/+C:/);
    });

    it("roundtrips with filePathToUri for Windows-style paths", () => {
      if (process.platform !== "win32") return;
      const winPath = "C:\\Users\\test\\file.ts";
      const uri = filePathToUri(winPath);
      expect(uri).toMatch(/^file:\/\//);
      const back = uriToFilePath(uri);
      expect(back).toBe(winPath);
    });
  });

  describe("filePathToUri", () => {
    it("adds file:// prefix to an absolute path", () => {
      const uri = filePathToUri("/home/user/project/src/index.ts");
      expect(uri).toMatch(/^file:\/\//);
      // Decode and verify roundtrip
      expect(uriToFilePath(uri)).toBe("/home/user/project/src/index.ts");
    });

    it("produces valid URI for paths with spaces", () => {
      const uri = filePathToUri("/path/with spaces/file.ts");
      expect(uri).toContain("file://");
      // The spaces should be URI-encoded
      expect(uri).toContain("%20");
    });
  });

  describe("isWithinWorkspace", () => {
    it("returns true for a file inside workspace", () => {
      const root = process.cwd();
      expect(isWithinWorkspace(path.join(root, "src", "index.ts"), root)).toBe(true);
    });

    it("returns true for the workspace root itself", () => {
      const root = process.cwd();
      expect(isWithinWorkspace(root, root)).toBe(true);
    });

    it("returns false for a file outside workspace", () => {
      const root = process.cwd();
      expect(isWithinWorkspace("/etc/passwd", root)).toBe(false);
    });

    it("returns false for paths using .. to escape", () => {
      const root = process.cwd();
      const escaped = path.resolve(root, "../../etc/passwd");
      expect(isWithinWorkspace(escaped, root)).toBe(false);
    });

    it("handles non-existent files inside existing parent dir", () => {
      const root = process.cwd();
      // Use src/ which exists, but the file doesn't
      const nonExistent = path.join(root, "src", "nonexistent_file_12345.ts");
      expect(isWithinWorkspace(nonExistent, root)).toBe(true);
    });
  });

  // ── flattenLocations ──────────────────────────────────────────────────

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

  // ── formatLocations ───────────────────────────────────────────────────

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
});
