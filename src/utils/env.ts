/**
 * Environment utilities for child processes
 */

/**
 * Build a sanitized environment with only essential variables.
 * Prevents leaking sensitive or unnecessary env vars to child processes.
 */
export function getSanitizedEnv(): Record<string, string | undefined> {
  const env = process.env;
  const allowedKeys = [
    "PATH",
    "HOME",
    "LANG",
    "LC_ALL",
    "TERM",
    "NODE_PATH",
    // Language-specific
    "GOPATH",
    "PYTHONPATH",
    "CARGO_HOME",
    "RUSTUP_HOME",
  ];
  const sanitized: Record<string, string | undefined> = {};
  for (const key of allowedKeys) {
    if (env[key] !== undefined) {
      sanitized[key] = env[key];
    }
  }
  return sanitized;
}
