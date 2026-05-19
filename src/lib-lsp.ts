/**
 * Library entry point: LSP internals
 *
 * Re-exports LspManager and related types for direct (non-daemon) usage.
 */

export { LspManager, DEFAULT_IDLE_TIMEOUT_MS } from "./lsp/lsp-manager.js";
export type { LspServerConfig, ServerStatus, LspServerInstance, LspManagerState } from "./lsp/types.js";
export { languageFromPath, isServerInstalled } from "./lsp/language-config.js";
export { LspClient } from "./lsp/lsp-client-methods.js";
