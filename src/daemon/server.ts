/**
 * Daemon socket server — listens for CLI requests and dispatches
 * them to registered command handlers via LspManager.
 */

import * as net from "node:net";
import * as readline from "node:readline";
import * as fs from "node:fs";
import type { Socket } from "node:net";
import type { DaemonRequest, DaemonResponse } from "./protocol.js";
import { DAEMON_ERROR_CODES } from "./protocol.js";
import { LspManager } from "../lsp/lsp-manager.js";
import type { CommandResult } from "../formatting/output.js";

// ── Types ──────────────────────────────────────────────────────────────────

/** Handler signature for daemon commands */
export type CommandHandler = (
  params: Record<string, unknown>,
  manager: LspManager,
  cwd: string,
) => Promise<CommandResult>;

// ── Command Registry ──────────────────────────────────────────────────────

const commandHandlers = new Map<string, CommandHandler>();

/** Register a named command handler (called by command modules at startup) */
export function registerCommand(name: string, handler: CommandHandler): void {
  commandHandlers.set(name, handler);
}

// ── Request Routing ───────────────────────────────────────────────────────

/** Route a single request to the appropriate handler */
async function handleRequest(
  request: DaemonRequest,
  manager: LspManager,
  cwd: string,
): Promise<DaemonResponse> {
  const handler = commandHandlers.get(request.method);

  if (!handler) {
    return {
      jsonrpc: "2.0",
      error: {
        code: DAEMON_ERROR_CODES.INVALID_PARAMS,
        message: `Unknown method: ${request.method}`,
      },
      id: request.id,
    };
  }

  try {
    const result = await handler(request.params, manager, cwd);
    return { jsonrpc: "2.0", result, id: request.id };
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    return {
      jsonrpc: "2.0",
      error: { code: DAEMON_ERROR_CODES.INTERNAL, message },
      id: request.id,
    };
  }
}

// ── Server ─────────────────────────────────────────────────────────────────

/** Idle timeout: shut down after 5 minutes with no requests and no active connections */
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

let idleTimer: NodeJS.Timeout | null = null;
let activeConnections = 0;
let serverInstance: net.Server | null = null;
let lspManager: LspManager | null = null;

/** Reset (or start) the idle shutdown timer */
function resetIdleTimer(): void {
  if (idleTimer) {
    clearTimeout(idleTimer);
  }
  idleTimer = setTimeout(() => {
    if (activeConnections === 0) {
      void gracefulShutdown();
    } else {
      // Still has connections — just reset
      resetIdleTimer();
    }
  }, IDLE_TIMEOUT_MS);
  idleTimer.unref();
}

/** Graceful shutdown: stop all LSP servers, close the socket, and exit */
async function gracefulShutdown(): Promise<void> {
  if (idleTimer) {
    clearTimeout(idleTimer);
    idleTimer = null;
  }

  if (lspManager) {
    await lspManager.stopAll();
    lspManager = null;
  }

  if (serverInstance) {
    serverInstance.close();
    serverInstance = null;
  }

  process.exit(0);
}

/** Start the daemon server */
export function startServer(): void {
  const cwd = process.env["CODE_LENS_CWD"];
  const socketPath = process.env["CODE_LENS_SOCKET_PATH"];

  if (!cwd || !socketPath) {
    console.error("Missing CODE_LENS_CWD or CODE_LENS_SOCKET_PATH environment variables");
    process.exit(1);
  }

  // Create the LSP manager
  lspManager = new LspManager(cwd);

  // Clean up stale socket file (Unix only)
  if (process.platform !== "win32") {
    try {
      fs.unlinkSync(socketPath);
    } catch {
      // File may not exist — that's fine
    }
  }

  // Create the server
  serverInstance = net.createServer((socket: Socket) => {
    activeConnections++;
    resetIdleTimer();

    const rl = readline.createInterface({ input: socket, crlfDelay: Infinity });

    rl.on("line", (line: string) => {
      resetIdleTimer();

      let request: DaemonRequest;
      try {
        request = JSON.parse(line) as DaemonRequest;
      } catch {
        const response: DaemonResponse = {
          jsonrpc: "2.0",
          error: {
            code: DAEMON_ERROR_CODES.INVALID_PARAMS,
            message: "Invalid JSON",
          },
          id: 0,
        };
        socket.write(JSON.stringify(response) + "\n");
        return;
      }

      if (lspManager) {
        void handleRequest(request, lspManager, cwd).then((response) => {
          try {
            socket.write(JSON.stringify(response) + "\n");
          } catch {
            // Socket may have been closed — ignore
          }
        });
      } else {
        const response: DaemonResponse = {
          jsonrpc: "2.0",
          error: {
            code: DAEMON_ERROR_CODES.INTERNAL,
            message: "Daemon is shutting down",
          },
          id: request.id,
        };
        try {
          socket.write(JSON.stringify(response) + "\n");
        } catch {
          // Socket may have been closed — ignore
        }
      }
    });

    socket.on("close", () => {
      activeConnections--;
      rl.close();
    });

    socket.on("error", () => {
      activeConnections--;
      rl.close();
    });
  });

  serverInstance.listen(socketPath, () => {
    resetIdleTimer();
  });

  serverInstance.on("error", (serverErr: Error) => {
    console.error(`Daemon server error: ${serverErr.message}`);
    void gracefulShutdown();
  });

  // Graceful shutdown on signals
  process.on("SIGTERM", () => {
    void gracefulShutdown();
  });

  process.on("SIGINT", () => {
    void gracefulShutdown();
  });
}

// ── Auto-start when run directly ──────────────────────────────────────────

// If this module is the entry point (i.e., spawned by lifecycle.ts), start
const isMain =
  process.argv[1] &&
  import.meta.url.endsWith(new URL(process.argv[1]).pathname.replace(/\.ts$/, ".js"));

if (isMain) {
  startServer();
}
