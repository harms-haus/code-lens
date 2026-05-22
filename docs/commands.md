# Commands Reference

All commands are invoked via the `code-lens` CLI (installed as `@harms-haus/code-lens`). Most commands require a running daemon — the CLI starts one automatically if needed.

```
code-lens <command> [options]
```

---

## diagnostics

Get LSP diagnostics for files or the entire workspace.

**Options:**

| Option | Description |
|--------|-------------|
| `--file <path>` | Single file path |
| `--files <paths>` | Comma-separated list of file paths |
| `--workspace` | Check all files that have been opened in running LSP servers |
| `--refresh` | Force refresh diagnostics (re-request from server) |

**Example — single file:**

```bash
code-lens diagnostics --file src/index.ts
```

**Example output:**

```
Diagnostics for src/index.ts (typescript):
1 error(s), 0 warning(s), 1 info message(s)

src/index.ts:23:5 error: Type 'string' is not assignable to type 'number'.
src/index.ts:45:1 info: Variable 'x' is declared but never used.
```

**Example — workspace:**

```bash
code-lens diagnostics --workspace
```

**Example output:**

```
Workspace diagnostics:
3 file(s), 2 error(s), 1 warning(s), 0 info message(s)

src/index.ts (1 error(s), 0 warning(s), 0 info):
src/index.ts:23:5 error: Type 'string' is not assignable to type 'number'.

src/utils.ts (1 error(s), 1 warning(s), 0 info):
src/utils.ts:10:3 error: Cannot find name 'foo'.
src/utils.ts:15:1 warning: 'bar' is deprecated.
```

**Example — multiple files:**

```bash
code-lens diagnostics --files "src/a.ts,src/b.ts"
```

---

## find-references

Find all references to a symbol at a given position.

**Options:**

| Option | Description |
|--------|-------------|
| `--file <path>` | File path (required) |
| `--line <n>` | Line number, 1-indexed (required) |
| `--col <n>` | Column number, 1-indexed (required) |

**Example:**

```bash
code-lens find-references --file src/foo.ts --line 10 --col 5
```

**Example output:**

```
References found: 3 locations

src/foo.ts:10:5
src/bar.ts:22:8
src/baz.ts:45:12
```

---

## find-definition

Find the definition of a symbol at a given position.

**Options:**

| Option | Description |
|--------|-------------|
| `--file <path>` | File path (required) |
| `--line <n>` | Line number, 1-indexed (required) |
| `--col <n>` | Column number, 1-indexed (required) |

**Example:**

```bash
code-lens find-definition --file src/foo.ts --line 15 --col 8
```

**Example output:**

```
Definition found: 1 location

src/types.ts:42:7
```

---

## find-implementations

Find implementations of an interface, abstract class, or type at a given position.

**Options:**

| Option | Description |
|--------|-------------|
| `--file <path>` | File path (required) |
| `--line <n>` | Line number, 1-indexed (required) |
| `--col <n>` | Column number, 1-indexed (required) |

**Example:**

```bash
code-lens find-implementations --file src/types.ts --line 5 --col 11
```

**Example output:**

```
Implementations found: 2 locations

src/repo/postgres-repo.ts:12:1
src/repo/memory-repo.ts:8:1
```

---

## find-type-definition

Find where the **type** of a symbol is defined. Unlike `find-definition` which jumps to where the symbol itself is declared, this jumps to where its type is defined.

**Options:**

| Option | Description |
|--------|-------------|
| `--file <path>` | File path (required) |
| `--line <n>` | Line number, 1-indexed (required) |
| `--col <n>` | Column number, 1-indexed (required) |

**Example:**

```bash
code-lens find-type-definition --file src/foo.ts --line 20 --col 5
```

**Example output:**

```
Type definition found: 1 location

src/types.ts:15:7
```

---

## find-type-hierarchy

Show the inheritance chain for a type — its parent types (supertypes) and/or child types (subtypes).

**Options:**

| Option | Description | Default |
|--------|-------------|---------|
| `--file <path>` | File path (required) | — |
| `--line <n>` | Line number, 1-indexed (required) | — |
| `--col <n>` | Column number, 1-indexed (required) | — |
| `--direction <dir>` | `supertypes`, `subtypes`, or `both` | `both` |
| `--depth <n>` | Max depth to traverse | `2` |

**Example:**

```bash
code-lens find-type-hierarchy --file src/types.ts --line 10 --col 5 --direction both --depth 3
```

**Example output:**

```
Type hierarchy for "UserService" in src/types.ts:10:5

─── Supertypes (2) ───
  BaseService (Class) — src/base.ts:5:1
  ILogger (Interface) — src/logger.ts:3:1

─── Subtypes (1) ───
  AdminUserService (Class) — src/admin.ts:12:1
```

