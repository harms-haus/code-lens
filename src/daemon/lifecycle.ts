/**
 * Daemon lifecycle management — start, stop, probe, and version-check
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import type { DaemonMetadata } from "../utils/socket-path.js";
import { getSocketPath, getMetadataPath } from "../utils/socket-path.js";
import { probeSocket } from "./client.js";

/** Current daemon protocol version */
export const DAEMON_VERSION = "0.1.0";

/** Poll interval when waiting for daemon startup */
const POLL_INTERVAL_MS = 50;

/** Maximum number of polls when waiting for daemon startup (10s) */
const MAX_POLL_ATTEMPTS = 200;

// ── Helpers ────────────────────────────────────────────────────────────────

/** Remove socket and metadata files for a given cwd */
function cleanFiles(cwd: string): void {
  const socketPath = getSocketPath(cwd);
  const metadataPath = getMetadataPath(cwd);

  try {
    fs.unlinkSync(socketPath);
  } catch {
    // File may not exist — that's fine
  }
  try {
    fs.unlinkSync(metadataPath);
  } catch {
    // File may not exist — that's fine
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Check whether a daemon is running for the given working directory */
export async function isDaemonRunning(cwd: string): Promise<boolean> {
  const socketPath = getSocketPath(cwd);
  return probeSocket(socketPath);
}

/** Read daemon metadata from disk, or return null if missing/invalid */
export function readMetadata(cwd: string): DaemonMetadata | null {
  const metadataPath = getMetadataPath(cwd);
  try {
    const raw = fs.readFileSync(metadataPath, "utf-8");
    return JSON.parse(raw) as DaemonMetadata;
  } catch {
    return null;
  }
}

/**
 * Spawn a new daemon process and wait for it to become ready.
 *
 * CRITICAL: Uses `import.meta.url` for path resolution, NOT `process.argv[1]`.
 */
export async function startDaemon(cwd: string): Promise<void> {
  const socketPath = getSocketPath(cwd);
  const metadataPath = getMetadataPath(cwd);

  // Resolve server.js path relative to this compiled file
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const serverScript = path.resolve(__dirname, "server.js");

  const child = spawn(process.execPath, [serverScript], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    env: {
      ...process.env,
      CODE_LENS_SOCKET_PATH: socketPath,
      CODE_LENS_CWD: cwd,
    },
  });

  child.unref();

  // Poll until the socket becomes available
  for (let _attempt = 0; _attempt < MAX_POLL_ATTEMPTS; _attempt++) {
    const ready = await probeSocket(socketPath);
    if (ready) {
      // Write metadata
      if (child.pid === undefined) {
        throw new Error("Daemon process failed to start — no PID");
      }

      const metadata: DaemonMetadata = {
        pid: child.pid,
        socketPath,
        version: DAEMON_VERSION,
        cwd,
      };

      // Ensure metadata directory exists
      const metadataDir = path.dirname(metadataPath);
      fs.mkdirSync(metadataDir, { recursive: true });
      fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), "utf-8");
      return;
    }

    // Wait before next poll
    await new Promise<void>((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error("Timed out waiting for daemon to start");
}

/**
 * Ensure a daemon is running for the given cwd.
 * Restarts if the version doesn't match the current DAEMON_VERSION.
 */
export async function ensureDaemon(cwd: string): Promise<void> {
  const running = await isDaemonRunning(cwd);

  if (running) {
    const meta = readMetadata(cwd);
    if (meta && meta.version !== DAEMON_VERSION) {
      // Version mismatch — restart
      await stopDaemon(cwd);
      await startDaemon(cwd);
    }
    return;
  }

  // Not running — clean stale files and start fresh
  cleanFiles(cwd);
  await startDaemon(cwd);
}

/** Stop the daemon for the given working directory */
export async function stopDaemon(cwd: string): Promise<void> {
  const meta = readMetadata(cwd);

  if (meta) {
    try {
      process.kill(meta.pid, "SIGTERM");
    } catch {
      // Process may already be dead — ignore
    }
  }

  // Give the OS a moment to clean up the socket file
  await new Promise<void>((resolve) => setTimeout(resolve, 100));

  cleanFiles(cwd);
}
