# Regression Test Implementation Plan

## Overview

Build end-to-end regression tests for the `code-lens` CLI tool that exercise the full daemon ↔ CLI pipeline against real LSP servers. Tests live in `regression/`, use a separate Vitest config, and are organized by language.

---

## Scope & Boundaries

### In Scope
- All 12 CLI commands: `diagnostics`, `find-references`, `find-definition`, `find-implementations`, `find-type-definition`, `find-type-hierarchy`, `find-symbols`, `find-document-symbols`, `find-calls`, `hover`, `rename-symbol`, `status`
- 10 language suites: TypeScript, Python, Go, Rust, JSON, Bash, YAML, CSS, C/C++, PHP
- Shared test infrastructure in `regression/_shared/`
- Vitest workspace configuration for parallel language execution
- CI integration via GitHub Actions

### Out of Scope
- Daemon-only methods: `fileChanged`, `lint`, `tsc`, `prettier`, `fullCheck`
- Changes to any source files under `src/`
- Changes to existing unit tests under `tests/`
- Library API tests (`lib.ts`, `lib-client.ts`, `lib-lsp.ts`)
- Performance/benchmark tests
- Cross-platform testing (Linux-only in CI)

### Files Modified (existing)
| File | Change |
|------|--------|
| `package.json` | Add `execa` devDependency, add `test:regression` and `test:regression:update` scripts |
| `eslint.config.js` | Add relaxed rules for `regression/**/*.test.ts` |
| `.github/workflows/ci.yaml` | Add regression test job |

### Files Created (new)
| File | Purpose |
|------|---------|
| `vitest.config.regression.ts` | Base regression Vitest config |
| `vitest.workspace.ts` | Workspace with per-language projects |
| `regression/_shared/types.ts` | Shared TypeScript types |
| `regression/_shared/normalize.ts` | Output normalization for snapshot comparison |
| `regression/_shared/run-cli.ts` | CLI subprocess runner using execa |
| `regression/_shared/test-context.ts` | Per-language fixture dir + daemon lifecycle |
| `regression/typescript/fixtures/*` | TypeScript fixture files |
| `regression/typescript/*.test.ts` | TypeScript test files (6 files) |
| `regression/python/fixtures/*` | Python fixture files |
| `regression/python/*.test.ts` | Python test files (4 files) |
| `regression/go/fixtures/*` | Go fixture files |
| `regression/go/*.test.ts` | Go test files (4 files) |
| `regression/rust/fixtures/*` | Rust fixture files |
| `regression/rust/*.test.ts` | Rust test files (4 files) |
| `regression/json/fixtures/*` | JSON fixture files |
| `regression/json/*.test.ts` | JSON test files (3 files) |
| `regression/bash/fixtures/*` | Bash fixture files |
| `regression/bash/*.test.ts` | Bash test files (3 files) |
| `regression/yaml/fixtures/*` | YAML fixture files |
| `regression/yaml/*.test.ts` | YAML test files (3 files) |
| `regression/css/fixtures/*` | CSS fixture files |
| `regression/css/*.test.ts` | CSS test files (3 files) |
| `regression/cpp/fixtures/*` | C/C++ fixture files |
| `regression/cpp/*.test.ts` | C/C++ test files (3 files) |
| `regression/php/fixtures/*` | PHP fixture files |
| `regression/php/*.test.ts` | PHP test files (3 files) |

---

## Data Model & State Changes

### CLIExecutionResult (new type in `regression/_shared/types.ts`)

```ts
export interface CLIExecutionResult {
  /** Combined stdout from the CLI process */
  stdout: string;
  /** Combined stderr from the CLI process */
  stderr: string;
  /** Process exit code (0 = success, 1 = error) */
  exitCode: number;
}
```

### NormalizeOptions (new type in `regression/_shared/types.ts`)

```ts
export interface NormalizeOptions {
  /** The absolute path of the per-test temp fixture directory */
  fixtureDir: string;
}
```

### No database or schema changes. No changes to existing types.

### State Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ Before: No regression/ directory, no execa dep, no workspace   │
│ After:  regression/ with 10 language suites, ~36 test files,   │
│         execa installed, workspace config, CI job added         │
└─────────────────────────────────────────────────────────────────┘

Per-test lifecycle:
  1. beforeAll: mkdtemp → copy fixtures → (optional language setup)
  2. each test: runCLI(cwd=tempDir, args) → normalize(stdout) → toMatchSnapshot()
  3. afterAll: runCLI(cwd=tempDir, ["stop"]) → rm -rf tempDir
```

---

## Step-by-Step Implementation

---

### Step 1: Install `execa` as a devDependency

**File modified:** `package.json`

**Action:** Run the following command in the project root:

```bash
npm install --save-dev execa
```

**Verification:** `package.json` `devDependencies` now contains `"execa"` with a version string. `npm run test` still passes. `npm run build` still succeeds.

---

### Step 2: Create `regression/_shared/types.ts`

**File created:** `regression/_shared/types.ts`

**Exact contents:**

```ts
/**
 * Shared types for regression tests
 */

/** Result of running a code-lens CLI command as a subprocess */
export interface CLIExecutionResult {
  /** Combined stdout from the CLI process */
  stdout: string;
  /** Combined stderr from the CLI process */
  stderr: string;
  /** Process exit code (0 = success, 1 = error) */
  exitCode: number;
}

/** Options for output normalization */
export interface NormalizeOptions {
  /** The absolute path of the per-test temp fixture directory */
  fixtureDir: string;
}
```

**Verification:** File exists, no syntax errors. TypeScript compiles (if `tsc` is pointed at it; note: this file is not in `src/` so `npm run typecheck` won't check it — that's OK).

---

### Step 3: Create `regression/_shared/normalize.ts`

**File created:** `regression/_shared/normalize.ts`

**Exact contents:**

```ts
/**
 * Output normalization for snapshot comparison.
 *
 * Replaces environment-specific values (absolute paths, PIDs, temp dirs,
 * timing values) with stable placeholders so snapshots are reproducible
 * across different machines and runs.
 */

import type { NormalizeOptions } from "./types.js";

/**
 * Normalize CLI output for snapshot comparison.
 *
 * Replacement order matters: paths first (so embedded URIs get normalized),
 * then PIDs, then timing, then whitespace cleanup.
 */
