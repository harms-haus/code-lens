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

const mockReadFileSync = vi.fn();
const mockRealpathSync = vi.fn((p: string) => p);
vi.mock("node:fs", () => ({
  readFileSync: (...args: unknown[]) => mockReadFileSync(...args),
  realpathSync: (...args: unknown[]) => mockRealpathSync(...args),
}));

await import("../../src/commands/rename-symbol.js");

// ── Helpers ────────────────────────────────────────────────────────────────

function getHandler(): Function {
  const handler = registeredHandlers.get("rename-symbol");
  expect(handler).toBeDefined();
  return handler!;
}

function makeTextEdit(
  startLine: number,
  startChar: number,
  endLine: number,
  endChar: number,
  newText: string,
) {
  return {
    range: {
      start: { line: startLine, character: startChar },
      end: { line: endLine, character: endChar },
    },
    newText,
  };
}

const mockClient = {
  prepareRename: vi.fn(),
  rename: vi.fn(),
};

const mockManager = {};
const defaultCwd = "/project";
const defaultFilePath = "/project/src/index.ts";
const defaultUri = "file:///project/src/index.ts";
const defaultFileContent = "const foo = 1;\nconst bar = foo + 2;\n";

const validParams = { file: "src/index.ts", line: 1, col: 7, newName: "baz" };

function setupPreambleSuccess() {
  mockExecutePreamble.mockResolvedValue({
    ok: {
      filePath: defaultFilePath,
      config: { language: "typescript" },
      client: mockClient,
      uri: defaultUri,
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

function setupFsMock(fileContent: string = defaultFileContent) {
  mockReadFileSync.mockReturnValue(fileContent);
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("rename-symbol command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Test 1: documentChanges format ─────────────────────────────────────

  it("returns ok with diff patch when WorkspaceEdit contains documentChanges", async () => {
    setupPreambleSuccess();
    setupFsMock();

    mockClient.prepareRename.mockResolvedValue({
      placeholder: "foo",
      range: {
        start: { line: 0, character: 6 },
        end: { line: 0, character: 9 },
      },
    });

    mockClient.rename.mockResolvedValue({
      documentChanges: [
        {
          textDocument: { uri: "file:///project/src/index.ts" },
          edits: [makeTextEdit(0, 6, 0, 9, "baz")],
        },
        {
          textDocument: { uri: "file:///project/src/other.ts" },
          edits: [makeTextEdit(5, 0, 5, 3, "baz")],
        },
      ],
    });

    const handler = getHandler();
    const result = (await handler(validParams, mockManager, defaultCwd)) as CommandResult;

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('Rename "foo" → "baz"');
    expect(result.content[0].text).toContain("Files affected: 2");
    expect(result.content[0].text).toContain("Patch:");
    expect(result.details).toMatchObject({
      file: "src/index.ts",
      oldName: "foo",
      newName: "baz",
      fileCount: 2,
    });
    expect(result.details.patch).toContain("--- a//project/src/index.ts");
    expect(result.details.patch).toContain("--- a//project/src/other.ts");
  });

  // ── Test 2: legacy changes format ──────────────────────────────────────

  it("returns ok with diff patch when WorkspaceEdit uses legacy changes format", async () => {
    setupPreambleSuccess();
    setupFsMock();

    mockClient.prepareRename.mockResolvedValue({
      placeholder: "foo",
      range: {
        start: { line: 0, character: 6 },
        end: { line: 0, character: 9 },
      },
    });

    mockClient.rename.mockResolvedValue({
      changes: {
        "file:///project/src/index.ts": [makeTextEdit(0, 6, 0, 9, "baz")],
        "file:///project/src/utils.ts": [makeTextEdit(2, 4, 2, 7, "baz")],
      },
    });

    const handler = getHandler();
    const result = (await handler(validParams, mockManager, defaultCwd)) as CommandResult;

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain('Rename "foo" → "baz"');
    expect(result.content[0].text).toContain("Files affected: 2");
    expect(result.details).toMatchObject({
      file: "src/index.ts",
      oldName: "foo",
      newName: "baz",
      fileCount: 2,
    });
    expect(result.details.patch).toContain("--- a//project/src/index.ts");
    expect(result.details.patch).toContain("--- a//project/src/utils.ts");
  });

  // ── Test 3: WorkspaceEdit is null ──────────────────────────────────────

  it("returns 'No changes generated' when WorkspaceEdit is null", async () => {
    setupPreambleSuccess();
    setupFsMock();

    mockClient.prepareRename.mockResolvedValue({
      placeholder: "foo",
      range: {
        start: { line: 0, character: 6 },
        end: { line: 0, character: 9 },
      },
    });

    mockClient.rename.mockResolvedValue(null);

    const handler = getHandler();
    const result = (await handler(validParams, mockManager, defaultCwd)) as CommandResult;

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("No changes generated");
    expect(result.details).toMatchObject({
      file: "src/index.ts",
      oldName: "foo",
      newName: "baz",
      fileCount: 0,
    });
  });

  // ── Test 4: prepareRename throws → falls back to extractWordAtPosition ─

  it("falls back to extractWordAtPosition when prepareRename throws", async () => {
    setupPreambleSuccess();
    setupFsMock("const myVar = 42;\n");

    mockClient.prepareRename.mockRejectedValue(new Error("not supported"));
    mockClient.rename.mockResolvedValue(null);

    const handler = getHandler();
    const result = (await handler(
      { file: "src/index.ts", line: 1, col: 7, newName: "newVar" },
      mockManager,
      defaultCwd,
    )) as CommandResult;

    expect(result.isError).toBe(false);
    // prepareRename threw, so it falls through to extractWordAtPosition
    // line=1, col=7 → 0-indexed: line=0, col=6 → "myVar" starts at char 6
    expect(result.details).toMatchObject({
      oldName: "myVar",
      newName: "newVar",
    });
  });

  // ── Test 5: rename throws → sanitized error ────────────────────────────

  it("returns sanitized error when rename throws", async () => {
    setupPreambleSuccess();
    setupFsMock();

    mockClient.prepareRename.mockResolvedValue({
      placeholder: "foo",
      range: {
        start: { line: 0, character: 6 },
        end: { line: 0, character: 9 },
      },
    });

    mockClient.rename.mockRejectedValue(new Error("Server crashed"));

    const handler = getHandler();
    const result = (await handler(validParams, mockManager, defaultCwd)) as CommandResult;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Failed to rename symbol");
    expect(result.content[0].text).toContain("Server crashed");
    expect(result.details).toMatchObject({ file: "src/index.ts" });
  });

  // ── Test 6: Invalid params (missing newName) ───────────────────────────

  it("returns error when newName is missing from params", async () => {
    const handler = getHandler();
    const result = (await handler(
      { file: "src/index.ts", line: 10, col: 5 },
      mockManager,
      defaultCwd,
    )) as CommandResult;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("newName");
    // Preamble should NOT have been called
    expect(mockExecutePreamble).not.toHaveBeenCalled();
  });
});
