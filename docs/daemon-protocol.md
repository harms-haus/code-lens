# Daemon Protocol

This document describes the IPC protocol used between the code-lens CLI and its background daemon process.

---

## 1. Transport

The CLI and daemon communicate over a **Unix domain socket** (Linux/macOS) or a **Windows named pipe** (Windows).

### Socket path generation

The socket path is derived from a SHA-256 hash of the current working directory:

```
hash = sha256(cwd)[:16]   // first 16 hex characters
```

| Platform | Path |
|----------|------|
| Linux/macOS | `/tmp/code-lens-{hash}.sock` |
| Windows | `\\.\pipe\code-lens-{hash}` |

Each working directory gets its own unique daemon instance, so you can run daemons for multiple projects simultaneously.

### NDJSON framing

Messages are sent over the socket as **Newline-Delimited JSON (NDJSON)** — each JSON object is serialized to a single line terminated by `\n`. The daemon reads one line per request and writes one line per response.

```
{"jsonrpc":"2.0","method":"hover","params":{...},"id":1}\n
{"jsonrpc":"2.0","result":{...},"id":1}\n
```

---

## 2. Message Format

All messages follow **JSON-RPC 2.0**.

### DaemonRequest

Sent by the CLI to the daemon:

```typescript
interface DaemonRequest {
  jsonrpc: "2.0";
  method: string;
  params: Record<string, unknown>;
  id: number;
}
```

