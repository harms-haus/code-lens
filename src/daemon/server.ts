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
import { sanitizeError } from "../formatting/output.js";

// ── Types ──────────────────────────────────────────────────────────────────

/** Handler signature for daemon commands */
export type CommandHandler = (
  params: Record<string, unknown>,
  manager: LspManager,
  cwd: string,
) => Promise<CommandResult>;

// ── DaemonServer class ─────────────────────────────────────────────────────

/** Encapsulates all daemon server mutable state and behavior */
export class DaemonServer {
  private idleTimer: NodeJS.Timeout | null = null;
  private activeConnections = 0;
  private serverInstance: net.Server | null = null;
  private lspManager: LspManager | null = null;
  private commandHandlers = new Map<string, CommandHandler>();

  // ── Command Registry ──────────────────────────────────────────────────

  /** Register a named command handler */
  registerCommand(name: string, handler: CommandHandler): void {
    this.commandHandlers.set(name, handler);
  }

  /** Get a snapshot of registered command names (for testing) */
  getRegisteredCommands(): string[] {
    return [...this.commandHandlers.keys()];
  }

  /** Get current active connection count (for testing) */
  getActiveConnections(): number {
    return this.activeConnections;
  }

  // ── Request Routing ───────────────────────────────────────────────────

  /** Route a single request to the appropriate handler */
  async handleRequest(
    request: DaemonRequest,
    cwd: string,
  ): Promise<DaemonResponse> {
    const handler = this.commandHandlers.get(request.method);

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
      const result = await handler(request.params, this.lspManager as LspManager, cwd);
      return { jsonrpc: "2.0", result, id: request.id };
    } catch (e: unknown) {
      const message = sanitizeError(e, "Internal error");
      return {
        jsonrpc: "2.0",
        error: { code: DAEMON_ERROR_CODES.INTERNAL, message },
        id: request.id,
      };
    }
  }

  // ── Idle Timer ────────────────────────────────────────────────────────

  /** Reset (or start) the idle shutdown timer */
  resetIdleTimer(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
    }
    this.idleTimer = setTimeout(() => {
      if (this.activeConnections === 0) {
        void this.gracefulShutdown();
      } else {
        // Still has connections — just reset
        this.resetIdleTimer();
      }
    }, IDLE_TIMEOUT_MS);
    this.idleTimer.unref();
  }

  // ── Shutdown ──────────────────────────────────────────────────────────

  /** Graceful shutdown: stop all LSP servers, close the socket, and exit */
  async gracefulShutdown(): Promise<void> {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    if (this.lspManager) {
      await this.lspManager.stopAll();
      this.lspManager = null;
    }

    if (this.serverInstance) {
      this.serverInstance.close();
      this.serverInstance = null;
    }

    process.exit(0);
  }

  // ── Start ─────────────────────────────────────────────────────────────

  /** Start the daemon server */
  start(): void {
    const cwd = process.env["CODE_LENS_CWD"];
    const socketPath = process.env["CODE_LENS_SOCKET_PATH"];

    if (!cwd || !socketPath) {
      console.error("Missing CODE_LENS_CWD or CODE_LENS_SOCKET_PATH environment variables");
      process.exit(1);
    }

    // Create the LSP manager
    this.lspManager = new LspManager(cwd);

    // Clean up stale socket file (Unix only)
    if (process.platform !== "win32") {
      try {
        fs.unlinkSync(socketPath);
      } catch {
        // File may not exist — that's fine
      }
    }

    // Create the server
    this.serverInstance = net.createServer((socket: Socket) => {
      this.activeConnections++;
      let connectionCounted = true;
      this.resetIdleTimer();

      const rl = readline.createInterface({ input: socket, crlfDelay: Infinity });

      rl.on("line", (line: string) => {
        this.resetIdleTimer();

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

        if (this.lspManager) {
          void this.handleRequest(request, cwd).then((response) => {
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

      const cleanupConnection = (): void => {
        if (connectionCounted) {
          this.activeConnections--;
          connectionCounted = false;
        }
        rl.close();
      };

      socket.on("close", cleanupConnection);
      socket.on("error", cleanupConnection);
    });

    this.serverInstance.listen(socketPath, () => {
      if (process.platform !== "win32") {
        fs.chmodSync(socketPath, 0o600);
      }
      this.resetIdleTimer();
    });

    this.serverInstance.on("error", (serverErr: Error) => {
      console.error(`Daemon server error: ${serverErr.message}`);
      void this.gracefulShutdown();
    });

    // Graceful shutdown on signals
    process.once("SIGTERM", () => {
      void this.gracefulShutdown();
    });

    process.once("SIGINT", () => {
      void this.gracefulShutdown();
    });
  }
}

// ── Constants ──────────────────────────────────────────────────────────────

/** Idle timeout: shut down after 5 minutes with no requests and no active connections */
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

// ── Module-level backward-compatible API ───────────────────────────────────

/**
 * Pending registrations collected before startServer() is called.
 * Command modules call registerCommand() at import time; startServer()
 * flushes these into the DaemonServer instance.
 */
const pendingRegistrations = new Map<string, CommandHandler>();

/** The default server instance (created by startServer) */
let defaultServer: DaemonServer | null = null;

/**
 * Register a named command handler (backward-compatible module-level export).
 *
 * Before startServer() is called, stores the registration in a pending map.
 * After startServer(), delegates directly to the default DaemonServer instance.
 */
export function registerCommand(name: string, handler: CommandHandler): void {
  if (defaultServer) {
    defaultServer.registerCommand(name, handler);
  } else {
    pendingRegistrations.set(name, handler);
  }
}

/**
 * Create a fresh DaemonServer instance (for testing).
 * Does NOT set it as the default — use startServer() for that.
 */
export function createServer(): DaemonServer {
  return new DaemonServer();
}

/**
 * Get the default DaemonServer instance (for testing).
 * Returns null if startServer() has not been called yet.
 */
export function getDefaultServer(): DaemonServer | null {
  return defaultServer;
}

/**
 * Start the daemon server using the default instance.
 * Flushes any pending command registrations collected during module import.
 */
export function startServer(): void {
  defaultServer = new DaemonServer();

  // Flush any pending registrations collected at import time
  for (const [name, handler] of pendingRegistrations) {
    defaultServer.registerCommand(name, handler);
  }
  pendingRegistrations.clear();

  defaultServer.start();
}

// ── Auto-start when run directly ──────────────────────────────────────────

// If this module is the entry point (i.e., spawned by lifecycle.ts), start
const isMain = (() => {
  try {
    return (
      process.argv[1] &&
      import.meta.url.endsWith(new URL(process.argv[1]).pathname.replace(/\.ts$/, ".js"))
    );
  } catch {
    return false;
  }
})();

if (isMain) {
  startServer();
}
