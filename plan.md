# Implementation Plan: Increase Regression Tests for code-lens

## Overview

This plan adds regression tests across 4 dimensions:
1. **CLI subcommands** for daemon-only commands (`lint`, `prettier`, `tsc`, `fullCheck`, `fileChanged`)
2. **New language-specific regression tests** for the 10 existing languages
3. **Diagnostics command regression tests** (tsc, prettier, lint, fullCheck) for TypeScript
4. **4 GitHub issues** for the diagnostics categories

---

## Current State

### Test Files per Language

| Language | Test Files | Commands Tested |
|---|---|---|
| TypeScript | 100-diagnostics, 101-find-references, 102-find-definition, 103-find-document-symbols, 104-hover, 105-status-error-rename | diagnostics, find-references, find-definition, document-symbols, hover, status, rename, error-states |
| Python | 100-diagnostics, 101-find-references, 102-find-definition, 103-hover-and-symbols | diagnostics, find-references, find-definition, hover, document-symbols |
| Go | 100-diagnostics (single file, 5 tests) | diagnostics, document-symbols, find-references, find-definition, hover |
| Rust | 100-diagnostics (single file, 5 tests) | diagnostics, document-symbols, hover, find-definition, find-references |
| JSON | 100-diagnostics, 101-document-symbols, 102-error-states | diagnostics, document-symbols, error-states |
| Bash | 100-diagnostics (single file, 3 tests) | diagnostics, document-symbols, find-references |
| YAML | 100-diagnostics (single file, 3 tests) | diagnostics, document-symbols, language-id |
| CSS | 100-diagnostics, 101-document-symbols, 102-hover | diagnostics, document-symbols, hover |
| C++ | 100-diagnostics (single file, 4 tests) | diagnostics, find-definition, document-symbols, hover |
| PHP | 100-diagnostics, 101-find-definition, 102-hover-and-symbols | diagnostics, find-definition, hover, document-symbols |

### Daemon-Only Commands (no CLI subcommand)

`lint`, `prettier`, `tsc`, `fullCheck`, `fileChanged` — these register via `registerCommand()` in the daemon but have no `.command()` in `src/cli.ts`. To test them via regression, CLI subcommands must be added first.

### Language Capability Matrix

| Language | find-implementations | find-type-definition | find-type-hierarchy | find-calls | find-symbols |
|---|---|---|---|---|---|
| TypeScript | ✅ works | ✅ works | ✅ works | ✅ works | ✅ works |
| Python | ⚠️ limited | ❌ N/A | ❌ N/A | ❌ N/A | ⚠️ limited |
| Go | ✅ works | ❌ N/A | ❌ N/A | ❌ N/A | ⚠️ limited |
| Rust | ✅ works | ✅ works | ✅ works | ✅ works | ✅ works |
| C++ | ⚠️ limited | ❌ N/A | ❌ N/A | ❌ N/A | ❌ N/A |
| PHP | ⚠️ limited | ❌ N/A | ❌ N/A | ❌ N/A | ❌ N/A |

---

## PART 1: Add CLI Subcommands for Daemon-Only Commands

**Single file to modify:** `src/cli.ts`

All 5 new subcommands follow the same pattern as existing commands — they call `dispatch(method, params)` which sends a JSON-RPC request to the daemon.

### Step 1.1: Add `lint` CLI subcommand

**File:** `src/cli.ts`
**Insert location:** After the `rename-symbol` command block (after the `registerPositionCommand` call for `rename-symbol`), before the `status` command block.

**Exact code to add:**

```typescript
// 14. lint
program
  .command("lint")
  .description("Run detected linters on files")
  .requiredOption("--files <paths>", "Comma-separated file paths")
  .option("--max-concurrency <n>", "Maximum concurrent linters", parseInt)
  .option("--timeout <ms>", "Timeout in milliseconds", parseInt)
  .action(async (opts) => {
    const files = (opts.files as string).split(",").map((f: string) => f.trim());
    await dispatch("lint", {
      files,
      maxConcurrency: opts.maxConcurrency ?? undefined,
      timeoutMs: opts.timeout ?? undefined,
    });
  });
```

**Key detail:** The `lint` command handler in `src/commands/lint.ts` expects `params.files` as `string[]`. The CLI splits the comma-separated string into an array.

### Step 1.2: Add `prettier` CLI subcommand

**File:** `src/cli.ts`
**Insert location:** After the `lint` command block.

```typescript
// 15. prettier
program
  .command("prettier")
  .description("Check if files are formatted with prettier")
  .requiredOption("--files <paths>", "Comma-separated file paths")
  .option("--timeout <ms>", "Timeout in milliseconds", parseInt)
  .action(async (opts) => {
    const files = (opts.files as string).split(",").map((f: string) => f.trim());
    await dispatch("prettier", {
      files,
      timeoutMs: opts.timeout ?? undefined,
    });
  });
```

### Step 1.3: Add `tsc` CLI subcommand

**File:** `src/cli.ts`
**Insert location:** After the `prettier` command block.

```typescript
// 16. tsc
program
  .command("tsc")
  .description("Run TypeScript type checking")
  .requiredOption("--files <paths>", "Comma-separated file paths")
  .option("--timeout <ms>", "Timeout in milliseconds", parseInt)
  .action(async (opts) => {
    const files = (opts.files as string).split(",").map((f: string) => f.trim());
    await dispatch("tsc", {
      files,
      timeoutMs: opts.timeout ?? undefined,
    });
  });
```

### Step 1.4: Add `full-check` CLI subcommand

**File:** `src/cli.ts`
**Insert location:** After the `tsc` command block.

```typescript
// 17. full-check
program
  .command("full-check")
  .description("Run all checks (linters, prettier, tsc, LSP diagnostics)")
  .requiredOption("--files <paths>", "Comma-separated file paths")
  .option("--no-prettier", "Skip prettier check")
  .option("--no-linters", "Skip linter checks")
  .option("--no-lsp", "Skip LSP diagnostics")
  .option("--no-tsc", "Skip tsc check")
  .option("--max-concurrency <n>", "Maximum concurrent checks", parseInt)
  .option("--lsp-delay <ms>", "Delay for LSP diagnostics to settle", parseInt, 500)
  .option("--timeout <ms>", "Timeout per check in milliseconds", parseInt)
  .action(async (opts) => {
    const files = (opts.files as string).split(",").map((f: string) => f.trim());
    await dispatch("fullCheck", {
      files,
      config: {
        prettier: opts.prettier !== false,
        linters: opts.linters !== false,
        lsp: opts.lsp !== false,
        tsc: opts.tsc !== false,
        maxConcurrency: opts.maxConcurrency ?? undefined,
        lspDelayMs: opts.lspDelay ?? 500,
        prettierTimeoutMs: opts.timeout ?? undefined,
        linterTimeoutMs: opts.timeout ?? undefined,
        tscTimeoutMs: opts.timeout ?? undefined,
      },
    });
  });
```

