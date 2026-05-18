/**
 * LSP Manager - Server lifecycle management
 * Handles starting, stopping, idle timeout, and diagnostics cache
 */

import * as fs from "node:fs";
import { pathToFileURL } from "node:url";
import type { Diagnostic } from "vscode-languageserver-types";
import type { LspServerConfig, LspServerInstance, LspManagerState } from "./types.js";
import { LspClient } from "./lsp-client-methods.js";
import { languageFromPath } from "./language-config.js";

// ── Local Types ───────────────────────────────────────────────────────────

/** LSP 3.17+ pull model diagnostic result */
interface DiagnosticPullResult {
  kind: "full" | "unchanged";
  resultId?: string;
  items?: Diagnostic[];
}

/** Runtime type guard for LSP diagnostic pull results */
function isDiagnosticPullResult(value: unknown): value is DiagnosticPullResult {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return "kind" in obj && (obj.kind === "full" || obj.kind === "unchanged");
}

/** Interval for checking idle servers (1 minute) */
const IDLE_CHECK_INTERVAL_MS = 60_000;
/** How long a server can be idle before being stopped (5 minutes) */
export const DEFAULT_IDLE_TIMEOUT_MS = 5 * 60 * 1000;

export class LspManager {
  private state: LspManagerState;
  private clientMap = new Map<string, LspClient>();

  constructor(cwd: string, idleTimeoutMs = DEFAULT_IDLE_TIMEOUT_MS) {
    this.state = {
      servers: new Map(),
      idleTimeoutMs,
      idleCheckInterval: null,
      cwd,
    };

    // Start idle checker
    this.state.idleCheckInterval = setInterval(() => {
      this.checkIdleServers();
    }, IDLE_CHECK_INTERVAL_MS);
  }

  /** Get the LSP client for a language, starting the server if needed */
  async getClientForFile(filePath: string): Promise<LspClient | null> {
    const config = languageFromPath(filePath);
    if (!config) return null;
    return this.getClientForConfig(config);
  }

  /** Get the LSP client for a specific language config */
  async getClientForConfig(config: LspServerConfig): Promise<LspClient | null> {
    let server = this.state.servers.get(config.language);

    // If server exists but process died, clean up
    if (server && server.status !== "stopped") {
      const client = this.clientMap.get(config.language);
      if (client && !client.isAlive()) {
        void this.stopServer(config.language);
        server = undefined;
      }
    }

    if (!server || server.status === "stopped" || server.status === "error") {
      await this.startServer(config);
      server = this.state.servers.get(config.language);
    }

    if (server?.status !== "running") {
      return null;
    }

    return this.clientMap.get(config.language) ?? null;
  }

  /** Start an LSP server for the given config */
  async startServer(config: LspServerConfig): Promise<void> {
    const existing = this.state.servers.get(config.language);
    if (existing && (existing.status === "starting" || existing.status === "running")) {
      return;
    }

    // Clean up any stopped instance
    if (existing) {
      await this.stopServer(config.language);
    }

    const server: LspServerInstance = {
      config,
      status: "starting",
      pid: null,
      nextId: 1,
      pendingRequests: new Map(),
      lastActive: Date.now(),
      fileVersions: new Map(),
      diagnostics: new Map(),
      rootUri: null,
    };

    this.state.servers.set(config.language, server);

    const client = new LspClient(server, (method, params) => {
      this.handleNotification(config.language, method, params);
    });
    this.clientMap.set(config.language, client);

    // Determine root URI
    const rootUri = pathToFileURL(this.state.cwd).href;
    server.rootUri = rootUri;

    try {
      // Start the process
      await client.startProcess(config);

      // Initialize
      await client.initialize(config, rootUri);

      server.lastActive = Date.now();
    } catch (err) {
      server.status = "error";
      throw err;
    }
  }

  /** Stop an LSP server gracefully */
  async stopServer(language: string): Promise<void> {
    const client = this.clientMap.get(language);
    if (client) {
      try {
        await client.shutdown();
      } catch {
        client.kill();
      }
      this.clientMap.delete(language);
    }
    this.state.servers.delete(language);
  }

  /** Stop all LSP servers */
  async stopAll(): Promise<void> {
    const languages = Array.from(this.clientMap.keys());
    await Promise.all(languages.map((lang) => this.stopServer(lang)));
    if (this.state.idleCheckInterval) {
      clearInterval(this.state.idleCheckInterval);
      this.state.idleCheckInterval = null;
    }
  }

  /** Check for idle servers and stop them */
  private checkIdleServers(): void {
    const now = Date.now();
    for (const [language, server] of this.state.servers) {
      if (
        server.status === "running" &&
        server.pendingRequests.size === 0 &&
        now - server.lastActive > this.state.idleTimeoutMs
      ) {
        this.stopServer(language).catch(() => {
          // Ignore errors during idle cleanup
        });
      }
    }
  }

