import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CommandResult } from "../../src/formatting/output.js";
import type { FormatterResult, DetectedFormatter } from "../../src/linting/types.js";

// ── Capture registered handlers ────────────────────────────────────────────

const registeredHandlers = new Map<string, Function>();

vi.mock("../../src/daemon/server.js", () => ({
  registerCommand: (name: string, handler: Function) => {
    registeredHandlers.set(name, handler);
  },
}));

// ── Mock resolveFile ───────────────────────────────────────────────────────

const mockResolveFile = vi.fn();

vi.mock("../../src/utils/paths.js", () => ({
  resolveFile: (...args: unknown[]) => mockResolveFile(...args),
}));

// ── Mock formatter registry ────────────────────────────────────────────────

const mockDetectFormatters = vi.fn();
const mockGetRelevantFormatters = vi.fn();

vi.mock("../../src/linting/formatter-registry.js", () => ({
  detectFormatters: (...args: unknown[]) => mockDetectFormatters(...args),
  getRelevantFormatters: (...args: unknown[]) => mockGetRelevantFormatters(...args),
}));

// ── Mock formatter runner ──────────────────────────────────────────────────

const mockRunFormatterDiagnose = vi.fn();

vi.mock("../../src/linting/formatter-runner.js", () => ({
  runFormatterDiagnose: (...args: unknown[]) => mockRunFormatterDiagnose(...args),
}));

// ── Import module (triggers registerCommand) ───────────────────────────────

await import("../../src/commands/prettier.js");

// ── Helpers ────────────────────────────────────────────────────────────────

function getHandler(): Function {
  const handler = registeredHandlers.get("prettier");
  expect(handler).toBeDefined();
  return handler!;
}

const defaultCwd = "/project";

function makeDetectedFormatter(): DetectedFormatter {
  return {
    definition: {
      name: "prettier",
      label: "Prettier",
      extensions: [".ts", ".js", ".json"],
      configFiles: [".prettierrc"],
      versionCommand: "npx prettier --version",
      diagnoseCommand: (files: string[]) => ["npx", "prettier", "--check", ...files],
      fixCommand: (files: string[]) => ["npx", "prettier", "--write", ...files],
      parseOutput: (stdout: string) => stdout.split("\n").filter(Boolean).map((f) => ({ source: "prettier", file: f, changed: true })),
      timeout: 30_000,
    },
    version: "3.0.0",
    detectionSource: "config-file",
  };
}

