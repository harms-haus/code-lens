import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock setup ──────────────────────────────────────────────────────────────

// Capture mock implementations before they're used by the module under test
const mockResolveFile = vi.fn();
const mockFilePathToUri = vi.fn();
const mockLanguageFromPath = vi.fn();
const mockIsServerInstalled = vi.fn();
const mockGetClientForFile = vi.fn();
const mockEnsureFileOpen = vi.fn();

vi.mock("../../src/utils/paths.js", () => ({
  resolveFile: (...args: unknown[]) => mockResolveFile(...args),
  filePathToUri: (...args: unknown[]) => mockFilePathToUri(...args),
}));

vi.mock("../../src/lsp/language-config.js", () => ({
  languageFromPath: (...args: unknown[]) => mockLanguageFromPath(...args),
  isServerInstalled: (...args: unknown[]) => mockIsServerInstalled(...args),
  // Must re-export LANGUAGE_SERVERS since preamble.ts uses it
  LANGUAGE_SERVERS: [
    {
      language: "typescript",
      command: "typescript-language-server",
      args: ["--stdio"],
      extensions: [".ts", ".tsx"],
      detectCommand: "typescript-language-server --version",
      installCommand: "npm install -g typescript-language-server typescript",
      installInstructions: "npm install -g typescript-language-server typescript",
    },
  ],
}));

vi.mock("../../src/lsp/lsp-manager.js", () => ({
  LspManager: class {
    getClientForFile = (...args: unknown[]) => mockGetClientForFile(...args);
    ensureFileOpen = (...args: unknown[]) => mockEnsureFileOpen(...args);
  },
}));

// ── Import after mocks ──────────────────────────────────────────────────────

import { executePreamble } from "../../src/commands/preamble.js";

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Create a minimal fake LspManager-like object */
function makeManager() {
  return {
    getClientForFile: mockGetClientForFile,
    ensureFileOpen: mockEnsureFileOpen,
  } as unknown as Awaited<ReturnType<typeof import("../../src/lsp/lsp-manager.js").LspManager.prototype.getClientForFile>> extends null
    ? never
    : InstanceType<typeof import("../../src/lsp/lsp-manager.js").LspManager>;
}

/** Sample typescript config used across tests */
const tsConfig = {
  language: "typescript",
  command: "typescript-language-server",
  args: ["--stdio"],
  extensions: [".ts", ".tsx"],
  detectCommand: "typescript-language-server --version",
  installCommand: "npm install -g typescript-language-server typescript",
  installInstructions: "npm install -g typescript-language-server typescript",
};

/** A fake LSP client object */
const fakeClient = { id: "fake-client" };

beforeEach(() => {
  vi.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("executePreamble", () => {
  it("returns error for unknown file extension", async () => {
    mockResolveFile.mockReturnValue("/project/file.xyz");
    mockLanguageFromPath.mockReturnValue(undefined);

    const result = await executePreamble("file.xyz", makeManager(), "/project");

    expect(result).toHaveProperty("error");
    if ("error" in result) {
      expect(result.error.isError).toBe(true);
      expect(result.error.content[0].text).toContain("No LSP server configured");
    }
  });

  it("returns error when server is not installed", async () => {
    mockResolveFile.mockReturnValue("/project/file.ts");
    mockLanguageFromPath.mockReturnValue(tsConfig);
    mockIsServerInstalled.mockResolvedValue(false);

    const result = await executePreamble("file.ts", makeManager(), "/project");

    expect(result).toHaveProperty("error");
    if ("error" in result) {
      expect(result.error.isError).toBe(true);
      expect(result.error.content[0].text).toContain("not installed");
      expect(result.error.content[0].text).toContain(tsConfig.installCommand);
    }
  });

  it("returns error when getClientForFile returns null", async () => {
    mockResolveFile.mockReturnValue("/project/file.ts");
    mockLanguageFromPath.mockReturnValue(tsConfig);
    mockIsServerInstalled.mockResolvedValue(true);
    mockGetClientForFile.mockResolvedValue(null);

    const result = await executePreamble("file.ts", makeManager(), "/project");

    expect(result).toHaveProperty("error");
    if ("error" in result) {
      expect(result.error.isError).toBe(true);
      expect(result.error.content[0].text).toContain("Failed to start LSP server");
    }
  });

  it("returns ok with filePath, config, client, uri on happy path", async () => {
    const resolvedPath = "/project/src/index.ts";
    const fileUri = "file:///project/src/index.ts";

    mockResolveFile.mockReturnValue(resolvedPath);
    mockLanguageFromPath.mockReturnValue(tsConfig);
    mockIsServerInstalled.mockResolvedValue(true);
    mockGetClientForFile.mockResolvedValue(fakeClient);
    mockEnsureFileOpen.mockResolvedValue(undefined);
    mockFilePathToUri.mockReturnValue(fileUri);

    const result = await executePreamble("src/index.ts", makeManager(), "/project");

    expect(result).toHaveProperty("ok");
    if ("ok" in result) {
      expect(result.ok.filePath).toBe(resolvedPath);
      expect(result.ok.config).toBe(tsConfig);
      expect(result.ok.client).toBe(fakeClient);
      expect(result.ok.uri).toBe(fileUri);
    }
  });

  it("calls ensureFileOpen with correct params on happy path", async () => {
    const resolvedPath = "/project/src/index.ts";
    const fileUri = "file:///project/src/index.ts";

    mockResolveFile.mockReturnValue(resolvedPath);
    mockLanguageFromPath.mockReturnValue(tsConfig);
    mockIsServerInstalled.mockResolvedValue(true);
    mockGetClientForFile.mockResolvedValue(fakeClient);
    mockEnsureFileOpen.mockResolvedValue(undefined);
    mockFilePathToUri.mockReturnValue(fileUri);

    await executePreamble("src/index.ts", makeManager(), "/project");

    expect(mockEnsureFileOpen).toHaveBeenCalledOnce();
    expect(mockEnsureFileOpen).toHaveBeenCalledWith(fakeClient, tsConfig, resolvedPath);
  });
});
