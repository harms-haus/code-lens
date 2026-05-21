/**
 * Per-language test fixture management.
 *
 * Creates a unique temp directory per test invocation, copies fixtures,
 * handles language-specific project initialization, and manages daemon
 * lifecycle (start on first command, stop in afterAll).
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execa } from "execa";
import { CLI_PATH } from "./types.js";

/**
 * Map of language → fixture file to use for server warmup.
 * The warmup runs find-document-symbols and retries until the server
 * returns actual symbols (not empty/error).
 */
const WARMUP_FILES: Record<string, string> = {
  typescript: "fixtures/valid.ts",
  python: "fixtures/valid.py",
  go: "fixtures/main.go",
  rust: "src/main.rs", // Rust uses project-root layout, not fixtures/
  json: "fixtures/valid.json",
  bash: "fixtures/valid.sh",
  yaml: "fixtures/valid.yaml",
  css: "fixtures/valid.css",
  cpp: "fixtures/main.c",
  php: "fixtures/valid.php",
  ruby: "fixtures/valid.rb",
  html: "fixtures/valid.html",
  markdown: "fixtures/valid.md",
  vue: "fixtures/valid.vue",
  dockerfile: "fixtures/Dockerfile",
  toml: "fixtures/valid.toml",
  terraform: "fixtures/main.tf",
  lua: "fixtures/valid.lua",
  java: "src/Main.java",
  svelte: "fixtures/valid.svelte",
};

/**
 * Additional files to open during warmup for languages that use
 * push-model diagnostics (TS). Opening them ensures the server
 * indexes them and pushes diagnostics before tests assert.
 */
const WARMUP_EXTRA_FILES: Record<string, string[]> = {
  typescript: ["fixtures/broken.ts", "fixtures/references.ts", "fixtures/classes.ts"],
  vue: ["fixtures/broken.vue", "fixtures/references.vue"],
  svelte: ["fixtures/broken.svelte", "fixtures/references.svelte"],
  java: ["src/Broken.java"],
};

/** Maximum number of warmup attempts (each ~2s) */
const WARMUP_MAX_ATTEMPTS = 15;

/** Delay between warmup attempts */
const WARMUP_DELAY_MS = 2_000;

/** Delay after opening extra files to let push diagnostics arrive */
const DIAGNOSTICS_SETTLE_MS = 1_500;

export class RegressionTestContext {
  /** Language name (e.g., "typescript", "python") */
  readonly language: string;

  /** Absolute path to the unique temp fixture directory for this test run */
  readonly fixtureDir: string;

  /** Whether the LSP server for this language is installed on the machine */
  isServerInstalled: boolean = true;

  /** Whether the server was successfully warmed up */
  isWarmedUp: boolean = false;

  /** Absolute path to the source fixtures directory in the repo */
  private readonly sourceFixturesDir: string;

  constructor(language: string) {
    this.language = language;
    this.sourceFixturesDir = path.resolve(import.meta.dirname, `../${language}/fixtures`);
    this.fixtureDir = fs.mkdtempSync(
      path.join(os.tmpdir(), `code-lens-reg-${language}-`),
    );
  }

  /**
   * Setup: copy fixtures, perform language-specific initialization,
   * detect server, and warm up the LSP server.
   * Call in beforeAll().
   */
  async setup(): Promise<void> {
    // Copy all fixture files from source to temp dir
    if (fs.existsSync(this.sourceFixturesDir)) {
      copyDirRecursive(this.sourceFixturesDir, path.join(this.fixtureDir, "fixtures"));
    }

    // Language-specific project initialization
    await this.languageInit();

    // Check if the LSP server is available
    await this.detectServer();

    // Warm up the daemon + LSP server so subsequent commands get real data
    if (this.isServerInstalled) {
      await this.warmup();
    }
  }

