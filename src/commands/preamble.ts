/**
 * Shared preamble logic for file-based LSP command handlers
 *
 * Resolves file path, detects language, ensures server is installed,
 * starts server if needed, and opens the file in the LSP server.
 */

import type { LspManager } from "../lsp/lsp-manager.js";
import type { LspClientMethods } from "../lsp/lsp-client-methods.js";
import type { LspServerConfig } from "../lsp/types.js";
import type { CommandResult } from "../formatting/output.js";
import { err } from "../formatting/output.js";
import { resolveFile, filePathToUri } from "../utils/paths.js";
import { languageFromPath, isServerInstalled } from "../lsp/language-config.js";
import { LANGUAGE_SERVERS } from "../lsp/language-config.js";

// ── Preamble Result ────────────────────────────────────────────────────────

export interface PreambleResult {
  filePath: string;
  config: LspServerConfig;
  client: LspClientMethods;
  uri: string;
}

// ── Preamble Function ──────────────────────────────────────────────────────

/**
 * Execute the shared preamble that all file-based LSP commands need:
 * 1. Resolve file path relative to cwd
 * 2. Detect language from file extension
 * 3. Ensure the LSP server is installed
 * 4. Get or start LSP client for the language
 * 5. Ensure the file is open in the server
 * 6. Convert to URI
 *
 * Returns the preamble result on success or an error CommandResult on failure.
 */
export async function executePreamble(
  file: string,
  manager: LspManager,
  cwd: string,
): Promise<{ ok: PreambleResult } | { error: CommandResult }> {
  // 1. Resolve file path
  const filePath = resolveFile(file, cwd);

  // 2. Detect language
  const config = languageFromPath(filePath);
  if (!config) {
    return {
      error: err(
        `No LSP server configured for "${file}".\n\nSupported languages: ${LANGUAGE_SERVERS.map((c) => c.language).join(", ")}`,
        { file },
      ),
    };
  }

  // 3. Check if server is installed
  const installed = await isServerInstalled(config);
  if (!installed) {
    return {
      error: err(
        `LSP server for ${config.language} is not installed.\n\nInstall: ${config.installCommand}`,
        { file },
      ),
    };
  }

  // 4. Get or start LSP client
  const client = await manager.getClientForFile(filePath);
  if (!client) {
    return {
      error: err(`Failed to start LSP server for ${config.language}.`, { file }),
    };
  }

  // 5. Ensure file is open in the server
  await manager.ensureFileOpen(client, config, filePath);

  // 6. Convert to URI
  const uri = filePathToUri(filePath);

  return { ok: { filePath, config, client, uri } };
}