---

## find-symbols

Search for symbols (functions, classes, variables, etc.) across the workspace.

**Options:**

| Option | Description |
|--------|-------------|
| `--query <string>` | Fuzzy symbol query (required) |
| `--kind <kind>` | Filter by symbol kind (e.g., `class`, `function`, `interface`) |
| `--file <file>` | File to determine language context for server routing (optional) |

**Example:**

```bash
code-lens find-symbols --query "UserService"
```

**Example with `--file` to target a specific language server:**

```bash
code-lens find-symbols --query "Calculator" --file src/main.go
```

**Example output:**

```
Symbols matching "UserService": 3

  UserService (Class) — src/user-service.ts:10:1
  IUserService (Interface) — src/types.ts:25:1
  createUserService (Function) — src/factory.ts:5:1
```

**Example with kind filter:**

```bash
code-lens find-symbols --query "handle" --kind function
```

---

## find-document-symbols

Get an outline of all symbols in a file.

**Options:**

| Option | Description |
|--------|-------------|
| `--file <path>` | File path (required) |

**Example:**

```bash
code-lens find-document-symbols --file src/index.ts
```

**Example output:**

```
Document symbols for src/index.ts:
8 symbols found

├─ AppConfig (Interface) [2:1]
│  ├─ port (Property) [3:3]
│  └─ host (Property) [4:3]
├─ createApp (Function) [8:1]
├─ startServer (Function) [20:1]
└─ main (Function) [30:1]
```

---

## find-calls

List incoming callers and outgoing callees for a function or method.

**Options:**

| Option | Description |
|--------|-------------|
| `--file <path>` | File path (required) |
| `--line <n>` | Line number, 1-indexed (required) |
| `--col <n>` | Column number, 1-indexed (required) |

**Example:**

```bash
code-lens find-calls --file src/service.ts --line 15 --col 5
```

**Example output:**

```
Call hierarchy for "processOrder" in src/service.ts:15:5

─── Incoming Calls (2) ───
  handleRequest — src/router.ts:22:10
      at line 22
  processQueue — src/queue.ts:45:3
      at line 45

─── Outgoing Calls (3) ───
  validateOrder — src/validators.ts:5:1
      at line 18
  calculateTotal — src/pricing.ts:10:1
      at line 19
  saveOrder — src/repository.ts:30:1
      at line 20
```

---

## hover

Get type information, signature, and documentation for a symbol at a position.

**Options:**

| Option | Description |
|--------|-------------|
| `--file <path>` | File path (required) |
| `--line <n>` | Line number, 1-indexed (required) |
| `--col <n>` | Column number, 1-indexed (required) |

**Example:**

```bash
code-lens hover --file src/foo.ts --line 10 --col 5
```

**Example output:**

```
Hover info at src/foo.ts:10:5:

const config: AppConfig

Range: line 10:5 to line 10:11
```

**Example with richer type info:**

```bash
code-lens hover --file src/foo.ts --line 15 --col 3
```

```
Hover info at src/foo.ts:15:3:

```typescript
function processData(input: string, options?: ProcessOptions): Promise<Result>
```

Processes the input string according to the given options.

Range: line 15:1 to line 15:50
```

---

## rename-symbol

Rename a symbol across the codebase. Outputs a unified diff patch — **does not apply changes**.

**Options:**

| Option | Description |
|--------|-------------|
| `--file <path>` | File path (required) |
| `--line <n>` | Line number, 1-indexed (required) |
| `--col <n>` | Column number, 1-indexed (required) |
| `--new-name <string>` | New name for the symbol (required) |

**Example:**

```bash
code-lens rename-symbol --file src/foo.ts --line 10 --col 5 --new-name updatedName
```

**Example output:**

```
Rename "oldName" → "updatedName"
File: src/foo.ts
Files affected: 3

Patch:
```diff
--- src/foo.ts
+++ src/foo.ts
@@ -7,7 +7,7 @@
 const x = 5;
-const oldName = "hello";
+const updatedName = "hello";
 const y = 10;

--- src/bar.ts
+++ src/bar.ts
@@ -20,7 +20,7 @@
   return 42;
-  oldName + x;
+  updatedName + x;
 };
```
```

---

## status

Show the daemon's LSP server status — which language servers are running and their process IDs.

**Options:** None.

**Example:**

```bash
code-lens status
```

**Example output:**

```
typescript: running (pid: 12345)
python: running (pid: 12346)
```

**Example when no servers are running:**

```
No LSP servers running.
```

---

## stop

Stop the daemon process for the current working directory. Unlike other commands, this does **not** dispatch through the daemon — it sends `SIGTERM` directly.

