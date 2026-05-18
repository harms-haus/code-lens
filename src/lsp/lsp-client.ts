/**
 * LSP Client (Base) - Low-level JSON-RPC communication with LSP servers
 * Uses stdio (stdin/stdout) to communicate with the language server process
 *
 * This module contains the core transport layer (process management, message framing,
 * request/response routing). High-level LSP method wrappers live in lsp-client-methods.ts.
 */

import * as child_process from "node:child_process";
import type { LspServerConfig, LspServerInstance } from "./types.js";
import type { JsonRpcRequest, JsonRpcNotification } from "./lsp-protocol.js";
import { getSanitizedEnv } from "../utils/env.js";

// ── Constants ─────────────────────────────────────────────────────────────

/** Default timeout for LSP requests (30 seconds) */
const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;
/** Maximum message size to prevent memory exhaustion (10 MB) */
const MAX_MESSAGE_SIZE = 10 * 1024 * 1024; // 10 MB

// ── LSP Client Class (base transport) ─────────────────────────────────────

export class LspClient {
  protected server: LspServerInstance;
  protected process: child_process.ChildProcess | null = null;
  private buffer = "";
  private contentLength = -1;
  private onNotification?: (method: string, params: unknown) => void;
  private logPrefix: string;

  constructor(
    server: LspServerInstance,
    onNotification?: (method: string, params: unknown) => void,
    logPrefix = "code-lens",
  ) {
    this.server = server;
    this.onNotification = onNotification;
    this.logPrefix = logPrefix;
  }

  /** Start the LSP server process */
  startProcess(config: LspServerConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.process = child_process.spawn(config.command, config.args, {
          stdio: ["pipe", "pipe", "pipe"],
          env: getSanitizedEnv(),
        });

        this.server.pid = this.process.pid ?? null;
        this.server.status = "starting";

        this.process.stdout?.on("data", (data: Buffer) => {
          this.handleData(data.toString());
        });

        this.process.stderr?.on("data", () => {
          /* LSP servers log to stderr; ignored */
        });

        this.process.on("error", (err) => {
          this.server.status = "error";
          reject(
            new Error(`Failed to start LSP server "${config.language}": ${err.message}`),
          );
        });

        this.process.on("exit", (code, signal) => {
          this.server.status = "stopped";
          this.server.pid = null;
          // Reject all pending requests
          for (const [id, pending] of this.server.pendingRequests) {
            pending.reject(
              new Error(`LSP server exited with code ${code}, signal ${signal}`),
            );
            this.server.pendingRequests.delete(id);
          }
        });

        resolve();
      } catch (err) {
        this.server.status = "error";
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  /** Parse incoming LSP data from stdout */
  private handleData(data: string): void {
    this.buffer += data;

    while (this.buffer.length > 0) {
      if (this.contentLength === -1) {
        const headerEnd = this.buffer.indexOf("\r\n\r\n");
        if (headerEnd === -1) break;

        const header = this.buffer.slice(0, headerEnd);
        const match = header.match(/Content-Length:\s*(\d+)/i);
        if (!match) {
          this.buffer = this.buffer.slice(headerEnd + 4);
          continue;
        }

        this.contentLength = parseInt(match[1], 10);
        if (this.contentLength > MAX_MESSAGE_SIZE || this.contentLength < 0) {
          console.warn(
            `[${this.logPrefix}] Dropping oversized message (${this.contentLength} bytes, max ${MAX_MESSAGE_SIZE})`,
          );
          this.buffer = "";
          this.contentLength = -1;
          return;
        }
        this.buffer = this.buffer.slice(headerEnd + 4);
      }

      if (this.buffer.length < this.contentLength) break;

      const body = this.buffer.slice(0, this.contentLength);
      this.buffer = this.buffer.slice(this.contentLength);
      this.contentLength = -1;

      try {
        const message: unknown = JSON.parse(body);
        if (this.isLspMessage(message)) {
          this.handleMessage(message);
        }
      } catch {
        // Skip malformed messages
      }
    }
  }

  /** Type guard for parsed JSON-RPC messages */
  private isLspMessage(
    value: unknown,
  ): value is { id?: number; error?: { message: string }; result?: unknown; method?: string; params?: unknown } {
    return typeof value === "object" && value !== null;
  }

  /** Handle a parsed JSON-RPC message */
  private handleMessage(
    message: { id?: number; error?: { message: string }; result?: unknown; method?: string; params?: unknown },
  ): void {
    if ("id" in message && typeof message.id === "number") {
      // Response to a request
      const pending = this.server.pendingRequests.get(message.id);
      if (pending) {
        if (message.error) {
          pending.reject(new Error(message.error.message));
        } else {
          pending.resolve(message.result);
        }
        this.server.pendingRequests.delete(message.id);
        if (pending.timer) clearTimeout(pending.timer);
      }
    } else if ("method" in message) {
      // Notification — forward to the manager
      if (this.onNotification) {
        this.onNotification(message.method as string, message.params);
      }
    }
  }

  /** Send a JSON-RPC message to the server */
  private sendMessage(message: JsonRpcRequest | JsonRpcNotification): void {
    if (!this.process?.stdin) {
      throw new Error("LSP server process stdin not available");
    }
    const body = JSON.stringify(message);
    const header = `Content-Length: ${Buffer.byteLength(body, "utf-8")}\r\n\r\n`;
    this.process.stdin.write(header + body);
  }

  /** Send a request and wait for response */
  request<T = unknown>(
    method: string,
    params: unknown,
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  ): Promise<T> {
    const id = this.server.nextId++;
    this.server.lastActive = Date.now();

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.server.pendingRequests.delete(id);
        reject(new Error(`LSP request "${method}" timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.server.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      });
      try {
        this.sendMessage({ jsonrpc: "2.0", id, method, params });
      } catch (err) {
        clearTimeout(timer);
        this.server.pendingRequests.delete(id);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  /** Send a notification (no response expected) */
  notify(method: string, params: unknown): void {
    this.server.lastActive = Date.now();
    this.sendMessage({ jsonrpc: "2.0", method, params });
  }
}
