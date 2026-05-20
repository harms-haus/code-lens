# Contributing to @harms-haus/code-lens

Thanks for your interest in contributing! This guide covers everything you need to get started.

## Prerequisites

- **Node.js** >= 20.0.0
- **npm** (bundled with Node.js)

## Setup

```bash
git clone <repo-url>
cd code-lens-cli
npm ci
```

## Development Commands

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript to `dist/` via tsup |
| `npm test` | Run all tests once |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Run tests with v8 coverage report |
| `npm run lint` | Lint `src/` with ESLint |
| `npm run lint:fix` | Lint and auto-fix |
| `npm run format` | Format `src/**/*.ts` with Prettier |
| `npm run format:check` | Check formatting without writing |
| `npm run typecheck` | Run `tsc --noEmit` for type errors |
| `npm run test:regression` | Run regression tests against real LSP servers |
| `npm run test:regression:update` | Run regression tests and update snapshots |

## Running Locally

Build first, then run the CLI directly:

```bash
npm run build
node dist/cli.js <command> [options]
```

For example:

```bash
node dist/cli.js status
node dist/cli.js diagnostics --file=src/index.ts
```

## Testing

Tests use [Vitest](https://vitest.dev/) and live in the `tests/` directory, mirroring the `src/` structure.

### Running Tests

```bash
# Run once
npm test

# Watch mode
npm run test:watch

# With coverage
npm run test:coverage
```

### Test Setup

The global setup file (`tests/setup.ts`) mocks Node.js built-in modules (`node:child_process`, `node:net`, `node:readline`) so tests don't spawn real processes or open network connections.

### Writing New Tests

#### Test File Structure

Place test files under `tests/` in a subdirectory matching the source module:

```
tests/
  commands/       → mirrors src/commands/
  daemon/         → mirrors src/daemon/
  lsp/            → mirrors src/lsp/
  formatting/     → mirrors src/formatting/
  utils/          → mirrors src/utils/
```

Import Vitest primitives at the top of every test file:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
```

#### Mock Patterns

**Mocking internal modules** — use `vi.mock()` with a factory. Place mocks **before** the imports they affect:

```ts
const mockHover = vi.fn();

vi.mock("../../src/commands/preamble.js", () => ({
  executePreamble: vi.fn(),
}));

vi.mock("../../src/daemon/server.js", () => ({
  registerCommand: (name: string, handler: Function) => {
    // capture handler for testing
  },
}));

// Import after mocks are set up
import { executePreamble } from "../../src/commands/preamble.js";
```

**Mocking LSP client methods** — create plain objects with `vi.fn()` properties:

```ts
function makeMockClient() {
  return {
    hover: vi.fn(),
    references: vi.fn(),
    definition: vi.fn(),
    // ...other methods as needed
  };
}
```

**Setting up preamble resolution** — mock `executePreamble` to return an `ok` or `error` result:

```ts
vi.mocked(executePreamble).mockResolvedValue({
  ok: {
    filePath: "/cwd/test.ts",
    config: { language: "typescript" } as any,
    client: makeMockClient(),
    uri: "file:///cwd/test.ts",
  },
});
```

**Asserting formatted output** — test against the plain-text output that commands produce:

```ts
const result = await callHandler({
  file: "test.ts",
  line: 10,
  col: 5,
});
expect(result).toContain("Hover info at");
```

### Regression Tests

Regression tests are end-to-end tests that exercise the full CLI → daemon → LSP server pipeline. They spawn real language servers, run actual CLI commands, and assert against snapshot output — unlike unit tests which mock everything.

They live in the `regression/` directory, organized by language:

```
regression/
  _shared/           → shared utilities (test context, CLI runner, output normalization)
  typescript/        → TypeScript regression tests and fixtures
  python/            → Python regression tests and fixtures
  go/                → Go regression tests and fixtures
  ...                → one subdirectory per supported language
```

#### Running Regression Tests

```bash
# Run all regression tests (up to 5 languages in parallel, 1 test at a time per language)
npm run test:regression

# Run and update snapshots (e.g. after intentional output changes)
npm run test:regression:update
```

#### Key Details

- **Separate Vitest config** — uses `vitest.config.regression.ts` with **no global mocks** (unlike `tests/setup.ts`), extended timeouts (2 min per test), and the `forks` pool for process isolation.
- **Workspace-based concurrency** — `vitest.workspace.ts` defines one Vitest project per language, each with `maxForks: 1`. Vitest runs up to 5 projects concurrently. This prevents daemon port collisions and ensures predictable LSP server behavior.
- **Graceful skip** — each test context auto-detects whether the language server is installed. Tests skip automatically when the server isn't available, so you only need the servers for languages you're actively testing.
- **Unique temp directories** — each test run copies fixtures into a fresh temp directory (`RegressionTestContext`), ensuring full isolation between runs.
- **Snapshot assertions** — most regression tests normalize output (strip absolute paths, timing info) and compare against Vitest snapshots. Use `--update` to refresh them.

#### Writing a New Regression Test

1. Add fixture files to `regression/<language>/fixtures/`.
2. Create a test file in `regression/<language>/` (e.g., `100-diagnostics.test.ts`).
3. Use `RegressionTestContext` from `_shared/test-context.ts` for setup/teardown.
4. Use `runCLI` / `runCLISlow` helpers and `normalizeOutput` to produce deterministic, snapshot-friendly output.
5. Assert with `expect(normalized).toMatchSnapshot("name")`.

## Code Style

- **Linter**: ESLint with `typescript-eslint` and `eslint-config-prettier`
- **Formatter**: Prettier
- **Module system**: ESM (`"type": "module"` in `package.json`)
- **Import extensions**: Always use `.js` extensions in TypeScript imports (e.g., `import { foo } from "./bar.js"`) — the project uses bundler module resolution
- **Type imports**: Use `import type` for type-only imports

Before committing, make sure both pass:

```bash
npm run lint
npm run format:check
```

## PR Process

1. **Create a branch** from `main` with a descriptive name
2. **Make your changes** and add/update tests
3. **Ensure all checks pass**:
   - `npm run typecheck` — no type errors
   - `npm run lint` — no lint errors
   - `npm run format:check` — formatting is clean
   - `npm test` — all tests pass
   - `npm run test:coverage` — meets coverage thresholds (statements ≥ 65%, branches ≥ 55%, functions ≥ 65%, lines ≥ 65%)
4. **Open a pull request** with a description of the changes, the motivation, and any relevant context

CI runs all of the above on every PR — all checks must be green before merging. Regression tests (`npm run test:regression`) also run in CI and should pass for all languages that have servers installed in the CI environment.

## Project Structure

```
code-lens-cli/
├── src/
│   ├── cli.ts              # CLI entry point (commander program)
│   ├── server.ts           # Daemon entry point
│   ├── lib.ts              # Library barrel export
│   ├── lib-client.ts       # Client-facing library barrel export
│   ├── lib-lsp.ts          # LSP library barrel export
│   ├── commands/           # Command handlers (one file per command)
│   │   ├── diagnostics.ts
│   │   ├── file-changed.ts
│   │   ├── find-calls.ts
│   │   ├── find-definition.ts
│   │   ├── find-document-symbols.ts
│   │   ├── find-implementations.ts
│   │   ├── find-references.ts
│   │   ├── find-symbols.ts
│   │   ├── find-type-definition.ts
│   │   ├── find-type-hierarchy.ts
│   │   ├── fullCheck.ts
│   │   ├── hover.ts
│   │   ├── lint.ts
│   │   ├── params.ts
│   │   ├── preamble.ts
│   │   ├── prettier.ts
│   │   ├── rename-symbol.ts
│   │   ├── status.ts
│   │   └── tsc.ts
│   ├── daemon/             # Daemon server, client, lifecycle, protocol
│   ├── linting/            # Linting infrastructure (9 files)
│   │   ├── types.ts            # Shared linting types
│   │   ├── parsers.ts          # Linter output parsers
│   │   ├── definitions.ts      # Linter definitions and configs
│   │   ├── linter-registry.ts  # Linter registration registry
│   │   ├── linter-runner.ts    # Generic linter runner
│   │   ├── prettier-runner.ts  # Prettier runner
│   │   ├── tsc-runner.ts       # TypeScript compiler runner
│   │   ├── bash-file-detector.ts # Shell script detection
│   │   └── output-formatter.ts  # Lint result formatting
│   ├── lsp/                # LSP client wrapper, manager, language configs
│   ├── formatting/         # Output formatting utilities
│   └── utils/              # Path, socket, env utilities
│       └── spawn.ts        # Child process spawning helpers
├── tests/
│   ├── setup.ts            # Global test setup (mocks node: built-ins)
│   ├── commands/           # Command handler tests
│   ├── daemon/             # Daemon tests
│   ├── lsp/                # LSP client/manager tests
│   ├── formatting/         # Formatting tests
│   └── utils/              # Utility tests
├── regression/               # End-to-end regression tests
│   ├── _shared/                  # Shared test context, CLI runner, output normalization
│   ├── typescript/               # TypeScript regression tests + fixtures
│   ├── python/                   # Python regression tests + fixtures
│   ├── go/                       # Go regression tests + fixtures
│   └── ...                       # One subdirectory per supported language
├── docs/                   # Documentation
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── vitest.config.regression.ts   # Regression test config (no mocks, extended timeouts)
├── vitest.workspace.ts           # Per-language workspace projects for regression tests
└── README.md
```
