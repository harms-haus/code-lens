# Architecture

## Overview

@harms-haus/code-lens uses a **client-daemon architecture** to provide LSP-powered code intelligence from the command line. The CLI spawns a long-lived daemon process **per workspace**, and the two communicate over a **Unix domain socket** (or Windows named pipe) using **NDJSON** (newline-delimited JSON) framed with **JSON-RPC 2.0** messages.

The daemon keeps LSP server processes alive between invocations, so repeated commands (e.g. in a REPL or scripting loop) don't pay the startup cost of initializing language servers every time.

```
┌────────────────────────────────────────────────────────────────┐
│  CLI (cli.ts)                                                  │
│  Commander.js entry point. Parses args, dispatches request,    │
│  writes result to stdout.                                      │
└──────────────┬─────────────────────────────────────────────────┘
               │  ensureDaemon(cwd)
               │  sendRequest(socketPath, request)
               ▼
┌────────────────────────────────────────────────────────────────┐
│  Daemon Process (server.ts → daemon/server.ts)                 │
│  One per workspace. Listens on Unix socket / named pipe.       │
│  Routes requests → command handlers → LspManager → LSP servers.│
└──────────────┬─────────────────────────────────────────────────┘
               │  LspManager → LspClient → child process (stdio)
               ▼
┌────────────────────────────────────────────────────────────────┐
│  LSP Server Process (e.g. typescript-language-server)          │
│  Standard JSON-RPC over stdio. One per language.               │
└────────────────────────────────────────────────────────────────┘
```

---

## Components

### CLI — `src/cli.ts`

The Commander.js entry point. Responsibilities:

- Defines all CLI commands with their options via `@commander-js/extra-typings`.
- Each command action calls `dispatch(method, params)`, which:
  1. Calls `ensureDaemon(cwd)` to guarantee a daemon is running.
  2. Constructs a `DaemonRequest` (JSON-RPC 2.0).
  3. Calls `sendRequest(socketPath, request)` to communicate with the daemon.
  4. Writes the `CommandResult.content` items to stdout.
- The `stop` command is special: it calls `stopDaemon(cwd)` directly instead of dispatching through the daemon.

### Daemon Client — `src/daemon/client.ts`

Client-side socket communication. Two functions:

| Function | Purpose |
|---|---|
| `sendRequest(socketPath, request)` | Connects to the daemon's socket, sends a JSON-RPC request as a single NDJSON line, reads the response line, and resolves with a `CommandResult`. Has a 60-second timeout. |
| `probeSocket(socketPath)` | Quick 2-second connection probe to check if a daemon is listening on a socket. Used by the lifecycle module. |

### Daemon Server — `src/daemon/server.ts`

The `DaemonServer` class encapsulates all daemon-side state:

- **Command registry** — a `Map<string, CommandHandler>` mapping method names to handler functions. Command modules call `registerCommand()` at import time.
- **Request routing** — `handleRequest()` looks up the handler by method name, calls it with `(params, lspManager, cwd)`, and returns a JSON-RPC response.
- **Idle timer** — resets on each request. After 5 minutes of inactivity with zero active connections, triggers `gracefulShutdown()`.
- **Connection tracking** — increments/decrements `activeConnections` as sockets connect/disconnect.
- **Shutdown** — stops all LSP servers, closes the server socket, and exits.

Module-level functions (`registerCommand`, `startServer`, `createServer`) support backward compatibility and testing. The `startServer()` function flushes pending command registrations collected at import time into the `DaemonServer` instance.

### Lifecycle — `src/daemon/lifecycle.ts`

Manages the daemon's lifecycle from the CLI side:

