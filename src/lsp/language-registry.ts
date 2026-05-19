/**
 * Language server registry — data definitions and extension lookup helpers
 */

import type { LspServerConfig } from "./types.js";

export const LANGUAGE_SERVERS: LspServerConfig[] = [
  // ── TypeScript / JavaScript ──────────────────────────────────────────────
  {
    language: "typescript",
    command: "typescript-language-server",
    args: ["--stdio"],
    extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"],
    detectCommand: "typescript-language-server --version",
    installCommand: "npm install -g typescript-language-server typescript",
    installInstructions: "npm install -g typescript-language-server typescript",
  },

  // ── Python ───────────────────────────────────────────────────────────────
  {
    language: "python",
    command: "pylsp",
    args: [],
    extensions: [".py"],
    detectCommand: "pylsp --version",
    installCommand: "pip install python-lsp-server",
    installInstructions: "pip install python-lsp-server",
  },

  // ── Rust ─────────────────────────────────────────────────────────────────
  {
    language: "rust",
    command: "rust-analyzer",
    args: [],
    extensions: [".rs"],
    detectCommand: "rust-analyzer --version",
    installCommand: "rustup component add rust-analyzer",
    installInstructions: "rustup component add rust-analyzer",
  },

  // ── Go ───────────────────────────────────────────────────────────────────
  {
    language: "go",
    command: "gopls",
    args: [],
    extensions: [".go"],
    detectCommand: "gopls version",
    installCommand: "go install golang.org/x/tools/gopls@latest",
    installInstructions: "go install golang.org/x/tools/gopls@latest",
  },

  // ── Java ─────────────────────────────────────────────────────────────────
  {
    language: "java",
    command: "java",
    args: [
      "-Declipse.application=org.eclipse.jdt.ls.core.id1",
      "-Dosgi.bundles.defaultStartLevel=4",
      "-Declipse.product=org.eclipse.jdt.ls.core.product",
      "-Dlog.level=ALL",
      "-noverify",
      "-Xmx1G",
      "-jar",
      "/opt/jdt-language-server/plugins/org.eclipse.equinox.launcher_*.jar",
      "-configuration",
      "/opt/jdt-language-server/config_linux",
      "-data",
      "/tmp/jdt-workspace",
    ],
    extensions: [".java"],
    detectCommand: "java -version",
    installCommand:
      "Install Eclipse JDT Language Server (see https://github.com/eclipse-jdtls/eclipse.jdt.ls)",
    installInstructions:
      "Download Eclipse JDT LS and set command/args to point to the launcher jar",
  },

  // ── C/C++ ────────────────────────────────────────────────────────────────
  {
    language: "cpp",
    command: "clangd",
    args: ["--background-index"],
    extensions: [".c", ".cpp", ".cc", ".cxx", ".h", ".hpp", ".hxx"],
    detectCommand: "clangd --version",
    installCommand: "apt install clangd  # or: brew install llvm",
    installInstructions: "Install clangd via your package manager (apt, brew, pacman, etc.)",
  },

  // ── C# ───────────────────────────────────────────────────────────────────
  {
    language: "csharp",
    command: "OmniSharp",
    args: [],
    extensions: [".cs"],
    detectCommand: "omnisharp --version",
    installCommand: "dotnet tool install -g omnisharp  # or use the standalone binary",
    installInstructions: "Install OmniSharp via dotnet tool or download standalone",
  },

  // ── PHP ──────────────────────────────────────────────────────────────────
  {
    language: "php",
    command: "intelephense",
    args: ["--stdio"],
    extensions: [".php"],
    detectCommand: "intelephense --version",
    installCommand: "npm install -g intelephense",
    installInstructions: "npm install -g intelephense",
  },

  // ── Ruby ─────────────────────────────────────────────────────────────────
  {
    language: "ruby",
    command: "ruby-lsp",
    args: ["stdio"],
    extensions: [".rb"],
    detectCommand: "ruby-lsp --version",
    installCommand: "gem install ruby-lsp",
    installInstructions: "gem install ruby-lsp",
  },

  // ── Lua ──────────────────────────────────────────────────────────────────
  {
    language: "lua",
    command: "lua-language-server",
    args: [],
    extensions: [".lua"],
    detectCommand: "lua-language-server --version",
    installCommand: "npm install -g lua-language-server",
    installInstructions: "npm install -g lua-language-server",
  },

  // ── HTML ─────────────────────────────────────────────────────────────────
  {
    language: "html",
    command: "html-languageserver",
    args: ["--stdio"],
    extensions: [".html", ".htm"],
    detectCommand: "html-languageserver --version",
    installCommand: "npm install -g vscode-html-languageserver-bin",
    installInstructions: "npm install -g vscode-html-languageserver-bin",
  },

  // ── CSS / SCSS / LESS ────────────────────────────────────────────────────
  {
    language: "css",
    command: "css-languageserver",
    args: ["--stdio"],
    extensions: [".css", ".scss", ".less"],
    detectCommand: "css-languageserver --version",
    installCommand: "npm install -g vscode-css-languageserver-bin",
    installInstructions: "npm install -g vscode-css-languageserver-bin",
  },

  // ── JSON ─────────────────────────────────────────────────────────────────
  {
    language: "json",
    command: "json-languageserver",
    args: ["--stdio"],
    extensions: [".json", ".jsonc"],
    detectCommand: "json-languageserver --version",
    installCommand: "npm install -g vscode-json-languageserver-bin",
    installInstructions: "npm install -g vscode-json-languageserver-bin",
  },

  // ── YAML ─────────────────────────────────────────────────────────────────
  {
    language: "yaml",
    command: "yaml-language-server",
    args: ["--stdio"],
    extensions: [".yaml", ".yml"],
    detectCommand: "yaml-language-server --version",
    installCommand: "npm install -g yaml-language-server",
    installInstructions: "npm install -g yaml-language-server",
  },

  // ── Markdown ─────────────────────────────────────────────────────────────
  {
    language: "markdown",
    command: "markdown-language-server",
    args: ["--stdio"],
    extensions: [".md"],
    detectCommand: "markdown-language-server --version",
    installCommand: "npm install -g vscode-markdown-languageserver",
    installInstructions: "npm install -g vscode-markdown-languageserver",
  },

  // ── Dart / Flutter ───────────────────────────────────────────────────────
  {
    language: "dart",
    command: "dart",
    args: ["language-server", "--client-id=@harms-haus/code-lens"],
    extensions: [".dart"],
    detectCommand: "dart --version",
    installCommand: "Install Dart SDK from https://dart.dev/get-dart",
    installInstructions: "Install the Dart SDK (includes the analysis server)",
  },

  // ── Kotlin ───────────────────────────────────────────────────────────────
  {
    language: "kotlin",
    command: "kotlin-language-server",
    args: [],
    extensions: [".kt", ".kts"],
    detectCommand: "kotlin-language-server --version",
    installCommand: "Install from https://github.com/fwcd/kotlin-language-server",
    installInstructions: "Download kotlin-language-server from GitHub releases",
  },

  // ── Swift ────────────────────────────────────────────────────────────────
  {
    language: "swift",
    command: "sourcekit-lsp",
    args: [],
    extensions: [".swift"],
    detectCommand: "sourcekit-lsp --version",
    installCommand: "Install via Swift toolchain (included with Swift >= 5.6)",
    installInstructions: "Install Swift toolchain; sourcekit-lsp is included",
  },

  // ── Zig ──────────────────────────────────────────────────────────────────
  {
    language: "zig",
    command: "zls",
    args: [],
    extensions: [".zig"],
    detectCommand: "zls --version",
    installCommand: "Install from https://github.com/zigtools/zls",
    installInstructions: "Download zls from GitHub releases or build from source",
  },

  // ── Haskell ──────────────────────────────────────────────────────────────
  {
    language: "haskell",
    command: "haskell-language-server",
    args: ["--lsp"],
    extensions: [".hs", ".lhs"],
    detectCommand: "haskell-language-server --version",
    installCommand: "ghcup install hls",
    installInstructions: "Install via ghcup: ghcup install hls",
  },

  // ── OCaml ────────────────────────────────────────────────────────────────
  {
    language: "ocaml",
    command: "ocamllsp",
    args: [],
    extensions: [".ml", ".mli"],
    detectCommand: "ocamllsp --version",
    installCommand: "opam install ocaml-lsp-server",
    installInstructions: "opam install ocaml-lsp-server",
  },

  // ── Elixir ───────────────────────────────────────────────────────────────
  {
    language: "elixir",
    command: "elixir-ls",
    args: [],
    extensions: [".ex", ".exs"],
    detectCommand: "elixir-ls --version",
    installCommand: "Install from https://github.com/elixir-lsp/elixir-ls",
    installInstructions: "Download elixir-ls release and make language_server.sh executable",
  },

  // ── Scala ────────────────────────────────────────────────────────────────
  {
    language: "scala",
    command: "metals",
    args: [],
    extensions: [".scala", ".sbt"],
    detectCommand: "metals --version",
    installCommand: "Install via coursier: cs install metals",
    installInstructions: "cs install metals (requires coursier)",
  },

  // ── Terraform / HCL ──────────────────────────────────────────────────────
  {
    language: "terraform",
    command: "terraform-ls",
    args: ["serve"],
    extensions: [".tf", ".tfvars", ".hcl"],
    detectCommand: "terraform-ls version",
    installCommand: "Install from https://github.com/hashicorp/terraform-ls",
    installInstructions: "Download terraform-ls from GitHub releases",
  },

  // ── Dockerfile ───────────────────────────────────────────────────────────
  {
    language: "dockerfile",
    command: "dockerfile-language-server-nodejs",
    args: ["--stdio"],
    extensions: [".dockerfile", "Dockerfile"],
    detectCommand: "docker-langserver --version",
    installCommand: "npm install -g dockerfile-language-server-nodejs",
    installInstructions: "npm install -g dockerfile-language-server-nodejs",
  },

  // ── SQL ──────────────────────────────────────────────────────────────────
  {
    language: "sql",
    command: "sql-language-server",
    args: ["up", "--method", "stdio"],
    extensions: [".sql"],
    detectCommand: "sql-language-server --version",
    installCommand: "npm install -g sql-language-server",
    installInstructions: "npm install -g sql-language-server",
  },

  // ── Vue ──────────────────────────────────────────────────────────────────
  {
    language: "vue",
    command: "vue-language-server",
    args: ["--stdio"],
    extensions: [".vue"],
    detectCommand: "vue-language-server --version",
    installCommand: "npm install -g @vue/language-server @vue/typescript-plugin typescript",
    installInstructions:
      "npm install -g @vue/language-server @vue/typescript-plugin typescript",
  },

  // ── Svelte ───────────────────────────────────────────────────────────────
  {
    language: "svelte",
    command: "svelteserver",
    args: ["--stdio"],
    extensions: [".svelte"],
    detectCommand: "svelteserver --version",
    installCommand: "npm install -g svelte-language-server",
    installInstructions: "npm install -g svelte-language-server",
  },

  // ── TOML ─────────────────────────────────────────────────────────────────
  {
    language: "toml",
    command: "taplo",
    args: ["lsp", "stdio"],
    extensions: [".toml"],
    detectCommand: "taplo --version",
    installCommand: "npm install -g @taplo/lsp  # or: cargo install taplo-cli",
    installInstructions: "npm install -g @taplo/lsp or cargo install taplo-cli",
  },

  // ── Nix ──────────────────────────────────────────────────────────────────
  {
    language: "nix",
    command: "nil",
    args: [],
    extensions: [".nix"],
    detectCommand: "nil --version",
    installCommand: "nix profile install nixpkgs#nil  # or: cargo install nil",
    installInstructions:
      "Install nil via Nix: nix profile install nixpkgs#nil, or cargo install nil",
  },

  // ── LaTeX ────────────────────────────────────────────────────────────────
  {
    language: "latex",
    command: "texlab",
    args: [],
    extensions: [".tex", ".latex"],
    detectCommand: "texlab --version",
    installCommand: "cargo install texlab  # or your package manager",
    installInstructions: "cargo install texlab or install via your package manager",
  },

  // ── R ────────────────────────────────────────────────────────────────────
  {
    language: "r",
    command: "R",
    args: ["--slave", "-e", "languageserver::run()"],
    extensions: [".r", ".R"],
    detectCommand: "R --version",
    installCommand: "R -e 'install.packages(\"languageserver\")'",
    installInstructions: "R -e 'install.packages(\"languageserver\")'",
  },

  // ── Bash / Shell ─────────────────────────────────────────────────────────
  {
    language: "bash",
    command: "bash-language-server",
    args: ["start"],
    extensions: [".sh", ".bash"],
    detectCommand: "bash-language-server --version",
    installCommand: "npm install -g bash-language-server",
    installInstructions: "npm install -g bash-language-server",
  },
];

// ── Extension lookup map (lazy-initialized) ────────────────────────────────

let _extensionMap: Map<string, LspServerConfig> | undefined;

export function getExtensionMap(): Map<string, LspServerConfig> {
  if (!_extensionMap) {
    _extensionMap = new Map();
    for (const cfg of LANGUAGE_SERVERS) {
      for (const ext of cfg.extensions) {
        _extensionMap.set(ext, cfg);
      }
    }
  }
  return _extensionMap;
}

/** Find the LSP config for a given file extension (O(1) via map lookup) */
export function getConfigForExtension(ext: string): LspServerConfig | undefined {
  return getExtensionMap().get(ext);
}
