import { describe, it, expect, vi } from "vitest";
import {
  readMetadata,
  isDaemonRunning,
  DAEMON_VERSION,
} from "../../src/daemon/lifecycle.js";
import { getMetadataPath } from "../../src/utils/socket-path.js";
import * as fs from "node:fs";
import * as path from "node:path";

describe("daemon/lifecycle", () => {
  describe("DAEMON_VERSION", () => {
    it('is "0.1.0"', () => {
      expect(DAEMON_VERSION).toBe("0.1.0");
    });
  });

  describe("readMetadata", () => {
    it("returns null for non-existent metadata file", () => {
      const result = readMetadata("/nonexistent/path/that/does/not/exist");
      expect(result).toBeNull();
    });

    it("returns parsed metadata when file exists", () => {
      const cwd = "/tmp/code-lens-test-" + Date.now();
      const metadataPath = getMetadataPath(cwd);

      const metadata = {
        pid: 12345,
        socketPath: "/tmp/test-socket.sock",
        version: "0.1.0",
        cwd,
      };

      // Ensure directory exists
      fs.mkdirSync(path.dirname(metadataPath), { recursive: true });
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");

      const result = readMetadata(cwd);
      expect(result).not.toBeNull();
      expect(result!.pid).toBe(12345);
      expect(result!.socketPath).toBe("/tmp/test-socket.sock");
      expect(result!.version).toBe("0.1.0");
      expect(result!.cwd).toBe(cwd);

      // Cleanup
      fs.unlinkSync(metadataPath);
    });

    it("returns null for invalid JSON", () => {
      const cwd = "/tmp/code-lens-test-invalid-" + Date.now();
      const metadataPath = getMetadataPath(cwd);

      fs.mkdirSync(path.dirname(metadataPath), { recursive: true });
      fs.writeFileSync(metadataPath, "not valid json{{{", "utf-8");

      const result = readMetadata(cwd);
      expect(result).toBeNull();

      // Cleanup
      fs.unlinkSync(metadataPath);
    });
  });

  describe("isDaemonRunning", () => {
    it("returns false when no daemon is running (non-existent socket)", async () => {
      const result = await isDaemonRunning("/nonexistent/path/for/test-" + Date.now());
      expect(result).toBe(false);
    });
  });
});