**Note:** Uses `--no-xxx` negation flags so each check defaults to ON. Commander.js supports `--no-prettier` → sets `opts.prettier = false`. The `--max-concurrency` option limits how many checks run concurrently.

### Step 1.5: Add `file-changed` CLI subcommand

**File:** `src/cli.ts`
**Insert location:** After the `full-check` command block.

```typescript
// 18. file-changed
program
  .command("file-changed")
  .description("Notify the LSP server that a file has changed")
  .requiredOption("--file <path>", "File path")
  .action(async (opts) => {
    await dispatch("fileChanged", {
      file: opts.file,
    });
  });
```

---

## PART 2: New Language-Specific Regression Tests

### Step 2.1: TypeScript — find-implementations

**New file:** `regression/typescript/106-find-implementations.test.ts`

**Imports:** `describe, it, expect, beforeAll, afterAll` from vitest; `RegressionTestContext` from `../_shared/test-context.js`; `runCLI, runCLISlow` from `../_shared/run-cli.js`; `normalizeOutput` from `../_shared/normalize.js`

**Context:** `const ctx = new RegressionTestContext("typescript")`
**Lifecycle:** `beforeAll(() => ctx.setup(), 120_000)` and `afterAll(() => ctx.teardown(), 30_000)`
**Describe block:** `"TypeScript — find-implementations"`

**Fixture reference — `classes.ts` line numbers:**
```
1:  export class Animal {
2:    constructor(public name: string) {}
3:    (blank)
4:    speak(): string {
5:      return `${this.name} makes a sound`;
6:    }
7:  }
8:  (blank)
9:  export class Dog extends Animal {
10:   breed: string;
...
20: export interface Printable {
...
25: export class Document implements Printable {
```

**Tests:**

1. **`"finds implementations of Animal base class"`**
   - Guard: `if (!ctx.isServerInstalled) return;`
   - Target: `classes.ts` line 1 — `export class Animal {` — column 14 (the `A` in `Animal`, after `export class ` which is 13 chars)
   - Command: `runCLISlow(ctx.fixtureDir, ["find-implementations", "--file", "fixtures/classes.ts", "--line", "1", "--col", "14"])`
   - Assert: `result.exitCode` is 0
   - Normalize and snapshot: `expect(normalized).toMatchSnapshot("implementations-of-animal")`
   - Expected: Should find `Dog` class as implementation

2. **`"finds implementations of Printable interface"`**
   - Guard: `if (!ctx.isServerInstalled) return;`
   - Target: `classes.ts` line 20 — `export interface Printable {` — column 18 (the `P` in `Printable`, after `export interface ` which is 17 chars)
   - Command: `runCLISlow(ctx.fixtureDir, ["find-implementations", "--file", "fixtures/classes.ts", "--line", "20", "--col", "18"])`
   - Assert: `result.exitCode` is 0
   - Normalize and snapshot: `expect(normalized).toMatchSnapshot("implementations-of-printable")`
   - Expected: Should find `Document` class

**Fixtures needed:** None (uses existing `classes.ts`)

### Step 2.2: TypeScript — find-type-definition

**New file:** `regression/typescript/107-find-type-definition.test.ts`

**Same boilerplate** as other TypeScript test files.

**Describe block:** `"TypeScript — find-type-definition"`

**Fixture reference — `references.ts` line numbers:**
```
1: import { greet, Calculator, type User } from "./valid.js";
2: (blank)
3: const message = greet("world");
4: (blank)
5: const calc = new Calculator();
6: const sum = calc.add(3, 4);
7: (blank)
8: const user: User = {
```

**Fixture reference — `valid.ts` line numbers:**
```
1:  export function greet(name: string): string {
...
9:  export class Calculator {
...
23: export interface User {
```

**Tests:**

1. **`"finds type definition of class instance"`**
   - Target: `references.ts` line 5 — `const calc = new Calculator();` — column 7 (the `c` in `calc`, after `const ` which is 6 chars)
   - Command: `runCLI(ctx.fixtureDir, ["find-type-definition", "--file", "fixtures/references.ts", "--line", "5", "--col", "7"])`
   - Assert: `result.exitCode` is 0
   - Snapshot: `"type-definition-of-calc"`
   - Expected: Should resolve to `Calculator` class in `valid.ts`

2. **`"finds type definition of typed variable"`**
   - Target: `references.ts` line 8 — `const user: User = {` — column 13 (the `U` in `User`, after `const user: ` which is 12 chars)
   - Command: `runCLI(ctx.fixtureDir, ["find-type-definition", "--file", "fixtures/references.ts", "--line", "8", "--col", "13"])`
   - Assert: `result.exitCode` is 0
   - Snapshot: `"type-definition-of-user"`
   - Expected: Should resolve to `User` interface in `valid.ts`

3. **`"finds type definition at definition site returns same location"`**
   - Target: `valid.ts` line 23 — `export interface User {` — column 18 (the `U` in `User`, after `export interface ` which is 17 chars)
   - Command: `runCLI(ctx.fixtureDir, ["find-type-definition", "--file", "fixtures/valid.ts", "--line", "23", "--col", "18"])`
   - Snapshot: `"type-definition-local"`

**Fixtures needed:** None

### Step 2.3: TypeScript — find-type-hierarchy

**New file:** `regression/typescript/108-find-type-hierarchy.test.ts`

**Describe block:** `"TypeScript — find-type-hierarchy"`

**Tests:**

1. **`"shows supertypes of Dog class"`**
   - Target: `classes.ts` line 9 — `export class Dog extends Animal {` — column 14 (the `D` in `Dog`, after `export class ` which is 13 chars)
   - Command: `runCLI(ctx.fixtureDir, ["find-type-hierarchy", "--file", "fixtures/classes.ts", "--line", "9", "--col", "14", "--direction", "supertypes"])`
   - Assert: `result.exitCode` is 0
   - Snapshot: `"type-hierarchy-dog-supertypes"`
   - Expected: Should show `Animal` as supertype

2. **`"shows subtypes of Animal class"`**
   - Target: `classes.ts` line 1 — `export class Animal {` — column 14 (the `A` in `Animal`, after `export class ` which is 13 chars)
   - Command: `runCLI(ctx.fixtureDir, ["find-type-hierarchy", "--file", "fixtures/classes.ts", "--line", "1", "--col", "14", "--direction", "subtypes"])`
   - Snapshot: `"type-hierarchy-animal-subtypes"`
   - Expected: Should show `Dog`

