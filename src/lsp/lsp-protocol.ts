/**
 * LSP Protocol Types - JSON-RPC message types and minimal LSP parameter/result interfaces
 */

import type { Range } from "vscode-languageserver-types";

// ── JSON-RPC Message Types ─────────────────────────────────────────────────

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface JsonRpcNotification {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
}

// ── LSP Protocol Types (minimal subset) ────────────────────────────────────

export interface InitializeParams {
  processId: number | null;
  clientInfo?: { name: string; version?: string };
  rootUri: string | null;
  initializationOptions?: Record<string, unknown>;
  capabilities: {
    textDocument?: {
      synchronization?: { didSave?: boolean };
      completion?: { completionItem?: { snippetSupport?: boolean } };
      diagnostic?: { dynamicRegistration?: boolean };
    };
    workspace?: {
      workspaceFolders?: boolean;
      symbol?: { dynamicRegistration?: boolean };
    };
    window?: {
      workDoneProgress?: boolean;
    };
  };
}

export interface TextDocumentItem {
  uri: string;
  languageId: string;
  version: number;
  text: string;
}

export interface TextDocumentPositionParams {
  textDocument: { uri: string };
  position: { line: number; character: number };
}

export interface DidChangeTextDocumentParams {
  textDocument: { uri: string; version: number };
  contentChanges: { text: string }[];
}

export interface ReferenceParams extends TextDocumentPositionParams {
  context: { includeDeclaration: boolean };
}

export interface RenameParams extends TextDocumentPositionParams {
  newName: string;
}

export interface WorkspaceSymbolParams {
  query: string;
}

export interface PrepareCallHierarchyParams {
  textDocument: { uri: string };
  position: { line: number; character: number };
}

export interface CallHierarchyIncomingCallsParams {
  item: {
    name: string;
    kind: number;
    uri: string;
    range: { start: { line: number; character: number }; end: { line: number; character: number } };
    selectionRange: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
    data?: unknown;
  };
}

export interface CallHierarchyOutgoingCallsParams {
  item: {
    name: string;
    kind: number;
    uri: string;
    range: { start: { line: number; character: number }; end: { line: number; character: number } };
    selectionRange: {
      start: { line: number; character: number };
      end: { line: number; character: number };
    };
    data?: unknown;
  };
}

export interface PrepareTypeHierarchyParams {
  textDocument: { uri: string };
  position: { line: number; character: number };
}

export interface TypeHierarchyItem {
  name: string;
  kind: number;
  tags?: number[];
  detail?: string;
  uri: string;
  range: Range;
  selectionRange: Range;
  children?: TypeHierarchyItem[];
}

export interface TypeHierarchySupertypesParams {
  item: TypeHierarchyItem;
}

export interface TypeHierarchySubtypesParams {
  item: TypeHierarchyItem;
}
