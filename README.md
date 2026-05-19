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

## Requirements

- **Node.js** >= 20.0.0
- **LSP servers** must be installed separately — the CLI will display an install command if the required server is missing

## License

MIT