| Function | Purpose |
|---|---|
| `isDaemonRunning(cwd)` | Probes the socket to check if a daemon is alive. |
| `readMetadata(cwd)` | Reads `~/.code-lens/<hash>.json` for daemon metadata (PID, socket path, version). |
| `startDaemon(cwd)` | Spawns `server.js` as a detached child process with `CODE_LENS_CWD` and `CODE_LENS_SOCKET_PATH` env vars. Polls the socket until ready (up to 10s). Writes metadata file. |
| `ensureDaemon(cwd)` | Idempotent start. If a daemon is running with a matching version, no-ops. If the version mismatches, restarts. Otherwise, starts fresh. |
| `stopDaemon(cwd)` | Sends `SIGTERM` to the daemon process, waits 100ms, and cleans up socket/metadata files. |

### Commands — `src/commands/`

Each command is a self-contained module that registers itself with the daemon via `registerCommand()`. They share common patterns:

- **`preamble.ts`** — Shared preamble for file-based commands: resolves the file path, detects the language, checks if the server is installed, starts the LSP client if needed, and opens the file in the server. Returns a `PreambleResult` with `{ filePath, config, client, uri }`.
- **`params.ts`** — Parameter extraction and validation (`extractPositionParams`, `extractRenameParams`).
- Individual handlers: `diagnostics.ts`, `find-references.ts`, `find-definition.ts`, `find-implementations.ts`, `find-type-definition.ts`, `find-type-hierarchy.ts`, `find-symbols.ts`, `find-document-symbols.ts`, `find-calls.ts`, `hover.ts`, `rename-symbol.ts`, `status.ts`.

### Language Support — `src/lsp/language-registry.ts` & `src/lsp/language-config.ts`

- **`language-registry.ts`** — Contains the `LANGUAGE_SERVERS` array and extension-to-language lookup logic.
- **`language-config.ts`** — Public API: `languageFromPath(filePath)` for language detection and `isServerInstalled(config)` for checking availability.

### LSP Protocol Types — `src/lsp/lsp-protocol.ts`

Defines JSON-RPC message types and LSP parameter interfaces used for daemon ↔ LSP server communication.

### LSP Manager — `src/lsp/lsp-manager.ts`

The `LspManager` class manages LSP server instances for a workspace:

- **Server lifecycle** — starts, stops, and tracks LSP server processes per language. Deduplicates concurrent startup attempts for the same language.
- **Idle timeout** — checks every 60 seconds. LSP servers idle for more than 5 minutes (configurable) are stopped automatically.
- **File tracking** — tracks which files are open in each server (`fileVersions` map) with a cap at 200 files to prevent unbounded growth. Older files are closed via `didClose`.
- **Diagnostics cache** — stores diagnostics per URI from push-model notifications. Supports pull-model (`textDocument/diagnostic`) for LSP 3.17+ servers.
- **Client access** — `getClientForFile(filePath)` and `getClientForConfig(config)` return the appropriate `LspClient` instance.

### LSP Client — `src/lsp/lsp-client.ts` & `src/lsp/lsp-client-methods.ts`

Two-layer design:

- **`lsp-client.ts` (base transport)** — Manages the child process, parses the LSP wire protocol (`Content-Length` header + JSON body), routes responses to pending requests, and forwards notifications. Provides `request<T>(method, params, timeout)` and `notify(method, params)`.
- **`lsp-client-methods.ts` (high-level methods)** — Extends the base with typed wrappers for each LSP operation: `initialize`, `gotoDefinition`, `findReferences`, `hover`, `rename`, `workspaceSymbol`, `documentSymbol`, `prepareCallHierarchy`, `incomingCalls`, `outgoingCalls`, `findImplementations`, `findTypeDefinition`, `prepareTypeHierarchy`, `typeHierarchySupertypes`, `typeHierarchySubtypes`, `shutdown`, `kill`.

### Formatting — `src/formatting/`

| File | Purpose |
|---|---|
| `output.ts` | `CommandResult` type and `ok()`/`err()` builders. Error sanitization. |
| `diagnostics.ts` | Formats LSP `Diagnostic` objects into readable lines. Severity counting. |
| `symbols.ts` | Formats `DocumentSymbol` and `SymbolInformation` lists. Symbol kind name map. |
| `diff.ts` | Exports `sortEdits`, `applyEdits`, `buildDiff`, `extractTextFromRange`, `extractWordAtPosition`, and `applyEditsAndDiff`. Builds unified diff patches for rename operations from `WorkspaceEdit`. |
| `index.ts` | Re-exports. |

