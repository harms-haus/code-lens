/**
 * LSP Client Methods - High-level LSP protocol method wrappers
 * Extends the base LspClient with typed methods for each LSP operation
 */

import type {
  Location,
  SymbolInformation,
  WorkspaceSymbol,
  CallHierarchyItem,
  CallHierarchyIncomingCall,
  CallHierarchyOutgoingCall,
  WorkspaceEdit,
  DocumentSymbol,
  Hover,
  Range,
} from "vscode-languageserver-types";
import type { LspServerConfig } from "./types.js";
import type {
  InitializeParams,
  TextDocumentItem,
  TextDocumentPositionParams,
  DidChangeTextDocumentParams,
  ReferenceParams,
  RenameParams,
  WorkspaceSymbolParams,
  PrepareCallHierarchyParams,
  CallHierarchyIncomingCallsParams,
  CallHierarchyOutgoingCallsParams,
  PrepareTypeHierarchyParams,
  TypeHierarchyItem,
  TypeHierarchySupertypesParams,
  TypeHierarchySubtypesParams,
} from "./lsp-protocol.js";
import { LspClient as BaseLspClient } from "./lsp-client.js";

// ── Constants (method-level) ──────────────────────────────────────────────

/** Timeout for the initialize handshake (60 seconds) */
const INITIALIZE_TIMEOUT_MS = 60_000;
/** Timeout for graceful shutdown (5 seconds) */
const SHUTDOWN_TIMEOUT_MS = 5_000;
/** Timeout before force-killing after SIGTERM (3 seconds) */
const FORCE_KILL_DELAY_MS = 3_000;

// ── Type Alias ────────────────────────────────────────────────────────────

/** Convenience alias for LspClient when used as a type in command handlers */
export type LspClientMethods = InstanceType<typeof LspClient>;

// ── Extended Client ───────────────────────────────────────────────────────

export class LspClient extends BaseLspClient {
  /** Initialize the LSP connection */
  async initialize(config: LspServerConfig, rootUri: string | null): Promise<void> {
    const params: InitializeParams = {
      processId: globalThis.process.pid,
      clientInfo: { name: "code-lens-cli", version: "1.0.0" },
      rootUri,
      initializationOptions: config.initializationOptions,
      capabilities: {
        textDocument: {
          synchronization: { didSave: false },
          completion: { completionItem: { snippetSupport: false } },
          diagnostic: { dynamicRegistration: false },
        },
        workspace: {
          workspaceFolders: false,
          symbol: { dynamicRegistration: false },
        },
        window: { workDoneProgress: false },
      },
    };

    await this.request<Record<string, unknown>>(
      "initialize",
      params,
      INITIALIZE_TIMEOUT_MS,
    );

    // Send initialized notification
    this.notify("initialized", {});
    this.server.status = "running";
  }

  /** Open a text document */
  didOpen(uri: string, languageId: string, version: number, text: string): void {
    const item: TextDocumentItem = { uri, languageId, version, text };
    this.notify("textDocument/didOpen", { textDocument: item });
  }

  /** Notify document change */
  didChange(uri: string, version: number, text: string): void {
    const params: DidChangeTextDocumentParams = {
      textDocument: { uri, version },
      contentChanges: [{ text }],
    };
    this.notify("textDocument/didChange", params);
  }

  /** Close a text document */
  didClose(uri: string): void {
    this.notify("textDocument/didClose", { textDocument: { uri } });
  }

  /** Request diagnostics via pull model (LSP 3.17+) */
  async requestDiagnostics(uri: string): Promise<unknown> {
    return this.request("textDocument/diagnostic", { textDocument: { uri } }, 30_000);
  }

  /** Go to definition */
  async gotoDefinition(
    uri: string,
    line: number,
    col: number,
  ): Promise<Location | Location[] | null> {
    const params: TextDocumentPositionParams = {
      textDocument: { uri },
      position: { line, character: col },
    };
    return this.request<Location | Location[] | null>(
      "textDocument/definition",
      params,
      30_000,
    );
  }

  /** Find references */
  async findReferences(
    uri: string,
    line: number,
    col: number,
  ): Promise<Location[] | null> {
    const params: ReferenceParams = {
      textDocument: { uri },
      position: { line, character: col },
      context: { includeDeclaration: true },
    };
    return this.request<Location[] | null>("textDocument/references", params, 30_000);
  }

  /** Prepare rename (returns valid rename range and placeholder) */
  async prepareRename(
    uri: string,
    line: number,
    col: number,
  ): Promise<Range | { range: Range; placeholder: string } | null> {
    const params: TextDocumentPositionParams = {
      textDocument: { uri },
      position: { line, character: col },
    };
    return this.request<Range | { range: Range; placeholder: string } | null>(
      "textDocument/prepareRename",
      params,
      30_000,
    );
  }

  /** Rename symbol */
  async rename(
    uri: string,
    line: number,
    col: number,
    newName: string,
  ): Promise<WorkspaceEdit | null> {
    const params: RenameParams = {
      textDocument: { uri },
      position: { line, character: col },
      newName,
    };
    return this.request<WorkspaceEdit | null>("textDocument/rename", params, 30_000);
  }

  /** Workspace symbol search */
  async workspaceSymbol(
    query: string,
  ): Promise<SymbolInformation[] | WorkspaceSymbol[] | null> {
    const params: WorkspaceSymbolParams = { query };
    return this.request<SymbolInformation[] | WorkspaceSymbol[] | null>(
      "workspace/symbol",
      params,
      30_000,
    );
  }