function makeFormatterResult(
  file: string,
  overrides: Partial<FormatterResult> = {},
): FormatterResult {
  return { source: "prettier", file, changed: false, ...overrides };
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("prettier command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: resolveFile returns the path unchanged
    mockResolveFile.mockImplementation((file: string, _cwd: string) => `/project/${file}`);
  });

  it("returns error when files param is missing", async () => {
    const handler = getHandler();
    const result = (await handler({}, {}, defaultCwd)) as CommandResult;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Missing or empty");
  });

  it("returns error when files param is an empty array", async () => {
    const handler = getHandler();
    const result = (await handler({ files: [] }, {}, defaultCwd)) as CommandResult;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Missing or empty");
  });

  it("returns error on path traversal rejection", async () => {
    mockResolveFile.mockImplementation(() => {
      throw new Error('Path traversal: "../etc/passwd" resolves outside the workspace.');
    });

    const handler = getHandler();
    const result = (await handler({ files: ["../etc/passwd"] }, {}, defaultCwd)) as CommandResult;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Path traversal rejected");
  });

  it("returns ok with available: false when no formatters detected", async () => {
    mockDetectFormatters.mockResolvedValue([]);

    const handler = getHandler();
    const result = (await handler({ files: ["src/index.ts"] }, {}, defaultCwd)) as CommandResult;

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("prettier: not available");
    expect(result.details).toMatchObject({ available: false, results: [] });
  });

  it("returns ok with available: false when no formatters match the files", async () => {
    mockDetectFormatters.mockResolvedValue([makeDetectedFormatter()]);
    mockGetRelevantFormatters.mockReturnValue(new Map());

    const handler = getHandler();
    const result = (await handler({ files: ["src/image.png"] }, {}, defaultCwd)) as CommandResult;

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("prettier: not available");
    expect(result.details).toMatchObject({ available: false, results: [] });
  });

  it("returns ok when all files are formatted correctly", async () => {
    const formatter = makeDetectedFormatter();
    const relevantMap = new Map([[formatter, ["/project/src/index.ts"]]]);
    mockDetectFormatters.mockResolvedValue([formatter]);
    mockGetRelevantFormatters.mockReturnValue(relevantMap);
    mockRunFormatterDiagnose.mockResolvedValue([
      makeFormatterResult("/project/src/index.ts", { changed: false }),
    ]);

    const handler = getHandler();
    const result = (await handler({ files: ["src/index.ts"] }, {}, defaultCwd)) as CommandResult;

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("prettier: 1 file(s) formatted correctly");
    expect(result.details).toMatchObject({ available: true, needsFormatting: 0 });
  });

  it("returns ok when no results but formatters exist (no supported files)", async () => {
    const formatter = makeDetectedFormatter();
    const relevantMap = new Map([[formatter, ["/project/src/image.png"]]]);
    mockDetectFormatters.mockResolvedValue([formatter]);
    mockGetRelevantFormatters.mockReturnValue(relevantMap);
    // runFormatterDiagnose returns empty for unsupported extensions
    mockRunFormatterDiagnose.mockResolvedValue([]);

    const handler = getHandler();
    const result = (await handler({ files: ["src/image.png"] }, {}, defaultCwd)) as CommandResult;

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("prettier: no supported files to check");
    expect(result.details).toMatchObject({ results: [], available: true });
  });

  it("returns error when files need formatting (key regression test)", async () => {
    const formatter = makeDetectedFormatter();
    const relevantMap = new Map([[formatter, ["/project/src/index.ts", "/project/src/app.ts"]]]);
    mockDetectFormatters.mockResolvedValue([formatter]);
    mockGetRelevantFormatters.mockReturnValue(relevantMap);
    mockRunFormatterDiagnose.mockResolvedValue([
      makeFormatterResult("/project/src/index.ts", { changed: true }),
      makeFormatterResult("/project/src/app.ts", { changed: false }),
    ]);

    const handler = getHandler();
    const result = (await handler({ files: ["src/index.ts", "src/app.ts"] }, {}, defaultCwd)) as CommandResult;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("need formatting");
    expect(result.content[0].text).toContain("1 file(s) need formatting");
    expect(result.details).toMatchObject({ available: true, needsFormatting: 1 });
  });

  it("returns error when formatter encounters errors", async () => {
    const formatter = makeDetectedFormatter();
    const relevantMap = new Map([[formatter, ["/project/src/index.ts"]]]);
    mockDetectFormatters.mockResolvedValue([formatter]);
    mockGetRelevantFormatters.mockReturnValue(relevantMap);
    mockRunFormatterDiagnose.mockResolvedValue([
      makeFormatterResult("/project/src/index.ts", { error: "parse error" }),
    ]);

    const handler = getHandler();
    const result = (await handler({ files: ["src/index.ts"] }, {}, defaultCwd)) as CommandResult;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("had errors");
    expect(result.details).toMatchObject({ available: true, errorCount: 1 });
  });

  it("returns sanitized error when detectFormatters throws", async () => {
    mockDetectFormatters.mockRejectedValue(new Error("Something failed in /home/user/project"));

    const handler = getHandler();
    const result = (await handler({ files: ["src/index.ts"] }, {}, defaultCwd)) as CommandResult;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Failed to run prettier");
    // Home directory should be sanitized
    expect(result.content[0].text).not.toContain("/home/user");
    expect(result.content[0].text).toContain("~");
  });

  it("passes timeoutMs to runFormatterDiagnose", async () => {
    const formatter = makeDetectedFormatter();
    const relevantMap = new Map([[formatter, ["/project/src/index.ts"]]]);
    mockDetectFormatters.mockResolvedValue([formatter]);
    mockGetRelevantFormatters.mockReturnValue(relevantMap);
    mockRunFormatterDiagnose.mockResolvedValue([
      makeFormatterResult("/project/src/index.ts", { changed: false }),
    ]);

    const handler = getHandler();
    await handler({ files: ["src/index.ts"], timeoutMs: 5000 }, {}, defaultCwd);

    expect(mockRunFormatterDiagnose).toHaveBeenCalledWith(
      formatter,
      ["/project/src/index.ts"],
      defaultCwd,
      undefined,
      5000,
    );
  });
});