### Utils — `src/utils/`

| File | Purpose |
|---|---|
| `socket-path.ts` | `getSocketPath(cwd)` — SHA-256 hash of cwd → socket path in `$TMPDIR/code-lens-<hash>.sock` (or `\\.\pipe\code-lens-<hash>` on Windows). `getMetadataPath(cwd)` — `~/.code-lens/<hash>.json`. |
| `paths.ts` | File path resolution, URI conversion (`filePathToUri`, `uriToFilePath`), location formatting. |
| `env.ts` | `getSanitizedEnv()` — strips problematic env vars before spawning LSP servers. |

---

## Data Flow

A typical request lifecycle (e.g. `find-references`):

```
1. User runs: code-lens find-references --file src/foo.ts --line 10 --col 5

2. CLI (cli.ts)
   ├── Commander parses arguments into opts
   ├── dispatch("find-references", { file, line, col })
   │   ├── ensureDaemon(cwd)
   │   │   ├── isDaemonRunning(cwd) → probeSocket
   │   │   ├── If not running: startDaemon(cwd) → spawn server.js
   │   │   └── If version mismatch: stopDaemon + startDaemon
   │   ├── Build DaemonRequest { jsonrpc: "2.0", method, params, id }
   │   └── sendRequest(socketPath, request)
   │       ├── Connect to Unix socket
   │       ├── Write JSON + newline
   │       ├── Read response line
   │       └── Resolve with CommandResult
   ├── Write result.content[].text to stdout
   └── Exit with code 0 (or 1 if result.isError)

3. Daemon (daemon/server.ts)
   ├── Accept socket connection
   ├── Parse NDJSON line → DaemonRequest
   ├── handleRequest(request, cwd)
   │   ├── Lookup handler in commandHandlers map
   │   ├── Call handler(params, lspManager, cwd)
   │   │   ├── extractPositionParams(params) — validate
   │   │   ├── executePreamble(file, manager, cwd)
   │   │   │   ├── resolveFile(file, cwd)
   │   │   │   ├── languageFromPath(filePath) — detect language
   │   │   │   ├── isServerInstalled(config)
   │   │   │   ├── manager.getClientForFile(filePath) — start if needed
   │   │   │   ├── manager.ensureFileOpen(client, config, filePath)
   │   │   │   └── filePathToUri(filePath)
   │   │   ├── client.findReferences(uri, line, col)
   │   │   │   └── LSP JSON-RPC request → language server → response
   │   │   ├── flattenLocations(result)
   │   │   ├── formatLocations(locations)
   │   │   └── Return ok(formatted, { references })
   │   └── Wrap in DaemonResponse { jsonrpc: "2.0", result, id }
   ├── Write JSON + newline back to socket
   └── Reset idle timer
```

---

## Protocol

### CLI ↔ Daemon: JSON-RPC 2.0 over NDJSON

Communication happens over a Unix domain socket (or Windows named pipe). Each message is a single JSON object terminated by a newline.

**Request** (`DaemonRequest`):

```json
{"jsonrpc": "2.0", "method": "find-references", "params": {"file": "src/foo.ts", "line": 10, "col": 5}, "id": 1}
```

**Response** (`DaemonResponse`):

```json
{"jsonrpc": "2.0", "result": {"content": [{"type": "text", "text": "References found: 3 locations\n\n..."}], "details": {"count": 3}, "isError": false}, "id": 1}
```

**Error response**:

```json
{"jsonrpc": "2.0", "error": {"code": -32004, "message": "Unknown method: foo"}, "id": 1}
```

Error codes are defined in `src/daemon/protocol.ts`:

| Code | Constant | Meaning |
|------|----------|---------|
| -32000 | `INTERNAL` | Unexpected daemon error |
| -32001 | `SERVER_NOT_FOUND` | LSP server not found |
| -32002 | `FILE_NOT_FOUND` | File does not exist |
| -32003 | `LSP_ERROR` | LSP server returned an error |
| -32004 | `INVALID_PARAMS` | Unknown method or invalid JSON |