  /**
   * Teardown: stop daemon and clean up temp directory.
   * Call in afterAll().
   */
  async teardown(): Promise<void> {
    try {
      await execa("node", [CLI_PATH, "stop"], {
        cwd: this.fixtureDir,
        reject: false,
        timeout: 10_000,
      });
    } catch {
      // Daemon may already be stopped
    }

    await new Promise<void>((resolve) => setTimeout(resolve, 200));

    try {
      fs.rmSync(this.fixtureDir, { recursive: true, force: true });
    } catch {
      // Directory may already be gone
    }
  }

  /**
   * Get the absolute path to a fixture file within the temp dir.
   */
  fixturePath(relativePath: string): string {
    return path.join(this.fixtureDir, relativePath);
  }

  // ── Private Methods ──────────────────────────────────────────────────

  /** Perform language-specific project initialization */
  private async languageInit(): Promise<void> {
    if (this.language === "go") {
      await this.initGoModule();
    } else if (this.language === "rust") {
      this.initRustWorkspace();
    } else if (this.language === "cpp") {
      this.initCppProject();
    } else if (this.language === "java") {
      this.initJavaWorkspace();
    } else if (this.language === "dockerfile") {
      this.initDockerfileWorkspace();
    } else if (this.language === "vue") {
      await this.initVueWorkspace();
    } else if (this.language === "svelte") {
      await this.initSvelteWorkspace();
    } else if (this.language === "ruby") {
      this.initRubyWorkspace();
    }
  }

  /** Initialize go.mod in the fixture directory */
  private async initGoModule(): Promise<void> {
    const goModPath = path.join(this.fixtureDir, "fixtures", "go.mod");
    if (!fs.existsSync(goModPath)) {
      try {
        await execa("go", ["mod", "init", "example.com/regression"], {
          cwd: path.join(this.fixtureDir, "fixtures"),
          timeout: 15_000,
          reject: false,
        });
      } catch {
        // Go may not be installed
      }
    }
  }

  /**
   * Rust: rust-analyzer requires Cargo.toml at the workspace root.
   * Copy Cargo.toml + src/ from fixtures/ to the temp dir root so
   * rust-analyzer can discover the workspace.
   */
  private initRustWorkspace(): void {
    const fixturesDir = path.join(this.fixtureDir, "fixtures");

    // Copy Cargo.toml to temp root
    const cargoToml = path.join(fixturesDir, "Cargo.toml");
    if (fs.existsSync(cargoToml)) {
      fs.copyFileSync(cargoToml, path.join(this.fixtureDir, "Cargo.toml"));
    }

    // Copy src/ directory to temp root
    const srcDir = path.join(fixturesDir, "src");
    if (fs.existsSync(srcDir)) {
      copyDirRecursive(srcDir, path.join(this.fixtureDir, "src"));
    }
  }

  /**
   * C++: clangd needs compile_commands.json or compile_flags.txt
   * to function properly. Generate a minimal one.
   */
  private initCppProject(): void {
    // Generate compile_flags.txt — simple and sufficient for clangd
    const flagsPath = path.join(this.fixtureDir, "compile_flags.txt");
    fs.writeFileSync(flagsPath, "-std=c11\n-I.\n", "utf-8");
  }

  /** Initialize Java workspace with Maven pom.xml and src/ layout */
  private initJavaWorkspace(): void {
    const fixturesDir = path.join(this.fixtureDir, "fixtures");
    const srcDir = path.join(this.fixtureDir, "src");
    if (!fs.existsSync(srcDir)) {
      fs.mkdirSync(srcDir, { recursive: true });
    }
    if (fs.existsSync(fixturesDir)) {
      for (const entry of fs.readdirSync(fixturesDir)) {
        if (entry.endsWith(".java")) {
          fs.copyFileSync(path.join(fixturesDir, entry), path.join(srcDir, entry));
        }
      }
    }
    fs.writeFileSync(
      path.join(this.fixtureDir, "pom.xml"),
      '<project xmlns="http://maven.apache.org/POM/4.0.0">\n' +
      '  <modelVersion>4.0.0</modelVersion>\n' +
      '  <groupId>com.regression</groupId>\n' +
      '  <artifactId>regression</artifactId>\n' +
      '  <version>1.0.0</version>\n' +
      '</project>'
    );
  }

