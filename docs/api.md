# API Reference

> **Package:** `@harms-haus/code-lens`
> **Node:** ≥ 20.0.0 · **Module:** ESM only

The library ships three subpath exports. Import them as:

```ts
import { … } from "@harms-haus/code-lens";       // re-exports /client
import { … } from "@harms-haus/code-lens/client"; // daemon client helpers
import { … } from "@harms-haus/code-lens/lsp";    // direct LSP management
```

---

## Table of Contents

- [@harms-haus/code-lens (main)](#harms-hauscode-lens-main)
- [@harms-haus/code-lens/client](#harms-hauscode-lensclient)
  - [Daemon Lifecycle](#daemon-lifecycle)
  - [Socket Communication](#socket-communication)
  - [Output Helpers](#output-helpers)
  - [Language Utilities](#language-utilities)
  - [Types (client)](#types-client)
- [@harms-haus/code-lens/lsp](#harms-hauscode-lenslsp)
  - [LspManager](#lspmanager)
  - [LspClient](#lspclient)
  - [Language Utilities](#language-utilities-1)
  - [Types (lsp)](#types-lsp)

---

## @harms-haus/code-lens (main)

The root entry point re-exports everything from [`/client`](#harms-hauscode-lensclient). There are no additional exports.

```ts
// These are equivalent:
import { ensureDaemon, sendRequest } from "@harms-haus/code-lens";
import { ensureDaemon, sendRequest } from "@harms-haus/code-lens/client";
```

---

## @harms-haus/code-lens/client

Daemon client helpers for lifecycle management, socket IPC, result building, and language detection.

### Daemon Lifecycle

#### `ensureDaemon(cwd: string): Promise<void>`

Ensure a daemon is running for the given working directory. If a daemon is already running but its version doesn't match `DAEMON_VERSION`, it is stopped and restarted. If no daemon is running, stale socket/metadata files are cleaned up first, then a fresh daemon is started.

```ts
await ensureDaemon("/path/to/my/project");
```

#### `startDaemon(cwd: string): Promise<void>`

Spawn a new daemon process for the given working directory and wait for it to become ready (polls the socket for up to 10 seconds). Writes a metadata file containing PID, socket path, version, and cwd. Throws if the daemon fails to start or times out.

```ts
await startDaemon("/path/to/my/project");
```

#### `stopDaemon(cwd: string): Promise<void>`

Stop the daemon for the given working directory by sending `SIGTERM` to its PID (read from metadata), then clean up socket and metadata files. On Windows, `SIGTERM` is delivered as a forced process termination via `TerminateProcess` since Windows lacks POSIX signals.

```ts
await stopDaemon("/path/to/my/project");
```

#### `isDaemonRunning(cwd: string): Promise<boolean>`

Check whether a daemon is currently running for the given working directory by probing the socket.

```ts
if (await isDaemonRunning(cwd)) {
  console.log("Daemon is alive");
}
```

#### `DAEMON_VERSION: string`

Current daemon protocol version. Used by `ensureDaemon` to decide whether a running daemon needs to be restarted (`"0.1.0"`).

---

### Socket Communication

#### `sendRequest(socketPath: string, request: DaemonRequest): Promise<CommandResult>`

Send a JSON-RPC 2.0 request to the daemon over a Unix socket (or Windows named pipe). The request is serialized as NDJSON. Returns a `CommandResult` — either the daemon's successful result or an error result built from the JSON-RPC error. Rejects on connection failure, timeout (60 s), or if the daemon closes the connection prematurely.

```ts
import { sendRequest, getSocketPath } from "@harms-haus/code-lens/client";

const result = await sendRequest(getSocketPath(cwd), {
  jsonrpc: "2.0",
  method: "diagnostics",
  params: { filePath: "/path/to/file.ts" },
  id: 1,
});
```

#### `probeSocket(socketPath: string): Promise<boolean>`

Quick check whether a socket path has an active listener. Resolves `true` on successful connect, `false` on any error or timeout (2 s). Always destroys the socket — no data is sent.

#### `getSocketPath(cwd: string): string`

Compute the daemon socket path for a working directory. On Unix this returns a file under `$TMPDIR/code-lens-<hash>.sock`. On Windows it returns a named pipe `\\.\pipe\code-lens-<hash>`. The hash is the first 16 hex characters of `sha256(cwd)`.

#### `getMetadataPath(cwd: string): string`

Compute the daemon metadata file path for a working directory. Always returns a file under `~/.code-lens/<hash>.json`.

---

### Output Helpers

#### `ok(text: string, details?: Record<string, unknown>): CommandResult`

Build a successful command result.

```ts
import { ok } from "@harms-haus/code-lens/client";

const result = ok("All checks passed", { filesChecked: 3 });
// result.isError === false
// result.content[0].text === "All checks passed"
// result.details.filesChecked === 3
```

#### `err(message: string, details?: Record<string, unknown>): CommandResult`

Build an error command result.

```ts
import { err } from "@harms-haus/code-lens/client";

const result = err("File not found", { path: "/bad/path.ts" });
// result.isError === true
```

---

### Language Utilities

#### `languageFromPath(filePath: string): LspServerConfig | undefined`

Determine the language server configuration for a file path by matching its extension (e.g. `.ts`, `.py`) or bare filename (e.g. `Dockerfile`). Returns `undefined` if no registered server matches.

```ts
const config = languageFromPath("src/index.ts");
// config?.language === "typescript"
```

#### `isServerInstalled(config: LspServerConfig): Promise<boolean>`

Check whether the language server binary for a given config is installed and accessible. Executes `config.detectCommand` (e.g. `typescript-language-server --version`) and resolves `true` if the command exits cleanly within 10 seconds.

```ts
const config = languageFromPath("app.py");
if (config && await isServerInstalled(config)) {
  // safe to use the server
}
```

---

### Types (client)

#### `CommandResult`

Standard result envelope returned by daemon responses and the `ok`/`err` helpers.

| Field      | Type                                | Description                |
|------------|-------------------------------------|----------------------------|
| `content`  | `{ type: "text"; text: string }[]`  | Text content blocks        |
| `details`  | `Record<string, unknown>`           | Arbitrary structured data  |
| `isError`  | `boolean`                           | Whether this is an error   |

#### `DaemonRequest`

A JSON-RPC 2.0 request sent to the daemon.

| Field     | Type                         | Description           |
|-----------|------------------------------|-----------------------|
| `jsonrpc` | `"2.0"`                      | Protocol version      |
| `method`  | `string`                     | Daemon method name    |
| `params`  | `Record<string, unknown>`    | Method parameters     |
| `id`      | `number`                     | Request identifier    |

#### `DaemonResponse`

A JSON-RPC 2.0 response returned by the daemon.

| Field     | Type                                               | Description             |
|-----------|----------------------------------------------------|-------------------------|
| `jsonrpc` | `"2.0"`                                            | Protocol version        |
| `result`  | `CommandResult` (optional)                         | Success payload         |
| `error`   | `{ code: number; message: string; data?: unknown }` (optional) | Error payload |
| `id`      | `number`                                           | Matches request `id`    |

#### `DAEMON_ERROR_CODES`

Standard error codes used in `DaemonResponse.error.code`.

| Constant             | Value   | Description                        |
|----------------------|---------|------------------------------------|
| `INTERNAL`           | `-32000`| Generic internal error             |
| `SERVER_NOT_FOUND`   | `-32001`| No LSP server for the language     |
| `FILE_NOT_FOUND`     | `-32002`| Requested file does not exist      |
| `LSP_ERROR`          | `-32003`| LSP server returned an error       |
| `INVALID_PARAMS`     | `-32004`| Malformed request parameters       |

#### `DaemonMetadata`

Metadata written to disk about a running daemon instance.

| Field        | Type     | Description                       |
|--------------|----------|-----------------------------------|
| `pid`        | `number` | Process ID of the daemon          |
| `socketPath` | `string` | Path to the IPC socket            |
| `version`    | `string` | Daemon protocol version           |
| `cwd`        | `string` | Working directory the daemon runs |

#### `LspServerConfig`

Language server configuration — see [full definition in the `/lsp` types section](#types-lsp).

---

## @harms-haus/code-lens/lsp

Direct LSP management for non-daemon usage. Provides the `LspManager` orchestrator, the `LspClient` protocol wrapper, language detection utilities, and all related types.

### LspManager

```ts
import { LspManager } from "@harms-haus/code-lens/lsp";
```

Orchestrates LSP server processes: starting, stopping, idle timeout, document tracking, and diagnostics caching. Communicates with servers over stdio using the LSP protocol.

#### Constructor

```ts
new LspManager(cwd: string, idleTimeoutMs?: number)
```

| Parameter        | Type     | Default                  | Description                      |
|------------------|----------|--------------------------|----------------------------------|
| `cwd`            | `string` | —                        | Root working directory           |
| `idleTimeoutMs`  | `number` | `DEFAULT_IDLE_TIMEOUT_MS`| Idle timeout before auto-stop    |

Creates the manager and starts a 60-second interval timer that checks for idle servers.

#### `DEFAULT_IDLE_TIMEOUT_MS`

```ts
const DEFAULT_IDLE_TIMEOUT_MS: number = 300_000; // 5 minutes
```

#### Methods

##### `getClientForFile(filePath: string): Promise<LspClient | null>`

Resolve the `LspClient` for a file's language, starting the server if needed. Returns `null` if the file's language is not registered.

##### `getClientForConfig(config: LspServerConfig): Promise<LspClient | null>`

Resolve the `LspClient` for a specific language config. Handles concurrent startup deduplication — if a server is already being started for the same language, the existing promise is awaited instead of spawning a duplicate process.

##### `startServer(config: LspServerConfig): Promise<void>`

Start an LSP server process and perform the `initialize`/`initialized` handshake. Throws if the process fails to start. Sets the server status to `"running"` on success.

##### `stopServer(language: string): Promise<void>`

Gracefully stop an LSP server (`shutdown` → `exit`), then remove it from the manager. If shutdown fails, the process is force-killed.

##### `stopAll(): Promise<void>`

Stop all running servers and clear the idle-check interval. Call this when shutting down.

##### `getDiagnostics(filePath: string, refresh?: boolean): Promise<Diagnostic[]>`

Get diagnostics for a file. Opens the file in the server if not already tracked. If `refresh` is `true` or no cached diagnostics exist, attempts a pull-model request (`textDocument/diagnostic`, LSP 3.17+). Falls back to cached push-model diagnostics from `textDocument/publishDiagnostics` notifications.

```ts
const diags = await manager.getDiagnostics("src/index.ts", true);
```

##### `onFileChanged(filePath: string): Promise<void>`

Notify the manager that a file was written/edited. Opens or updates the file in the appropriate server and triggers diagnostics.

##### `getStatus(): { language: string; status: string; pid: number | null }[]`

Return a summary array of all tracked server instances.

##### `getClientMap(): Map<string, LspClient>`

Direct access to the internal `language → LspClient` map.

##### `getAllDiagnostics(): Map<string, Diagnostic[]>`

Aggregate diagnostics from all running servers into a single `uri → Diagnostic[]` map.

---

### LspClient

```ts
import { LspClient } from "@harms-haus/code-lens/lsp";
```

High-level wrapper around a single LSP server process. Extends the base transport layer with typed methods for each standard LSP operation. Instances are created internally by `LspManager` — you typically obtain one via `getClientForFile` rather than constructing directly.

#### Constructor (internal)

```ts
new LspClient(server: LspServerInstance, onNotification?: (method: string, params: unknown) => void)
```

#### Document Synchronization

| Method | Signature | Description |
|--------|-----------|-------------|
| `didOpen` | `(uri: string, languageId: string, version: number, text: string): void` | Notify the server a document was opened. |
| `didChange` | `(uri: string, version: number, text: string): void` | Notify the server a document changed (full sync). |
| `didClose` | `(uri: string): void` | Notify the server a document was closed. |

#### Initialization & Shutdown

| Method | Signature | Description |
|--------|-----------|-------------|
| `initialize` | `(config: LspServerConfig, rootUri: string \| null): Promise<void>` | Send `initialize` request + `initialized` notification. Sets server status to `"running"`. |
| `shutdown` | `(): Promise<void>` | Graceful shutdown: sends `shutdown` request, then `exit` notification. Falls back to `SIGTERM`/`SIGKILL` on failure. |
| `kill` | `(): void` | Immediately force-kill the server process (`SIGKILL`). |

#### Navigation & Intelligence

All position-based methods use **0-indexed** `line` and `col` (character) parameters, consistent with the LSP specification.

| Method | Signature | LSP Method | Returns |
|--------|-----------|------------|---------|
| `gotoDefinition` | `(uri, line, col): Promise<Location \| Location[] \| null>` | `textDocument/definition` | Definition locations |
| `findReferences` | `(uri, line, col): Promise<Location[] \| null>` | `textDocument/references` | All references (includes declaration) |
| `findImplementations` | `(uri, line, col): Promise<Location \| Location[] \| null>` | `textDocument/implementation` | Implementation locations |
| `findTypeDefinition` | `(uri, line, col): Promise<Location \| Location[] \| null>` | `textDocument/typeDefinition` | Type definition locations |
| `hover` | `(uri, line, col): Promise<Hover \| null>` | `textDocument/hover` | Hover result |
| `documentSymbol` | `(uri): Promise<DocumentSymbol[] \| SymbolInformation[] \| null>` | `textDocument/documentSymbol` | Document symbols |

#### Rename

| Method | Signature | LSP Method | Returns |
|--------|-----------|------------|---------|
| `prepareRename` | `(uri, line, col): Promise<Range \| { range: Range; placeholder: string } \| null>` | `textDocument/prepareRename` | Rename range and placeholder |
| `rename` | `(uri, line, col, newName): Promise<WorkspaceEdit \| null>` | `textDocument/rename` | Workspace edit with changes |

#### Workspace

| Method | Signature | LSP Method | Returns |
|--------|-----------|------------|---------|
| `workspaceSymbol` | `(query: string): Promise<SymbolInformation[] \| WorkspaceSymbol[] \| null>` | `workspace/symbol` | Matching symbols |

#### Call Hierarchy

| Method | Signature | LSP Method | Returns |
|--------|-----------|------------|---------|
| `prepareCallHierarchy` | `(uri, line, col): Promise<CallHierarchyItem[] \| null>` | `textDocument/prepareCallHierarchy` | Call hierarchy items |
| `incomingCalls` | `(item): Promise<CallHierarchyIncomingCall[] \| null>` | `callHierarchy/incomingCalls` | Incoming calls |
| `outgoingCalls` | `(item): Promise<CallHierarchyOutgoingCall[] \| null>` | `callHierarchy/outgoingCalls` | Outgoing calls |

The `item` parameter for `incomingCalls`/`outgoingCalls` matches the `CallHierarchyItem` shape: `{ name, kind, uri, range, selectionRange, data? }`.

#### Type Hierarchy

| Method | Signature | LSP Method | Returns |
|--------|-----------|------------|---------|
| `prepareTypeHierarchy` | `(uri, line, col): Promise<TypeHierarchyItem[] \| null>` | `textDocument/prepareTypeHierarchy` | Type hierarchy items |
| `typeHierarchySupertypes` | `(item, resolve?): Promise<TypeHierarchyItem[] \| null>` | `typeHierarchy/supertypes` | Parent types |
| `typeHierarchySubtypes` | `(item, resolve?): Promise<TypeHierarchyItem[] \| null>` | `typeHierarchy/subtypes` | Child types |

The optional `resolve` parameter controls recursion depth in the hierarchy.

#### Diagnostics

| Method | Signature | LSP Method | Returns |
|--------|-----------|------------|---------|
| `requestDiagnostics` | `(uri: string): Promise<unknown>` | `textDocument/diagnostic` | Pull-model diagnostic result |

#### Process Management

| Method | Signature | Description |
|--------|-----------|-------------|
| `isAlive` | `(): boolean` | Check if the server process is still running. |
| `startProcess` | `(config: LspServerConfig): Promise<void>` | Spawn the LSP server process (called internally by `LspManager`). |

#### Low-Level Transport (inherited from base)

| Method | Signature | Description |
|--------|-----------|-------------|
| `request<T>` | `(method: string, params: unknown, timeoutMs?: number): Promise<T>` | Send a JSON-RPC request and wait for a response. Default timeout: 30 s. |
| `notify` | `(method: string, params: unknown): void` | Send a JSON-RPC notification (no response expected). |

---

### Language Utilities

Re-exports from `/client` — see [Language Utilities](#language-utilities) above.

- `languageFromPath(filePath: string): LspServerConfig | undefined`
- `isServerInstalled(config: LspServerConfig): Promise<boolean>`

---

### Types (lsp)

#### `LspServerConfig`

Describes a supported language and how to start its server.

| Field                  | Type                          | Description                                      |
|------------------------|-------------------------------|--------------------------------------------------|
| `language`             | `string`                      | Language name (e.g. `"typescript"`, `"python"`)  |
| `command`              | `string`                      | Binary to start the server (e.g. `"pyright"`; spawned via `cross-spawn` for cross-platform resolution) |
| `args`                 | `string[]`                    | Additional CLI arguments                          |
| `extensions`           | `string[]`                    | File extensions with dot (e.g. `[".ts", ".tsx"]`) |
| `initializationOptions`| `Record<string, unknown>` (optional) | Sent during `initialize` handshake        |
| `detectCommand`        | `string`                      | Command to verify installation (run via `cross-spawn` for cross-platform support) |
| `installInstructions`  | `string`                      | Human-readable install instructions              |
| `installCommand`       | `string`                      | Package manager command to install the server    |

#### `ServerStatus`

```ts
type ServerStatus = "stopped" | "starting" | "running" | "stopping" | "error";
```

#### `LspServerInstance`

Runtime state for a single LSP server process (internal; not typically constructed by consumers).

| Field             | Type                                                        | Description                          |
|-------------------|-------------------------------------------------------------|--------------------------------------|
| `config`          | `LspServerConfig`                                           | Server configuration                 |
| `status`          | `ServerStatus`                                              | Current lifecycle state              |
| `pid`             | `number \| null`                                            | Child process PID                    |
| `nextId`          | `number`                                                    | JSON-RPC message ID counter          |
| `pendingRequests` | `Map<number, { resolve; reject; timer? }>`                  | In-flight requests awaiting response |
| `lastActive`      | `number`                                                    | Last activity timestamp (ms)         |
| `fileVersions`    | `Map<string, number>`                                       | Tracked file URI → version           |
| `diagnostics`     | `Map<string, Diagnostic[]>`                                 | Cached diagnostics: URI → items      |
| `rootUri`         | `string \| null`                                            | Root URI for this server             |

#### `LspManagerState`

Full state snapshot of the `LspManager`.

| Field               | Type                              | Description                         |
|---------------------|-----------------------------------|-------------------------------------|
| `servers`           | `Map<string, LspServerInstance>`  | Active servers keyed by language    |
| `idleTimeoutMs`     | `number`                          | Idle timeout in ms (default 5 min)  |
| `idleCheckInterval` | `NodeJS.Timeout \| null`          | Timer handle for idle checks        |
| `cwd`               | `string`                          | Working directory                   |