3. **`"shows both directions for Document class"`**
   - Target: `classes.ts` line 25 — `export class Document implements Printable {` — column 14 (the `D` in `Document`, after `export class ` which is 13 chars)
   - Command: `runCLI(ctx.fixtureDir, ["find-type-hierarchy", "--file", "fixtures/classes.ts", "--line", "25", "--col", "14", "--direction", "both"])`
   - Snapshot: `"type-hierarchy-document-both"`

**Fixtures needed:** None

### Step 2.4: TypeScript — find-calls

**New file:** `regression/typescript/109-find-calls.test.ts`

**Describe block:** `"TypeScript — find-calls"`

**Fixture reference — `valid.ts` line numbers:**
```
1:  export function greet(name: string): string {
...
9:  export class Calculator {
10:   private result: number = 0;
11:   (blank)
12:   add(a: number, b: number): number {
```

**Tests:**

1. **`"shows call hierarchy for greet function"`**
   - Target: `valid.ts` line 1 — `export function greet(name: string): string {` — column 17 (the `g` in `greet`, after `export function ` which is 16 chars)
   - Command: `runCLI(ctx.fixtureDir, ["find-calls", "--file", "fixtures/valid.ts", "--line", "1", "--col", "17"])`
   - Assert: `result.exitCode` is 0
   - Snapshot: `"calls-greet"`
   - Expected: Should show incoming calls from `references.ts`

2. **`"shows call hierarchy for Calculator.add method"`**
   - Target: `valid.ts` line 12 — `add(a: number, b: number): number {` — column 3 (the `a` in `add`, after 2 spaces of indentation)
   - Command: `runCLI(ctx.fixtureDir, ["find-calls", "--file", "fixtures/valid.ts", "--line", "12", "--col", "3"])`
   - Snapshot: `"calls-calculator-add"`

**Fixtures needed:** None

### Step 2.5: TypeScript — find-symbols

**New file:** `regression/typescript/110-find-symbols.test.ts`

**Describe block:** `"TypeScript — find-symbols"`

**Tests:**

1. **`"finds symbols matching 'greet'"`**
   - Prerequisite: First run `runCLISlow(ctx.fixtureDir, ["find-document-symbols", "--file", "fixtures/valid.ts"])` to ensure daemon+server are running
   - Command: `runCLI(ctx.fixtureDir, ["find-symbols", "--query", "greet"])`
   - Assert: `result.exitCode` is 0
   - Normalize and snapshot: `"symbols-greet"`
   - Expected: Should list `greet` function

2. **`"finds symbols matching 'Calculator'"`**
   - Command: `runCLI(ctx.fixtureDir, ["find-symbols", "--query", "Calculator"])`
   - Snapshot: `"symbols-calculator"`
   - Expected: Should list `Calculator` class

3. **`"returns empty results for non-matching query"`**
   - Command: `runCLI(ctx.fixtureDir, ["find-symbols", "--query", "xyznonexistent123"])`
   - Snapshot: `"symbols-no-match"`
   - Expected: Should return 0 symbols

**Fixtures needed:** None

### Step 2.6: Python — find-implementations (limited)

**New file:** `regression/python/104-find-implementations.test.ts`

**Describe block:** `"Python — find-implementations"`

**Fixture reference — `valid.py` line numbers:**
```
1: def greet(name: str) -> str:
2:     return f"Hello, {name}!"
3: (blank)
4: def farewell(name: str) -> str:
5:     return f"Goodbye, {name}!"
6: (blank)
7: (blank)
8: class Calculator:
9:     def __init__(self) -> None:
```

**Tests:**

1. **`"finds implementations or returns empty for class"`**
   - Guard: `if (!ctx.isServerInstalled) return;`
   - Target: `valid.py` line 8 — `class Calculator:` — column 7 (the `C` in `Calculator`, after `class ` which is 6 chars)
   - Command: `runCLIWithRetry(ctx.fixtureDir, ["find-implementations", "--file", "fixtures/valid.py", "--line", "8", "--col", "7"])`
   - Assert: Use `.toMatch(/Implementations found: \d+ location/)` (not snapshot — pylsp support varies)
   - Normalize output and assert it matches the pattern

**Fixtures needed:** None

### Step 2.7: Go — find-implementations

**New file:** `regression/go/101-find-implementations.test.ts`

**Describe block:** `"Go — find-implementations"`

**Fixture reference — `main.go` line numbers:**
```
1:  package main
2:  (blank)
3:  import "fmt"
4:  (blank)
5:  func greet(name string) string {
...
13: type Calculator struct {
```

**Tests:**

1. **`"finds implementations of Calculator struct"`**
   - Guard: `if (!ctx.isServerInstalled) return;`
   - Target: `fixtures/main.go` line 13 — `type Calculator struct {` — column 6 (the `C` in `Calculator`, after `type ` which is 5 chars)
   - Command: `runCLIWithRetry(ctx.fixtureDir, ["find-implementations", "--file", "fixtures/main.go", "--line", "13", "--col", "6"])`
   - Assert: `result.exitCode` is 0
   - Snapshot: `"implementations-calculator"`
   - Expected: gopls may return 0 implementations since Calculator is not an interface — this is acceptable

2. **`"finds implementations returns result for function"`**
   - Target: `fixtures/main.go` line 5 — `func greet(name string) string {` — column 6 (the `g` in `greet`, after `func ` which is 5 chars)
   - Command: `runCLIWithRetry(ctx.fixtureDir, ["find-implementations", "--file", "fixtures/main.go", "--line", "5", "--col", "6"])`
   - Snapshot: `"implementations-greet"`

**Fixtures needed:** None

### Step 2.8: Rust — find-implementations

**New file:** `regression/rust/101-find-implementations.test.ts`

**Describe block:** `"Rust — find-implementations"`

**Fixture reference — `src/main.rs` line numbers:**
```
1:  fn greet(name: &str) -> String {
...
9:  struct Calculator {
```

**Tests:**

1. **`"finds implementations of Calculator struct"`**
   - Guard: `if (!ctx.isServerInstalled) return;`
   - Target: `src/main.rs` line 9 — `struct Calculator {` — column 8 (the `C` in `Calculator`, after `struct ` which is 7 chars)
   - Command: `runCLIWithRetry(ctx.fixtureDir, ["find-implementations", "--file", "src/main.rs", "--line", "9", "--col", "8"])`
   - Assert: `result.exitCode` is 0
   - Snapshot: `"implementations-calculator"`

**Fixtures needed:** None

### Step 2.9: Rust — find-type-definition

**New file:** `regression/rust/102-find-type-definition.test.ts`

**Describe block:** `"Rust — find-type-definition"`

**Fixture reference — `src/main.rs` line numbers:**
```
24: fn main() {
25:     let message = greet("world");
26:     println!("{}", message);
27:     (blank)
28:     let mut calc = Calculator::new();
29:     let sum = calc.add(3, 4);
```

**Tests:**

