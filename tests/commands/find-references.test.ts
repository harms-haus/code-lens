import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CommandResult } from "../../src/formatting/output.js";

const registeredHandlers = new Map<string, Function>();
vi.mock("../../src/daemon/server.js", () => ({
  registerCommand: (name: string, handler: Function) => {
    registeredHandlers.set(name, handler);
  },
}));

const mockExecutePreamble = vi.fn();
vi.mock("../../src/commands/preamble.js", () => ({
  executePreamble: (...args: unknown[]) => mockExecutePreamble(...args),
}));

await import("../../src/commands/find-references.js");

// ── Helpers ────────────────────────────────────────────────────────────────

function getHandler(): Function {
  const handler = registeredHandlers.get("find-references");
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
  findReferences: vi.fn(),
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

describe("find-references command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns locations with formatted output and count", async () => {
    setupPreambleSuccess();
    mockClient.findReferences.mockResolvedValue([
      makeLocation("file:///project/src/other.ts", 20, 3),
      makeLocation("file:///project/src/utils.ts", 5, 10),
    ]);

    const handler = getHandler();
    const result = (await handler(validParams, mockManager, defaultCwd)) as CommandResult;

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("References found: 2 locations");
    expect(result.details).toMatchObject({
      file: "src/index.ts",
      line: 10,
      col: 5,
      count: 2,
    });
    expect(result.details.references).toHaveLength(2);
    // Verify 0-indexed LSP positions are converted to 1-indexed
    expect(result.details.references[0]).toEqual({
      uri: "file:///project/src/other.ts",
      line: 21,
      col: 4,
    });
    expect(result.details.references[1]).toEqual({
      uri: "file:///project/src/utils.ts",
      line: 6,
      col: 11,
    });
  });

  it("returns ok with 0 locations when LSP returns null", async () => {
    setupPreambleSuccess();
    mockClient.findReferences.mockResolvedValue(null);

    const handler = getHandler();
    const result = (await handler(validParams, mockManager, defaultCwd)) as CommandResult;

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("References found: 0 locations");
    expect(result.details).toMatchObject({
      file: "src/index.ts",
      line: 10,
      col: 5,
      count: 0,
    });
    expect(result.details.references).toHaveLength(0);
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
    mockClient.findReferences.mockRejectedValue(new Error("Connection lost"));

    const handler = getHandler();
    const result = (await handler(validParams, mockManager, defaultCwd)) as CommandResult;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Failed to find references");
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
