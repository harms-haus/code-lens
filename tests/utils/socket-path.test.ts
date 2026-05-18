import { describe, it, expect } from "vitest";
import * as os from "node:os";
import * as path from "node:path";
import { getSocketPath, getMetadataPath } from "../../src/utils/socket-path.js";

describe("socket-path", () => {
  describe("getSocketPath", () => {
    it("is deterministic (same cwd always produces same path)", () => {
      const a = getSocketPath("/project");
      const b = getSocketPath("/project");
      expect(a).toBe(b);
    });

    it("produces different paths for different cwds", () => {
      const a = getSocketPath("/project-a");
      const b = getSocketPath("/project-b");
      expect(a).not.toBe(b);
    });

    it("contains the hash suffix with .sock extension (on Unix)", () => {
      const result = getSocketPath("/my-project");
      if (process.platform !== "win32") {
        expect(result).toMatch(/code-lens-[a-f0-9]{16}\.sock$/);
        expect(result).toContain(os.tmpdir());
      }
    });

    it("uses named pipe format on Windows", () => {
      const originalPlatform = process.platform;
      if (originalPlatform === "win32") {
        const result = getSocketPath("C:\\Users\\dev\\project");
        expect(result).toMatch(/^\\\\\.\\pipe\\code-lens-[a-f0-9]{16}$/);
      }
      // On non-Windows, we just verify it doesn't use pipe format
      else {
        const result = getSocketPath("/project");
        expect(result).not.toContain("\\\\.\\pipe\\");
      }
    });
  });

  describe("getMetadataPath", () => {
    it("returns a path under ~/.code-lens/", () => {
      const result = getMetadataPath("/my-project");
      const expectedDir = path.join(os.homedir(), ".code-lens");
      expect(result).toContain(expectedDir);
    });

    it("ends with .json", () => {
      const result = getMetadataPath("/my-project");
      expect(result).toMatch(/\.json$/);
    });

    it("is deterministic for same cwd", () => {
      const a = getMetadataPath("/project");
      const b = getMetadataPath("/project");
      expect(a).toBe(b);
    });

    it("differs for different cwds", () => {
      const a = getMetadataPath("/project-a");
      const b = getMetadataPath("/project-b");
      expect(a).not.toBe(b);
    });

    it("uses the same hash as getSocketPath for the same cwd", () => {
      const socketPath = getSocketPath("/test-project");
      const metadataPath = getMetadataPath("/test-project");
      // Both should contain the same hash substring
      const socketMatch = socketPath.match(/code-lens-([a-f0-9]{16})/);
      const metaMatch = metadataPath.match(/([a-f0-9]{16})\.json/);
      expect(socketMatch).not.toBeNull();
      expect(metaMatch).not.toBeNull();
      expect(socketMatch![1]).toBe(metaMatch![1]);
    });
  });
});