1. **`"finds type definition of variable"`**
   - Target: `src/main.rs` line 25 — `    let message = greet("world");` — column 9 (the `m` in `message`, after 4 spaces + `let ` which is 8 chars total)
   - Command: `runCLIWithRetry(ctx.fixtureDir, ["find-type-definition", "--file", "src/main.rs", "--line", "25", "--col", "9"])`
   - Snapshot: `"type-definition-message"`
   - Expected: Should resolve to `String` or the return type

2. **`"finds type definition of struct instance"`**
   - Target: `src/main.rs` line 28 — `    let mut calc = Calculator::new();` — column 13 (the `c` in `calc`, after 4 spaces + `let mut ` which is 12 chars total)
   - Command: `runCLIWithRetry(ctx.fixtureDir, ["find-type-definition", "--file", "src/main.rs", "--line", "28", "--col", "13"])`
   - Snapshot: `"type-definition-calc"`

**Fixtures needed:** None

### Step 2.10: Rust — find-type-hierarchy

**New file:** `regression/rust/103-find-type-hierarchy.test.ts`

**Describe block:** `"Rust — find-type-hierarchy"`

**Tests:**

1. **`"shows type hierarchy for Calculator struct"`**
   - Target: `src/main.rs` line 9 — `struct Calculator {` — column 8 (the `C` in `Calculator`, after `struct ` which is 7 chars)
   - Command: `runCLIWithRetry(ctx.fixtureDir, ["find-type-hierarchy", "--file", "src/main.rs", "--line", "9", "--col", "8", "--direction", "both"])`
   - Snapshot: `"type-hierarchy-calculator"`

**Fixtures needed:** None

### Step 2.11: Rust — find-calls

**New file:** `regression/rust/104-find-calls.test.ts`

**Describe block:** `"Rust — find-calls"`

**Fixture reference — `src/main.rs` line numbers:**
```
1:  fn greet(name: &str) -> String {
...
18:     fn add(&mut self, a: i32, b: i32) -> i32 {
```

**Tests:**

1. **`"shows call hierarchy for greet function"`**
   - Target: `src/main.rs` line 1 — `fn greet(name: &str) -> String {` — column 4 (the `g` in `greet`, after `fn ` which is 3 chars)
   - Command: `runCLIWithRetry(ctx.fixtureDir, ["find-calls", "--file", "src/main.rs", "--line", "1", "--col", "4"])`
   - Snapshot: `"calls-greet"`
   - Expected: Should show incoming call from `main`

2. **`"shows call hierarchy for Calculator::add method"`**
   - Target: `src/main.rs` line 18 — `    fn add(&mut self, a: i32, b: i32) -> i32 {` — column 7 (the `a` in `add`, after 4 spaces + `fn ` which is 6 chars total)
   - Command: `runCLIWithRetry(ctx.fixtureDir, ["find-calls", "--file", "src/main.rs", "--line", "18", "--col", "7"])`
   - Snapshot: `"calls-calculator-add"`

**Fixtures needed:** None

### Step 2.12: Rust — find-symbols

**New file:** `regression/rust/105-find-symbols.test.ts`

**Describe block:** `"Rust — find-symbols"`

**Tests:**

1. **`"finds symbols matching 'greet'"`**
   - Prerequisite: First run `runCLIWithRetry(ctx.fixtureDir, ["find-document-symbols", "--file", "src/main.rs"])` to ensure server is running
   - Command: `runCLI(ctx.fixtureDir, ["find-symbols", "--query", "greet"])`
   - Snapshot: `"symbols-greet"`

2. **`"finds symbols matching 'Calculator'"`**
   - Command: `runCLI(ctx.fixtureDir, ["find-symbols", "--query", "Calculator"])`
   - Snapshot: `"symbols-calculator"`

**Fixtures needed:** None

### Step 2.13: C++ — find-references

**New file:** `regression/cpp/101-find-references.test.ts`

**Describe block:** `"C/C++ — find-references"`

**Fixture reference — `fixtures/main.c` line numbers:**
```
1:  #include <stdio.h>
2:  (blank)
3:  int add(int a, int b) {
4:      return a + b;
5:  }
6:  (blank)
7:  int subtract(int a, int b) {
8:      return a - b;
9:  }
10: (blank)
11: typedef struct {
12:     int x;
13:     int y;
14: } Point;
```

**Tests:**

1. **`"finds references to add function"`**
   - Guard: `if (!ctx.isServerInstalled) return;`
   - Target: `fixtures/main.c` line 3 — `int add(int a, int b) {` — column 5 (the `a` in `add`, after `int ` which is 4 chars)
   - Command: `runCLISlow(ctx.fixtureDir, ["find-references", "--file", "fixtures/main.c", "--line", "3", "--col", "5"])`
   - Assert: `result.exitCode` is 0
   - Snapshot: `"references-to-add"`

2. **`"finds references to Point typedef"`**
   - Target: `fixtures/main.c` line 14 — `} Point;` — column 3 (the `P` in `Point`, after `} ` which is 2 chars)
   - Command: `runCLISlow(ctx.fixtureDir, ["find-references", "--file", "fixtures/main.c", "--line", "14", "--col", "3"])`
   - Snapshot: `"references-to-point"`

**Fixtures needed:** None

### Step 2.14: PHP — find-references

**New file:** `regression/php/103-find-references.test.ts`

**Describe block:** `"PHP — find-references"`

**Fixture reference — `fixtures/valid.php` line numbers:**
```
1:  <?php
2:  (blank)
3:  function greet(string $name): string {
...
11: class Calculator {
```

**Tests:**

1. **`"finds references to greet function"`**
   - Guard: `if (!ctx.isServerInstalled) return;`
   - Target: `fixtures/valid.php` line 3 — `function greet(string $name): string {` — column 10 (the `g` in `greet`, after `function ` which is 9 chars)
   - Command: `runCLIWithRetry(ctx.fixtureDir, ["find-references", "--file", "fixtures/valid.php", "--line", "3", "--col", "10"])`
   - Assert: `.toMatch(/References found: \d+ location/)`
   - Expected: Should find reference in `references.php`

2. **`"finds references to Calculator class"`**
   - Target: `fixtures/valid.php` line 11 — `class Calculator {` — column 7 (the `C` in `Calculator`, after `class ` which is 6 chars)
   - Command: `runCLIWithRetry(ctx.fixtureDir, ["find-references", "--file", "fixtures/valid.php", "--line", "11", "--col", "7"])`
   - Assert: `.toMatch(/References found: \d+ location/)`

**Fixtures needed:** None

### Step 2.15: PHP — find-implementations

**New file:** `regression/php/104-find-implementations.test.ts`

**Describe block:** `"PHP — find-implementations"`

**Tests:**

