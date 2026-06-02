import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import {
  readMetadata,
  isDaemonRunning,
  DAEMON_VERSION,
  startDaemon,
  ensureDaemon,
  stopDaemon,
} from "../../src/daemon/lifecycle.js";
import { getMetadataPath, getSocketPath } from "../../src/utils/socket-path.js";
import { getSanitizedEnv } from "../../src/utils/env.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import spawn from "cross-spawn";

// ── Mocks ──────────────────────────────────────────────────────────────────

// node:child_process is already mocked globally by tests/setup.ts.
// node:fs and probeSocket are mocked here for the new test suites.

vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    readFileSync: vi.fn(),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
    mkdirSync: vi.fn(),
  };
});

vi.mock("../../src/daemon/client.js", () => ({
  probeSocket: vi.fn(),
}));

// Import the mocked probeSocket so we can configure it in tests
import { probeSocket } from "../../src/daemon/client.js";

// ── Helpers ────────────────────────────────────────────────────────────────

const TEST_CWD = path.join(os.tmpdir(), "test-project");
const mockSocketPath = getSocketPath(TEST_CWD);
const mockMetadataPath = getMetadataPath(TEST_CWD);

/** Create a mock child process object with a given pid */
function mockChildProcess(pid: number) {
  return {
    pid,
    unref: vi.fn(),
    stdout: null,
    stderr: null,
    stdin: null,
    on: vi.fn(),
    removeAllListeners: vi.fn(),
  };
}

// ── Test suites ────────────────────────────────────────────────────────────

