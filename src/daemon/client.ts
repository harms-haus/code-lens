/**
 * CLI-side socket client for daemon communication
 */

import * as net from "node:net";
import * as readline from "node:readline";
import type { DaemonRequest, DaemonResponse } from "./protocol.js";
import type { CommandResult } from "../formatting/output.js";
import { err } from "../formatting/output.js";

/** Default timeout for daemon requests (60 seconds) */
const REQUEST_TIMEOUT_MS = 60_000;

/** Timeout for probe connections (2 seconds) */
const PROBE_TIMEOUT_MS = 2_000;

/**
 * Send a JSON-RPC request to the daemon over a Unix socket / named pipe.
 * Returns the CommandResult from the daemon response.
 */
export function sendRequest(socketPath: string, request: DaemonRequest): Promise<CommandResult> {
  return new Promise<CommandResult>((resolve, reject) => {
    let settled = false;
    let timeout: NodeJS.Timeout | undefined;

    const socket = net.createConnection(socketPath, () => {
      // Connected — send the request as NDJSON
      socket.write(JSON.stringify(request) + "\n");

      // Start timeout
      timeout = setTimeout(() => {
        settled = true;
        socket.destroy();
        reject(new Error(`Daemon request timed out after ${REQUEST_TIMEOUT_MS / 1000}s`));
      }, REQUEST_TIMEOUT_MS);
    });

    // Read response line-by-line
    const rl = readline.createInterface({ input: socket, crlfDelay: Infinity });

    rl.on("line", (line: string) => {
      if (settled) return;
      let response: DaemonResponse;
      try {
        response = JSON.parse(line) as DaemonResponse;
      } catch {
        return; // ignore non-JSON lines
      }

      if (response.id === request.id) {
        settled = true;
        if (timeout) clearTimeout(timeout);
        rl.close();
        socket.destroy();

        if (response.error) {
          resolve(
            err(response.error.message, {
              code: response.error.code,
              data: response.error.data,
            }),
          );
        } else {
          resolve(response.result ?? err("Empty response from daemon"));
        }
      }
    });

    rl.on('error', (rlErr: Error) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      rl.close();
      socket.destroy();
      reject(new Error(`Failed to connect to daemon: ${rlErr.message}`));
    });

    socket.on("error", (socketErr) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      rl.close();
      reject(new Error(`Failed to connect to daemon: ${socketErr.message}`));
    });

    socket.on("close", () => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      rl.close();
      reject(new Error("Daemon closed connection before sending a response"));
    });
  });
}

/**
 * Quick check if a socket path has an active listener.
 * Resolves true on successful connect, false on any error.
 * Always destroys the socket.
 */
export function probeSocket(socketPath: string): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, PROBE_TIMEOUT_MS);

    const socket = net.createConnection(socketPath, () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });

    socket.on("error", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(false);
    });

    socket.on("close", () => {
      clearTimeout(timer);
    });
  });
}