  /** Get diagnostics for a file */
  async getDiagnostics(filePath: string, refresh = false): Promise<Diagnostic[]> {
    const config = languageFromPath(filePath);
    if (!config) return [];

    const client = await this.getClientForFile(filePath);
    if (!client) return [];

    const uri = pathToFileURL(filePath).href;
    const server = this.state.servers.get(config.language);
    if (!server) return [];

    // Ensure the file is open
    await this.ensureFileOpen(client, config, filePath);

    // For push-model servers, return cached diagnostics
    // For pull-model servers (LSP 3.17+), request diagnostics
    return this.fetchOrCachedDiagnostics(client, server, uri, refresh);
  }

  /** Try pull-model diagnostics or return cached */
  private async fetchOrCachedDiagnostics(
    client: LspClient,
    server: LspServerInstance,
    uri: string,
    refresh: boolean,
  ): Promise<Diagnostic[]> {
    if (refresh || !server.diagnostics.has(uri)) {
      try {
        const result = await client.requestDiagnostics(uri);
        if (isDiagnosticPullResult(result) && result.kind === "full") {
          const diags = result.items ?? [];
          server.diagnostics.set(uri, diags);
          return diags;
        }
      } catch {
        // Pull model not supported; use cached diagnostics from notifications
      }
    }

    return server.diagnostics.get(uri) ?? [];
  }

  /** Handle a notification from the LSP server */
  private handleNotification(language: string, method: string, params: unknown): void {
    if (method === "textDocument/publishDiagnostics") {
      const diagParams = params as { uri: string; diagnostics?: Diagnostic[] };
      if (diagParams.uri) {
        this.handleDiagnosticsNotification(
          language,
          diagParams.uri,
          diagParams.diagnostics ?? [],
        );
      }
    }
  }

  /** Handle a diagnostics notification from the server */
  handleDiagnosticsNotification(
    language: string,
    uri: string,
    diagnostics: Diagnostic[],
  ): void {
    const server = this.state.servers.get(language);
    if (server) {
      server.diagnostics.set(uri, diagnostics);
      server.lastActive = Date.now();
    }
  }

  /** Ensure a file is open in the LSP server */
  async ensureFileOpen(
    client: LspClient,
    config: LspServerConfig,
    filePath: string,
    content?: string,
  ): Promise<void> {
    const uri = pathToFileURL(filePath).href;
    const server = this.state.servers.get(config.language);
    if (!server) return;

    // Read file content if not provided
    let text = content;
    if (text === undefined) {
      try {
        text = await fs.promises.readFile(filePath, "utf-8");
      } catch {
        text = "";
      }
    }

    const currentVersion = server.fileVersions.get(uri) ?? 0;
    const newVersion = currentVersion + 1;

    if (currentVersion === 0) {
      const langId = config.language === "cpp" ? "cpp" : config.language;
      client.didOpen(uri, langId, newVersion, text);
    } else {
      client.didChange(uri, newVersion, text);
    }

    server.fileVersions.set(uri, newVersion);
    server.lastActive = Date.now();

    this.capTrackedFiles(client, server);
  }

  /** Cap tracked files to prevent unbounded growth */
  private capTrackedFiles(client: LspClient, server: LspServerInstance): void {
    const MAX_TRACKED_FILES = 200;
    if (server.fileVersions.size <= MAX_TRACKED_FILES) return;

    const toDelete: string[] = [];
    let count = 0;
    for (const key of server.fileVersions.keys()) {
      toDelete.push(key);
      count++;
      if (count >= server.fileVersions.size - MAX_TRACKED_FILES + 10) break;
    }
    for (const key of toDelete) {
      server.fileVersions.delete(key);
      server.diagnostics.delete(key);
      try {
        client.didClose(key);
      } catch {
        // ignore — server may not support didClose or may have stopped
      }
    }
  }

  /** Handle a file being written/edited — open it and trigger diagnostics */
  async onFileChanged(filePath: string): Promise<void> {
    const config = languageFromPath(filePath);
    if (!config) return;

    const client = await this.getClientForConfig(config);
    if (!client) return;

    await this.ensureFileOpen(client, config, filePath);
    // Diagnostics will arrive via notification (push model)
    // or can be fetched via pull model
  }

  /** Get server status summary */
  getStatus(): { language: string; status: string; pid: number | null }[] {
    const result: { language: string; status: string; pid: number | null }[] = [];
    for (const [lang, server] of this.state.servers) {
      result.push({ language: lang, status: server.status, pid: server.pid });
    }
    return result;
  }

  /** Get the client map (for direct access) */
  getClientMap(): Map<string, LspClient> {
    return this.clientMap;
  }

  /** Get all cached diagnostics across all running servers */
  getAllDiagnostics(): Map<string, Diagnostic[]> {
    const result = new Map<string, Diagnostic[]>();
    for (const server of this.state.servers.values()) {
      for (const [uri, diags] of server.diagnostics) {
        const existing = result.get(uri) ?? [];
        existing.push(...diags);
        result.set(uri, existing);
      }
    }
    return result;
  }
}
