# code-lens-cli

LSP-powered code intelligence CLI.

Manage LSP servers from the command line. Get diagnostics, find references, navigate code, and more — without managing LSP servers yourself.

## Installation

```bash
npm install -g code-lens-cli
```

## Quick Start

```bash
# Get diagnostics for a file
code-lens diagnostics --file=src/index.ts

# Find all references to a symbol
code-lens find-references --file=src/index.ts --line=10 --col=5

# Get type info at a position
code-lens hover --file=src/index.ts --line=10 --col=5

# Check daemon status
code-lens status
```

## How It Works

`code-lens` uses a **client-daemon architecture** to keep LSP servers warm between commands:

- **CLI client** — a thin wrapper that sends JSON-RPC requests over Unix domain sockets (or Windows named pipes)
- **Daemon server** — a persistent background process that manages LSP server lifecycles

**Lifecycle:**

1. The daemon **auto-starts** on your first command in a working directory
2. Each working directory gets its **own daemon instance** (socket path is derived from a SHA-256 hash of the cwd)
3. LSP servers are started **lazily** when a file of that language is first opened
4. Idle LSP servers are **stopped after 5 minutes** of inactivity
5. The daemon itself **auto-stops after 5 minutes** with no requests and no active connections

This means you can run `code-lens` commands in rapid succession (e.g., from a script) and the LSP server stays warm — no startup penalty after the first invocation.

## Commands

### `diagnostics`

Get LSP diagnostics for files or the entire workspace.

```bash
# Single file
code-lens diagnostics --file=src/index.ts

# Multiple files
code-lens diagnostics --files=src/index.ts,src/utils.ts

# Entire workspace (cached diagnostics from all open files)
code-lens diagnostics --workspace

# Force a fresh diagnostic pull
code-lens diagnostics --file=src/index.ts --refresh
```

**Options:**

| Option | Description |
|--------|-------------|
| `--file <path>` | Single file path |
| `--files <paths>` | Comma-separated file paths |
| `--workspace` | Check entire workspace (cached diagnostics) |
| `--refresh` | Force refresh diagnostics from the server |

**Example output:**

```
Diagnostics for src/index.ts (typescript):
2 error(s), 1 warning(s), 0 info message(s)

  Error: 15:7: [ts] Type 'string' is not assignable to type 'number' (2322)
  Error: 23:14: [ts] Cannot find name 'foo' (2304)
  Warning: 42:5: [ts] 'x' is declared but never used (6133)
```

---

### `find-references`

Find all references to a symbol at a given position.

```bash
code-lens find-references --file=src/index.ts --line=10 --col=5
```

**Required options:** `--file`, `--line`, `--col` (all 1-indexed)

**Example output:**

```
References found: 4

  src/index.ts:10:5
  src/utils.ts:22:12
  src/utils.ts:45:8
  tests/index.test.ts:15:3
```

---

### `find-definition`

Navigate to the definition of a symbol.

```bash
code-lens find-definition --file=src/index.ts --line=10 --col=5
```

**Required options:** `--file`, `--line`, `--col` (all 1-indexed)

**Example output:**

```
Definition found: 1 location(s)

  src/types.ts:8:1
```

---

### `find-implementations`

Find concrete implementations of an interface, abstract class, or type.

```bash
code-lens find-implementations --file=src/types.ts --line=5 --col=11
```

**Required options:** `--file`, `--line`, `--col` (all 1-indexed)

**Example output:**

```
Implementations found: 3

  src/file-logger.ts:4:1
  src/console-logger.ts:7:1
  src/null-logger.ts:3:1
```

---

### `find-type-definition`

