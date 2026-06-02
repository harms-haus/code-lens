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
vi.mock("../../src/utils/paths.js", () => ({
  uriToFilePath: (uri: string) => decodeURIComponent(uri.replace(/^file:\/\//, "")),
  flattenLocations: (result: unknown) => {
    if (Array.isArray(result)) return result;
    if (result && typeof result === "object" && "uri" in (result as object)) return [result];
    return [];
  },
  formatLocations: (locations: { uri: string; range: { start: { line: number; character: number } } }[]) =>
    locations.length > 0
      ? locations
          .map(
            (l) =>
              `  ${decodeURIComponent(l.uri.replace(/^file:\/\//, ""))}:${l.range.start.line + 1}:${l.range.start.character + 1}`,
          )
          .join("\n")
      : "(none)",
}));

await import("../../src/commands/find-implementations.js");

// ── Helpers ────────────────────────────────────────────────────────────────

function getHandler(): Function {
  const handler = registeredHandlers.get("find-implementations");
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
  findImplementations: vi.fn(),
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

describe("find-implementations command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns locations with formatted output and count", async () => {
    setupPreambleSuccess();
    mockClient.findImplementations.mockResolvedValue([
      makeLocation("file:///project/src/impl-a.ts", 30, 0),
      makeLocation("file:///project/src/impl-b.ts", 12, 8),
    ]);

    const handler = getHandler();
    const result = (await handler(validParams, mockManager, defaultCwd)) as CommandResult;

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Implementations found: 2 locations");
    expect(result.details).toMatchObject({
      file: "src/index.ts",
      line: 10,
      col: 5,
      count: 2,
    });
    expect(result.details.implementations).toHaveLength(2);
    // Verify 0-indexed LSP positions are converted to 1-indexed
    expect(result.details.implementations[0]).toEqual({
      uri: "file:///project/src/impl-a.ts",
      line: 31,
      col: 1,
    });
    expect(result.details.implementations[1]).toEqual({
      uri: "file:///project/src/impl-b.ts",
      line: 13,
      col: 9,
    });
  });

  it("returns ok with 0 locations when LSP returns null", async () => {
    setupPreambleSuccess();
    mockClient.findImplementations.mockResolvedValue(null);

    const handler = getHandler();
    const result = (await handler(validParams, mockManager, defaultCwd)) as CommandResult;

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Implementations found: 0 locations");
    expect(result.details).toMatchObject({
      file: "src/index.ts",
      line: 10,
      col: 5,
      count: 0,
    });
    expect(result.details.implementations).toHaveLength(0);
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
    mockClient.findImplementations.mockRejectedValue(new Error("Connection lost"));

    const handler = getHandler();
    const result = (await handler(validParams, mockManager, defaultCwd)) as CommandResult;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Failed to find implementations");
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
