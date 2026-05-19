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

**Example:**

```bash
code-lens find-symbols --query "UserService"
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
