/**
 * Language config — public API for language detection and server checks
 *
 * Data definitions live in language-registry.ts; this module re-exports them
 * so that existing consumers can keep importing from language-config.js.
 */

import type { LspServerConfig } from "./types.js";
import { getConfigForExtension } from "./language-registry.js";

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

/** Check if a language server is installed */
export async function isServerInstalled(config: LspServerConfig): Promise<boolean> {
  try {
    const { execFile } = await import("node:child_process");
    return await new Promise<boolean>((resolve) => {
      const parts = config.detectCommand.split(/\s+/);
      execFile(parts[0], parts.slice(1), { timeout: 10000 }, (error) => {
        if (!error) {
          resolve(true);
          return;
        }
        // If the binary was not found (ENOENT), the server is not installed.
        // Some LSP servers (css-languageserver, json-languageserver, intelephense)
        // are stdio-mode only and don't support --version. They exit non-zero with
        // an error like "Connection input stream is not set" but ARE installed.
        // We distinguish by checking the error code: ENOENT = not in PATH = not installed.
        const execError = error as NodeJS.ErrnoException;
        resolve(execError.code !== "ENOENT");
      });
    });
  } catch {
    return false;
  }
}
