# @harms-haus/code-lens

LSP-powered code intelligence CLI.

Manage LSP servers from the command line. Get diagnostics, find references, navigate code, and more — without managing LSP servers yourself.

## Installation

```bash
npm install -g @harms-haus/code-lens
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

## Documentation

- [Architecture](docs/architecture.md) — System design and data flow
- [Commands](docs/commands.md) — Full command reference
- [Daemon Protocol](docs/daemon-protocol.md) — Client-daemon communication spec
- [Adding Languages](docs/adding-languages.md) — Guide to adding LSP server support
- [Contributing](docs/contributing.md) — Development setup and PR process

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

## Library Usage

`@harms-haus/code-lens` can also be used as a library — not just a CLI tool. Import it into your own Node.js project to start a daemon, send requests, and process results programmatically.

### Subpath Exports

| Import path | Description |
|---|---|
| `@harms-haus/code-lens` | Re-exports all client functions |
| `@harms-haus/code-lens/client` | Daemon client — `sendRequest`, `ensureDaemon`, `stopDaemon`, `getSocketPath`, `languageFromPath`, and more (see below) |
| `@harms-haus/code-lens/lsp` | Direct LSP access — `LspManager`, `LspClient`, language config utilities |

### Quick Start

```ts
import { ensureDaemon, sendRequest, getSocketPath } from "@harms-haus/code-lens/client";

// Start the daemon (no-op if already running)
await ensureDaemon(process.cwd());

// Send a JSON-RPC request
const socketPath = getSocketPath(process.cwd());
const result = await sendRequest(socketPath, {
  jsonrpc: "2.0",
  method: "fullCheck",
  params: {
    files: ["src/index.ts"],
    config: { prettier: true, linters: true, lsp: true },
  },
  id: 1,
});

// result is a CommandResult: { content, details, isError }
if (result.isError) {
  console.error("Check failed:", result.content[0].text);
} else {
  console.log(result.content[0].text);
  // details.statuses, details.hasIssues, details.durationMs, etc.
}
```

### Client Exports (`@harms-haus/code-lens/client`)

| Export | Kind | Description |
|---|---|---|
| `sendRequest` | function | Send a JSON-RPC request to the daemon over a Unix socket |
| `ensureDaemon` | function | Start a daemon if none is running; restart on version mismatch |
| `startDaemon` | function | Spawn a new daemon process |
| `stopDaemon` | function | Stop the running daemon for a given cwd |
| `isDaemonRunning` | function | Check whether a daemon is active |
| `getSocketPath` | function | Resolve the socket path for a cwd |
| `getMetadataPath` | function | Resolve the daemon metadata file path |
| `languageFromPath` | function | Detect language from a file extension |
| `isServerInstalled` | function | Check whether the LSP server for a language is available |
| `probeSocket` | function | Probe a Unix socket to check if a daemon is listening |
| `ok` / `err` | functions | Build `CommandResult` success/error values |
| `DaemonRequest` | type | JSON-RPC request shape (`{ jsonrpc, method, params, id }`) |
| `DaemonResponse` | type | JSON-RPC response shape |
| `DaemonMetadata` | type | Daemon metadata persisted to disk (`{ pid, socketPath, version, cwd }`) |
| `CommandResult` | type | `{ content, details, isError }` |
| `DAEMON_ERROR_CODES` | const | Standard error codes (`SERVER_NOT_FOUND`, `FILE_NOT_FOUND`, …) |
| `DAEMON_VERSION` | const | Current daemon protocol version |

### Available Daemon Methods

These are the `method` values you can pass in a `DaemonRequest`:

| Method | Description |
|---|---|
| `fullCheck` | Run all checks (formatters, linters, LSP diagnostics) concurrently |
| `diagnostics` | Get LSP diagnostics for files |
| `fileChanged` | Notify the daemon that files have changed |
| `lint` | Run configured linters |
| `prettier` | Check formatting via the formatter system |
| `fix` | Run formatter and linter fix modes (writes to disk) |
| `hover` | Get type info at a position |
| `find-references` | Find all references to a symbol |
| `find-definition` | Go to definition |
| `find-type-definition` | Go to type definition |
| `find-implementations` | Find implementations of an interface/type |
| `find-symbols` | Workspace symbol search |
| `find-document-symbols` | Document symbols for a file |
| `find-calls` | Incoming/outgoing call hierarchy |
| `find-type-hierarchy` | Supertype/subtype hierarchy |
| `rename-symbol` | Rename a symbol across the workspace |
| `status` | Daemon and LSP server status |

### LSP Direct Access (`@harms-haus/code-lens/lsp`)

Use this subpath when you need direct control over LSP servers without the daemon layer:

```ts
import { LspManager, LspClient, languageFromPath } from "@harms-haus/code-lens/lsp";

const manager = new LspManager(process.cwd());
const client: LspClient | null = await manager.getClientForFile("src/index.ts");
if (!client) process.exit(1);
const hover = await client.hover("file:///path/to/src/index.ts", 9, 4);
```

Key exports: `LspManager`, `LspClient`, `DEFAULT_IDLE_TIMEOUT_MS`, `languageFromPath`, `isServerInstalled`, and related types (`LspServerConfig`, `ServerStatus`, `LspServerInstance`, `LspManagerState`).

---

## Requirements

- **Node.js** >= 20.0.0
- **Platforms**: Linux, macOS, Windows
- **LSP servers** must be installed separately — the CLI will display an install command if the required server is missing

## License

MIT
