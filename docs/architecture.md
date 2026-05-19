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
- Individual handlers: `diagnostics.ts`, `find-references.ts`, `find-definition.ts`, `find-implementations.ts`, `find-type-definition.ts`, `find-type-hierarchy.ts`, `find-symbols.ts`, `find-document-symbols.ts`, `find-calls.ts`, `hover.ts`, `rename-symbol.ts`, `status.ts`, `file-changed.ts`, `lint.ts`, `prettier.ts`, `tsc.ts`, `fullCheck.ts`.

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

### Linting Subsystem — `src/linting/`

A self-contained subsystem for detecting, running, and formatting output from external linters, formatters, and type checkers. Designed to operate independently of the LSP subsystem — linting commands do not require an LSP server.

#### types.ts — Core types

Defines the shared data types used across all linting modules:

| Type | Purpose |
|------|----------|
| `LintIssue` | Normalized lint issue with file, line, column, severity, message, code, and source linter. The universal output format all parsers produce. |
| `LinterDefinition` | Static definition of a supported linter: name, languages, extensions, config files, package keys, version/lint commands, parser function, and timeout. |
| `DetectedLinter` | A linter confirmed available in the current project, with its `LinterDefinition`, resolved config file path, version string, and how it was detected (`"config-file"` \| `"package-key"` \| `"project-marker"`). |
| `PrettierResult` | Per-file prettier check result: file path, whether it needs formatting, and optional error. |
| `TscIssue` | Parsed `tsc` diagnostic with file, line, column, severity, message, and TS error code. |
| `CheckStatus` | Union type: `"pending"` \| `"running"` \| `"clean"` \| `"issues"` \| `"error"` \| `"skipped"`. |

#### definitions.ts — Linter definitions

Exports `LINTER_DEFINITIONS`: an array of 11 `LinterDefinition` objects, one per supported linter:

| Linter | Languages | Key config files |
|--------|-----------|-----------------|
| ESLint | JavaScript, TypeScript | `.eslintrc.*`, `eslint.config.*` |
| Biome | JavaScript, TypeScript | `biome.json` |
| Ruff | Python | `ruff.toml`, `.ruff.toml` |
| Flake8 | Python | `.flake8`, `setup.cfg`, `tox.ini` |
| Pylint | Python | `.pylintrc`, `pylintrc` |
| Mypy | Python | `mypy.ini`, `.mypy.ini` |
| Clippy | Rust | `Clippy.toml`, `.clippy.toml` |
| staticcheck | Go | *(none — uses `go.mod` project marker)* |
| RuboCop | Ruby | `.rubocop.yml` |
| ShellCheck | Shell | `.shellcheckrc` |
| Stylelint | CSS, SCSS, Less | `.stylelintrc.*`, `stylelint.config.*` |

Each definition specifies extensions, config files, optional `packageKeys` (for `package.json` detection) and `projectMarkers` (ecosystem files like `Cargo.toml`, `go.mod`), a `versionCommand` string, a `lintCommand` function that returns `[cmd, ...args]`, and a `parseOutput` function reference. Timeouts range from 15s (most linters) to 120s (Clippy).

#### parsers.ts — Output parsers

Exports 11 parser functions, one per linter, each with signature `(stdout: string, cwd: string) => LintIssue[]`. Handles linter-specific JSON formats, tab-delimited formats (Flake8), and NDJSON lines (Clippy, Mypy, staticcheck). All parsers are defensive — they return `[]` on parse failures rather than throwing. Notable parsing details:

- **Clippy**: Parses JSON-lines with `reason: "compiler-message"`, resolves spans relative to cwd.
- **Flake8**: Tab-delimited `path\trow\tcol\tcode\ttext` format. Codes starting with `E` or `F` are mapped to `"error"` severity.
- **Mypy**: NDJSON with `--output=json`. Columns are 1-adjusted from mypy's 0-based output.
- **staticcheck**: Tries JSON-lines first, falls back to text format regex `file:line:col: message (code)`.
- **Biome**: Scans for the first `{` in stdout (handles leading non-JSON output), resolves relative paths.

#### linter-registry.ts — Detection and file discovery

Provides linter detection and file-to-linter matching:

| Function | Purpose |
|----------|----------|
| `detectLinters(cwd)` | Two-phase detection: (1) synchronous scan of config files, `package.json` keys, and project markers to collect candidates, (2) parallel `versionCommand` execution to verify installation. Returns `DetectedLinter[]`. |
| `getLintersForFile(filePath, detected)` | Filters detected linters to those whose extensions match the file. |
| `getCoveredExtensions(detected)` | Returns all file extensions covered by the detected linters. |
| `discoverFilesNative(cwd, extensions, maxFiles?, signal?)` | Cross-platform recursive file discovery using `fs.promises.readdir`. Respects `IGNORE_DIRS` (node_modules, .git, target, etc.) and skips dot-directories. Returns up to `maxFiles` (default 1000). |

