/**
 * Language config — public API for language detection and server checks
 *
 * Data definitions live in language-registry.ts; this module re-exports them
 * so that existing consumers can keep importing from language-config.js.
 */

import type { LspServerConfig } from "./types.js";
import { getConfigForExtension } from "./language-registry.js";
import spawn from "cross-spawn";

// Re-export the registry so existing imports from language-config.js keep working
export { LANGUAGE_SERVERS } from "./language-registry.js";

/** Determine language from a file path */
export function languageFromPath(filePath: string): LspServerConfig | undefined {
  const dotIndex = filePath.lastIndexOf(".");
  if (dotIndex !== -1) {
    const ext = filePath.slice(dotIndex);
    return getConfigForExtension(ext);
  }
  // No extension found (e.g., "Dockerfile"): try matching the bare filename
  const basename = filePath.split(/[/\\]/).pop();
  if (basename) {
    return getConfigForExtension(basename);
  }
  return undefined;
}

const installedCache = new Map<string, boolean>();

/** Check if a language server is installed */
export async function isServerInstalled(config: LspServerConfig): Promise<boolean> {
  const cached = installedCache.get(config.language);
  if (cached !== undefined) return cached;

  const cmd = config.detectCommand;
  if (!cmd) return false;
  const parts = cmd.split(/\s+/);
  return new Promise((resolve) => {
    const child = spawn(parts[0], parts.slice(1), { timeout: 10000 });
    child.on("error", (err: NodeJS.ErrnoException) => {
      const result = err.code !== "ENOENT";
      installedCache.set(config.language, result);
      resolve(result);
    });
    child.on("close", () => {
      // Binary exited (any code) = it exists on PATH. ENOENT is handled in error handler.
      const result = true;
      installedCache.set(config.language, result);
      resolve(result);
    });
  });
}
