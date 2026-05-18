/**
 * Socket path utilities for daemon communication
 */

import * as crypto from "node:crypto";
import * as os from "node:os";
import * as path from "node:path";

/** Get the socket path for IPC with the daemon for a given working directory */
export function getSocketPath(cwd: string): string {
  const hash = crypto
    .createHash("sha256")
    .update(cwd)
    .digest("hex")
    .slice(0, 16);
  if (process.platform === "win32") {
    return `\\\\.\\pipe\\code-lens-${hash}`;
  }
  return path.join(os.tmpdir(), `code-lens-${hash}.sock`);
}

/** Get the metadata file path for a given working directory */
export function getMetadataPath(cwd: string): string {
  const hash = crypto
    .createHash("sha256")
    .update(cwd)
    .digest("hex")
    .slice(0, 16);
  const dir = path.join(os.homedir(), ".code-lens");
  return path.join(dir, `${hash}.json`);
}

/** Metadata stored about a running daemon */
export interface DaemonMetadata {
  pid: number;
  socketPath: string;
  version: string;
  cwd: string;
}
