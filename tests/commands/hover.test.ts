import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Capture registered handlers ────────────────────────────────────────────

const registeredHandlers = new Map<string, Function>();

vi.mock("../../src/daemon/server.js", () => ({
  registerCommand: (name: string, handler: Function) => {
    registeredHandlers.set(name, handler);
  },
}));

// ── Mock preamble ──────────────────────────────────────────────────────────

const mockHover = vi.fn();

vi.mock("../../src/commands/preamble.js", () => ({
  executePreamble: vi.fn(),
}));

// Import after mocks are set up so the module-level registerCommand call is captured
import { executePreamble } from "../../src/commands/preamble.js";

// ── Helpers ────────────────────────────────────────────────────────────────

/** Helper to make a mock LspClientMethods with a controllable hover method */
function makeMockClient() {
  return { hover: mockHover };
}

/** Invoke the captured hover handler with given params and a mock client */
async function callHandler(
  params: Record<string, unknown>,
  client: ReturnType<typeof makeMockClient> = makeMockClient(),
) {
  const handler = registeredHandlers.get("hover");
  if (!handler) throw new Error("hover handler was not registered");
  return handler(params, { getClientForFile: vi.fn() } as any, "/cwd");
}

/** Shorthand to set up executePreamble to resolve with the given client */
function setupPreambleSuccess(client: ReturnType<typeof makeMockClient>) {
  vi.mocked(executePreamble).mockResolvedValue({
    ok: {
      filePath: "/cwd/test.ts",
      config: { language: "typescript" } as any,
      client,
      uri: "file:///cwd/test.ts",
    },
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("hover command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registeredHandlers.clear();
    // Re-import module so registerCommand fires again with fresh map
    vi.resetModules();
  });

  // We need to re-import inside each test so the module-level side effect runs
  // after our mock map is in place. We use a helper for that.
  async function importHoverModule() {
    await import("../../src/commands/hover.js");
  }

  it("successful hover with string contents → ok result with formatted content", async () => {
    await importHoverModule();
    const client = makeMockClient();
    setupPreambleSuccess(client);

    mockHover.mockResolvedValue({
      contents: "string hover content",
      range: {
        start: { line: 4, character: 9 },
        end: { line: 4, character: 15 },
      },
    });

    const result = await callHandler({ file: "test.ts", line: 5, col: 10 });

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("string hover content");
    expect(result.content[0].text).toContain("Hover info at test.ts:5:10");
    expect(result.content[0].text).toContain("Range: line 5:10 to line 5:16");
    expect(result.details).toMatchObject({
      file: "test.ts",
      line: 5,
      col: 10,
      hoverContent: "string hover content",
    });
  });

  it("hover returns null → ok result with 'No hover information available'", async () => {
    await importHoverModule();
    const client = makeMockClient();
    setupPreambleSuccess(client);

    mockHover.mockResolvedValue(null);

    const result = await callHandler({ file: "test.ts", line: 5, col: 10 });

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("No hover information available");
    expect(result.details).toMatchObject({
      file: "test.ts",
      hoverContent: null,
      range: null,
    });
  });

  it("preamble error → returns error result", async () => {
    await importHoverModule();

    vi.mocked(executePreamble).mockResolvedValue({
      error: {
        content: [{ type: "text" as const, text: "LSP server not installed" }],
        details: { file: "test.ts" },
        isError: true,
      },
    });

    const result = await callHandler({ file: "test.ts", line: 5, col: 10 });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("LSP server not installed");
  });

  it("LSP throws → returns sanitized error", async () => {
    await importHoverModule();
    const client = makeMockClient();
    setupPreambleSuccess(client);

    mockHover.mockRejectedValue(new Error("connection lost at /home/user/project"));

    const result = await callHandler({ file: "test.ts", line: 5, col: 10 });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Failed to get hover information");
    // Home directory path should be sanitized
    expect(result.content[0].text).not.toContain("/home/user");
    expect(result.content[0].text).toContain("~");
  });

  it("hover with MarkupContent → returns the value", async () => {
    await importHoverModule();
    const client = makeMockClient();
    setupPreambleSuccess(client);

    mockHover.mockResolvedValue({
      contents: {
        kind: "markdown",
        value: "**bold** and `code`",
      },
    });

    const result = await callHandler({ file: "test.ts", line: 5, col: 10 });

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("**bold** and `code`");
    expect(result.details.hoverContent).toBe("**bold** and `code`");
  });

  it("hover with array of contents → joined with double newlines", async () => {
    await importHoverModule();
    const client = makeMockClient();
    setupPreambleSuccess(client);

    mockHover.mockResolvedValue({
      contents: [
        "first part",
        { kind: "plaintext" as const, value: "second part" },
      ],
    });

    const result = await callHandler({ file: "test.ts", line: 5, col: 10 });

    expect(result.isError).toBe(false);
    // Array contents should be joined with \n\n
    expect(result.details.hoverContent).toBe("first part\n\nsecond part");
    expect(result.content[0].text).toContain("first part\n\nsecond part");
  });
});