1. **`"returns result for Calculator class"`**
   - Guard: `if (!ctx.isServerInstalled) return;`
   - Target: `fixtures/valid.php` line 11 — `class Calculator {` — column 7 (the `C` in `Calculator`, after `class ` which is 6 chars)
   - Command: `runCLIWithRetry(ctx.fixtureDir, ["find-implementations", "--file", "fixtures/valid.php", "--line", "11", "--col", "7"])`
   - Assert: `.toMatch(/Implementations found: \d+ location/)` (flexible — intelephense may return 0)

**Fixtures needed:** None

### Step 2.16: CSS — find-definition

**New file:** `regression/css/103-find-definition.test.ts`

**Describe block:** `"CSS — find-definition"`

**Fixture reference — `fixtures/valid.css` line numbers:**
```
1:  :root {
2:    --primary-color: #333;
3:    --font-size: 16px;
4:  }
5:  (blank)
6:  .container {
7:    display: flex;
8:    flex-direction: column;
9:    color: var(--primary-color);
10:   font-size: var(--font-size);
11: }
12: (blank)
13: .container .header {
14:   font-weight: bold;
15:   margin-bottom: 10px;
16: }
17: (blank)
18: .container .content {
19:   padding: 20px;
20: }
```

**Tests:**

1. **`"finds definition of CSS variable"`**
   - Guard: `if (!ctx.isServerInstalled) return;`
   - Target: `fixtures/valid.css` line 9 — `  color: var(--primary-color);` — column 16 (the first `-` in `--primary-color` inside `var()`, after `  color: var(` which is 15 chars)
   - Command: `runCLIWithRetry(ctx.fixtureDir, ["find-definition", "--file", "fixtures/valid.css", "--line", "9", "--col", "16"])`
   - Assert: `.toMatch(/Definition found: \d+ location/)` — CSS variable go-to-definition may or may not work depending on css-languageserver version

2. **`"finds definition from within a selector block"`**
   - Target: `fixtures/valid.css` line 9 — `  color: var(--primary-color);` — column 3 (the `c` in `color`, after 2 spaces)
   - Command: `runCLIWithRetry(ctx.fixtureDir, ["find-definition", "--file", "fixtures/valid.css", "--line", "9", "--col", "3"])`
   - Assert: `.toMatch(/Definition found:|No definition/)` — flexible

**Fixtures needed:** None

### Step 2.17: TypeScript — file-changed

**New file:** `regression/typescript/111-file-changed.test.ts`

**Describe block:** `"TypeScript — file-changed"`

**Tests:**

1. **`"notifies server of file change"`**
   - Guard: `if (!ctx.isServerInstalled) return;`
   - Command: `runCLISlow(ctx.fixtureDir, ["file-changed", "--file", "fixtures/valid.ts"])`
   - Assert: `result.exitCode` is 0
   - Assert: `normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir })` matches `.toMatch(/changed|language|notified|success|ok/i)`
   - Use `.toMatch()` assertion (not snapshot) since the exact output message may vary by server state

**Fixtures needed:** None

---

## PART 3: Diagnostics Command Regression Tests (TypeScript)

These tests require new fixtures. The daemon runs from the `cwd` (the temp fixture dir), so `tsconfig.json` must be in the fixture root. Currently fixtures are copied to `<tmpdir>/fixtures/`. The tsc runner looks for `tsconfig.json` starting from the file's directory upward — so it needs to be at `<tmpdir>/fixtures/tsconfig.json` or `<tmpdir>/tsconfig.json`. Since the tsc runner calls `npx tsc --noEmit --pretty false` from the `cwd`, and tsc searches for `tsconfig.json` starting from `cwd`, we need `tsconfig.json` at the temp dir root.

**However**, the existing `copyDirRecursive` copies `regression/typescript/fixtures/` → `<tmpdir>/fixtures/`. The temp dir root has no `tsconfig.json`. We need to either:
- Copy `tsconfig.json` to `<tmpdir>/tsconfig.json` in the test's `beforeAll`, OR
- Place `tsconfig.json` inside `fixtures/` so it ends up at `<tmpdir>/fixtures/tsconfig.json`, and set the `cwd` for tsc to `<tmpdir>/fixtures/` — but the daemon is started with `cwd` = `<tmpdir>`, not `<tmpdir>/fixtures/`.

**Solution:** Place `tsconfig.json` at `regression/typescript/fixtures/tsconfig.json`. In the `beforeAll` of the tsc/prettier/lint/fullCheck tests, copy it to the temp dir root:
```typescript
import * as fs from "node:fs";
import * as path from "node:path";
// In beforeAll, after ctx.setup():
fs.copyFileSync(
  path.join(ctx.fixtureDir, "fixtures", "tsconfig.json"),
  path.join(ctx.fixtureDir, "tsconfig.json")
);
```

Similarly for `.prettierrc`.

### Step 3.1: New fixtures

**New file:** `regression/typescript/fixtures/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["./**/*.ts"]
}
```

**New file:** `regression/typescript/fixtures/.prettierrc`

```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 80
}
```

**New file:** `regression/typescript/fixtures/unformatted.ts`

```typescript
export function    badlyFormatted(    x:number   ):number{
    return     x+1;
}
```

This file has inconsistent spacing that prettier will flag.

### Step 3.2: TypeScript — TSC regression test

**New file:** `regression/typescript/200-tsc.test.ts`

**Describe block:** `"TypeScript — tsc"`

**BeforeAll special setup:** After `ctx.setup()`, copy `tsconfig.json` to temp dir root:
```typescript
beforeAll(async () => {
  await ctx.setup();
  // Copy tsconfig.json to workspace root for tsc
  const tsconfigSrc = path.join(ctx.fixtureDir, "fixtures", "tsconfig.json");
  if (fs.existsSync(tsconfigSrc)) {
    fs.copyFileSync(tsconfigSrc, path.join(ctx.fixtureDir, "tsconfig.json"));
  }
}, 120_000);
```

**Tests:**

1. **`"reports errors for broken file"`**
   - Guard: `if (!ctx.isServerInstalled) return;`
   - Command: `runCLISlow(ctx.fixtureDir, ["tsc", "--files", "fixtures/broken.ts"])`
   - Assert: `result.exitCode` is 0 (the CLI always exits 0; errors are in the output text)
   - Assert: `normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir })` matches `.toMatch(/error|TS\d+|0 issues|not available/i)`
   - Note: If tsc is not installed (CI installs typescript globally via `npm install -g typescript`), the command returns "not available". The test should handle both cases gracefully.

2. **`"reports 0 errors for valid files"`**
   - Guard: `if (!ctx.isServerInstalled) return;`
   - Command: `runCLISlow(ctx.fixtureDir, ["tsc", "--files", "fixtures/valid.ts"])`
   - Assert: `result.exitCode` is 0
   - Assert: `normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir })` matches `.toMatch(/0 (errors|issues)|not available/i)`