  /** Prepare call hierarchy */
  async prepareCallHierarchy(
    uri: string,
    line: number,
    col: number,
  ): Promise<CallHierarchyItem[] | null> {
    const params: PrepareCallHierarchyParams = {
      textDocument: { uri },
      position: { line, character: col },
    };
    return this.request<CallHierarchyItem[] | null>(
      "textDocument/prepareCallHierarchy",
      params,
      30_000,
    );
  }

  /** Get incoming calls */
  async incomingCalls(item: {
    name: string;
    kind: number;
    uri: string;
    range: { start: { line: number; character: number }; end: { line: number; character: number } };
    selectionRange: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
    data?: unknown;
  }): Promise<CallHierarchyIncomingCall[] | null> {
    const params: CallHierarchyIncomingCallsParams = { item };
    return this.request<CallHierarchyIncomingCall[] | null>(
      "callHierarchy/incomingCalls",
      params,
      30_000,
    );
  }

  /** Get outgoing calls */
  async outgoingCalls(item: {
    name: string;
    kind: number;
    uri: string;
    range: { start: { line: number; character: number }; end: { line: number; character: number } };
    selectionRange: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
    data?: unknown;
  }): Promise<CallHierarchyOutgoingCall[] | null> {
    const params: CallHierarchyOutgoingCallsParams = { item };
    return this.request<CallHierarchyOutgoingCall[] | null>(
      "callHierarchy/outgoingCalls",
      params,
      30_000,
    );
  }

  /** Document symbols */
  async documentSymbol(
    uri: string,
  ): Promise<DocumentSymbol[] | SymbolInformation[] | null> {
    return this.request<DocumentSymbol[] | SymbolInformation[] | null>(
      "textDocument/documentSymbol",
      { textDocument: { uri } },
      30_000,
    );
  }

  /** Hover */
  async hover(uri: string, line: number, col: number): Promise<Hover | null> {
    const params: TextDocumentPositionParams = {
      textDocument: { uri },
      position: { line, character: col },
    };
    return this.request<Hover | null>("textDocument/hover", params, 30_000);
  }

  /** Find implementations */
  async findImplementations(
    uri: string,
    line: number,
    col: number,
  ): Promise<Location | Location[] | null> {
    const params: TextDocumentPositionParams = {
      textDocument: { uri },
      position: { line, character: col },
    };
    return this.request<Location | Location[] | null>(
      "textDocument/implementation",
      params,
      30_000,
    );
  }

  /** Find type definition */
  async findTypeDefinition(
    uri: string,
    line: number,
    col: number,
  ): Promise<Location | Location[] | null> {
    const params: TextDocumentPositionParams = {
      textDocument: { uri },
      position: { line, character: col },
    };
    return this.request<Location | Location[] | null>(
      "textDocument/typeDefinition",
      params,
      30_000,
    );
  }

  /** Prepare type hierarchy */
  async prepareTypeHierarchy(
    uri: string,
    line: number,
    col: number,
  ): Promise<TypeHierarchyItem[] | null> {
    const params: PrepareTypeHierarchyParams = {
      textDocument: { uri },
      position: { line, character: col },
    };
    return this.request<TypeHierarchyItem[] | null>(
      "textDocument/prepareTypeHierarchy",
      params,
      30_000,
    );
  }

  /** Get supertypes in type hierarchy */
  async typeHierarchySupertypes(
    item: TypeHierarchyItem,
    resolve?: number,
  ): Promise<TypeHierarchyItem[] | null> {
    const params: TypeHierarchySupertypesParams & { resolve?: number } = {
      item,
      ...(resolve !== undefined ? { resolve } : {}),
    };
    return this.request<TypeHierarchyItem[] | null>(
      "typeHierarchy/supertypes",
      params,
      30_000,
    );
  }

  /** Get subtypes in type hierarchy */
  async typeHierarchySubtypes(
    item: TypeHierarchyItem,
    resolve?: number,
  ): Promise<TypeHierarchyItem[] | null> {
    const params: TypeHierarchySubtypesParams & { resolve?: number } = {
      item,
      ...(resolve !== undefined ? { resolve } : {}),
    };
    return this.request<TypeHierarchyItem[] | null>(
      "typeHierarchy/subtypes",
      params,
      30_000,
    );
  }

  /** Shutdown the LSP server gracefully */
  async shutdown(): Promise<void> {
    if (this.server.status !== "running") return;
    this.server.status = "stopping";

    try {
      await this.request("shutdown", {}, SHUTDOWN_TIMEOUT_MS);
      this.notify("exit", {});
    } catch {
      // Force kill if graceful shutdown fails
      const proc = this.process;
      if (proc) {
        proc.kill("SIGTERM");
        setTimeout(() => {
          if (!proc.killed) {
            proc.kill("SIGKILL");
          }
        }, FORCE_KILL_DELAY_MS);
      }
    }

    this.server.status = "stopped";
    this.process = null;
    this.server.pid = null;
  }

  /** Force kill the server process */
  kill(): void {
    if (this.process) {
      this.process.kill("SIGKILL");
      this.process = null;
    }
    this.server.status = "stopped";
    this.server.pid = null;
  }

  /** Check if the process is still alive */
  isAlive(): boolean {
    if (!this.process) return false;
    return !this.process.killed;
  }
}