Detection order per linter: config file → `pyproject.toml` section → `package.json` dependency key → project marker. The `package.json` is read once and cached across all linter checks. Special handling for `setup.cfg`/`tox.ini` (require a section header like `[flake8]`) and `pyproject.toml` (requires `[tool.ruff]` etc.).

#### linter-runner.ts — Linter execution

Runs linters with concurrency control:

| Function | Purpose |
|----------|----------|
| `runLinter(linter, files, cwd, signal?, timeoutCap?)` | Execute a single linter against matching files. Uses `execCommand` from `utils/spawn`. Applies `timeoutCap` to clamp the linter's default timeout. Exit code 1 from linters is treated as normal (issues found), not an error. |
| `runLinters(linters, files, cwd, signal?, maxConcurrency?, timeoutCap?)` | Runs multiple linters in parallel. Pre-groups files by extension for O(1) lookup. Batches tasks when `maxConcurrency` is set. Each linter only processes files matching its extensions. |

Also re-exports `formatIssues` and `summarizeIssues` from `output-formatter` for backward compatibility.

#### prettier-runner.ts — Prettier check runner

Report-only prettier execution (does not write files):

| Function | Purpose |
|----------|----------|
| `isPrettierAvailable(cwd)` | Runs `npx prettier --version` with a 10s timeout. |
| `runPrettier(files, cwd, signal?, timeout?)` | Runs `npx prettier --check` on files with supported extensions. Exit code 0 = all formatted correctly; exit code 1 = parses stdout for file paths needing formatting. Returns `PrettierResult[]`. |

Supported extensions: `.js`, `.jsx`, `.ts`, `.tsx`, `.json`, `.jsonc`, `.css`, `.scss`, `.less`, `.html`, `.md`, `.mdx`, `.yaml`, `.yml`, `.vue`, `.svelte`, `.graphql`.

#### tsc-runner.ts — TypeScript type checker

Runs `tsc --noEmit` and parses diagnostics:

| Function | Purpose |
|----------|----------|
| `isTscAvailable(cwd)` | Checks for `tsconfig.json` (fast fs check) then runs `npx tsc --version`. |
| `detectTsconfig(cwd)` | Returns the path to `tsconfig.json` if found. |
| `runTsc(cwd, files?, signal?, timeout?)` | Runs `tsc --noEmit --pretty false`. Parses output via regex `file(line,col): error|warning TSnnnn: message`. If `files` is provided, results are filtered to only those files. Returns `TscRunResult` with issues, duration, and optional error. |

#### bash-file-detector.ts — Bash command file detection

Best-effort detection of file paths affected by a bash command. Scans command strings for common file-writing patterns:

- `sed -i`, `cat >`, `echo/printf >`, `tee`, `perl -i`, `awk >`, `python -c >`, `dd of=`, `mv`, `cp`
- Shell redirects (`>`, `>>`) as a fallback
- Splits compound commands on `&&`, `;`, `|`, and newlines

Returns `DetectedBashFiles { written: string[], read: string[] }` with absolute paths resolved against cwd. Files in both sets are removed from `read`. Known limitations: cannot handle variable expansion, subshells, aliases, or arbitrary functions.

#### output-formatter.ts — Issue formatting

| Function | Purpose |
|----------|----------|
| `formatIssues(issues, cwd?)` | Formats `LintIssue[]` into human-readable lines with severity icons (`✗`, `⚠`, `ℹ`), relative paths, and `[source]` tags. Truncates at 2000 lines or 50KB to prevent context overflow. |
| `summarizeIssues(issues)` | One-line summary: `"Lint Results: 2 error(s), 1 warning(s) in 3 file(s)"`. |

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
| `spawn.ts` | `execCommand(command, args, options)` — Promise-based process spawning built on `child_process.spawn`. Returns `{ stdout, stderr, exitCode }`. Handles timeouts, `AbortSignal` cancellation, max-buffer overflow (stdout capped at `maxBuffer`, stderr kept to last 512KB when over 1MB), and process errors — never rejects, always resolves with an `ExecResult`. Used by linter, prettier, and tsc runners. |

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

### New Commands — Linting & Checking

Five new commands leverage the linting subsystem:

