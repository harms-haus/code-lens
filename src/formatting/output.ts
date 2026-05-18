/**
 * Standard result/error response builders
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface CommandResult {
  content: { type: "text"; text: string }[];
  details: Record<string, unknown>;
  isError: boolean;
}

// ── Result Builders ────────────────────────────────────────────────────────

/** Build a successful command result */
export function ok(text: string, details: Record<string, unknown> = {}): CommandResult {
  return {
    content: [{ type: "text", text }],
    details,
    isError: false,
  };
}

/** Build an error command result */
export function err(message: string, details: Record<string, unknown> = {}): CommandResult {
  return {
    content: [{ type: "text", text: message }],
    details,
    isError: true,
  };
}

// ── Error Sanitization ─────────────────────────────────────────────────────

/**
 * Sanitize an error for safe display in tool results.
 * Strips home directory paths to avoid leaking internal paths/details.
 */
export function sanitizeError(err: unknown, context: string): string {
  const message = err instanceof Error ? err.message : String(err);
  // Strip common internal path patterns
  const sanitized = message
    .replace(/\/home\/[^/\s]+/g, "~")
    .replace(/\/Users\/[^/\s]+/g, "~")
    .replace(/\/root\//g, "/")
    .replace(/C:\\\\Users\\[^\\]+/g, "~");
  return `${context}: ${sanitized}`;
}