describe("daemon/lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  // ── DAEMON_VERSION ──────────────────────────────────────────────────────

  describe("DAEMON_VERSION", () => {
    it('is "0.1.0"', () => {
      expect(DAEMON_VERSION).toBe("0.1.0");
    });
  });

  // ── readMetadata ────────────────────────────────────────────────────────

  describe("readMetadata", () => {
    it("returns null when readFileSync throws (file not found)", () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error("ENOENT");
      });
      expect(readMetadata(TEST_CWD)).toBeNull();
    });

    it("returns parsed metadata when file exists", () => {
      const metadata = {
        pid: 12345,
        socketPath: mockSocketPath,
        version: "0.1.0",
        cwd: TEST_CWD,
      };
      vi.mocked(fs.readFileSync).mockReturnValue(JSON.stringify(metadata));
      const result = readMetadata(TEST_CWD);
      expect(result).not.toBeNull();
      expect(result!.pid).toBe(12345);
      expect(result!.socketPath).toBe(mockSocketPath);
      expect(result!.version).toBe("0.1.0");
      expect(result!.cwd).toBe(TEST_CWD);
    });

    it("returns null for invalid JSON", () => {
      vi.mocked(fs.readFileSync).mockReturnValue("not valid json{{{");
      expect(readMetadata(TEST_CWD)).toBeNull();
    });
  });

  // ── isDaemonRunning ─────────────────────────────────────────────────────

  describe("isDaemonRunning", () => {
    it("returns true when probeSocket returns true", async () => {
      vi.mocked(probeSocket).mockResolvedValue(true);
      expect(await isDaemonRunning(TEST_CWD)).toBe(true);
      expect(probeSocket).toHaveBeenCalledWith(mockSocketPath);
    });

    it("returns false when probeSocket returns false", async () => {
      vi.mocked(probeSocket).mockResolvedValue(false);
      expect(await isDaemonRunning(TEST_CWD)).toBe(false);
    });
  });

  // ── startDaemon ─────────────────────────────────────────────────────────

  describe("startDaemon", () => {
    let mockSpawn: Mock;
    let childProcess: ReturnType<typeof mockChildProcess>;

    beforeEach(() => {
      childProcess = mockChildProcess(99999);
      mockSpawn = vi.mocked(spawn);
      mockSpawn.mockReturnValue(childProcess as ReturnType<typeof spawn>);

      // By default, probeSocket resolves true on first call (daemon ready)
      vi.mocked(probeSocket).mockResolvedValue(true);
    });

    it("spawns process with correct env vars", async () => {
      await startDaemon(TEST_CWD);

      expect(mockSpawn).toHaveBeenCalledTimes(1);
      const [execPath, args, options] = mockSpawn.mock.calls[0];

      expect(execPath).toBe(process.execPath);
      // Second arg should be a path ending with server.js
      expect(args[0]).toMatch(/server\.js$/);

      expect(options).toMatchObject({
        detached: true,
        stdio: "ignore",
        windowsHide: true,
        env: {
          ...getSanitizedEnv(),
          CODE_LENS_SOCKET_PATH: mockSocketPath,
          CODE_LENS_CWD: TEST_CWD,
        },
      });
    });

    it("writes metadata file after startup", async () => {
      await startDaemon(TEST_CWD);

      // Should ensure directory exists
      expect(fs.mkdirSync).toHaveBeenCalledWith(
        path.dirname(mockMetadataPath),
        { recursive: true },
      );

      // Should write metadata JSON
      expect(fs.writeFileSync).toHaveBeenCalledTimes(1);
      const [filePath, content] = vi.mocked(fs.writeFileSync).mock.calls[0];
      expect(filePath).toBe(mockMetadataPath);

      const parsed = JSON.parse(content as string);
      expect(parsed).toMatchObject({
        pid: 99999,
        socketPath: mockSocketPath,
        version: DAEMON_VERSION,
        cwd: TEST_CWD,
      });
    });

    it("polls socket until ready", async () => {
      // First two polls return false, third returns true
      vi.mocked(probeSocket)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(false)
        .mockResolvedValueOnce(true);

      await startDaemon(TEST_CWD);

      expect(probeSocket).toHaveBeenCalledTimes(3);
      // All calls should be to the socket path
      for (const call of vi.mocked(probeSocket).mock.calls) {
        expect(call[0]).toBe(mockSocketPath);
      }
    });
  });

  // ── ensureDaemon ────────────────────────────────────────────────────────

  describe("ensureDaemon", () => {
    let startDaemonSpy: ReturnType<typeof vi.spyOn>;
    let stopDaemonSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      // Spy on the module's own exports so we can track calls
      // We import * as lifecycleMod at the bottom of this approach.
      // Instead, let's spy directly — but since these are the functions
      // under test from the same module, we need to be careful.
      // We'll use vi.spyOn on the module namespace.
    });

    it("daemon running with matching version → no restart", async () => {
      vi.mocked(probeSocket).mockResolvedValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          pid: 12345,
          socketPath: mockSocketPath,
          version: DAEMON_VERSION,
          cwd: TEST_CWD,
        }),
      );

      // Should NOT call spawn
      await ensureDaemon(TEST_CWD);
      expect(spawn).not.toHaveBeenCalled();
    });

    it("daemon running with mismatched version → stopDaemon then startDaemon", async () => {
      vi.mocked(probeSocket).mockResolvedValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          pid: 12345,
          socketPath: mockSocketPath,
          version: "99.99.99",
          cwd: TEST_CWD,
        }),
      );

      // Mock process.kill so stopDaemon doesn't fail
      const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true);

      // Mock spawn for startDaemon
      const childProcess = mockChildProcess(88888);
      vi.mocked(spawn).mockReturnValue(childProcess as ReturnType<typeof spawn>);

      await ensureDaemon(TEST_CWD);

      // stopDaemon should have killed the old process
      expect(killSpy).toHaveBeenCalledWith(12345, "SIGTERM");

      // startDaemon should have spawned a new process
      expect(spawn).toHaveBeenCalledTimes(1);

      killSpy.mockRestore();
    });

    it("daemon not running → startDaemon called", async () => {
      // First call: isDaemonRunning → false (daemon not running)
      // Second call: startDaemon poll → true (daemon becomes ready)
      vi.mocked(probeSocket)
        .mockResolvedValueOnce(false)
        .mockResolvedValue(true);

      // Mock spawn for startDaemon
      const childProcess = mockChildProcess(77777);
      vi.mocked(spawn).mockReturnValue(childProcess as ReturnType<typeof spawn>);

      await ensureDaemon(TEST_CWD);

      expect(spawn).toHaveBeenCalledTimes(1);

      // unlinkSync should be called via cleanFiles
      expect(fs.unlinkSync).toHaveBeenCalled();
    });
  });

  // ── stopDaemon ──────────────────────────────────────────────────────────

  describe("stopDaemon", () => {
    it("with metadata → kills process and cleans files", async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          pid: 12345,
          socketPath: mockSocketPath,
          version: DAEMON_VERSION,
          cwd: TEST_CWD,
        }),
      );

      const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true);

      await stopDaemon(TEST_CWD);

      expect(killSpy).toHaveBeenCalledWith(12345, "SIGTERM");
      // cleanFiles should unlink both socket and metadata
      expect(fs.unlinkSync).toHaveBeenCalledTimes(2);

      killSpy.mockRestore();
    });

    it("without metadata → just cleans files", async () => {
      vi.mocked(fs.readFileSync).mockImplementation(() => {
        throw new Error("ENOENT");
      });

      const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true);

      await stopDaemon(TEST_CWD);

      // process.kill should NOT be called
      expect(killSpy).not.toHaveBeenCalled();

      // cleanFiles should still unlink (both may throw, which is caught)
      expect(fs.unlinkSync).toHaveBeenCalledTimes(2);

      killSpy.mockRestore();
    });

    it("kill throws (process already dead) → no error thrown", async () => {
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          pid: 12345,
          socketPath: mockSocketPath,
          version: DAEMON_VERSION,
          cwd: TEST_CWD,
        }),
      );

      const killSpy = vi
        .spyOn(process, "kill")
        .mockImplementation(() => {
          throw new Error("ESRCH: process not found");
        });

      // Should NOT throw
      await expect(stopDaemon(TEST_CWD)).resolves.toBeUndefined();

      expect(killSpy).toHaveBeenCalledWith(12345, "SIGTERM");
      // Files should still be cleaned
      expect(fs.unlinkSync).toHaveBeenCalledTimes(2);

      killSpy.mockRestore();
    });
  });
});
