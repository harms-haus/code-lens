/**
 * LSP types for the code-lens-cli tool
 */

import type { Diagnostic } from "vscode-languageserver-types";

// ── LSP Server Config ──────────────────────────────────────────────────────

export interface LspServerConfig {
  /** Language name (e.g. "typescript", "python") */
  language: string;
  /** Command to start the LSP server (argv[0]) */
  command: string;
  /** Additional args for the server command */
  args: string[];
  /** File extensions this server handles (with dot, e.g. ".ts") */
  extensions: string[];
  /** Initialization options sent during initialize */
  initializationOptions?: Record<string, unknown>;
  /** How to detect if the server is already installed */
  detectCommand: string;
  /** Human-readable install instructions */
  installInstructions: string;
  /** Package manager command to install the server */
  installCommand: string;
}

// ── Server State ────────────────────────────────────────────────────────────

export type ServerStatus = "stopped" | "starting" | "running" | "stopping" | "error";

export interface LspServerInstance {
  config: LspServerConfig;
  status: ServerStatus;
  /** Child process PID */
  pid: number | null;
  /** JSON-RPC message ID counter */
  nextId: number;
  /** Pending requests: id → resolve/reject */
  pendingRequests: Map<
    number,
    { resolve: (value: unknown) => void; reject: (err: Error) => void; timer?: NodeJS.Timeout }
  >;
  /** Last activity timestamp (ms) */
  lastActive: number;
  /** File versions for didChange tracking: uri → version */
  fileVersions: Map<string, number>;
  /** Diagnostics cache: uri → Diagnostic[] */
  diagnostics: Map<string, Diagnostic[]>;
  /** Root URI for this server instance */
  rootUri: string | null;
}

// ── Manager State ───────────────────────────────────────────────────────────

export interface LspManagerState {
  /** Active server instances keyed by language */
  servers: Map<string, LspServerInstance>;
  /** Idle timeout in ms (default 5 min) */
  idleTimeoutMs: number;
  /** Interval timer for checking idle servers */
  idleCheckInterval: NodeJS.Timeout | null;
  /** Current working directory */
  cwd: string;
}