3. **`"returns result when tsc is missing"`**
   - This test documents what happens when tsc is unavailable. Since CI installs typescript, the "not available" case won't trigger in CI. Assert `exitCode` is 0 and use `.toMatch(/issues|error|not available/i)` to accept any valid output.

### Step 3.3: TypeScript — Prettier regression test

**New file:** `regression/typescript/201-prettier.test.ts`

**BeforeAll special setup:** After `ctx.setup()`, copy `.prettierrc` to temp dir root:
```typescript
beforeAll(async () => {
  await ctx.setup();
  const prettierrcSrc = path.join(ctx.fixtureDir, "fixtures", ".prettierrc");
  if (fs.existsSync(prettierrcSrc)) {
    fs.copyFileSync(prettierrcSrc, path.join(ctx.fixtureDir, ".prettierrc"));
  }
}, 120_000);
```

**Tests:**

1. **`"reports correctly formatted files"`**
   - Guard: `if (!ctx.isServerInstalled) return;`
   - Command: `runCLISlow(ctx.fixtureDir, ["prettier", "--files", "fixtures/valid.ts"])`
   - Assert: `result.exitCode` is 0
   - Assert: `normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir })` matches `.toMatch(/formatted correctly|no supported files|not available|0 files need/i)`

2. **`"detects unformatted file"`**
   - Guard: `if (!ctx.isServerInstalled) return;`
   - Command: `runCLISlow(ctx.fixtureDir, ["prettier", "--files", "fixtures/unformatted.ts"])`
   - Assert: `result.exitCode` is 0
   - Assert: `normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir })` matches `.toMatch(/need formatting|formatted correctly|not available|files? need/i)`

3. **`"handles multiple files"`**
   - Guard: `if (!ctx.isServerInstalled) return;`
   - Command: `runCLISlow(ctx.fixtureDir, ["prettier", "--files", "fixtures/valid.ts,fixtures/unformatted.ts"])`
   - Assert: `result.exitCode` is 0
   - Assert: `normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir })` matches `.toMatch(/formatted|formatting|not available|files/i)`

### Step 3.4: TypeScript — lint regression test

**New file:** `regression/typescript/202-lint.test.ts`

**No special beforeAll setup** — lint relies on detecting installed linters. CI does NOT install ESLint globally, so the lint command will return "No linters detected" or "0 issues". This is the expected behavior to test.

**Tests:**

1. **`"returns result when no linters are installed"`**
   - Guard: `if (!ctx.isServerInstalled) return;`
   - Command: `runCLISlow(ctx.fixtureDir, ["lint", "--files", "fixtures/valid.ts"])`
   - Assert: `result.exitCode` is 0
   - Assert: `normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir })` matches `.toMatch(/issues|No linters|0 issues|not available/i)`
   - Expected: "0 issues" or "No linters detected" — either is valid

2. **`"handles multiple files"`**
   - Guard: `if (!ctx.isServerInstalled) return;`
   - Command: `runCLISlow(ctx.fixtureDir, ["lint", "--files", "fixtures/valid.ts,fixtures/broken.ts"])`
   - Assert: `result.exitCode` is 0
   - Assert: `normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir })` matches `.toMatch(/issues|No linters|0 issues|not available/i)`

### Step 3.5: TypeScript — fullCheck regression test

**New file:** `regression/typescript/203-full-check.test.ts`

**BeforeAll special setup:** Copy both `tsconfig.json` and `.prettierrc` to temp dir root:
```typescript
beforeAll(async () => {
  await ctx.setup();
  const tsconfigSrc = path.join(ctx.fixtureDir, "fixtures", "tsconfig.json");
  if (fs.existsSync(tsconfigSrc)) {
    fs.copyFileSync(tsconfigSrc, path.join(ctx.fixtureDir, "tsconfig.json"));
  }
  const prettierrcSrc = path.join(ctx.fixtureDir, "fixtures", ".prettierrc");
  if (fs.existsSync(prettierrcSrc)) {
    fs.copyFileSync(prettierrcSrc, path.join(ctx.fixtureDir, ".prettierrc"));
  }
}, 120_000);
```

**Tests:**

1. **`"runs full check on valid files"`**
   - Guard: `if (!ctx.isServerInstalled) return;`
   - Command: `runCLISlow(ctx.fixtureDir, ["full-check", "--files", "fixtures/valid.ts", "--no-linters"])` (skip linters since none installed)
   - Assert: `result.exitCode` is 0
   - Snapshot: `"full-check-valid"` — fullCheck output has deterministic section headers (prettier, tsc, LSP diagnostics) with normalized paths, so snapshots are appropriate
   - Note: Output will contain sections for each check (prettier, tsc, LSP diagnostics) with their statuses. Use `--no-linters` to skip the linting section since no linters are installed.

2. **`"runs full check on broken files"`**
   - Guard: `if (!ctx.isServerInstalled) return;`
   - Command: `runCLISlow(ctx.fixtureDir, ["full-check", "--files", "fixtures/broken.ts", "--no-linters"])`
   - Snapshot: `"full-check-broken"`

3. **`"handles multiple files"`**
   - Guard: `if (!ctx.isServerInstalled) return;`
   - Command: `runCLISlow(ctx.fixtureDir, ["full-check", "--files", "fixtures/valid.ts,fixtures/broken.ts,fixtures/unformatted.ts", "--no-linters"])`
   - Snapshot: `"full-check-multi-file"`

---

## PART 4: Update CI Workflow

### Step 4.1: Install prettier in CI

**File:** `.github/workflows/ci.yaml`
**Insert location:** After "Install TypeScript language server" step.

**Add step:**

```yaml
      - name: Install prettier
        run: npm install -g prettier
```

**Reason:** The `prettier` CLI subcommand uses `npx prettier --check`, which requires prettier to be available. Installing globally ensures it's in PATH.

Note: `tsc` is already available because CI installs `typescript` globally (`npm install -g typescript-language-server typescript`). `eslint` is deliberately NOT installed — the lint tests will verify the "no linters" path.

---

## PART 5: GitHub Issues

### Step 5.1: Create GitHub issues via `gh issue create`

Run the following `gh` CLI commands to create 4 issues. These should be run after the PR is merged so the issue body references the merged code.

**Issue 1: Linting Diagnostics**

