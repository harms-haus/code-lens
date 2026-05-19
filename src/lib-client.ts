/**
 * Library entry point: daemon client
 *
 * Re-exports everything needed to connect to a running code-lens daemon
 * and send requests over Unix socket.
 */

export { sendRequest, probeSocket } from "./daemon/client.js";
export { ensureDaemon, startDaemon, stopDaemon, isDaemonRunning, DAEMON_VERSION } from "./daemon/lifecycle.js";
export { getSocketPath, getMetadataPath } from "./utils/socket-path.js";
export type { DaemonMetadata } from "./utils/socket-path.js";
export type { DaemonRequest, DaemonResponse } from "./daemon/protocol.js";
export { DAEMON_ERROR_CODES } from "./daemon/protocol.js";
export type { CommandResult } from "./formatting/output.js";
export { ok, err } from "./formatting/output.js";
export { languageFromPath, isServerInstalled } from "./lsp/language-config.js";
export type { LspServerConfig } from "./lsp/types.js";
