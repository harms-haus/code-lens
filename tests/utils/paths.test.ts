import { describe, it, expect, vi } from "vitest";
import * as path from "node:path";
import {
  resolveFile,
  uriToFilePath,
  filePathToUri,
  isWithinWorkspace,
} from "../../src/utils/paths.js";

describe("paths", () => {
  describe("resolveFile", () => {
    it("resolves a relative path against cwd", () => {
      const cwd = "/project";
      const result = resolveFile("src/index.ts", cwd);
      // Should be normalized and absolute
      expect(path.isAbsolute(result)).toBe(true);
      expect(result).toBe(path.normalize("/project/src/index.ts"));
    });

    it("returns an absolute path as-is (normalized)", () => {
      const result = resolveFile("/absolute/path/file.ts", "/project");
      expect(result).toBe(path.normalize("/absolute/path/file.ts"));
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
      const cwd = "/project";
      const result = resolveFile("./src/file.ts", cwd);
      expect(result).toBe(path.normalize("/project/src/file.ts"));
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

    it("handles URI without file:// (returns as-is minus prefix)", () => {
      expect(uriToFilePath("/just/a/path")).toBe("/just/a/path");
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
});
