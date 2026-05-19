import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";

// ── Mocks ──────────────────────────────────────────────────────────────────

// Use vi.hoisted so mock constructors/fns are available inside hoisted vi.mock factories
const { MockLspClient, getClientInstance } = vi.hoisted(() => {
  let instance: Record<string, ReturnType<typeof vi.fn>> = {} as any;

  const Ctor = vi.fn().mockImplementation(function (this: any, server: any) {
    instance = {
      startProcess: vi.fn().mockResolvedValue(undefined),
      initialize: vi.fn().mockImplementation(async () => {
        // Real LspClient.initialize sets status to "running"
        server.status = "running";
      }),
      shutdown: vi.fn().mockResolvedValue(undefined),
      kill: vi.fn(),
      isAlive: vi.fn().mockReturnValue(true),
      didOpen: vi.fn(),
      didChange: vi.fn(),
      didClose: vi.fn(),
      requestDiagnostics: vi.fn().mockResolvedValue(undefined),
      request: vi.fn().mockResolvedValue(undefined),
      notify: vi.fn(),
    };
    Object.assign(this, instance);
    return instance;
  });

  return {
    MockLspClient: Ctor,
    getClientInstance: () => instance,
  };
});

vi.mock("../../src/lsp/lsp-client-methods.js", () => ({
  LspClient: MockLspClient,
}));

const { mockLanguageFromPath } = vi.hoisted(() => ({
  mockLanguageFromPath: vi.fn(),
}));

vi.mock("../../src/lsp/language-config.js", (importOriginal) => ({
  ...importOriginal<typeof import("../../src/lsp/language-config.js")>(),
  languageFromPath: (...args: unknown[]) => mockLanguageFromPath(...(args as [string])),
}));

// Suppress fs.readFile in ensureFileOpen tests
vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    promises: {
      ...actual.promises,
      readFile: vi.fn().mockResolvedValue("mock file content"),
    },
  };
});

// ── Import after mocks ─────────────────────────────────────────────────────

import { LspManager } from "../../src/lsp/lsp-manager.js";
import type { LspServerConfig } from "../../src/lsp/types.js";

// ── Helpers ────────────────────────────────────────────────────────────────

const tsConfig: LspServerConfig = {
  language: "typescript",
  command: "typescript-language-server",
  args: ["--stdio"],
  extensions: [".ts"],
  detectCommand: "typescript-language-server --version",
  installCommand: "npm install -g typescript-language-server typescript",
  installInstructions: "npm install -g typescript-language-server typescript",
};

const pyConfig: LspServerConfig = {
  language: "python",
  command: "pylsp",
  args: [],
  extensions: [".py"],
  detectCommand: "pylsp --version",
  installCommand: "pip install python-lsp-server",
  installInstructions: "pip install python-lsp-server",
};

/** Convenience alias */
const mock = getClientInstance;

// ── Tests ──────────────────────────────────────────────────────────────────