export function normalizeOutput(output: string, options: NormalizeOptions): string {
  // Escape the fixture dir for use in regex (handles paths with dots, parens, etc.)
  const escapedDir = options.fixtureDir.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return (
    output
      // 1. Replace absolute fixture dir with <ROOT>
      .replace(new RegExp(escapedDir, "g"), "<ROOT>")
      // 2. Replace file:// URIs containing the fixture dir (after step 1 these are file://<ROOT>)
      //    No additional step needed — step 1 already handles the path inside URIs.
      // 3. Replace home directory paths (various platforms)
      .replace(/\/home\/[^/\s)"']+/g, "~")
      .replace(/\/Users\/[^/\s)"']+/g, "~")
      .replace(/\/root\b/g, "~")
      // 4. Replace PIDs — handles both `(pid: 12345)` and bare `pid: 12345`
      .replace(/\(pid: \d+\)/g, "(pid: <PID>)")
      .replace(/\bpid: \d+/g, "pid: <PID>")
      // 5. Normalize socket paths (derived from cwd hash)
      .replace(/code-lens-[a-f0-9]{16}\.sock/g, "code-lens-<HASH>.sock")
      .replace(/code-lens-[a-f0-9]{16}/g, "code-lens-<HASH>")
      // 6. Normalize other temp directory patterns
      .replace(/\/tmp\/code-lens-reg-[^/\s)"']+/g, "<TMPDIR>")
      .replace(/\/var\/folders\/[^/\s)"']+/g, "<TMPDIR>")
      // 7. Normalize timing values (e.g., "123ms", "45.6s")
      .replace(/\b\d+ms\b/g, "<TIME>")
      .replace(/\b\d+\.\d+s\b/g, "<TIME>")
      // 8. Normalize line numbers in diff output that may shift
      //    (not applied — line numbers are deterministic for fixed fixtures)
      // 9. Trim trailing whitespace on each line, then leading/trailing blank lines
      .split("\n")
      .map((line) => line.trimEnd())
      .join("\n")
      .trim()
  );
}

/**
 * Normalize stderr output. Applies the same normalization but also
 * handles common error message patterns.
 */
export function normalizeStderr(output: string, options: NormalizeOptions): string {
  return normalizeOutput(output, options)
    // Normalize Node.js stack traces
    .replace(/at\s+\S+\s+\([^)]*\)/g, "at <STACK>")
    // Normalize error codes from the daemon
    .replace(/Error:\s+/g, "Error: ");
}
```

**Verification:** File exists, no syntax errors.

---

### Step 4: Create `regression/_shared/run-cli.ts`

**File created:** `regression/_shared/run-cli.ts`

**Exact contents:**

```ts
/**
 * CLI subprocess runner for regression tests.
 *
 * Uses execa to spawn a code-lens CLI process with the test's
 * fixture directory as cwd.
 */

import path from "node:path";
import { execa } from "execa";
import type { CLIExecutionResult } from "./types.js";

/**
 * Absolute path to the compiled CLI entry point.
 * Resolved relative to this file's location in regression/_shared/.
 */
const CLI_PATH = path.resolve(import.meta.dirname, "../../dist/cli.js");

/**
 * Run a code-lens CLI command as a subprocess.
 *
 * @param cwd - Working directory (the test's fixture temp dir)
 * @param args - CLI arguments (e.g., ["diagnostics", "--file", "fixtures/valid.ts"])
 * @param options - Optional: timeout in milliseconds (default: 30_000)
 * @returns The process result with stdout, stderr, and exitCode
 */
export async function runCLI(
  cwd: string,
  args: string[],
  options?: { timeout?: number },
): Promise<CLIExecutionResult> {
  const result = await execa("node", [CLI_PATH, ...args], {
    cwd,
    reject: false, // Don't throw on non-zero exit codes
    timeout: options?.timeout ?? 30_000,
    // Ensure the CLI can find language servers on PATH
    env: {
      ...process.env,
      // Don't inherit NODE_OPTIONS that might interfere
      NODE_OPTIONS: undefined,
    },
    extendEnv: false,
    // Explicitly pass through only needed env vars
  });

  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.exitCode ?? 0,
  };
}

/**
 * Run the CLI with extended timeout for operations that may take longer
 * (e.g., first-time server initialization).
 */
export async function runCLISlow(
  cwd: string,
  args: string[],
): Promise<CLIExecutionResult> {
  return runCLI(cwd, args, { timeout: 60_000 });
}
```

**Important design note on env:** Using `extendEnv: false` means we must explicitly pass `PATH`, `HOME`, etc. Let me revise:

```ts
/**
 * CLI subprocess runner for regression tests.
 */

import path from "node:path";
import { execa } from "execa";
import type { CLIExecutionResult } from "./types.js";

/** Absolute path to the compiled CLI entry point. */
const CLI_PATH = path.resolve(import.meta.dirname, "../../dist/cli.js");

/** Environment keys required for CLI and LSP servers to function. */
const REQUIRED_ENV_KEYS = [
  "PATH",
  "HOME",
  "LANG",
  "LC_ALL",
  "TERM",
  "NODE_PATH",
  "GOPATH",
  "PYTHONPATH",
  "CARGO_HOME",
  "RUSTUP_HOME",
  "TMPDIR",
  "npm_config_prefix",
  "NVM_DIR",
];

/**
 * Build a minimal environment with only essential variables.
 * Prevents test environment contamination.
 */
function buildEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {};
  for (const key of REQUIRED_ENV_KEYS) {
    if (process.env[key] !== undefined) {
      env[key] = process.env[key];
    }
  }
  return env;
}

/**
 * Run a code-lens CLI command as a subprocess.
 */
export async function runCLI(
  cwd: string,
  args: string[],
  options?: { timeout?: number },
): Promise<CLIExecutionResult> {
  const result = await execa("node", [CLI_PATH, ...args], {
    cwd,
    reject: false,
    timeout: options?.timeout ?? 30_000,
    env: buildEnv(),
    extendEnv: false,
  });

  return {
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
    exitCode: result.exitCode ?? 0,
  };
}

/**
 * Run the CLI with extended timeout for slow operations
 * (first-time server initialization, large workspaces).
 */
export async function runCLISlow(
  cwd: string,
  args: string[],
): Promise<CLIExecutionResult> {
  return runCLI(cwd, args, { timeout: 60_000 });
}
```

**Verification:** File exists, no syntax errors. `execa` is importable.

---

### Step 5: Create `regression/_shared/test-context.ts`

**File created:** `regression/_shared/test-context.ts`

**Exact contents:**

```ts
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

/** Absolute path to the compiled CLI entry point. */
const CLI_PATH = path.resolve(import.meta.dirname, "../../dist/cli.js");

/** Languages that need go.mod initialization */
const GO_LANGUAGES = new Set(["go"]);

export class RegressionTestContext {
  /** Language name (e.g., "typescript", "python") */
  readonly language: string;

  /** Absolute path to the unique temp fixture directory for this test run */
  readonly fixtureDir: string;

  /** Whether the LSP server for this language is installed on the machine */
  isServerInstalled: boolean = true;

  /** Absolute path to the source fixtures directory in the repo */
  private readonly sourceFixturesDir: string;

  constructor(language: string) {
    this.language = language;
    this.sourceFixturesDir = path.resolve(import.meta.dirname, `../${language}/fixtures`);
    // Unique temp dir per test invocation — ensures daemon isolation
    this.fixtureDir = fs.mkdtempSync(
      path.join(os.tmpdir(), `code-lens-reg-${language}-`),
    );
  }

  /**
   * Setup: copy fixtures and perform language-specific initialization.
   * Call in beforeAll().
   */
  async setup(): Promise<void> {
    // Copy all fixture files from source to temp dir
    if (fs.existsSync(this.sourceFixturesDir)) {
      copyDirRecursive(this.sourceFixturesDir, this.fixtureDir);
    }

    // Language-specific project initialization
    await this.languageInit();

    // Check if the LSP server is available
    await this.detectServer();
  }

  /**
   * Teardown: stop daemon and clean up temp directory.
   * Call in afterAll().
   */
  async teardown(): Promise<void> {
    // Stop the daemon for this fixture dir
    try {
      await execa("node", [CLI_PATH, "stop"], {
        cwd: this.fixtureDir,
        reject: false,
        timeout: 10_000,
      });
    } catch {
      // Daemon may already be stopped — ignore
    }

    // Small delay for socket cleanup
    await new Promise<void>((resolve) => setTimeout(resolve, 200));

    // Remove temp directory
    try {
      fs.rmSync(this.fixtureDir, { recursive: true, force: true });
    } catch {
      // Directory may already be gone — ignore
    }
  }

  /**
   * Get the absolute path to a fixture file within the temp dir.
   * Used for passing --file arguments to the CLI.
   */
  fixturePath(relativePath: string): string {
    return path.join(this.fixtureDir, relativePath);
  }

  /**
   * Get a relative fixture path suitable for CLI --file arguments.
   * Using relative paths tests the CLI's path resolution.
   */
  fixtureRelativePath(relativePath: string): string {
    return relativePath;
  }

  // ── Private Methods ──────────────────────────────────────────────────

  /** Perform language-specific project initialization */
  private async languageInit(): Promise<void> {
    if (GO_LANGUAGES.has(this.language)) {
      await this.initGoModule();
    }
    // Rust: fixtures include Cargo.toml + src/main.rs — no init needed
    // TypeScript: works without tsconfig for simple files
    // All others: no special init needed
  }

  /** Initialize go.mod in the fixture directory */
  private async initGoModule(): Promise<void> {
    // Only init if go.mod doesn't already exist (it might be a fixture)
    const goModPath = path.join(this.fixtureDir, "go.mod");
    if (!fs.existsSync(goModPath)) {
      try {
        await execa("go", ["mod", "init", "example.com/regression"], {
          cwd: this.fixtureDir,
          timeout: 15_000,
          reject: false,
        });
      } catch {
        // Go may not be installed — test will be skipped via isServerInstalled
      }
    }
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
      };
      const cmd = detectCommands[this.language];
      if (!cmd) {
        this.isServerInstalled = false;
        return;
      }
      await execa(cmd[0], cmd.slice(1), { timeout: 10_000, reject: true });
      this.isServerInstalled = true;
    } catch {
      this.isServerInstalled = false;
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
```

**Verification:** File exists, no syntax errors. The class can be imported.

---

### Step 6: Create `vitest.config.regression.ts`

**File created:** `vitest.config.regression.ts` (project root)

**Exact contents:**

```ts
import { defineConfig } from "vitest/config";

/**
 * Base Vitest configuration for regression tests.
 *
 * - NO global mocks (unlike tests/setup.ts which mocks node:child_process, node:net, etc.)
 * - Uses forks pool for process isolation
 * - Extended timeouts for real LSP server communication
 * - Separate from vitest.config.ts to avoid interfering with unit tests
 */
export default defineConfig({
  test: {
    include: ["regression/**/*.test.ts"],
    pool: "forks",
    testTimeout: 120_000, // 2 minutes per test (LSP server startup can be slow)
    hookTimeout: 60_000, // 1 minute for beforeAll/afterAll
    setupFiles: [], // No global mocks
    // No coverage collection for regression tests
  },
});
```

**Verification:** File exists. Running `npx vitest --config vitest.config.regression.ts` does not error (though it won't find tests yet).

---

### Step 7: Create `vitest.workspace.ts` + Update `package.json` scripts + Update ESLint config

**Three changes in this step:**

#### 7a. Create `vitest.workspace.ts` (project root)

**Exact contents:**

```ts
/**
 * Vitest workspace for regression tests.
 *
 * Defines one project per language, each with maxForks=1 so tests
 * within a language run sequentially. Vitest runs up to 5 projects
 * concurrently (controlled via --maxWorkers flag).
 *
 * NOTE: This workspace is used ONLY when vitest is invoked without
 * an explicit --config flag. The existing "test" script uses
 * --config vitest.config.ts to bypass workspace mode.
 */

import { defineWorkspace } from "vitest/config";

const LANGUAGES = [
  "typescript",
  "python",
  "go",
  "rust",
  "json",
  "bash",
  "yaml",
  "css",
  "cpp",
  "php",
] as const;

export default defineWorkspace(
  LANGUAGES.map((lang) => ({
    extends: "vitest.config.regression.ts",
    test: {
      name: `regression:${lang}`,
      include: [`regression/${lang}/**/*.test.ts`],
      // One concurrent test per language — prevents daemon port collisions
      // and ensures predictable LSP server behavior
      poolOptions: {
        forks: {
          maxForks: 1,
        },
      },
    },
  })),
);
```

#### 7b. Update `package.json` scripts

**File modified:** `package.json`

**Changes to the `"scripts"` section:**

1. Change `"test"` to explicitly use the unit test config:
   ```json
   "test": "vitest run --config vitest.config.ts",
   ```

2. Change `"test:watch"` to explicitly use the unit test config:
   ```json
   "test:watch": "vitest --config vitest.config.ts",
   ```

3. Add two new scripts:
   ```json
   "test:regression": "vitest run --workspace vitest.workspace.ts --maxWorkers 5",
   "test:regression:update": "vitest run --workspace vitest.workspace.ts --maxWorkers 5 --update"
   ```

**Full scripts section after changes:**

```json
"scripts": {
  "build": "tsup",
  "lint": "eslint src/",
  "lint:fix": "eslint src/ --fix",
  "typecheck": "tsc --noEmit",
  "test": "vitest run --config vitest.config.ts",
  "test:watch": "vitest --config vitest.config.ts",
  "test:coverage": "vitest run --coverage --config vitest.config.ts",
  "test:regression": "vitest run --workspace vitest.workspace.ts --maxWorkers 5",
  "test:regression:update": "vitest run --workspace vitest.workspace.ts --maxWorkers 5 --update",
  "format": "prettier --write 'src/**/*.ts'",
  "format:check": "prettier --check 'src/**/*.ts'",
  "prepublishOnly": "npm run build"
}
```

#### 7c. Update `eslint.config.js`

**File modified:** `eslint.config.js`

**Add a new block** after the existing `{ files: ["src/**/*.test.ts", "tests/**/*.test.ts", "tests/setup.ts"], ... }` block. This block adds the same relaxed rules for regression test files:

```js
{
  files: ["regression/**/*.test.ts", "regression/_shared/**/*.ts"],
  rules: {
    "@typescript-eslint/no-explicit-any": "off",
    "@typescript-eslint/no-non-null-assertion": "off",
    "@typescript-eslint/unbound-method": "off",
    "@typescript-eslint/no-unsafe-argument": "off",
    "@typescript-eslint/no-unsafe-assignment": "off",
    "@typescript-eslint/no-unsafe-call": "off",
    "@typescript-eslint/no-unsafe-member-access": "off",
    "@typescript-eslint/no-unsafe-return": "off",
    "@typescript-eslint/no-misused-promises": [
      "error",
      { checksConditionals: false, checksVoidReturn: false },
    ],
    "max-lines-per-function": "off",
    complexity: "off",
    "max-depth": "off",
    "no-console": "off",
  },
},
```

Also update the `ignores` array in the first config block to NOT ignore `vitest.config.regression.ts` and `vitest.workspace.ts` — actually, these should remain ignored since they're config files. No change needed to ignores.

**Verification:**
- `npm run test` still passes (unit tests unaffected)
- `npm run lint` passes
- `npm run build` succeeds
- `npx vitest run --workspace vitest.workspace.ts --maxWorkers 5` runs but finds no tests (expected — no test files yet)

---

### Step 8: Create TypeScript Fixtures

**Directory created:** `regression/typescript/fixtures/`

#### 8a. `regression/typescript/fixtures/valid.ts`

```ts
export function greet(name: string): string {
  return `Hello, ${name}!`;
}

export function farewell(name: string): string {
  return `Goodbye, ${name}!`;
}

export class Calculator {
  private result: number = 0;

  add(a: number, b: number): number {
    this.result = a + b;
    return this.result;
  }

  subtract(a: number, b: number): number {
    this.result = a - b;
    return this.result;
  }
}

export interface User {
  name: string;
  age: number;
  email: string;
}

export type UserId = string;

export enum Direction {
  Up = "UP",
  Down = "DOWN",
  Left = "LEFT",
  Right = "RIGHT",
}
```

#### 8b. `regression/typescript/fixtures/broken.ts`

```ts
// This file has intentional type errors for diagnostics testing
const x: string = 42;

function add(a: number, b: string): number {
  return a + b;
}

const user: { name: string } = { age: 30 };
```

#### 8c. `regression/typescript/fixtures/references.ts`

```ts
import { greet, Calculator, type User } from "./valid.js";

const message = greet("world");

const calc = new Calculator();
const sum = calc.add(3, 4);

const user: User = {
  name: "Alice",
  age: 30,
  email: "alice@example.com",
};
```

#### 8d. `regression/typescript/fixtures/classes.ts`

```ts
export class Animal {
  constructor(public name: string) {}

  speak(): string {
    return `${this.name} makes a sound`;
  }
}

export class Dog extends Animal {
  breed: string;

  constructor(name: string, breed: string) {
    super(name);
    this.breed = breed;
  }

  speak(): string {
    return `${this.name} barks`;
  }
}

export interface Printable {
  print(): string;
}

export class Document implements Printable {
  constructor(public title: string) {}

  print(): string {
    return `Document: ${this.title}`;
  }
}
```

**Verification:** Four fixture files exist under `regression/typescript/fixtures/`. Files are valid TypeScript (except `broken.ts` which has intentional errors).

---

### Step 9: Create TypeScript `100-diagnostics.test.ts`

**File created:** `regression/typescript/100-diagnostics.test.ts`

**Exact contents:**

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("typescript");

describe.skipIf(
  // Skip if typescript-language-server is not installed
  !process.env.CI || process.env.CI === "true"
    ? true // In CI, always try (will be skipped by detectServer)
    : false,
)("TypeScript — diagnostics", () => {
  beforeAll(async () => {
    await ctx.setup();
    // Skip all tests if server not installed
    if (!ctx.isServerInstalled) return;
  }, 60_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("reports no diagnostics for a valid file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "diagnostics",
      "--file",
      "fixtures/valid.ts",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("valid-file-diagnostics");
  });

  it("reports errors for a broken file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "diagnostics",
      "--file",
      "fixtures/broken.ts",
    ]);
    // May be 0 or 1 depending on server response — diagnostics might not be immediate
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("broken-file-diagnostics");
  });

  it("reports diagnostics for multiple files", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "diagnostics",
      "--files",
      "fixtures/valid.ts,fixtures/broken.ts",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("multi-file-diagnostics");
  });

  it("errors on unsupported file extension", async () => {
    if (!ctx.isServerInstalled) return;
    // Create a file with unsupported extension
    const unsupportedFile = "fixtures/test.xyz";
    const { writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    writeFileSync(join(ctx.fixtureDir, unsupportedFile), "content");

    const result = await runCLI(ctx.fixtureDir, [
      "diagnostics",
      "--file",
      unsupportedFile,
    ]);
    expect(result.exitCode).toBe(1);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("unsupported-extension");
  });
});
```

**Important design decisions:**
- Uses `describe.skipIf()` to skip when the server isn't installed
- Each `it()` checks `ctx.isServerInstalled` as a guard clause
- First command in each file uses `runCLISlow` (60s timeout) because the daemon needs to start and the LSP server needs to initialize
- Subsequent commands can use `runCLI` (30s timeout) since the daemon is already running
- Snapshot assertions use named snapshots for clarity

**After first run:** Run with `--update` to generate the initial `__snapshots__/100-diagnostics.test.ts.snap` file.

**Verification:** `npm run test:regression` (with typescript-language-server installed) runs the tests and generates snapshots.

---

### Step 10: Create TypeScript `101-find-references.test.ts`

**File created:** `regression/typescript/101-find-references.test.ts`

**Exact contents:**

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("typescript");

describe("TypeScript — find-references", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 60_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("finds references to an exported function", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.ts line 1: export function greet(name: string) — "greet" is at line 1, col 25
    const result = await runCLISlow(ctx.fixtureDir, [
      "find-references",
      "--file",
      "fixtures/valid.ts",
      "--line",
      "1",
      "--col",
      "25",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("references-to-greet");
  });

  it("finds references to a class method", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.ts line 7: add(a: number, b: number) — "add" is at line 7, col 3
    const result = await runCLI(ctx.fixtureDir, [
      "find-references",
      "--file",
      "fixtures/valid.ts",
      "--line",
      "7",
      "--col",
      "3",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("references-to-add");
  });

  it("returns empty for unreferenced symbol", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.ts line 28: enum Direction — "Direction" at line 28, col 13
    const result = await runCLI(ctx.fixtureDir, [
      "find-references",
      "--file",
      "fixtures/valid.ts",
      "--line",
      "28",
      "--col",
      "13",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("references-to-unreferenced");
  });

  it("finds cross-file references", async () => {
    if (!ctx.isServerInstalled) return;
    // references.ts imports greet from valid.ts
    // references.ts line 3: const message = greet("world") — "greet" at line 3, col 26
    const result = await runCLI(ctx.fixtureDir, [
      "find-references",
      "--file",
      "fixtures/references.ts",
      "--line",
      "3",
      "--col",
      "26",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("cross-file-references");
  });
});
```

**Verification:** File exists, tests are syntactically valid.

---

### Step 11: Create TypeScript `102-find-definition.test.ts`

**File created:** `regression/typescript/102-find-definition.test.ts`

**Exact contents:**

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("typescript");

describe("TypeScript — find-definition", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 60_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("finds definition of an imported function", async () => {
    if (!ctx.isServerInstalled) return;
    // references.ts line 1: import { greet } — "greet" at line 1, col 18
    const result = await runCLISlow(ctx.fixtureDir, [
      "find-definition",
      "--file",
      "fixtures/references.ts",
      "--line",
      "1",
      "--col",
      "18",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("definition-of-greet");
  });

  it("finds definition of an imported class", async () => {
    if (!ctx.isServerInstalled) return;
    // references.ts line 1: import { Calculator } — actually on line 1, col 25 (after greet)
    // Let's use a clearer target: references.ts line 5: const calc = new Calculator()
    // "Calculator" at line 5, col 25
    const result = await runCLI(ctx.fixtureDir, [
      "find-definition",
      "--file",
      "fixtures/references.ts",
      "--line",
      "5",
      "--col",
      "25",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("definition-of-calculator");
  });

  it("finds definition of an imported type", async () => {
    if (!ctx.isServerInstalled) return;
    // references.ts line 1: import { type User } — "User" at approximately col 38
    // Or: references.ts line 8: const user: User — "User" at line 8, col 19
    const result = await runCLI(ctx.fixtureDir, [
      "find-definition",
      "--file",
      "fixtures/references.ts",
      "--line",
      "8",
      "--col",
      "19",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("definition-of-user-type");
  });

  it("returns same location for locally defined symbol", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.ts line 1: function greet — already at definition
    const result = await runCLI(ctx.fixtureDir, [
      "find-definition",
      "--file",
      "fixtures/valid.ts",
      "--line",
      "1",
      "--col",
      "25",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("definition-local-symbol");
  });
});
```

**Verification:** File exists.

---

### Step 12: Create TypeScript `103-find-document-symbols.test.ts`

**File created:** `regression/typescript/103-find-document-symbols.test.ts`

**Exact contents:**

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("typescript");

describe("TypeScript — find-document-symbols", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 60_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("lists all symbols in valid.ts", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "find-document-symbols",
      "--file",
      "fixtures/valid.ts",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("document-symbols-valid");
  });

  it("lists symbols in classes.ts including class members", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLI(ctx.fixtureDir, [
      "find-document-symbols",
      "--file",
      "fixtures/classes.ts",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("document-symbols-classes");
  });

  it("returns no symbols for empty file", async () => {
    if (!ctx.isServerInstalled) return;
    const { writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    writeFileSync(join(ctx.fixtureDir, "fixtures", "empty.ts"), "// empty file\n");

    const result = await runCLI(ctx.fixtureDir, [
      "find-document-symbols",
      "--file",
      "fixtures/empty.ts",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("document-symbols-empty");
  });
});
```

**Verification:** File exists.

---

### Step 13: Create TypeScript `104-hover.test.ts`

**File created:** `regression/typescript/104-hover.test.ts`

**Exact contents:**

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("typescript");

describe("TypeScript — hover", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 60_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("shows type info for a function", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.ts line 1: function greet(name: string): string — hover on "greet" at col 18
    const result = await runCLISlow(ctx.fixtureDir, [
      "hover",
      "--file",
      "fixtures/valid.ts",
      "--line",
      "1",
      "--col",
      "18",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("hover-function");
  });

  it("shows type info for a variable", async () => {
    if (!ctx.isServerInstalled) return;
    // references.ts line 3: const message = greet("world") — hover on "message" at col 7
    const result = await runCLI(ctx.fixtureDir, [
      "hover",
      "--file",
      "fixtures/references.ts",
      "--line",
      "3",
      "--col",
      "7",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("hover-variable");
  });

  it("shows type info for a class", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.ts line 6: class Calculator — hover on "Calculator" at col 7
    const result = await runCLI(ctx.fixtureDir, [
      "hover",
      "--file",
      "fixtures/valid.ts",
      "--line",
      "6",
      "--col",
      "7",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("hover-class");
  });

  it("shows no hover for blank area", async () => {
    if (!ctx.isServerInstalled) return;
    // Hover on an empty line or comment
    // broken.ts line 1: // This file has... — hover on comment at col 5
    const result = await runCLI(ctx.fixtureDir, [
      "hover",
      "--file",
      "fixtures/broken.ts",
      "--line",
      "1",
      "--col",
      "5",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("hover-blank");
  });
});
```

**Verification:** File exists.

---

### Step 14: Create TypeScript `105-status-error-rename.test.ts`

**File created:** `regression/typescript/105-status-error-rename.test.ts`

This file tests `status`, error states, and `rename-symbol` (which doesn't modify files — it returns a diff).

**Exact contents:**

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("typescript");

describe("TypeScript — status, errors, rename", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 60_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  // ── Status ──────────────────────────────────────────────────────────

  it("shows no servers before any commands", async () => {
    if (!ctx.isServerInstalled) return;
    // Status before running any LSP command — daemon starts but no LSP server
    const result = await runCLISlow(ctx.fixtureDir, ["status"]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("status-no-servers");
  });

  it("shows running server after a file command", async () => {
    if (!ctx.isServerInstalled) return;
    // First run a command that starts the TS server
    await runCLI(ctx.fixtureDir, [
      "find-document-symbols",
      "--file",
      "fixtures/valid.ts",
    ]);

    const result = await runCLI(ctx.fixtureDir, ["status"]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("status-with-server");
  });

  // ── Rename Symbol ───────────────────────────────────────────────────

  it("generates rename diff for a function", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.ts line 1: function greet — rename "greet" to "sayHello"
    const result = await runCLI(ctx.fixtureDir, [
      "rename-symbol",
      "--file",
      "fixtures/valid.ts",
      "--line",
      "1",
      "--col",
      "18",
      "--new-name",
      "sayHello",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("rename-function");
  });

  it("generates rename diff for a cross-file reference", async () => {
    if (!ctx.isServerInstalled) return;
    // references.ts line 3: greet("world") — rename "greet" to "sayHello"
    // This should produce a diff that touches both references.ts and valid.ts
    const result = await runCLI(ctx.fixtureDir, [
      "rename-symbol",
      "--file",
      "fixtures/references.ts",
      "--line",
      "3",
      "--col",
      "26",
      "--new-name",
      "sayHello",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("rename-cross-file");
  });

  // ── Error States ────────────────────────────────────────────────────

  it("errors on missing --file parameter", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLI(ctx.fixtureDir, [
      "find-references",
      "--line",
      "1",
      "--col",
      "1",
    ]);
    expect(result.exitCode).toBe(1);
    // Commander outputs help text to stderr
    const normalized = normalizeOutput(result.stderr, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toContain("error");
  });

  it("errors on missing --line parameter", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLI(ctx.fixtureDir, [
      "find-references",
      "--file",
      "fixtures/valid.ts",
      "--col",
      "1",
    ]);
    expect(result.exitCode).toBe(1);
  });

  it("errors on missing --new-name for rename-symbol", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLI(ctx.fixtureDir, [
      "rename-symbol",
      "--file",
      "fixtures/valid.ts",
      "--line",
      "1",
      "--col",
      "18",
    ]);
    expect(result.exitCode).toBe(1);
  });
});
```

**Verification:** File exists. This is the last TypeScript test file.

At this point, running `npm run test:regression -- --project regression:typescript` should:
- Create temp dirs
- Start daemons
- Run all TypeScript tests
- Generate snapshot files in `regression/typescript/__snapshots__/`

---

### Step 15: Create Python Fixtures + Tests

#### 15a. `regression/python/fixtures/valid.py`

```python
def greet(name: str) -> str:
    return f"Hello, {name}!"

def farewell(name: str) -> str:
    return f"Goodbye, {name}!"

class Calculator:
    def __init__(self) -> None:
        self.result = 0

    def add(self, a: int, b: int) -> int:
        self.result = a + b
        return self.result

    def subtract(self, a: int, b: int) -> int:
        self.result = a - b
        return self.result
```

#### 15b. `regression/python/fixtures/broken.py`

```python
def broken() -> str:
    x: str = 42  # type error
    return x

def undefined_call():
    return nonexistent_function()  # name error
```

#### 15c. `regression/python/fixtures/imports.py`

```python
from valid import greet, Calculator

message = greet("world")
calc = Calculator()
total = calc.add(3, 4)
```

#### 15d. `regression/python/100-diagnostics.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("python");

describe("Python — diagnostics", () => {
  beforeAll(async () => { await ctx.setup(); }, 60_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("reports diagnostics for a valid file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, ["diagnostics", "--file", "fixtures/valid.py"]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("valid-file-diagnostics");
  });

  it("reports diagnostics for a broken file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLI(ctx.fixtureDir, ["diagnostics", "--file", "fixtures/broken.py"]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("broken-file-diagnostics");
  });
});
```

#### 15e. `regression/python/101-find-references.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("python");

describe("Python — find-references", () => {
  beforeAll(async () => { await ctx.setup(); }, 60_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds references to a function", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.py line 1: def greet(name: str) — "greet" at line 1, col 5
    const result = await runCLISlow(ctx.fixtureDir, [
      "find-references", "--file", "fixtures/valid.py", "--line", "1", "--col", "5",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("references-to-greet");
  });
});
```

#### 15f. `regression/python/102-find-definition.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("python");

describe("Python — find-definition", () => {
  beforeAll(async () => { await ctx.setup(); }, 60_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds definition of imported function", async () => {
    if (!ctx.isServerInstalled) return;
    // imports.py line 3: message = greet("world") — "greet" at line 3, col 19
    const result = await runCLISlow(ctx.fixtureDir, [
      "find-definition", "--file", "fixtures/imports.py", "--line", "3", "--col", "19",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("definition-of-greet");
  });
});
```

#### 15g. `regression/python/103-hover-and-symbols.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("python");

describe("Python — hover & document-symbols", () => {
  beforeAll(async () => { await ctx.setup(); }, 60_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("shows hover info for a function", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.py line 1: def greet — "greet" at line 1, col 5
    const result = await runCLISlow(ctx.fixtureDir, [
      "hover", "--file", "fixtures/valid.py", "--line", "1", "--col", "5",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("hover-function");
  });

  it("lists document symbols", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLI(ctx.fixtureDir, [
      "find-document-symbols", "--file", "fixtures/valid.py",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("document-symbols");
  });
});
```

**Verification:** 3 fixture files + 4 test files exist under `regression/python/`.

---

### Step 16: Create Go Fixtures + Tests

#### 16a. `regression/go/fixtures/main.go`

```go
package main

import "fmt"

func greet(name string) string {
	return fmt.Sprintf("Hello, %s!", name)
}

func farewell(name string) string {
	return fmt.Sprintf("Goodbye, %s!", name)
}

type Calculator struct {
	result int
}

func NewCalculator() *Calculator {
	return &Calculator{result: 0}
}

func (c *Calculator) Add(a int, b int) int {
	c.result = a + b
	return c.result
}

func main() {
	message := greet("world")
	fmt.Println(message)

	calc := NewCalculator()
	sum := calc.Add(3, 4)
	fmt.Println(sum)
}
```

#### 16b. `regression/go/fixtures/go.mod`

```
module example.com/regression

go 1.22
```

#### 16c. `regression/go/100-diagnostics.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("go");

describe("Go — diagnostics", () => {
  beforeAll(async () => { await ctx.setup(); }, 60_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("reports diagnostics for main.go", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, ["diagnostics", "--file", "fixtures/main.go"]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("diagnostics-main");
  });
});
```

#### 16d. `regression/go/101-find-references.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("go");

describe("Go — find-references", () => {
  beforeAll(async () => { await ctx.setup(); }, 60_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds references to greet function", async () => {
    if (!ctx.isServerInstalled) return;
    // main.go line 5: func greet — "greet" at line 5, col 6
    const result = await runCLISlow(ctx.fixtureDir, [
      "find-references", "--file", "fixtures/main.go", "--line", "5", "--col", "6",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("references-to-greet");
  });
});
```

#### 16e. `regression/go/102-find-definition.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("go");

describe("Go — find-definition", () => {
  beforeAll(async () => { await ctx.setup(); }, 60_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds definition of greet from call site", async () => {
    if (!ctx.isServerInstalled) return;
    // main.go line 29: message := greet("world") — "greet" at line 29, col 13
    const result = await runCLISlow(ctx.fixtureDir, [
      "find-definition", "--file", "fixtures/main.go", "--line", "29", "--col", "13",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("definition-of-greet");
  });
});
```

#### 16f. `regression/go/103-hover-and-symbols.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("go");

describe("Go — hover & document-symbols", () => {
  beforeAll(async () => { await ctx.setup(); }, 60_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("shows hover info for a function", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "hover", "--file", "fixtures/main.go", "--line", "5", "--col", "6",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("hover-function");
  });

  it("lists document symbols", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLI(ctx.fixtureDir, [
      "find-document-symbols", "--file", "fixtures/main.go",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("document-symbols");
  });
});
```

**Verification:** 2 fixture files + 4 test files exist under `regression/go/`.

---

### Step 17: Create Rust Fixtures + Tests

#### 17a. `regression/rust/fixtures/Cargo.toml`

```toml
[package]
name = "regression"
version = "0.1.0"
edition = "2021"
```

#### 17b. `regression/rust/fixtures/src/main.rs`

```rust
fn greet(name: &str) -> String {
    format!("Hello, {}!", name)
}

fn farewell(name: &str) -> String {
    format!("Goodbye, {}!", name)
}

struct Calculator {
    result: i32,
}

impl Calculator {
    fn new() -> Self {
        Calculator { result: 0 }
    }

    fn add(&mut self, a: i32, b: i32) -> i32 {
        self.result = a + b;
        self.result
    }
}

fn main() {
    let message = greet("world");
    println!("{}", message);

    let mut calc = Calculator::new();
    let sum = calc.add(3, 4);
    println!("{}", sum);
}
```

#### 17c. `regression/rust/100-diagnostics.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("rust");

describe("Rust — diagnostics", () => {
  beforeAll(async () => { await ctx.setup(); }, 60_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("reports diagnostics for main.rs", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, ["diagnostics", "--file", "fixtures/src/main.rs"]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("diagnostics-main");
  });
});
```

#### 17d. `regression/rust/101-find-references.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("rust");

describe("Rust — find-references", () => {
  beforeAll(async () => { await ctx.setup(); }, 60_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds references to greet function", async () => {
    if (!ctx.isServerInstalled) return;
    // main.rs line 1: fn greet — "greet" at line 1, col 4
    const result = await runCLISlow(ctx.fixtureDir, [
      "find-references", "--file", "fixtures/src/main.rs", "--line", "1", "--col", "4",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("references-to-greet");
  });
});
```

#### 17e. `regression/rust/102-find-definition.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("rust");

describe("Rust — find-definition", () => {
  beforeAll(async () => { await ctx.setup(); }, 60_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds definition of greet from call site", async () => {
    if (!ctx.isServerInstalled) return;
    // main.rs line 24: let message = greet("world") — "greet" at line 24, col 23
    const result = await runCLISlow(ctx.fixtureDir, [
      "find-definition", "--file", "fixtures/src/main.rs", "--line", "24", "--col", "23",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("definition-of-greet");
  });
});
```

#### 17f. `regression/rust/103-hover-and-symbols.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("rust");

describe("Rust — hover & document-symbols", () => {
  beforeAll(async () => { await ctx.setup(); }, 60_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("shows hover info for a function", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "hover", "--file", "fixtures/src/main.rs", "--line", "1", "--col", "4",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("hover-function");
  });

  it("lists document symbols", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLI(ctx.fixtureDir, [
      "find-document-symbols", "--file", "fixtures/src/main.rs",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("document-symbols");
  });
});
```

**Verification:** 2 fixture files (Cargo.toml + src/main.rs) + 4 test files under `regression/rust/`.

---

### Step 18: Create JSON Fixtures + Tests

#### 18a. `regression/json/fixtures/valid.json`

```json
{
  "name": "test-project",
  "version": "1.0.0",
  "dependencies": {
    "lodash": "^4.17.0"
  }
}
```

#### 18b. `regression/json/fixtures/invalid.json`

```json
{
  "name": "broken",
  "version": 1.0.0,
  "missing_end"
```

#### 18c. `regression/json/100-diagnostics.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("json");

describe("JSON — diagnostics", () => {
  beforeAll(async () => { await ctx.setup(); }, 60_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("reports diagnostics for valid JSON", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, ["diagnostics", "--file", "fixtures/valid.json"]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("valid-json-diagnostics");
  });

  it("reports diagnostics for invalid JSON", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLI(ctx.fixtureDir, ["diagnostics", "--file", "fixtures/invalid.json"]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("invalid-json-diagnostics");
  });
});
```

#### 18d. `regression/json/101-document-symbols.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("json");

describe("JSON — document-symbols", () => {
  beforeAll(async () => { await ctx.setup(); }, 60_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("lists document symbols in JSON", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "find-document-symbols", "--file", "fixtures/valid.json",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("document-symbols");
  });
});
```

#### 18e. `regression/json/102-error-states.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("json");

describe("JSON — error states", () => {
  beforeAll(async () => { await ctx.setup(); }, 60_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("errors on missing --file for diagnostics", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLI(ctx.fixtureDir, ["diagnostics"]);
    expect(result.exitCode).toBe(1);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("missing-file-error");
  });
});
```

**Verification:** 2 fixture files + 3 test files under `regression/json/`.

---

### Step 19: Create Bash Fixtures + Tests

#### 19a. `regression/bash/fixtures/valid.sh`

```bash
#!/bin/bash

greet() {
    local name="$1"
    echo "Hello, ${name}!"
}

farewell() {
    local name="$1"
    echo "Goodbye, ${name}!"
}

main() {
    greet "world"
    farewell "world"
}

main
```

#### 19b. `regression/bash/fixtures/references.sh`

```bash
#!/bin/bash
source ./fixtures/valid.sh

result=$(greet "Alice")
echo "${result}"
```

#### 19c. `regression/bash/100-diagnostics.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("bash");

describe("Bash — diagnostics", () => {
  beforeAll(async () => { await ctx.setup(); }, 60_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("reports diagnostics for a valid file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, ["diagnostics", "--file", "fixtures/valid.sh"]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("valid-file-diagnostics");
  });
});
```

#### 19d. `regression/bash/101-hover.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("bash");

describe("Bash — hover", () => {
  beforeAll(async () => { await ctx.setup(); }, 60_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("shows hover info for a function", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.sh line 3: greet() — "greet" at line 3, col 1
    const result = await runCLISlow(ctx.fixtureDir, [
      "hover", "--file", "fixtures/valid.sh", "--line", "3", "--col", "1",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("hover-function");
  });
});
```

#### 19e. `regression/bash/102-document-symbols.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("bash");

describe("Bash — document-symbols", () => {
  beforeAll(async () => { await ctx.setup(); }, 60_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("lists document symbols", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "find-document-symbols", "--file", "fixtures/valid.sh",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("document-symbols");
  });
});
```

**Verification:** 2 fixture files + 3 test files under `regression/bash/`.

---

### Step 20: Create YAML Fixtures + Tests

#### 20a. `regression/yaml/fixtures/valid.yaml`

```yaml
name: test-project
version: 1.0.0
dependencies:
  lodash: "^4.17.0"
  express: "^4.18.0"
scripts:
  build: "npm run build"
  test: "npm test"
```

#### 20b. `regression/yaml/fixtures/invalid.yaml`

```yaml
name: broken
  version: 1.0.0
  bad_indent:
 - item
```

#### 20c. `regression/yaml/100-diagnostics.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("yaml");

describe("YAML — diagnostics", () => {
  beforeAll(async () => { await ctx.setup(); }, 60_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("reports diagnostics for valid YAML", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, ["diagnostics", "--file", "fixtures/valid.yaml"]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("valid-yaml-diagnostics");
  });

  it("reports diagnostics for invalid YAML", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLI(ctx.fixtureDir, ["diagnostics", "--file", "fixtures/invalid.yaml"]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("invalid-yaml-diagnostics");
  });
});
```

#### 20d. `regression/yaml/101-document-symbols.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("yaml");

describe("YAML — document-symbols", () => {
  beforeAll(async () => { await ctx.setup(); }, 60_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("lists document symbols", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "find-document-symbols", "--file", "fixtures/valid.yaml",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("document-symbols");
  });
});
```

#### 20e. `regression/yaml/102-hover.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("yaml");

describe("YAML — hover", () => {
  beforeAll(async () => { await ctx.setup(); }, 60_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("shows hover info for a key", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.yaml line 1: name: — "name" at line 1, col 1
    const result = await runCLISlow(ctx.fixtureDir, [
      "hover", "--file", "fixtures/valid.yaml", "--line", "1", "--col", "1",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("hover-key");
  });
});
```

**Verification:** 2 fixture files + 3 test files under `regression/yaml/`.

---

### Step 21: Create CSS Fixtures + Tests

#### 21a. `regression/css/fixtures/valid.css`

```css
:root {
  --primary-color: #333;
  --font-size: 16px;
}

.container {
  display: flex;
  flex-direction: column;
  color: var(--primary-color);
  font-size: var(--font-size);
}

.container .header {
  font-weight: bold;
  margin-bottom: 10px;
}

.container .content {
  padding: 20px;
}
```

#### 21b. `regression/css/100-diagnostics.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("css");

describe("CSS — diagnostics", () => {
  beforeAll(async () => { await ctx.setup(); }, 60_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("reports diagnostics for a valid CSS file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, ["diagnostics", "--file", "fixtures/valid.css"]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("valid-css-diagnostics");
  });
});
```

#### 21c. `regression/css/101-document-symbols.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("css");

describe("CSS — document-symbols", () => {
  beforeAll(async () => { await ctx.setup(); }, 60_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("lists document symbols in CSS", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "find-document-symbols", "--file", "fixtures/valid.css",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("document-symbols");
  });
});
```

#### 21d. `regression/css/102-hover.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("css");

describe("CSS — hover", () => {
  beforeAll(async () => { await ctx.setup(); }, 60_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("shows hover info for a CSS property", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.css line 8: display: flex — "display" at line 8, col 3
    const result = await runCLISlow(ctx.fixtureDir, [
      "hover", "--file", "fixtures/valid.css", "--line", "8", "--col", "3",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("hover-property");
  });
});
```

**Verification:** 1 fixture file + 3 test files under `regression/css/`.

---

### Step 22: Create C/C++ Fixtures + Tests

#### 22a. `regression/cpp/fixtures/main.c`

```c
#include <stdio.h>

int add(int a, int b) {
    return a + b;
}

int subtract(int a, int b) {
    return a - b;
}

typedef struct {
    int x;
    int y;
} Point;

Point create_point(int x, int y) {
    Point p;
    p.x = x;
    p.y = y;
    return p;
}

int main() {
    int sum = add(3, 4);
    printf("Sum: %d\n", sum);

    Point p = create_point(1, 2);
    printf("Point: (%d, %d)\n", p.x, p.y);

    return 0;
}
```

#### 22b. `regression/cpp/100-diagnostics.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("cpp");

describe("C/C++ — diagnostics", () => {
  beforeAll(async () => { await ctx.setup(); }, 60_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("reports diagnostics for a valid C file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, ["diagnostics", "--file", "fixtures/main.c"]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("valid-c-diagnostics");
  });
});
```

#### 22c. `regression/cpp/101-find-definition.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("cpp");

describe("C/C++ — find-definition", () => {
  beforeAll(async () => { await ctx.setup(); }, 60_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds definition of add function from call site", async () => {
    if (!ctx.isServerInstalled) return;
    // main.c line 31: int sum = add(3, 4) — "add" at line 31, col 15
    const result = await runCLISlow(ctx.fixtureDir, [
      "find-definition", "--file", "fixtures/main.c", "--line", "31", "--col", "15",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("definition-of-add");
  });
});
```

#### 22d. `regression/cpp/102-hover-and-symbols.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("cpp");

describe("C/C++ — hover & document-symbols", () => {
  beforeAll(async () => { await ctx.setup(); }, 60_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("shows hover info for a function", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "hover", "--file", "fixtures/main.c", "--line", "3", "--col", "5",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("hover-function");
  });

  it("lists document symbols", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLI(ctx.fixtureDir, [
      "find-document-symbols", "--file", "fixtures/main.c",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("document-symbols");
  });
});
```

**Verification:** 1 fixture file + 3 test files under `regression/cpp/`.

---

### Step 23: Create PHP Fixtures + Tests

#### 23a. `regression/php/fixtures/valid.php`

```php
<?php

function greet(string $name): string {
    return "Hello, " . $name . "!";
}

function farewell(string $name): string {
    return "Goodbye, " . $name . "!";
}

class Calculator {
    private int $result = 0;

    public function add(int $a, int $b): int {
        $this->result = $a + $b;
        return $this->result;
    }

    public function subtract(int $a, int $b): int {
        $this->result = $a - $b;
        return $this->result;
    }
}
```

#### 23b. `regression/php/fixtures/references.php`

```php
<?php
require_once __DIR__ . '/valid.php';

$message = greet("world");
echo $message;

$calc = new Calculator();
$sum = $calc->add(3, 4);
echo $sum;
```

#### 23c. `regression/php/100-diagnostics.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("php");

describe("PHP — diagnostics", () => {
  beforeAll(async () => { await ctx.setup(); }, 60_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("reports diagnostics for a valid file", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, ["diagnostics", "--file", "fixtures/valid.php"]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("valid-file-diagnostics");
  });
});
```

#### 23d. `regression/php/101-find-definition.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("php");

describe("PHP — find-definition", () => {
  beforeAll(async () => { await ctx.setup(); }, 60_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("finds definition of an imported function", async () => {
    if (!ctx.isServerInstalled) return;
    // references.php line 4: $message = greet("world") — "greet" at line 4, col 21
    const result = await runCLISlow(ctx.fixtureDir, [
      "find-definition", "--file", "fixtures/references.php", "--line", "4", "--col", "21",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("definition-of-greet");
  });
});
```

#### 23e. `regression/php/102-hover-and-symbols.test.ts`

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("php");

describe("PHP — hover & document-symbols", () => {
  beforeAll(async () => { await ctx.setup(); }, 60_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("shows hover info for a function", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "hover", "--file", "fixtures/valid.php", "--line", "3", "--col", "10",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("hover-function");
  });

  it("lists document symbols", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLI(ctx.fixtureDir, [
      "find-document-symbols", "--file", "fixtures/valid.php",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("document-symbols");
  });
});
```

**Verification:** 2 fixture files + 3 test files under `regression/php/`.

---

### Step 24: Update CI Workflow

**File modified:** `.github/workflows/ci.yaml`

**Add a new job** `regression` that runs after the existing `ci` job. This job runs on only one Node.js version (22) to save CI time, and installs the required LSP servers.

**Replace the entire file contents with:**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  ci:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [20, 22, 24]
      fail-fast: false

    steps:
      - uses: actions/checkout@v4

      - name: Use Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Typecheck
        run: npm run typecheck

      - name: Test
        run: npm run test

      - name: Build
        run: npm run build

      - name: Verify publish dry-run
        run: npm publish --dry-run --tag dev

  regression:
    runs-on: ubuntu-latest
    needs: ci

    steps:
      - uses: actions/checkout@v4

      - name: Use Node.js 22
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Build
        run: npm run build

      # ── Install LSP servers ──────────────────────────────────────────
      - name: Install TypeScript language server
        run: npm install -g typescript-language-server typescript

      - name: Install Bash language server
        run: npm install -g bash-language-server

      - name: Install YAML language server
        run: npm install -g yaml-language-server

      - name: Install JSON language server
        run: npm install -g vscode-json-languageserver-bin

      - name: Install CSS language server
        run: npm install -g vscode-css-languageserver-bin

      - name: Install PHP language server
        run: npm install -g intelephense

      # Python, Go, Rust, C/C++ servers are installed via their package managers
      # and may require additional setup. They are tested locally or in
      # a future matrix expansion.

      - name: Install Python LSP
        run: pip install python-lsp-server

      - name: Install Go
        uses: actions/setup-go@v5
        with:
          go-version: "1.22"

      - name: Install gopls
        run: go install golang.org/x/tools/gopls@latest

      - name: Install Rust toolchain
        uses: dtolnay/rust-toolchain@stable

      - name: Install rust-analyzer
        run: rustup component add rust-analyzer

      - name: Install clangd
        run: sudo apt-get update && sudo apt-get install -y clangd

      # ── Run regression tests ──────────────────────────────────────────
      - name: Run regression tests
        run: npm run test:regression

      - name: Upload snapshot artifacts on failure
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: regression-snapshots
          path: |
            regression/**/__snapshots__/
          retention-days: 7
```

**Verification:** CI workflow validates on push. The regression job runs after the ci job passes.

---

## Testing Strategy

### How to Run

```bash
# Unit tests (unchanged)
npm test

# Regression tests (all languages)
npm run test:regression

# Regression tests (single language)
npx vitest run --workspace vitest.workspace.ts --project regression:typescript

# Update snapshots after intentional output changes
npm run test:regression:update
```

### Snapshot Lifecycle

1. **First run:** Tests will FAIL because no snapshots exist. Run with `--update` to generate initial snapshots.
2. **Subsequent runs:** Tests PASS if output matches snapshots.
3. **When output changes intentionally:** Run with `--update` to regenerate.
4. **When output changes unintentionally:** Test FAILS — investigate the regression.

### Snapshot File Locations

Snapshots are stored alongside test files:
```
regression/typescript/__snapshots__/100-diagnostics.test.ts.snap
regression/typescript/__snapshots__/101-find-references.test.ts.snap
regression/python/__snapshots__/100-diagnostics.test.ts.snap
...
```

### What Tests Assert

| Test Type | Assertion | Description |
|-----------|-----------|-------------|
| Happy path | `expect(exitCode).toBe(0)` | Command succeeds |
| Happy path | `expect(normalized).toMatchSnapshot()` | Output matches expected pattern |
| Error state | `expect(exitCode).toBe(1)` | Command fails as expected |
| Error state | `expect(normalized).toMatchSnapshot()` | Error output matches expected pattern |
| Skip guard | `if (!ctx.isServerInstalled) return` | Skip gracefully when server not installed |

### Test Isolation Guarantees

1. **Daemon isolation:** Each `RegressionTestContext` creates a unique temp dir → unique socket path → unique daemon instance
2. **File isolation:** Fixtures are copied to temp dir; `rename-symbol` doesn't modify files (returns diff only)
3. **Concurrency:** Each language project runs with `maxForks: 1`; up to 5 languages run in parallel
4. **Cleanup:** `afterAll` always stops daemon and removes temp dir, even if tests fail

### Existing Tests That Must Still Pass

All existing unit tests must continue to pass unchanged:
- `tests/commands/*.test.ts` (10 files)
- `tests/daemon/*.test.ts` (4 files)
- `tests/formatting/*.test.ts` (5 files)
- `tests/lsp/*.test.ts` (3 files)
- `tests/utils/*.test.ts` (3 files)

**No existing test files are modified.** The `--config vitest.config.ts` flag ensures unit tests bypass workspace mode.

---

## Implementation Order

Steps must be completed in this order:

```
Step 1  (execa install)
  ↓
Step 2  (types.ts)
  ↓
Step 3  (normalize.ts) ──── depends on types.ts
  ↓
Step 4  (run-cli.ts) ──── depends on types.ts
  ↓
Step 5  (test-context.ts) ──── depends on run-cli pattern
  ↓
Step 6  (vitest.config.regression.ts)
  ↓
Step 7  (vitest.workspace.ts + scripts + eslint) ──── depends on Step 6
  ↓
Step 8  (TypeScript fixtures)
  ↓
Steps 9-14 (TypeScript tests) ──── depend on Steps 2-8; can be done in any order
  ↓
Steps 15-23 (Other language suites) ──── depend on Steps 2-7; each step is independent
  ↓
Step 24 (CI) ──── depends on all above
```

Steps 9-14 (TypeScript tests) can be implemented in parallel.
Steps 15-23 (other language suites) can each be implemented independently.

---

## Edge Cases & Error Handling

### Daemon startup failure
If the daemon fails to start (e.g., port conflict, corrupted state), the first CLI command in a test will timeout after 30s (or 60s with `runCLISlow`). The test will fail with a timeout error. No special handling needed — this is the expected behavior.

### LSP server not installed
The `RegressionTestContext.detectServer()` method runs the server's `--version` command. If it fails, `isServerInstalled` is set to `false`. Each test begins with `if (!ctx.isServerInstalled) return;` which causes the test to pass vacuously. This means:
- In CI with all servers installed: all tests run
- On a developer machine without Go: Go tests pass but exercise nothing
- The `describe.skipIf` pattern could also be used for clearer reporting

### Flaky LSP server responses
LSP servers may return slightly different results depending on timing, indexing state, or version. The normalization function handles most variability, but snapshots may still need updating when server versions change. This is by design — snapshots should be updated deliberately.

### Snapshot drift
If a CLI command's output format changes intentionally, all affected snapshots must be regenerated with `npm run test:regression:update`. This is a deliberate regression-checking mechanism.

---

## Files NOT Changed

The following files are explicitly OUT OF SCOPE and must not be modified:

- All files under `src/` (source code)
- All files under `tests/` (existing unit tests)
- `vitest.config.ts` (only the scripts reference changes — adding `--config` flag)
- `tsconfig.json` (regression tests are handled by Vitest's TypeScript transform)
- `tsup.config.ts` (build config)
- `README.md` (documentation)
- `.prettierrc` (formatting config)
- `.gitignore` (git config)