### Daemon ↔ LSP Server: JSON-RPC 2.0 over stdio

Standard LSP wire protocol with `Content-Length` headers. The daemon communicates with each language server process via its stdin/stdout.

---

## State

### DaemonServer (`daemon/server.ts`)

All daemon mutable state is encapsulated in the `DaemonServer` class:

| Field | Type | Purpose |
|-------|------|---------|
| `idleTimer` | `Timeout \| null` | Auto-shutdown timer (5 min idle) |
| `activeConnections` | `number` | Currently open socket connections |
| `serverInstance` | `net.Server \| null` | The TCP/socket server |
| `lspManager` | `LspManager \| null` | Manages all LSP servers |
| `commandHandlers` | `Map<string, CommandHandler>` | Registered command handlers |

### LspManager (`lsp/lsp-manager.ts`)

| Field | Type | Purpose |
|-------|------|---------|
| `state.servers` | `Map<string, LspServerInstance>` | Running server instances keyed by language |
| `state.idleTimeoutMs` | `number` | Idle timeout (default 5 min) |
| `state.idleCheckInterval` | `Timeout \| null` | Periodic idle check timer |
| `state.cwd` | `string` | Workspace root directory |
| `clientMap` | `Map<string, LspClient>` | LspClient instances keyed by language |
| `startingPromises` | `Map<string, Promise<void>>` | Deduplication map for concurrent startups |

### LspServerInstance (`lsp/types.ts`)

Per-language server state:

| Field | Type | Purpose |
|-------|------|---------|
| `config` | `LspServerConfig` | Server configuration |
| `status` | `ServerStatus` | Lifecycle state (`stopped`, `starting`, `running`, `stopping`, `error`) |
| `pid` | `number \| null` | Child process PID |
| `nextId` | `number` | JSON-RPC request ID counter |
| `pendingRequests` | `Map<number, {resolve, reject, timer}>` | Outstanding LSP requests |
| `lastActive` | `number` | Timestamp of last activity |
| `fileVersions` | `Map<string, number>` | Open file version tracking |
| `diagnostics` | `Map<string, Diagnostic[]>` | Cached diagnostics per URI |
| `rootUri` | `string \| null` | Workspace root URI |

---

## Design Decisions

### Daemon per-workspace

Each unique working directory gets its own daemon process. This isolates workspaces — different projects may use different language servers, different file sets, and different LSP server configurations. Socket paths are derived from a SHA-256 hash of the cwd, so they never collide.

### Idle timeout

Both the daemon (5 min) and individual LSP servers (5 min) have idle timeouts. This ensures resources are released when the user stops working, while still providing fast responses during active use. The daemon timer resets on every incoming request; LSP server timers reset on any request or notification.

### Versioned metadata

When the CLI starts a daemon, it writes a metadata file (`~/.code-lens/<hash>.json`) containing the PID, socket path, and daemon version. On subsequent invocations, `ensureDaemon()` checks if the running daemon's version matches the current CLI version. If not, it restarts the daemon. This prevents version skew when the CLI is updated.

### Preamble pattern

Most commands share a common setup: resolve the file, detect the language, check installation, start the server, and open the file. This is centralized in `executePreamble()` (`commands/preamble.ts`), which returns a typed result (`PreambleResult`) or an error `CommandResult`. This reduces duplication and ensures consistent error handling.

### Command registration at import time

Command modules call `registerCommand()` at the top level, which stores handlers in a pending map. `server.ts` imports all command modules (side-effect imports), then `startServer()` flushes the pending registrations into the `DaemonServer` instance. This keeps command modules self-contained and decoupled from the server.

### Two-layer LSP client

The LSP client is split into a base transport layer (`lsp-client.ts`) handling process management and message framing, and a methods layer (`lsp-client-methods.ts`) providing typed wrappers. This separation makes the transport testable independently and keeps method implementations clean.
