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

await import("../../src/commands/find-type-definition.js");

// ── Helpers ────────────────────────────────────────────────────────────────

function getHandler(): Function {
  const handler = registeredHandlers.get("find-type-definition");
  expect(handler).toBeDefined();
  return handler!;
}

function makeLocation(uri: string, line: number, character: number) {
  return {
    uri,
    range: {
      start: { line, character },
      end: { line, character: character + 1 },
    },
  };
}

const mockClient = {
  findTypeDefinition: vi.fn(),
};

const mockManager = {};
const defaultCwd = "/project";
const validParams = { file: "src/index.ts", line: 10, col: 5 };

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

describe("find-type-definition command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns locations with formatted output and count", async () => {
    setupPreambleSuccess();
    mockClient.findTypeDefinition.mockResolvedValue([
      makeLocation("file:///project/src/types.ts", 42, 7),
      makeLocation("file:///project/src/interfaces.ts", 15, 2),
    ]);

    const handler = getHandler();
    const result = (await handler(validParams, mockManager, defaultCwd)) as CommandResult;

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Type definition found: 2 locations");
    expect(result.details).toMatchObject({
      file: "src/index.ts",
      line: 10,
      col: 5,
      count: 2,
    });
    expect(result.details.locations).toHaveLength(2);
    // Verify 0-indexed LSP positions are converted to 1-indexed
    expect(result.details.locations[0]).toEqual({
      uri: "file:///project/src/types.ts",
      line: 43,
      col: 8,
    });
    expect(result.details.locations[1]).toEqual({
      uri: "file:///project/src/interfaces.ts",
      line: 16,
      col: 3,
    });
  });

  it("returns ok with 0 locations when LSP returns null", async () => {
    setupPreambleSuccess();
    mockClient.findTypeDefinition.mockResolvedValue(null);

    const handler = getHandler();
    const result = (await handler(validParams, mockManager, defaultCwd)) as CommandResult;

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Type definition found: 0 locations");
    expect(result.details).toMatchObject({
      file: "src/index.ts",
      line: 10,
      col: 5,
      count: 0,
    });
    expect(result.details.locations).toHaveLength(0);
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
    mockClient.findTypeDefinition.mockRejectedValue(new Error("Connection lost"));

    const handler = getHandler();
    const result = (await handler(validParams, mockManager, defaultCwd)) as CommandResult;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Failed to find type definition");
    expect(result.content[0].text).toContain("Connection lost");
    expect(result.details).toMatchObject({
      file: "src/index.ts",
      line: 10,
      col: 5,
    });
  });

  it("returns error from extractPositionParams when file is missing", async () => {
    setupPreambleSuccess();

    const handler = getHandler();
    const result = (await handler(
      { line: 10, col: 5 },
      mockManager,
      defaultCwd,
    )) as CommandResult;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Missing or invalid 'file' parameter");
    // Preamble should NOT have been called
    expect(mockExecutePreamble).not.toHaveBeenCalled();
  });
});
