/**
 * Shared parameter extraction and validation for command handlers
 */

import { err } from "../formatting/output.js";
import type { CommandResult } from "../formatting/output.js";

// ── Position Params ────────────────────────────────────────────────────────

export interface PositionParams {
  file: string;
  line: number;
  col: number;
}

type ExtractSuccess<T> = { ok: true; params: T };
type ExtractFailure = { ok: false; error: CommandResult };

export type ExtractPositionResult = ExtractSuccess<PositionParams> | ExtractFailure;
export type ExtractRenameResult =
  | ExtractSuccess<PositionParams & { newName: string }>
  | ExtractFailure;

/** Extract and validate file, line, col from raw command params */
export function extractPositionParams(
  params: Record<string, unknown>,
): ExtractPositionResult {
  const file = params.file as string;
  const line = params.line as number;
  const col = params.col as number;

  if (!file || typeof file !== "string") {
    return {
      ok: false,
      error: err("Missing or invalid 'file' parameter.", { file }),
    };
  }
  if (!Number.isFinite(line) || line < 1) {
    return {
      ok: false,
      error: err("Missing or invalid 'line' parameter.", { line }),
    };
  }
  if (!Number.isFinite(col) || col < 1) {
    return {
      ok: false,
      error: err("Missing or invalid 'col' parameter.", { col }),
    };
  }

  return { ok: true, params: { file, line, col } };
}

/** Extract and validate file, line, col, newName from raw command params */
export function extractRenameParams(
  params: Record<string, unknown>,
): ExtractRenameResult {
  const extracted = extractPositionParams(params);
  if (!extracted.ok) return extracted;

  const newName = params.newName as string;
  if (!newName || typeof newName !== "string") {
    return {
      ok: false,
      error: err("Missing or invalid 'newName' parameter.", { newName }),
    };
  }

  return { ok: true, params: { ...extracted.params, newName } };
}
