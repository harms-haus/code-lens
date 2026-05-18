/**
 * CLI ↔ Daemon protocol types
 * Uses JSON-RPC 2.0 over Unix socket / Windows named pipe (NDJSON)
 */

import type { CommandResult } from "../formatting/output.js";

export interface DaemonRequest {
  jsonrpc: "2.0";
  method: string;
  params: Record<string, unknown>;
  id: number;
}

export interface DaemonResponse {
  jsonrpc: "2.0";
  result?: CommandResult;
  error?: { code: number; message: string; data?: unknown };
  id: number;
}

export const DAEMON_ERROR_CODES = {
  SERVER_NOT_FOUND: -32001,
  FILE_NOT_FOUND: -32002,
  LSP_ERROR: -32003,
  INVALID_PARAMS: -32004,
  INTERNAL: -32000,
} as const;