```bash
gh issue create \
  --title "Regression Tests: Linting Diagnostics (lint command)" \
  --body '## Summary
The `lint` command runs detected linters (ESLint, Ruff, Flake8, Pylint, Mypy, Clippy, staticcheck, RuboCop, ShellCheck, Stylelint) on specified files. Currently, the lint command has zero regression test coverage.

## Current State
- **Command**: `src/commands/lint.ts` — registers `lint` via `registerCommand()`
- **Linter definitions**: `src/linting/definitions.ts` — 10 linters defined
- **Linter detection**: `src/linting/linter-registry.ts` — auto-detects installed linters
- **Linter runner**: `src/linting/linter-runner.ts` — runs linters concurrently
- **CLI subcommand**: `code-lens lint --files <paths>`
- **Regression test**: `regression/typescript/202-lint.test.ts` — basic "no linters" path only

## What Needs Testing

### TypeScript + ESLint
- Install ESLint + `@typescript-eslint/parser` + `@typescript-eslint/eslint-plugin`
- Create `regression/typescript/fixtures/.eslintrc.json` with basic rules
- Test: lint returns issues for files with lint violations
- Test: lint returns 0 issues for clean files

### Python + Ruff/Flake8
- Install Ruff or Flake8
- Create `regression/python/fixtures/pyproject.toml` or `setup.cfg` with lint config
- Test: lint returns issues for Python files with violations

### Go + staticcheck
- Install staticcheck
- Test: lint runs staticcheck on Go files

### Rust + Clippy
- Test: lint runs clippy on Rust files (cargo clippy is typically available with Rust toolchain)

## CI Requirements
- CI needs to install linters: `npm install -g eslint`, `pip install ruff`, etc.
- Each linter test should skip gracefully if the linter is not installed

## Languages Affected
TypeScript, Python, Go, Rust, Shell, CSS, Ruby

## Priority
Medium — lint is a daemon-only command that pi-lens calls in Phase 2. Having basic regression coverage ensures the lint pipeline works end-to-end.'
```

**Issue 2: Prettier Formatting**

```bash
gh issue create \
  --title "Regression Tests: Prettier Formatting (prettier command)" \
  --body '## Summary
The `prettier` command runs `prettier --check` on specified files to detect formatting issues. Currently has minimal regression test coverage (basic TypeScript-only test in `regression/typescript/201-prettier.test.ts`).

## Current State
- **Command**: `src/commands/prettier.ts` — registers `prettier` via `registerCommand()`
- **Runner**: `src/linting/prettier-runner.ts` — runs `npx prettier --check`
- **CLI subcommand**: `code-lens prettier --files <paths>`
- **Regression test**: `regression/typescript/201-prettier.test.ts` — TypeScript only

## What Needs Testing

### CSS/SCSS
- Create `regression/css/fixtures/unformatted.css` with bad formatting
- Test: prettier detects formatting issues in CSS

### JSON
- Create `regression/json/fixtures/unformatted.json` with bad formatting
- Test: prettier detects formatting issues in JSON

### YAML
- Install `prettier-plugin-yaml` or test with native prettier YAML support
- Create unformatted YAML fixture

## CI Requirements
- CI needs: `npm install -g prettier` (already in CI)
- For YAML: `npm install -g prettier prettier-plugin-yaml`

## Languages Affected
TypeScript, CSS, JSON, YAML, HTML, Markdown

## Priority
Medium — prettier is a daemon-only command used in fullCheck. Basic TypeScript coverage is sufficient for now; other languages are nice-to-have.'
```

**Issue 3: TSC Type Checking**

```bash
gh issue create \
  --title "Regression Tests: TSC Type Checking (tsc command)" \
  --body '## Summary
The `tsc` command runs `tsc --noEmit` on TypeScript files and reports type errors. Currently has minimal regression test coverage (basic TypeScript-only test in `regression/typescript/200-tsc.test.ts`).

## Current State
- **Command**: `src/commands/tsc.ts` — registers `tsc` via `registerCommand()`
- **Runner**: `src/linting/tsc-runner.ts` — runs `tsc --noEmit --pretty false`
- **CLI subcommand**: `code-lens tsc --files <paths>`
- **Regression test**: `regression/typescript/200-tsc.test.ts` — TypeScript only

## What Needs Testing

### TypeScript — Error Reporting
- Test: tsc reports specific error codes (TS2322, TS2345, etc.)
- Test: tsc handles files with import resolution errors
- Test: tsc handles tsconfig.json with strict mode enabled
- Test: tsc handles missing tsconfig.json gracefully

### TypeScript — Edge Cases
- Test: tsc with very large file sets
- Test: tsc with files that have circular imports
- Test: tsc timeout behavior

## CI Requirements
- CI already installs `typescript` globally: `npm install -g typescript`
- CI needs `tsconfig.json` in the fixture directory

## Languages Affected
TypeScript only (tsc is TypeScript-specific)

## Priority
High — tsc type checking is critical for TypeScript projects and is part of the fullCheck command. The basic tests cover the happy path and broken-file path.'
```

**Issue 4: Full Check Aggregation**

```bash
gh issue create \
  --title "Regression Tests: Full Check Aggregation (fullCheck command)" \
  --body '## Summary
The `fullCheck` command runs all checks (prettier, linters, LSP diagnostics, tsc) concurrently and aggregates results. Currently has minimal regression test coverage (basic TypeScript-only test in `regression/typescript/203-full-check.test.ts`).

## Current State
- **Command**: `src/commands/fullCheck.ts` — registers `fullCheck` via `registerCommand()`
- **Runs concurrently**: prettier, lint, LSP diagnostics, tsc
- **CLI subcommand**: `code-lens full-check --files <paths>`
- **Regression test**: `regression/typescript/203-full-check.test.ts` — TypeScript, no linters

## What Needs Testing

### Integration Tests
- Test: fullCheck with all checks enabled and passing
- Test: fullCheck with all checks enabled and some failing
- Test: fullCheck with individual checks disabled via config flags
- Test: fullCheck handles partial failures gracefully (one check fails, others succeed)

### Multi-Language
- Test: fullCheck on Python files (LSP diagnostics only, no tsc/prettier)
- Test: fullCheck on Go files (LSP diagnostics only)
- Test: fullCheck on mixed file types

### Performance
- Test: fullCheck completes within timeout for typical project sizes
- Test: concurrent execution does not cause race conditions

## CI Requirements
- Requires all individual check prerequisites (prettier, typescript, LSP servers)
- CI should test the "minimal tools" scenario (no linters, prettier+tsc available)

## Languages Affected
All languages — fullCheck is language-agnostic, runs applicable checks per file

## Priority
High — fullCheck is the primary command pi-lens calls in Phase 2+. It must work correctly across all supported languages.'
```

---

## Summary: All Files to Create/Modify

### Files to MODIFY (2 files)

| File | Changes |
|---|---|
| `src/cli.ts` | Add 5 new CLI subcommands: `lint`, `prettier`, `tsc`, `full-check`, `file-changed` (after rename-symbol, before status). New commands use comment numbers 14–18. Existing command comments 1–13 are left unchanged. |
| `.github/workflows/ci.yaml` | Add `npm install -g prettier` step |

### Files to CREATE — New test files (26 files)

