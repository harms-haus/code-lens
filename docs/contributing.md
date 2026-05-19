# Contributing to code-lens-cli

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

CI runs all of the above on every PR — all checks must be green before merging.

## Project Structure

```
code-lens-cli/
├── src/
│   ├── cli.ts              # CLI entry point (commander program)
│   ├── server.ts           # Daemon entry point
│   ├── commands/           # Command handlers (one file per command)
│   ├── daemon/             # Daemon server, client, lifecycle, protocol
│   ├── lsp/                # LSP client wrapper, manager, language configs
│   ├── formatting/         # Output formatting utilities
│   └── utils/              # Path, socket, env utilities
├── tests/
│   ├── setup.ts            # Global test setup (mocks node: built-ins)
│   ├── commands/           # Command handler tests
│   ├── daemon/             # Daemon tests
│   ├── lsp/                # LSP client/manager tests
│   ├── formatting/         # Formatting tests
│   └── utils/              # Utility tests
├── docs/                   # Documentation
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```