**Options:** None.

**Example:**

```bash
code-lens stop
```

**Example output:**

```
Daemon stopped.
```

---

# Daemon Protocol Commands

The following methods are available **only** over the daemon's JSON-RPC 2.0 protocol (Unix socket / Windows named pipe). They are not exposed as CLI subcommands. Each request is a single JSON object terminated by a newline (NDJSON); the daemon responds with a corresponding JSON-RPC response.

> **Protocol details:** All requests/responses follow the [JSON-RPC 2.0](https://www.jsonrpc.org/specification) spec. The daemon listens on a socket path identified by the `CODE_LENS_SOCKET_PATH` environment variable.

---

## `fileChanged`

Notify the daemon that a file has changed. The daemon will forward the notification to the relevant LSP server so it can update its internal state (e.g., re-index diagnostics).

If the file's extension is not associated with any configured LSP language, the notification is silently skipped.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `file` | `string` | Yes | Relative or absolute path of the changed file |

**Example request:**

```json
{
  "jsonrpc": "2.0",
  "method": "fileChanged",
  "params": { "file": "src/index.ts" },
  "id": 1
}
```

**Example response (file handled):**

```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [{ "type": "text", "text": "file updated" }],
    "details": { "language": "typescript" },
    "isError": false
  },
  "id": 1
}
```

**Example response (file skipped — no LSP support):**

```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [{ "type": "text", "text": "skipped" }],
    "details": { "skipped": true },
    "isError": false
  },
  "id": 1
}
```

---

## `lint`

Run detected linters on the specified files. Linter detection is cached for the lifetime of the daemon process (re-detected if the working directory changes).

Only linters whose file patterns match the provided files are invoked. If no linters are detected or none match, a clean result is returned.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `files` | `string[]` | Yes | Array of file paths to lint |
| `maxConcurrency` | `number` | No | Maximum number of linters to run in parallel |
| `timeoutMs` | `number` | No | Per-linter timeout in milliseconds |

**Example request:**

```json
{
  "jsonrpc": "2.0",
  "method": "lint",
  "params": {
    "files": ["src/index.ts", "src/utils.ts"],
    "maxConcurrency": 4,
    "timeoutMs": 30000
  },
  "id": 2
}
```

**Example response (issues found):**

```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [{
      "type": "text",
      "text": "Lint: 2 errors, 1 warning\n  ✗ src/index.ts:23:5: Unexpected any (no-explicit-any)\n  ⚠ src/utils.ts:10:3: Unused variable 'x' (no-unused-vars)"
    }],
    "details": {
      "issues": ["..."],
      "linterNames": ["eslint"],
      "linterCount": 1
    },
    "isError": false
  },
  "id": 2
}
```

**Example response (no issues):**

```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [{ "type": "text", "text": "Lint: 0 issues (eslint)" }],
    "details": {
      "issues": [],
      "linterNames": ["eslint"],
      "linterCount": 1
    },
    "isError": false
  },
  "id": 2
}
```

---

## `prettier`

Run `prettier --check` on the specified files. Prettier availability is cached for the daemon lifetime.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `files` | `string[]` | Yes | Array of file paths to check |
| `timeoutMs` | `number` | No | Timeout in milliseconds |

**Example request:**

```json
{
  "jsonrpc": "2.0",
  "method": "prettier",
  "params": {
    "files": ["src/index.ts", "src/utils.ts"],
    "timeoutMs": 15000
  },
  "id": 3
}
```

**Example response (files need formatting):**

```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [{
      "type": "text",
      "text": "prettier: 2 file(s) need formatting\n  src/index.ts\n  src/utils.ts"
    }],
    "details": {
      "results": ["..."],
      "available": true,
      "needsFormatting": 2
    },
    "isError": false
  },
  "id": 3
}
```

**Example response (all formatted correctly):**

```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [{ "type": "text", "text": "prettier: 2 file(s) formatted correctly" }],
    "details": {
      "results": ["..."],
      "available": true,
      "needsFormatting": 0
    },
    "isError": false
  },
  "id": 3
}
```

**Example response (prettier not available):**

```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [{ "type": "text", "text": "prettier: not available" }],
    "details": { "available": false, "results": [] },
    "isError": false
  },
  "id": 3
}
```

---

## `tsc`

Run `tsc --noEmit` and filter results to the specified files. Only TypeScript/JavaScript files (`.ts`, `.tsx`, `.js`, `.jsx`, `.mjs`, `.cjs`) are checked. TSC availability is cached for the daemon lifetime.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `files` | `string[]` | Yes | Array of file paths to type-check |
| `timeoutMs` | `number` | No | Timeout in milliseconds |

**Example request:**

```json
{
  "jsonrpc": "2.0",
  "method": "tsc",
  "params": {
    "files": ["src/index.ts", "src/utils.ts"],
    "timeoutMs": 30000
  },
  "id": 4
}
```

**Example response (errors found):**

```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [{
      "type": "text",
      "text": "tsc: 1 error(s), 0 warning(s) (342ms)\n  ✗ src/index.ts:23:5: Type 'string' is not assignable to type 'number'. (TS2322)"
    }],
    "details": {
      "available": true,
      "issues": ["..."],
      "durationMs": 342
    },
    "isError": false
  },
  "id": 4
}
```

**Example response (no errors):**

```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [{ "type": "text", "text": "tsc: 0 errors (215ms)" }],
    "details": {
      "available": true,
      "issues": [],
      "durationMs": 215
    },
    "isError": false
  },
  "id": 4
}
```

**Example response (tsc not available):**

```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [{ "type": "text", "text": "tsc: not available" }],
    "details": { "available": false, "issues": [] },
    "isError": false
  },
  "id": 4
}
```

---

## `fullCheck`

Run all enabled checks concurrently on the specified files. This is the primary method called by external integrations (e.g., pi-lens). Each check category is individually gated by its config flag and tool availability.

The four check categories are:

| Check | Flag | What it does |
|-------|------|--------------|
| **Prettier** | `config.prettier` | Runs `prettier --check` on files |
| **Linters** | `config.linters` | Runs detected linters matching the files |
| **LSP** | `config.lsp` | Notifies LSP servers of changes, waits for diagnostics to settle, then collects them |
| **TSC** | `config.tsc` | Runs `tsc --noEmit` on TypeScript/JavaScript files |

All checks run in parallel via `Promise.all`. Each returns a status: `"clean"`, `"issues"`, `"error"`, or `"skipped"`.

**Parameters:**

| Name | Type | Required | Description |
|------|------|----------|-------------|
| `files` | `string[]` | Yes | Array of file paths to check |
| `config` | `object` | No | Feature flags and timeout settings (see below) |
| `config.prettier` | `boolean` | No | Enable prettier check (default: disabled) |
| `config.linters` | `boolean` | No | Enable linter check (default: disabled) |
| `config.lsp` | `boolean` | No | Enable LSP diagnostics check (default: disabled) |
| `config.tsc` | `boolean` | No | Enable TSC type check (default: disabled) |
| `config.lspDelayMs` | `number` | No | Milliseconds to wait for LSP diagnostics to settle (default: `500`) |
| `config.maxConcurrency` | `number` | No | Max parallel linters |
| `config.prettierTimeoutMs` | `number` | No | Prettier timeout in milliseconds |
| `config.linterTimeoutMs` | `number` | No | Per-linter timeout in milliseconds |
| `config.tscTimeoutMs` | `number` | No | TSC timeout in milliseconds |

**Example request:**

```json
{
  "jsonrpc": "2.0",
  "method": "fullCheck",
  "params": {
    "files": ["src/index.ts", "src/utils.ts"],
    "config": {
      "prettier": true,
      "linters": true,
      "lsp": true,
      "tsc": true,
      "lspDelayMs": 500,
      "tscTimeoutMs": 30000
    }
  },
  "id": 5
}
```

**Example response (issues found):**

```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [{
      "type": "text",
      "text": "  ✅ prettier: 2 file(s) formatted correctly\n  ⚠ 2 errors, 1 warning\n    ✗ src/index.ts:23:5: Unexpected any (no-explicit-any)\n  ⚠ lsp: 3 diagnostic(s) (1 error(s), 2 warning(s))\n    ✗ src/index.ts:23:5: Type 'string' is not assignable to type 'number'.\n  ⚠ tsc: 1 error(s), 0 warning(s)\n    ✗ src/index.ts:23:5: Type 'string' is not assignable to type 'number'. (TS2322)"
    }],
    "details": {
      "statuses": {
        "prettier": "clean",
        "linters": "issues",
        "lsp": "issues",
        "tsc": "issues"
      },
      "hasIssues": true,
      "fileCount": 2,
      "durationMs": 487
    },
    "isError": false
  },
  "id": 5
}
```

**Example response (all checks clean):**

```json
{
  "jsonrpc": "2.0",
  "result": {
    "content": [{ "type": "text", "text": "All checks passed (no issues found)." }],
    "details": {
      "statuses": {
        "prettier": "clean",
        "linters": "clean",
        "lsp": "clean",
        "tsc": "clean"
      },
      "hasIssues": false,
      "fileCount": 2,
      "durationMs": 312
    },
    "isError": false
  },
  "id": 5
}
```