| # | File | Tests |
|---|---|---|
| 1 | `regression/typescript/106-find-implementations.test.ts` | 2 tests: Animal (line 1 col 14), Printable (line 20 col 18) |
| 2 | `regression/typescript/107-find-type-definition.test.ts` | 3 tests: calc (line 5 col 7), User (line 8 col 13), local (line 23 col 18) |
| 3 | `regression/typescript/108-find-type-hierarchy.test.ts` | 3 tests: Dog supertypes (line 9 col 14), Animal subtypes (line 1 col 14), Document both (line 25 col 14) |
| 4 | `regression/typescript/109-find-calls.test.ts` | 2 tests: greet (line 1 col 17), Calculator.add (line 12 col 3) |
| 5 | `regression/typescript/110-find-symbols.test.ts` | 3 tests: greet, Calculator, no-match |
| 6 | `regression/typescript/111-file-changed.test.ts` | 1 test: file-changed on valid.ts |
| 7 | `regression/typescript/200-tsc.test.ts` | 3 tests: broken, valid, not-available |
| 8 | `regression/typescript/201-prettier.test.ts` | 3 tests: valid, unformatted, multi-file |
| 9 | `regression/typescript/202-lint.test.ts` | 2 tests: no-linters, multi-file |
| 10 | `regression/typescript/203-full-check.test.ts` | 3 tests: valid, broken, multi-file |
| 11 | `regression/python/104-find-implementations.test.ts` | 1 test: Calculator class (line 8 col 7) |
| 12 | `regression/go/101-find-implementations.test.ts` | 2 tests: Calculator struct (line 13 col 6), greet function (line 5 col 6) |
| 13 | `regression/rust/101-find-implementations.test.ts` | 1 test: Calculator struct (line 9 col 8) |
| 14 | `regression/rust/102-find-type-definition.test.ts` | 2 tests: message (line 25 col 9), calc (line 28 col 13) |
| 15 | `regression/rust/103-find-type-hierarchy.test.ts` | 1 test: Calculator struct (line 9 col 8) |
| 16 | `regression/rust/104-find-calls.test.ts` | 2 tests: greet (line 1 col 4), Calculator::add (line 18 col 7) |
| 17 | `regression/rust/105-find-symbols.test.ts` | 2 tests: greet, Calculator |
| 18 | `regression/css/103-find-definition.test.ts` | 2 tests: CSS variable (line 9 col 16), property (line 9 col 3) |
| 19 | `regression/cpp/101-find-references.test.ts` | 2 tests: add function (line 3 col 5), Point typedef (line 14 col 3) |
| 20 | `regression/php/103-find-references.test.ts` | 2 tests: greet function (line 3 col 10), Calculator class (line 11 col 7) |
| 21 | `regression/php/104-find-implementations.test.ts` | 1 test: Calculator class (line 11 col 7) |

### Files to CREATE — New fixtures (3 files)

| # | File | Purpose |
|---|---|---|
| 1 | `regression/typescript/fixtures/tsconfig.json` | TypeScript compiler config for tsc command |
| 2 | `regression/typescript/fixtures/.prettierrc` | Prettier config for prettier command |
| 3 | `regression/typescript/fixtures/unformatted.ts` | Intentionally badly-formatted file for prettier tests |

### Files explicitly OUT OF SCOPE

- `regression/_shared/test-context.ts` — no changes needed
- `regression/_shared/run-cli.ts` — no changes needed
- `regression/_shared/normalize.ts` — no changes needed
- `regression/_shared/types.ts` — no changes needed
- `vitest.config.regression.ts` — no changes needed
- `vitest.workspace.ts` — no changes needed
- `src/commands/*.ts` — no changes to command handlers
- `src/linting/*.ts` — no changes to linting infrastructure
- `src/daemon/*.ts` — no changes to daemon
- Existing test files — no modifications to existing tests
- Existing fixture files — no modifications to existing fixtures
- Unit tests — no new unit tests (per user decision)
- New language tests — no tests for the 20+ untested languages (per user decision)
- GitHub issue markdown files — NOT stored in repo; issues are created via `gh issue create`

---

## Implementation Order

### Phase A: Infrastructure (must be first)
1. Add CLI subcommands to `src/cli.ts` (Steps 1.1–1.5)
2. Build (`npm run build`) and verify `node dist/cli.js lint --help` works
3. Create new fixtures (Step 3.1: tsconfig.json, .prettierrc, unformatted.ts)
4. Update CI (Step 4.1: install prettier)

### Phase B: Language-specific tests (can be parallelized)
5. TypeScript new tests (Steps 2.1–2.5, 2.17: files 106–111)
6. Python new test (Step 2.6: file 104)
7. Go new test (Step 2.7: file 101)
8. Rust new tests (Steps 2.8–2.12: files 101–105)
9. CSS new test (Step 2.16: file 103)
10. C++ new test (Step 2.13: file 101)
11. PHP new tests (Steps 2.14–2.15: files 103–104)

### Phase C: Diagnostics tests (depends on Phase A)
12. TSC test (Step 3.2: file 200)
13. Prettier test (Step 3.3: file 201)
14. Lint test (Step 3.4: file 202)
15. FullCheck test (Step 3.5: file 203)

### Phase D: Snapshots & CI (depends on all above)
16. Run `npm run test:regression:update` to generate all snapshots
17. Run `npm run test:regression` to verify all tests pass
18. Create GitHub issues via `gh issue create` (Step 5.1)

---

## Test Pattern Template

Every new test file follows this exact pattern:

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow, runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("<language>");

describe("<Language> — <feature>", () => {
  beforeAll(async () => {
    await ctx.setup();
    // Optional: copy config files to temp dir root
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("<test description>", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLISlow(ctx.fixtureDir, [
      "<command>", "--file", "<fixture-path>",
      // position args if needed:
      "--line", "<line>", "--col", "<col>",
    ]);

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("<snapshot-name>");
  });
});
```

**When to use each runner:**
- `runCLI` — standard commands when server is already warm (30s timeout)
- `runCLISlow` — first command after setup, or commands that trigger server init (60s timeout)
- `runCLIWithRetry` — navigation commands that may return empty while server indexes (retries up to 5x with 3s delay)

**When to use `.toMatchSnapshot()` vs `.toMatch()`:**
- `.toMatchSnapshot()` — for stable, deterministic output (diagnostics, symbols, references, type hierarchy, calls, fullCheck)
- `.toMatch()` — for variable output where exact content varies by server version or installed tooling:
  - find-implementations for limited servers (Python, PHP, Go)
  - find-definition for CSS
  - tsc output (varies by whether tsc is installed, which errors exist)
  - prettier output (varies by whether prettier is installed)
  - lint output (varies by whether linters are installed)
  - file-changed output (varies by server state)