  /** Initialize Dockerfile workspace by copying Dockerfile to root */
  private initDockerfileWorkspace(): void {
    const fixturesDir = path.join(this.fixtureDir, "fixtures");
    const dockerfileSrc = path.join(fixturesDir, "Dockerfile");
    if (fs.existsSync(dockerfileSrc)) {
      fs.copyFileSync(dockerfileSrc, path.join(this.fixtureDir, "Dockerfile"));
    }
  }

  /** Initialize Vue workspace: copy tsconfig.json to root, run npm install */
  private async initVueWorkspace(): Promise<void> {
    const fixturesDir = path.join(this.fixtureDir, "fixtures");
    // Copy tsconfig.json and package.json to workspace root
    for (const file of ["tsconfig.json", "package.json"]) {
      const src = path.join(fixturesDir, file);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, path.join(this.fixtureDir, file));
      }
    }
    await this.npmInstallFixtures();
  }

  /** Initialize Svelte workspace: run npm install */
  private async initSvelteWorkspace(): Promise<void> {
    const fixturesDir = path.join(this.fixtureDir, "fixtures");
    // Copy package.json to workspace root
    const pkgSrc = path.join(fixturesDir, "package.json");
    if (fs.existsSync(pkgSrc)) {
      fs.copyFileSync(pkgSrc, path.join(this.fixtureDir, "package.json"));
    }
    await this.npmInstallFixtures();
  }

  /** Run npm install in the fixtures directory (for Vue, Svelte, etc.) */
  private async npmInstallFixtures(): Promise<void> {
    const fixturesDir = path.join(this.fixtureDir, "fixtures");
    if (fs.existsSync(path.join(fixturesDir, "package.json"))) {
      try {
        await execa("npm", ["install"], {
          cwd: fixturesDir,
          timeout: 60_000,
          reject: false,
        });
      } catch {
        // npm may not be available or install may fail
      }
    }
    // Also install at root if package.json exists there
    if (fs.existsSync(path.join(this.fixtureDir, "package.json"))) {
      try {
        await execa("npm", ["install"], {
          cwd: this.fixtureDir,
          timeout: 60_000,
          reject: false,
        });
      } catch {
        // npm may not be available or install may fail
      }
    }
  }

  /** Initialize Ruby workspace: ruby-lsp needs a Gemfile or .ruby-version */
  private initRubyWorkspace(): void {
    // ruby-lsp requires either a Gemfile, .ruby-version, or to be in a Git repo
    // Create a minimal Gemfile to satisfy the server
    fs.writeFileSync(
      path.join(this.fixtureDir, "Gemfile"),
      "source 'https://rubygems.org'\n",
      "utf-8"
    );
  }

  /** Detect whether the LSP server for this language is installed */
  private async detectServer(): Promise<void> {
    try {
      const detectCommands: Record<string, string[]> = {
        typescript: ["typescript-language-server", "--version"],
        python: ["pylsp", "--version"],
        go: ["gopls", "version"],
        rust: ["rust-analyzer", "--version"],
        json: ["json-languageserver", "--version"],
        bash: ["bash-language-server", "--version"],
        yaml: ["yaml-language-server", "--version"],
        css: ["css-languageserver", "--version"],
        cpp: ["clangd", "--version"],
        php: ["intelephense", "--version"],
        ruby: ["ruby-lsp", "--version"],
        html: ["html-languageserver", "--version"],
        markdown: ["markdown-language-server", "--version"],
        vue: ["vue-language-server", "--version"],
        dockerfile: ["docker-langserver", "--version"],
        toml: ["taplo", "--version"],
        terraform: ["terraform-ls", "version"],
        lua: ["lua-language-server", "--version"],
        java: ["jdtls", "--version"],
        svelte: ["svelteserver", "--version"],
      };
      const cmd = detectCommands[this.language];
      if (!cmd) {
        this.isServerInstalled = false;
        return;
      }
      try {
        await execa(cmd[0], cmd.slice(1), { timeout: 10_000, reject: true });
        this.isServerInstalled = true;
      } catch {
        // Some LSP servers (css-languageserver, json-languageserver, intelephense)
        // are stdio-mode only and don't support --version. Fall back to checking
        // if the binary exists in PATH.
        try {
          await execa("which", [cmd[0]], { timeout: 5_000, reject: true });
          this.isServerInstalled = true;
        } catch {
          this.isServerInstalled = false;
        }
      }
    } catch {
      this.isServerInstalled = false;
    }
  }

  /**
   * Warm up the LSP server by repeatedly running find-document-symbols
   * until it returns actual results (not empty/error).
   * Then open extra files (e.g. broken.ts) so push-model diagnostics
   * arrive before the real tests run.
   */
  private async warmup(): Promise<void> {
    const warmupFile = WARMUP_FILES[this.language];
    if (!warmupFile) {
      this.isWarmedUp = true;
      return;
    }

    if (this.language === "dockerfile") {
      // Dockerfile LSP doesn't support document-symbols
      // Warm up using diagnostics instead
      for (let attempt = 0; attempt < WARMUP_MAX_ATTEMPTS; attempt++) {
        try {
          const result = await execa(
            "node", [CLI_PATH, "diagnostics", "--file", warmupFile],
            { cwd: this.fixtureDir, reject: false, timeout: 60_000 },
          );
          const output = result.stdout;
          if (!output.includes("timed out") && !output.includes("Failed") && !output.includes("Error:")) {
            this.isWarmedUp = true;
            break;
          }
        } catch {
          // ignore
        }
        await new Promise((r) => setTimeout(r, WARMUP_DELAY_MS));
      }
      return;
    }

    // Phase 1: Get the server responding to requests
    for (let attempt = 0; attempt < WARMUP_MAX_ATTEMPTS; attempt++) {
      try {
        const result = await execa(
          "node", [CLI_PATH, "find-document-symbols", "--file", warmupFile],
          { cwd: this.fixtureDir, reject: false, timeout: 60_000 },
        );

        const stdout = result.stdout ?? "";

        // Require actual symbols (N > 0) to confirm server is fully indexed
        const symbolMatch = stdout.match(/(\d+) symbols? found/);
        const hasRealSymbols = symbolMatch && parseInt(symbolMatch[1], 10) > 0;

        if (hasRealSymbols) {
          this.isWarmedUp = true;
          break;
        }

        // Also accept non-symbol responses as long as it's not an error
        if (
          !stdout.includes("timed out") &&
          !stdout.includes("Failed to") &&
          !stdout.includes("Path traversal") &&
          !stdout.includes("Error:") &&
          !stdout.includes("No symbols found")
        ) {
          this.isWarmedUp = true;
          break;
        }
      } catch {
        // Server not ready yet
      }

      await new Promise<void>((resolve) => setTimeout(resolve, WARMUP_DELAY_MS));
    }

    // Phase 2: Open extra files so push-model diagnostics settle
    const extraFiles = WARMUP_EXTRA_FILES[this.language] ?? [];
    for (const file of extraFiles) {
      try {
        await execa(
          "node", [CLI_PATH, "find-document-symbols", "--file", file],
          { cwd: this.fixtureDir, reject: false, timeout: 30_000 },
        );
      } catch {
        // Ignore — server may not support document symbols for this file
      }
    }

    if (extraFiles.length > 0) {
      // Give the server time to push diagnostics for the opened files
      await new Promise<void>((resolve) => setTimeout(resolve, DIAGNOSTICS_SETTLE_MS));
    }
  }
}

// ── Utility Functions ───────────────────────────────────────────────────

/** Recursively copy a directory */
function copyDirRecursive(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}