Find where the *type* of a symbol is defined. Unlike `find-definition` (which goes to the symbol's declaration), this goes to the type declaration — e.g., for `const user: User`, it jumps to the `User` class.

```bash
code-lens find-type-definition --file=src/index.ts --line=10 --col=5
```

**Required options:** `--file`, `--line`, `--col` (all 1-indexed)

**Example output:**

```
Type definition found: 1 location(s)

  src/types.ts:12:1
```

---

### `find-type-hierarchy`

Show the inheritance chain for a class or type — parent types (supertypes) and/or child types (subtypes).

```bash
# Both directions (default)
code-lens find-type-hierarchy --file=src/types.ts --line=5 --col=11

# Only parent types
code-lens find-type-hierarchy --file=src/types.ts --line=5 --col=11 --direction=supertypes

# Only child types, up to depth 3
code-lens find-type-hierarchy --file=src/types.ts --line=5 --col=11 --direction=subtypes --depth=3
```

**Required options:** `--file`, `--line`, `--col` (all 1-indexed)

| Option | Default | Description |
|--------|---------|-------------|
| `--direction <dir>` | `both` | `supertypes`, `subtypes`, or `both` |
| `--depth <n>` | `2` | Max depth to traverse |

**Example output:**

```
Type hierarchy for "UserService" in src/types.ts:5:11

─── Supertypes (2) ───
  BaseService (Class) — src/base.ts:1:1
  Logger (Interface) — src/logger.ts:3:1

─── Subtypes (1) ───
  AdminUserService (Class) — src/admin.ts:7:1
```

---

### `find-symbols`

Search for symbols (functions, classes, variables, etc.) across the workspace by name.

```bash
# Search by name
code-lens find-symbols --query=UserService

# Filter by kind
code-lens find-symbols --query=handle --kind=function
```

**Required options:** `--query`

| Option | Description |
|--------|-------------|
| `--kind <kind>` | Filter by symbol kind (e.g., `class`, `function`, `interface`, `method`, `variable`) |

**Example output:**

```
Symbols matching "UserService": 3

  UserService [Services] (Class) — src/services/user.ts:15:1
  UserServiceImpl (Class) — src/services/user-impl.ts:8:1
  UserService (Interface) — src/types.ts:42:1
```

---

### `find-document-symbols`

Get an outline of all symbols in a file.

```bash
code-lens find-document-symbols --file=src/index.ts
```

**Required options:** `--file`

**Example output:**

```
Document symbols for src/index.ts:
6 symbols found

Class Application (line 5)
  Method start (line 12)
  Method stop (line 28)
  Property config (line 8)
Function createApp (line 35)
Variable version (line 42)
```

---

### `find-calls`

List incoming callers and outgoing callees for a function at a given position.

```bash
code-lens find-calls --file=src/index.ts --line=15 --col=5
```

**Required options:** `--file`, `--line`, `--col` (all 1-indexed)

**Example output:**

```
Call hierarchy for "handleRequest" in src/index.ts:15:5

─── Incoming Calls (2) ───
  router — src/router.ts:22:3
    at line 22
    at line 45

─── Outgoing Calls (3) ───
  parseBody — src/parser.ts:8:1
    at line 16
  validateInput — src/validator.ts:12:1
    at line 18
  sendResponse — src/response.ts:5:1
    at line 24
```

---

### `hover`

Get type information, signature, and documentation for a symbol at a position.

```bash
code-lens hover --file=src/index.ts --line=10 --col=5
```

**Required options:** `--file`, `--line`, `--col` (all 1-indexed)

**Example output:**

```
Hover info at src/index.ts:10:5:

```typescript
const app: Application
```

Range: line 10:5 to line 10:8
```

---

### `rename-symbol`

Rename a symbol across the codebase. Returns a unified diff patch — **does not apply changes**.

```bash
code-lens rename-symbol --file=src/index.ts --line=10 --col=5 --new-name=myApp
```

**Required options:** `--file`, `--line`, `--col`, `--new-name` (all positions 1-indexed)

**Example output:**

```
Rename "app" → "myApp"
File: src/index.ts
Files affected: 3

Patch:
```diff
--- src/index.ts
+++ src/index.ts
@@ -10,1 +10,1 @@
-const app = createApp();
+const myApp = createApp();

--- src/server.ts
+++ src/server.ts
@@ -5,1 +5,1 @@
-export { app };
+export { myApp };

--- tests/index.test.ts
+++ tests/index.test.ts
@@ -3,1 +3,1 @@
-  expect(app).toBeDefined();
+  expect(myApp).toBeDefined();
```
```

---

### `status`

Show daemon and LSP server status.

```bash
code-lens status
```

**Example output:**

```
typescript: running (pid: 42137)
python: running (pid: 42198)
```

---

### `stop`

Stop the daemon for the current working directory.

```bash
code-lens stop
```

**Example output:**

```
Daemon stopped.
```

## Supported Languages

`code-lens` auto-detects the language from file extensions and starts the appropriate LSP server. LSP servers must be installed separately — the CLI will tell you how if one is missing.

| Language | Extensions | LSP Server | Install |
|----------|-----------|------------|---------|
| TypeScript / JavaScript | `.ts` `.tsx` `.js` `.jsx` `.mjs` `.cjs` | typescript-language-server | `npm install -g typescript-language-server typescript` |
| Python | `.py` | pylsp | `pip install python-lsp-server` |
| Rust | `.rs` | rust-analyzer | `rustup component add rust-analyzer` |
| Go | `.go` | gopls | `go install golang.org/x/tools/gopls@latest` |
| Java | `.java` | Eclipse JDT LS | [eclipse-jdtls/eclipse.jdt.ls](https://github.com/eclipse-jdtls/eclipse.jdt.ls) |
| C / C++ | `.c` `.cpp` `.cc` `.cxx` `.h` `.hpp` `.hxx` | clangd | `apt install clangd` / `brew install llvm` |
| C# | `.cs` | OmniSharp | `dotnet tool install -g omnisharp` |
| PHP | `.php` | intelephense | `npm install -g intelephense` |
| Ruby | `.rb` | ruby-lsp | `gem install ruby-lsp` |
| Lua | `.lua` | lua-language-server | `npm install -g lua-language-server` |
| HTML | `.html` `.htm` | html-languageserver | `npm install -g vscode-html-languageserver-bin` |
| CSS / SCSS / LESS | `.css` `.scss` `.less` | css-languageserver | `npm install -g vscode-css-languageserver-bin` |
| JSON | `.json` `.jsonc` | json-languageserver | `npm install -g vscode-json-languageserver-bin` |
| YAML | `.yaml` `.yml` | yaml-language-server | `npm install -g yaml-language-server` |
| Markdown | `.md` | markdown-language-server | `npm install -g vscode-markdown-languageserver` |
| Dart | `.dart` | Dart analysis server | [dart.dev/get-dart](https://dart.dev/get-dart) |
| Kotlin | `.kt` `.kts` | kotlin-language-server | [fwcd/kotlin-language-server](https://github.com/fwcd/kotlin-language-server) |
| Swift | `.swift` | sourcekit-lsp | Included with Swift ≥ 5.6 |
| Zig | `.zig` | zls | [zigtools/zls](https://github.com/zigtools/zls) |
| Haskell | `.hs` `.lhs` | haskell-language-server | `ghcup install hls` |
| OCaml | `.ml` `.mli` | ocamllsp | `opam install ocaml-lsp-server` |
| Elixir | `.ex` `.exs` | elixir-ls | [elixir-lsp/elixir-ls](https://github.com/elixir-lsp/elixir-ls) |
| Scala | `.scala` `.sbt` | Metals | `cs install metals` |
| Terraform / HCL | `.tf` `.tfvars` `.hcl` | terraform-ls | [hashicorp/terraform-ls](https://github.com/hashicorp/terraform-ls) |
| Dockerfile | `.dockerfile` `Dockerfile` | dockerfile-language-server | `npm install -g dockerfile-language-server-nodejs` |
| SQL | `.sql` | sql-language-server | `npm install -g sql-language-server` |
| Vue | `.vue` | vue-language-server | `npm install -g @vue/language-server @vue/typescript-plugin typescript` |
| Svelte | `.svelte` | svelte-language-server | `npm install -g svelte-language-server` |
| TOML | `.toml` | taplo | `npm install -g @taplo/lsp` |
| Nix | `.nix` | nil | `nix profile install nixpkgs#nil` |
| LaTeX | `.tex` `.latex` | texlab | `cargo install texlab` |
| R | `.r` `.R` | R languageserver | `R -e 'install.packages("languageserver")'` |
| Bash / Shell | `.sh` `.bash` | bash-language-server | `npm install -g bash-language-server` |

## Requirements

- **Node.js** >= 20.0.0
- **LSP servers** must be installed separately — the CLI will display an install command if the required server is missing

## License

MIT
