import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CommandResult } from "../../src/formatting/output.js";
import type { LspClientMethods } from "../../src/lsp/lsp-client-methods.js";
import type {
  CallHierarchyItem,
  CallHierarchyIncomingCall,
  CallHierarchyOutgoingCall,
} from "vscode-languageserver-types";

// ── Mocks ──────────────────────────────────────────────────────────────────

// Will be populated by the registerCommand mock during import
let capturedHandler:
  | ((
      params: Record<string, unknown>,
      manager: unknown,
      cwd: string,
    ) => Promise<CommandResult>)
  | null = null;

const registerCommandMock = vi.fn((_name: string, handler: typeof capturedHandler) => {
  capturedHandler = handler;
});

vi.mock("../../src/daemon/server.js", () => ({
  registerCommand: registerCommandMock,
}));

let preambleResult:
  | { ok: { client: LspClientMethods; uri: string } }
  | { error: CommandResult };

vi.mock("../../src/commands/preamble.js", () => ({
  executePreamble: vi.fn(
    (_file: string, _manager: unknown, _cwd: string) => Promise.resolve(preambleResult),
  ),
}));

vi.mock("../../src/utils/paths.js", () => ({
  uriToFilePath: vi.fn((uri: string) =>
    decodeURIComponent(uri.replace(/^file:\/\//, "")),
  ),
}));

// ── Import SUT (triggers registerCommand) ──────────────────────────────────

// Dynamic import so the mock is in place first
await import("../../src/commands/find-calls.js");

// Sanity: handler must have been captured
if (!capturedHandler) {
  throw new Error("registerCommand was never called — mock setup issue");
}

// ── Helpers ────────────────────────────────────────────────────────────────

function makeCallHierarchyItem(
  name: string,
  uri: string,
  startLine: number,
): CallHierarchyItem {
  return {
    name,
    kind: 12, // Function
    uri,
    range: {
      start: { line: startLine, character: 0 },
      end: { line: startLine, character: name.length },
    },
    selectionRange: {
      start: { line: startLine, character: 0 },
      end: { line: startLine, character: name.length },
    },
  };
}

function makeIncomingCall(
  fromName: string,
  fromUri: string,
  fromLine: number,
  fromRanges: Array<{ line: number }>,
): CallHierarchyIncomingCall {
  const from = makeCallHierarchyItem(fromName, fromUri, fromLine);
  return {
    from,
    fromRanges: fromRanges.map((r) => ({
      start: { line: r.line, character: 0 },
      end: { line: r.line, character: 10 },
    })),
  };
}

function makeOutgoingCall(
  toName: string,
  toUri: string,
  toLine: number,
  fromRanges: Array<{ line: number }>,
): CallHierarchyOutgoingCall {
  const to = makeCallHierarchyItem(toName, toUri, toLine);
  return {
    to,
    fromRanges: fromRanges.map((r) => ({
      start: { line: r.line, character: 0 },
      end: { line: r.line, character: 10 },
    })),
  };
}

function makeClient(overrides: Partial<LspClientMethods> = {}): LspClientMethods {
  return {
    prepareCallHierarchy: vi.fn().mockResolvedValue(null),
    incomingCalls: vi.fn().mockResolvedValue(null),
    outgoingCalls: vi.fn().mockResolvedValue(null),
    ...overrides,
  } as unknown as LspClientMethods;
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("find-calls", () => {
  it("returns ok with incoming + outgoing calls formatted", async () => {
    const item = makeCallHierarchyItem(
      "myFunc",
      "file:///project/src/foo.ts",
      10,
    );
    const incoming = [
      makeIncomingCall("callerA", "file:///project/src/a.ts", 5, [
        { line: 4 },
      ]),
    ];
    const outgoing = [
      makeOutgoingCall("calleeB", "file:///project/src/b.ts", 20, [
        { line: 11 },
      ]),
    ];

    const client = makeClient({
      prepareCallHierarchy: vi.fn().mockResolvedValue([item]),
      incomingCalls: vi.fn().mockResolvedValue(incoming),
      outgoingCalls: vi.fn().mockResolvedValue(outgoing),
    });

    preambleResult = { ok: { client, uri: "file:///project/src/foo.ts" } };

    const result = await capturedHandler!(
      { file: "src/foo.ts", line: 11, col: 1 },
      {},
      "/project",
    );

    expect(result.isError).toBe(false);
    const text = result.content[0].text;

    // Header
    expect(text).toContain('Call hierarchy for "myFunc"');

    // Incoming section
    expect(text).toContain("Incoming Calls (1)");
    expect(text).toContain("callerA");
    expect(text).toContain("/project/src/a.ts:6");
    expect(text).toContain("at line 5");

    // Outgoing section
    expect(text).toContain("Outgoing Calls (1)");
    expect(text).toContain("calleeB");
    expect(text).toContain("/project/src/b.ts:21");
    expect(text).toContain("at line 12");

    // Details metadata
    expect(result.details).toMatchObject({
      functionName: "myFunc",
      incomingCount: 1,
      outgoingCount: 1,
    });
  });

  it("returns 'No call hierarchy available' when no items at position", async () => {
    const client = makeClient({
      prepareCallHierarchy: vi.fn().mockResolvedValue(null),
    });

    preambleResult = { ok: { client, uri: "file:///project/src/foo.ts" } };

    const result = await capturedHandler!(
      { file: "src/foo.ts", line: 5, col: 1 },
      {},
      "/project",
    );

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("No call hierarchy available");
  });

  it("returns error when preamble fails", async () => {
    preambleResult = {
      error: {
        content: [{ type: "text", text: "LSP server not installed" }],
        details: {},
        isError: true,
      },
    };

    const result = await capturedHandler!(
      { file: "src/foo.ts", line: 5, col: 1 },
      {},
      "/project",
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("LSP server not installed");
  });

  it("returns sanitized error when LSP throws on prepareCallHierarchy", async () => {
    const client = makeClient({
      prepareCallHierarchy: vi
        .fn()
        .mockRejectedValue(new Error("internal /home/secret/path crash")),
    });

    preambleResult = { ok: { client, uri: "file:///project/src/foo.ts" } };

    const result = await capturedHandler!(
      { file: "src/foo.ts", line: 5, col: 1 },
      {},
      "/project",
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Failed to get call hierarchy");
    // Home path should be sanitized
    expect(result.content[0].text).not.toContain("/home/secret");
  });

  it("formatCall output format for incoming and outgoing calls", async () => {
    const item = makeCallHierarchyItem(
      "target",
      "file:///project/src/main.ts",
      0,
    );

    // Incoming: two callers, one with multiple fromRanges
    const incoming = [
      makeIncomingCall("alpha", "file:///project/src/a.ts", 3, [
        { line: 2 },
        { line: 8 },
      ]),
      makeIncomingCall("beta", "file:///project/src/b.ts", 7, [
        { line: 10 },
      ]),
    ];

    // Outgoing: one callee with a single fromRange
    const outgoing = [
      makeOutgoingCall("gamma", "file:///project/src/c.ts", 40, [
        { line: 1 },
      ]),
    ];

    const client = makeClient({
      prepareCallHierarchy: vi.fn().mockResolvedValue([item]),
      incomingCalls: vi.fn().mockResolvedValue(incoming),
      outgoingCalls: vi.fn().mockResolvedValue(outgoing),
    });

    preambleResult = { ok: { client, uri: "file:///project/src/main.ts" } };

    const result = await capturedHandler!(
      { file: "src/main.ts", line: 1, col: 1 },
      {},
      "/project",
    );

    expect(result.isError).toBe(false);
    const text = result.content[0].text;

    // ── Incoming call #1: alpha with two fromRanges ──
    // Should show: "  alpha — <path>:<line>" then "    at line X" for each range
    expect(text).toMatch(/alpha — .*\/project\/src\/a\.ts:4/);
    expect(text).toContain("at line 3");
    expect(text).toContain("at line 9");

    // ── Incoming call #2: beta ──
    expect(text).toMatch(/beta — .*\/project\/src\/b\.ts:8/);
    expect(text).toContain("at line 11");

    // ── Outgoing call: gamma ──
    expect(text).toMatch(/gamma — .*\/project\/src\/c\.ts:41/);
    expect(text).toContain("at line 2");
  });
});