| Field | Description |
|-------|-------------|
| `jsonrpc` | Always `"2.0"` |
| `method` | The command name (see [Methods](#3-methods)) |
| `params` | Method-specific parameters as a key-value object |
| `id` | Request identifier used to correlate responses |

### DaemonResponse

Sent by the daemon back to the CLI:

```typescript
interface DaemonResponse {
  jsonrpc: "2.0";
  result?: CommandResult;
  error?: { code: number; message: string; data?: unknown };
  id: number;
}
```

| Field | Description |
|-------|-------------|
| `jsonrpc` | Always `"2.0"` |
| `result` | Present on success — a `CommandResult` with text content and structured data |
| `error` | Present on failure — error code, message, and optional data |
| `id` | Matches the request `id` |

A response contains **either** `result` **or** `error`, never both.

---

## 3. Methods

### Position-based commands

These commands require a symbol position in a source file:

| Method | Required params | Optional params | Description |
|--------|----------------|-----------------|-------------|
| `find-definition` | `file`, `line`, `col` | — | Go to the definition of the symbol at the given position |
| `find-references` | `file`, `line`, `col` | — | Find all references to the symbol |
| `find-implementations` | `file`, `line`, `col` | — | Find implementations of the interface/type at position |
| `find-type-definition` | `file`, `line`, `col` | — | Go to the definition of the symbol's *type* |
| `hover` | `file`, `line`, `col` | — | Get type info, signature, and docs at position |
| `find-calls` | `file`, `line`, `col` | — | Show incoming and outgoing call hierarchy for a function |
| `rename-symbol` | `file`, `line`, `col`, `newName` | — | Rename a symbol; returns a unified diff patch |
| `find-type-hierarchy` | `file`, `line`, `col` | `direction`, `depth` | Show supertype/subtype inheritance chain |

#### Position params shape

```typescript
{
  file: string;    // File path, relative to cwd or absolute
  line: number;    // 1-based line number (must be ≥ 1)
  col: number;     // 1-based column number (must be ≥ 1)
}
```

Note: Internally, positions are converted to **0-based** before sending to LSP servers.

#### find-type-hierarchy extra params

```typescript
{
  direction?: "supertypes" | "subtypes" | "both";  // default: "both"
  depth?: number;                                   // default: 2
}
```

#### rename-symbol extra param

```typescript
{
  newName: string;   // The new name for the symbol
}
```

### File-based commands

| Method | Required params | Optional params | Description |
|--------|----------------|-----------------|-------------|
| `find-document-symbols` | `file` | — | Get an outline of all symbols in a file |
| `diagnostics` | — | `file`, `files`, `workspace`, `refresh` | Run LSP diagnostics (see below) |

#### diagnostics params

The `diagnostics` method supports three modes:

- **Single file**: pass `file` (string)
- **Multiple files**: pass `files` (comma-separated string)
- **Workspace-wide**: pass `workspace: true`

```typescript
{
  file?: string;        // Single file path
  files?: string;       // Comma-separated file paths
  workspace?: boolean;  // If true, report diagnostics for all open files
  refresh?: boolean;    // If true, request fresh diagnostics from the LSP server
}
```

### Workspace commands

| Method | Required params | Optional params | Description |
|--------|----------------|-----------------|-------------|
| `find-symbols` | `query` | `kind` | Search for symbols across the workspace |

```typescript
{
  query: string;      // Symbol search query (minimum 1 character)
  kind?: string;      // Filter by symbol kind (e.g., "class", "function", "interface")
}
```

### Status command

| Method | Required params | Optional params | Description |
|--------|----------------|-----------------|-------------|
| `status` | — | — | Show currently running LSP servers |

---

## 4. Error Codes

The daemon uses custom error codes in the JSON-RPC error range (`-32000` to `-32099`):

| Code | Constant | Description |
|------|----------|-------------|
| `-32000` | `INTERNAL` | Unexpected internal error (unhandled exception in a handler) |
| `-32001` | `SERVER_NOT_FOUND` | No LSP server is configured or running for the requested language |
| `-32002` | `FILE_NOT_FOUND` | The specified file does not exist or cannot be resolved |
| `-32003` | `LSP_ERROR` | The LSP server returned an error or the operation failed at the protocol level |
| `-32004` | `INVALID_PARAMS` | Missing or malformed request parameters, or unknown method name |

### Error response example

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32004,
    "message": "Missing or invalid 'file' parameter."
  },
  "id": 3
}
```

---

## 5. Lifecycle

### Auto-start on first CLI call

When the CLI needs to communicate with the daemon and no daemon is running, it **automatically spawns one**:

1. The CLI calls `ensureDaemon(cwd)`.
2. If a daemon is already running (socket probe succeeds), it reuses it.
3. If not running, the CLI spawns a detached child process running `server.js` with these environment variables:
   - `CODE_LENS_CWD` — the current working directory
   - `CODE_LENS_SOCKET_PATH` — the generated socket path
4. The CLI polls the socket every 50ms (up to 10 seconds) until the daemon accepts connections.
5. Once ready, the CLI writes a metadata file and proceeds with the request.

### Idle timeout

The daemon shuts itself down after **5 minutes** of inactivity:

- The idle timer resets on every incoming request and every new connection.
- When the timer fires, if there are **zero active connections**, the daemon performs a graceful shutdown.
- If connections are still active when the timer fires, the timer simply resets.

### Graceful shutdown

On shutdown (idle timeout, `SIGTERM`, or `SIGINT`):

1. The idle timer is cleared.
2. All LSP server processes are stopped via `LspManager.stopAll()`.
3. The listening socket server is closed.
4. The daemon process exits with code `0`.

### Manual stop

The CLI provides a `stopDaemon(cwd)` function that:

1. Reads the metadata file to get the daemon's PID.
2. Sends `SIGTERM` to the process.
3. Waits 100ms for OS cleanup.
4. Removes stale socket and metadata files.

---

## 6. Metadata File

When a daemon starts, it writes a metadata file to disk so the CLI can discover and manage it.

### Location

```
~/.code-lens/{hash}.json
```

Where `hash` is the same SHA-256 hash (first 16 hex chars) derived from `cwd`.

### Shape

```typescript
interface DaemonMetadata {
  pid: number;        // OS process ID of the daemon
  socketPath: string; // Full path to the Unix socket or named pipe
  version: string;    // Protocol version (e.g. "0.1.0")
  cwd: string;        // Working directory this daemon serves
}
```

### Example

```json
{
  "pid": 48291,
  "socketPath": "/tmp/code-lens-a1b2c3d4e5f6g7h8.sock",
  "version": "0.1.0",
  "cwd": "/home/user/projects/my-app"
}
```

---

## 7. Protocol Versioning

### Current version

The daemon protocol version is defined in `src/daemon/lifecycle.ts`:

```typescript
export const DAEMON_VERSION = "0.1.0";
```

### Version mismatch handling

When the CLI calls `ensureDaemon(cwd)` and finds an already-running daemon:

1. It reads the metadata file from disk.
2. It compares `metadata.version` against `DAEMON_VERSION`.
3. If the versions **don't match**, the CLI:
   - Stops the old daemon via `stopDaemon(cwd)`.
   - Starts a fresh daemon with the current version via `startDaemon(cwd)`.

This ensures that after an upgrade, the CLI always uses a daemon running the matching protocol version. No manual restart is required.

### Timeouts

| Timeout | Value | Description |
|---------|-------|-------------|
| Request timeout | 60 seconds | CLI gives up waiting for a daemon response |
| Probe timeout | 2 seconds | Socket connection check during startup |
| Startup poll interval | 50ms | How often the CLI checks if the daemon socket is ready |
| Startup max polls | 200 (10s total) | Maximum wait time for daemon to become ready |
| Idle shutdown | 5 minutes | Daemon auto-shutdown after inactivity |
