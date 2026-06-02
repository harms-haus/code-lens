import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CommandResult } from "../../src/formatting/output.js";

const { registeredHandlers, mockExecutePreamble } = vi.hoisted(() => {
  return { registeredHandlers: new Map<string, Function>(), mockExecutePreamble: vi.fn() };
});
vi.mock("../../src/daemon/server.js", () => ({
  registerCommand: (name: string, handler: Function) => {
    registeredHandlers.set(name, handler);
  },
}));
vi.mock("../../src/commands/preamble.js", () => ({
  executePreamble: (...args: unknown[]) => mockExecutePreamble(...args),
}));

await import("../../src/commands/find-document-symbols.js");

// ── Helpers ────────────────────────────────────────────────────────────────

function getHandler(): Function {
  const handler = registeredHandlers.get("find-document-symbols");
  expect(handler).toBeDefined();
  return handler!;
}

function makeDocSymbol(
  name: string,
  kind: number,
  startLine: number,
  children?: ReturnType<typeof makeDocSymbol>[],
): { name: string; kind: number; range: { start: { line: number }; end: { line: number } }; children?: ReturnType<typeof makeDocSymbol>[] } {
  return {
    name,
    kind,
    range: { start: { line: startLine }, end: { line: startLine } },
    ...(children ? { children } : {}),
  };
}

function makeSymInfo(
  name: string,
  kind: number,
  uri: string,
  startLine: number,
) {
  return {
    name,
    kind,
    location: {
      uri,
      range: {
        start: { line: startLine, character: 0 },
        end: { line: startLine, character: 10 },
      },
    },
  };
}

const mockClient = {
  documentSymbol: vi.fn(),
};

const mockManager = {};
const defaultCwd = "/project";
const validParams = { file: "src/index.ts" };

function setupPreambleSuccess() {
  mockExecutePreamble.mockResolvedValue({
    ok: {
      filePath: "/project/src/index.ts",
      config: { language: "typescript" },
      client: mockClient,
      uri: "file:///project/src/index.ts",
    },
  });
}

function setupPreambleError(message: string) {
  mockExecutePreamble.mockResolvedValue({
    error: {
      content: [{ type: "text" as const, text: message }],
      details: { file: "src/index.ts" },
      isError: true,
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("find-document-symbols command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("formats DocumentSymbol[] result (hierarchical) with indentation", async () => {
    setupPreambleSuccess();
    // Hierarchical: parent class with a child method
    mockClient.documentSymbol.mockResolvedValue([
      makeDocSymbol("MyClass", 5, 0, [
        makeDocSymbol("constructor", 9, 2),
        makeDocSymbol("myMethod", 6, 5),
      ]),
      makeDocSymbol("helper", 12, 20),
    ]);

    const handler = getHandler();
    const result = (await handler(validParams, mockManager, defaultCwd)) as CommandResult;

    expect(result.isError).toBe(false);
    // Check the formatted text contains hierarchical output with indentation
    expect(result.content[0].text).toContain("Class MyClass (line 1)");
    expect(result.content[0].text).toContain("  Constructor constructor (line 3)");
    expect(result.content[0].text).toContain("  Method myMethod (line 6)");
    expect(result.content[0].text).toContain("Function helper (line 21)");
    expect(result.content[0].text).toContain("4 symbols found");
    // Check details
    expect(result.details).toMatchObject({
      file: "src/index.ts",
      count: 4,
    });
    expect(result.details.symbols).toHaveLength(4);
    expect(result.details.symbols[0]).toEqual({
      name: "MyClass",
      kind: "5",
      line: 1,
    });
    expect(result.details.symbols[1]).toEqual({
      name: "constructor",
      kind: "9",
      line: 3,
    });
  });

  it("formats SymbolInformation[] result (flat) as flat list", async () => {
    setupPreambleSuccess();
    // Flat SymbolInformation results (no `children` property)
    mockClient.documentSymbol.mockResolvedValue([
      makeSymInfo("foo", 12, "file:///project/src/index.ts", 0),
      makeSymInfo("bar", 13, "file:///project/src/index.ts", 10),
    ]);

    const handler = getHandler();
    const result = (await handler(validParams, mockManager, defaultCwd)) as CommandResult;

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Function foo (line 1)");
    expect(result.content[0].text).toContain("Variable bar (line 11)");
    expect(result.content[0].text).toContain("2 symbols found");
    expect(result.details).toMatchObject({
      file: "src/index.ts",
      count: 2,
    });
    expect(result.details.symbols).toHaveLength(2);
    expect(result.details.symbols[0]).toEqual({
      name: "foo",
      kind: "12",
      line: 1,
    });
  });

  it("returns 'No symbols found' when LSP returns null", async () => {
    setupPreambleSuccess();
    mockClient.documentSymbol.mockResolvedValue(null);

    const handler = getHandler();
    const result = (await handler(validParams, mockManager, defaultCwd)) as CommandResult;

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("No symbols found");
    expect(result.details).toMatchObject({
      file: "src/index.ts",
      count: 0,
    });
    expect(result.details.symbols).toHaveLength(0);
  });

  it("returns 'No symbols found' when LSP returns empty array", async () => {
    setupPreambleSuccess();
    mockClient.documentSymbol.mockResolvedValue([]);

    const handler = getHandler();
    const result = (await handler(validParams, mockManager, defaultCwd)) as CommandResult;

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("No symbols found");
    expect(result.details).toMatchObject({
      file: "src/index.ts",
      count: 0,
    });
  });

  it("returns error when preamble fails", async () => {
    setupPreambleError("LSP server not installed");

    const handler = getHandler();
    const result = (await handler(validParams, mockManager, defaultCwd)) as CommandResult;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("LSP server not installed");
  });

  it("returns sanitized error when LSP client throws", async () => {
    setupPreambleSuccess();
    mockClient.documentSymbol.mockRejectedValue(new Error("Connection lost"));

    const handler = getHandler();
    const result = (await handler(validParams, mockManager, defaultCwd)) as CommandResult;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Failed to get document symbols");
    expect(result.content[0].text).toContain("Connection lost");
    expect(result.details).toMatchObject({
      file: "src/index.ts",
    });
  });
});
