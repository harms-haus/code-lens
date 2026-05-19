import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CommandResult } from "../../src/formatting/output.js";
import { MAX_SYMBOL_RESULTS } from "../../src/formatting/symbols.js";

// ── Mocks ──────────────────────────────────────────────────────────────────

const registeredHandlers = new Map<string, Function>();
vi.mock("../../src/daemon/server.js", () => ({
  registerCommand: (name: string, handler: Function) => {
    registeredHandlers.set(name, handler);
  },
}));

const mockIsServerInstalled = vi.fn();
vi.mock("../../src/lsp/language-config.js", () => ({
  LANGUAGE_SERVERS: [
    {
      language: "typescript",
      command: "typescript-language-server",
      args: ["--stdio"],
      extensions: [".ts", ".tsx", ".js", ".jsx"],
      detectCommand: "typescript-language-server --version",
    },
    {
      language: "python",
      command: "pylsp",
      args: [],
      extensions: [".py"],
      detectCommand: "pylsp --version",
    },
  ],
  isServerInstalled: (...args: unknown[]) => mockIsServerInstalled(...args),
}));

await import("../../src/commands/find-symbols.js");

// ── Helpers ────────────────────────────────────────────────────────────────

function getHandler(): Function {
  const handler = registeredHandlers.get("find-symbols");
  expect(handler).toBeDefined();
  return handler!;
}

function makeSymbol(
  name: string,
  kind: number,
  uri: string,
  line: number,
  containerName?: string,
) {
  return {
    name,
    kind,
    containerName: containerName || "",
    location: {
      uri,
      range: {
        start: { line, character: 0 },
        end: { line, character: 1 },
      },
    },
  };
}

const mockClient = {
  workspaceSymbol: vi.fn(),
};

const mockManager = {
  getClientForConfig: vi.fn(),
  getClientMap: vi.fn().mockReturnValue(new Map()),
};

const defaultCwd = "/project";

/** Set up mockManager so findAvailableClient resolves mockClient */
function setupClientAvailable() {
  mockIsServerInstalled.mockResolvedValue(true);
  mockManager.getClientForConfig.mockResolvedValue(mockClient);
}

/** Set up mockManager so findAvailableClient resolves null (no client) */
function setupNoClient() {
  mockIsServerInstalled.mockResolvedValue(false);
  mockManager.getClientForConfig.mockResolvedValue(null);
  mockManager.getClientMap.mockReturnValue(new Map());
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("find-symbols command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockManager.getClientMap.mockReturnValue(new Map());
  });

  it("returns error when query is empty", async () => {
    const handler = getHandler();
    const result = (await handler(
      { query: "" },
      mockManager,
      defaultCwd,
    )) as CommandResult;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Please provide a symbol query");
  });

  it("returns error when no LSP client is available", async () => {
    setupNoClient();

    const handler = getHandler();
    const result = (await handler(
      { query: "MyClass" },
      mockManager,
      defaultCwd,
    )) as CommandResult;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("No LSP server running");
  });

  it("returns formatted symbol list on successful search", async () => {
    setupClientAvailable();
    mockClient.workspaceSymbol.mockResolvedValue([
      makeSymbol("MyClass", 5, "file:///project/src/index.ts", 10, "MyModule"),
      makeSymbol("myFunc", 12, "file:///project/src/utils.ts", 42),
    ]);

    const handler = getHandler();
    const result = (await handler(
      { query: "my" },
      mockManager,
      defaultCwd,
    )) as CommandResult;

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('Symbols matching "my": 2');
    expect(result.content[0].text).toContain("MyClass [MyModule] (Class)");
    expect(result.content[0].text).toContain("/project/src/index.ts:11");
    expect(result.content[0].text).toContain("myFunc (Function)");
    expect(result.content[0].text).toContain("/project/src/utils.ts:43");
    expect(result.details).toMatchObject({
      query: "my",
      kind: undefined,
      count: 2,
    });
    expect(result.details.symbols).toHaveLength(2);
  });

  it("returns 'No symbols found' when search yields no results", async () => {
    setupClientAvailable();
    mockClient.workspaceSymbol.mockResolvedValue([]);

    const handler = getHandler();
    const result = (await handler(
      { query: "nonexistent" },
      mockManager,
      defaultCwd,
    )) as CommandResult;

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('No symbols found matching "nonexistent"');
    expect(result.details).toMatchObject({
      query: "nonexistent",
      kind: undefined,
      count: 0,
    });
  });

  it("truncates results that exceed MAX_SYMBOL_RESULTS", async () => {
    setupClientAvailable();

    const symbols = Array.from({ length: MAX_SYMBOL_RESULTS + 5 }, (_, i) =>
      makeSymbol(`sym${i}`, 12, `file:///project/src/f${i}.ts`, i),
    );
    mockClient.workspaceSymbol.mockResolvedValue(symbols);

    const handler = getHandler();
    const result = (await handler(
      { query: "sym" },
      mockManager,
      defaultCwd,
    )) as CommandResult;

    expect(result.isError).toBe(false);
    // The count should reflect ALL filtered results
    expect(result.content[0].text).toContain(
      `Symbols matching "sym": ${MAX_SYMBOL_RESULTS + 5}`,
    );
    // There should be a truncation notice
    expect(result.content[0].text).toContain(
      `... and 5 more`,
    );
    // Details symbols should be truncated to MAX_SYMBOL_RESULTS
    expect((result.details.symbols as unknown[]).length).toBe(MAX_SYMBOL_RESULTS);
  });

  it("applies valid kind filter to results", async () => {
    setupClientAvailable();
    mockClient.workspaceSymbol.mockResolvedValue([
      makeSymbol("MyClass", 5, "file:///project/src/a.ts", 1),
      makeSymbol("myFunc", 12, "file:///project/src/b.ts", 2),
      makeSymbol("Helper", 5, "file:///project/src/c.ts", 3),
    ]);

    const handler = getHandler();
    const result = (await handler(
      { query: "my", kind: "class" },
      mockManager,
      defaultCwd,
    )) as CommandResult;

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('kind: class');
    expect(result.content[0].text).toContain("MyClass (Class)");
    expect(result.content[0].text).toContain("Helper (Class)");
    expect(result.content[0].text).not.toContain("myFunc (Function)");
    expect(result.details).toMatchObject({
      query: "my",
      kind: "class",
      count: 2,
    });
  });

  it("returns sanitized error when LSP throws", async () => {
    setupClientAvailable();
    mockClient.workspaceSymbol.mockRejectedValue(new Error("Connection lost"));

    const handler = getHandler();
    const result = (await handler(
      { query: "MyClass" },
      mockManager,
      defaultCwd,
    )) as CommandResult;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Failed to find symbols");
    expect(result.content[0].text).toContain("Connection lost");
    expect(result.details).toMatchObject({ query: "MyClass" });
  });
});