describe("LspManager", () => {
  let manager: LspManager;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = new LspManager("/test/workspace");
  });

  afterEach(async () => {
    await manager.stopAll();
  });

  afterAll(() => {
    vi.restoreAllMocks();
  });

  // ── 1. getClientForFile with known extension ─────────────────────────────
  it("getClientForFile starts server and returns client for known extension", async () => {
    mockLanguageFromPath.mockReturnValue(tsConfig);

    const client = await manager.getClientForFile("/test/workspace/index.ts");

    expect(mockLanguageFromPath).toHaveBeenCalledWith("/test/workspace/index.ts");
    expect(MockLspClient).toHaveBeenCalled();
    expect(mock().startProcess).toHaveBeenCalledWith(tsConfig);
    expect(mock().initialize).toHaveBeenCalledWith(tsConfig, expect.any(String));
    expect(client).toBeDefined();
    expect(client).toBe(mock());
  });

  // ── 2. getClientForFile with unknown extension ───────────────────────────
  it("getClientForFile returns null for unknown extension", async () => {
    mockLanguageFromPath.mockReturnValue(undefined);

    const client = await manager.getClientForFile("/test/workspace/file.xyz");

    expect(client).toBeNull();
    expect(MockLspClient).not.toHaveBeenCalled();
  });

  // ── 3. getClientForConfig deduplicates concurrent calls ──────────────────
  it("getClientForConfig deduplicates concurrent calls via startingPromises", async () => {
    mockLanguageFromPath.mockReturnValue(tsConfig);

    // Pre-seed a stopped server entry so both calls enter the restart path
    const servers = (manager as any).state.servers as Map<string, any>;
    servers.set("typescript", { status: "stopped", config: tsConfig });

    let resolveInitialize!: () => void;
    const initPromise = new Promise<void>((resolve) => {
      resolveInitialize = resolve;
    });

    MockLspClient.mockImplementationOnce(function (this: any, server: any) {
      const inst: Record<string, ReturnType<typeof vi.fn>> = {
        startProcess: vi.fn().mockResolvedValue(undefined),
        initialize: vi.fn().mockImplementation(async () => {
          await initPromise;
          server.status = "running";
        }),
        shutdown: vi.fn().mockResolvedValue(undefined),
        kill: vi.fn(),
        isAlive: vi.fn().mockReturnValue(true),
        didOpen: vi.fn(),
        didChange: vi.fn(),
        didClose: vi.fn(),
        requestDiagnostics: vi.fn().mockResolvedValue(undefined),
        request: vi.fn().mockResolvedValue(undefined),
        notify: vi.fn(),
      };
      Object.assign(this, inst);
      return inst;
    });

    // Fire two concurrent getClientForConfig calls
    const p1 = manager.getClientForConfig(tsConfig);
    const p2 = manager.getClientForConfig(tsConfig);

    // Let the initialize complete
    resolveInitialize();

    const [c1, c2] = await Promise.all([p1, p2]);

    // The constructor should only have been called once — deduplication
    expect(MockLspClient).toHaveBeenCalledTimes(1);
    // Both should return a valid client (not null)
    expect(c1).not.toBeNull();
    expect(c2).not.toBeNull();
    // Both should be the exact same client instance
    expect(c1).toBe(c2);
  });

  // ── 4. stopServer → client.shutdown called ───────────────────────────────
  it("stopServer calls client.shutdown", async () => {
    mockLanguageFromPath.mockReturnValue(tsConfig);
    await manager.getClientForFile("/test/workspace/index.ts");

    await manager.stopServer("typescript");

    expect(mock().shutdown).toHaveBeenCalled();
  });

  // ── 5. stopAll → all servers stopped ─────────────────────────────────────
  it("stopAll stops all servers", async () => {
    mockLanguageFromPath
      .mockReturnValueOnce(tsConfig)
      .mockReturnValueOnce(pyConfig);

    await manager.getClientForFile("/test/a.ts");
    await manager.getClientForFile("/test/b.py");

    expect(manager.getClientMap().size).toBe(2);

    await manager.stopAll();

    expect(manager.getClientMap().size).toBe(0);
    expect(manager.getStatus()).toEqual([]);
  });

  // ── 6. getStatus with no servers ─────────────────────────────────────────
  it("getStatus returns empty array with no servers", () => {
    expect(manager.getStatus()).toEqual([]);
  });

  // ── 7. getStatus with running server ─────────────────────────────────────
  it("getStatus includes language, status, and pid for running server", async () => {
    mockLanguageFromPath.mockReturnValue(tsConfig);
    await manager.getClientForFile("/test/workspace/index.ts");

    const status = manager.getStatus();
    expect(status).toHaveLength(1);
    expect(status[0]).toEqual({
      language: "typescript",
      status: "running",
      pid: null,
    });
  });

  // ── 8. getDiagnostics with no server → empty array ───────────────────────
  it("getDiagnostics returns empty array when no server is running", async () => {
    mockLanguageFromPath.mockReturnValue(undefined);

    const diags = await manager.getDiagnostics("/test/workspace/file.xyz");
    expect(diags).toEqual([]);
  });

  // ── 9. getAllDiagnostics merges from all servers ─────────────────────────
  it("getAllDiagnostics merges diagnostics from all servers", async () => {
    mockLanguageFromPath
      .mockReturnValueOnce(tsConfig)
      .mockReturnValueOnce(pyConfig);

    await manager.getClientForFile("/test/a.ts");
    await manager.getClientForFile("/test/b.py");

    // Simulate cached diagnostics via handleDiagnosticsNotification
    manager.handleDiagnosticsNotification("typescript", "file:///test/a.ts", [
      { range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } }, message: "ts error" },
    ] as any);
    manager.handleDiagnosticsNotification("python", "file:///test/b.py", [
      { range: { start: { line: 1, character: 0 }, end: { line: 1, character: 1 } }, message: "py error" },
    ] as any);

    const allDiags = manager.getAllDiagnostics();
    expect(allDiags.size).toBe(2);
    expect(allDiags.get("file:///test/a.ts")).toHaveLength(1);
    expect(allDiags.get("file:///test/b.py")).toHaveLength(1);
  });

  // ── 10. ensureFileOpen → calls didOpen/didChange based on version ────────
  it("ensureFileOpen calls didOpen on first open, didChange on subsequent", async () => {
    mockLanguageFromPath.mockReturnValue(tsConfig);
    const client = await manager.getClientForFile("/test/workspace/index.ts");
    expect(client).toBeDefined();

    // First open → didOpen (version 0 → 1)
    await manager.ensureFileOpen(client!, tsConfig, "/test/workspace/index.ts");
    expect(mock().didOpen).toHaveBeenCalledWith(
      expect.any(String),
      "typescript",
      1,
      expect.any(String),
    );
    expect(mock().didChange).not.toHaveBeenCalled();

    // Second open → didChange (version 1 → 2)
    mock().didOpen.mockClear();
    await manager.ensureFileOpen(client!, tsConfig, "/test/workspace/index.ts");

    expect(mock().didOpen).not.toHaveBeenCalled();
    expect(mock().didChange).toHaveBeenCalledWith(
      expect.any(String),
      2,
      expect.any(String),
    );
  });
});