| Command | Module | Purpose |
|---------|--------|----------|
| `fileChanged` | `file-changed.ts` | Notifies the LSP manager that a file has been modified. Calls `manager.onFileChanged(filePath)`. Lightweight — no linting, just keeps LSP diagnostics fresh. |
| `lint` | `lint.ts` | Detects available linters, filters to those matching the provided files, runs them with `runLinters()`, and returns formatted issues. |
| `prettier` | `prettier.ts` | Checks if prettier is available, runs `prettier --check` on supported files. Report-only — does not write. |
| `tsc` | `tsc.ts` | Checks if TypeScript is available (`tsconfig.json` + `tsc --version`), runs `tsc --noEmit`, filters results to the provided files. |
| `fullCheck` | `fullCheck.ts` | Runs all four check types (prettier, linters, LSP diagnostics, tsc) concurrently via `Promise.all`. Each check is gated by a config flag in `params.config` (e.g., `{ prettier: true, linters: true, lsp: true, tsc: true }`). LSP check includes a configurable `lspDelayMs` (default 500ms) to let diagnostics settle. |

#### Caching behavior

All linting commands use **module-level caching** to avoid re-detecting tools on every call within a daemon's lifetime:

- `lint.ts` caches detected linters (`DetectedLinter[]`) and re-detects only when `cwd` changes.
- `prettier.ts` caches prettier availability (`boolean`).
- `tsc.ts` caches tsc availability (`boolean`).
- `fullCheck.ts` caches all three in a single `ensureCache()` call, invalidated together on `cwd` change.
- Each module exports an `invalidate*Cache()` function for external cache busting.

Since the daemon is per-workspace (one `cwd`), caches are effectively stable for the daemon's lifetime.

### Command registration at import time

Command modules call `registerCommand()` at the top level, which stores handlers in a pending map. `server.ts` imports all command modules (side-effect imports), then `startServer()` flushes the pending registrations into the `DaemonServer` instance. This keeps command modules self-contained and decoupled from the server.

### Two-layer LSP client

The LSP client is split into a base transport layer (`lsp-client.ts`) handling process management and message framing, and a methods layer (`lsp-client-methods.ts`) providing typed wrappers. This separation makes the transport testable independently and keeps method implementations clean.

---

## Library Entry Points

code-lens is usable as both a CLI tool and a library. Three barrel files provide layered exports for different consumption patterns:

### `src/lib.ts` — Primary public API

Re-exports everything from `lib-client.ts`. This is the main entry point for external consumers:

```typescript
export * from "./lib-client.js";
```

### `src/lib-client.ts` — Daemon client exports

Provides everything needed to connect to a running code-lens daemon and send requests:

| Export | Source | Purpose |
|--------|--------|----------|
| `sendRequest`, `probeSocket` | `daemon/client.ts` | Socket communication with the daemon |
| `ensureDaemon`, `startDaemon`, `stopDaemon`, `isDaemonRunning` | `daemon/lifecycle.ts` | Daemon lifecycle management |
| `DAEMON_VERSION` | `daemon/lifecycle.ts` | Current daemon version string |
| `getSocketPath`, `getMetadataPath` | `utils/socket-path.ts` | Socket and metadata file path resolution |
| `DaemonMetadata` *(type)* | `utils/socket-path.ts` | Metadata file structure |
| `DaemonRequest`, `DaemonResponse` *(types)* | `daemon/protocol.ts` | JSON-RPC message types |
| `DAEMON_ERROR_CODES` | `daemon/protocol.ts` | Error code constants |
| `CommandResult` *(type)* | `formatting/output.ts` | Command result structure |
| `ok`, `err` | `formatting/output.ts` | Result builders |
| `languageFromPath`, `isServerInstalled` | `lsp/language-config.ts` | Language detection and server availability |
| `LspServerConfig` *(type)* | `lsp/types.ts` | LSP server configuration |

### `src/lib-lsp.ts` — LSP internals

Provides direct access to LSP manager internals for non-daemon usage (e.g., embedding in another process):

| Export | Source | Purpose |
|--------|--------|----------|
| `LspManager`, `DEFAULT_IDLE_TIMEOUT_MS` | `lsp/lsp-manager.ts` | LSP server lifecycle manager |
| `LspServerConfig`, `ServerStatus`, `LspServerInstance`, `LspManagerState` *(types)* | `lsp/types.ts` | LSP type definitions |
| `languageFromPath`, `isServerInstalled` | `lsp/language-config.ts` | Language detection |
| `LspClient` | `lsp/lsp-client-methods.ts` | High-level LSP client with typed method wrappers |

### Design rationale

The three-layer structure serves distinct use cases:

1. **`lib.ts`** — The default import for library consumers. Provides the full client API (connect to a daemon, send requests, manage lifecycle). Re-exports `lib-client.ts` for a single unified surface.
2. **`lib-client.ts`** — The daemon client layer. Use this when you need to communicate with a running daemon without pulling in LSP internals. Includes all types and functions for socket communication, lifecycle, and result handling.
3. **`lib-lsp.ts`** — The internal LSP layer. Use this when you want to embed the LSP manager directly in your own process, bypassing the daemon entirely. Exposes `LspManager` and `LspClient` for programmatic control.
