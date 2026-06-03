import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CommandResult } from "../../src/formatting/output.js";
import type { FormatterResult, DetectedFormatter, DetectedLinter, LintIssue } from "../../src/linting/types.js";

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

// ── Mock linter registry ───────────────────────────────────────────────────

const mockDetectLinters = vi.fn();
const mockGetRelevantLinters = vi.fn();

vi.mock("../../src/linting/linter-registry.js", () => ({
  detectLinters: (...args: unknown[]) => mockDetectLinters(...args),
  getRelevantLinters: (...args: unknown[]) => mockGetRelevantLinters(...args),
}));

// ── Mock linter runner ─────────────────────────────────────────────────────

const mockRunLinter = vi.fn();

vi.mock("../../src/linting/linter-runner.js", () => ({
  runLinter: (...args: unknown[]) => mockRunLinter(...args),
}));

// ── Mock output formatter ──────────────────────────────────────────────────

vi.mock("../../src/linting/output-formatter.js", () => ({
  formatIssues: (issues: unknown[]) => {
    if (!Array.isArray(issues) || issues.length === 0) return "";
    return (issues as { file: string; line: number; message: string }[])
      .map((i) => ` ✗ ${i.file}:${i.line}: ${i.message}`)
      .join("\n");
  },
  summarizeIssues: (issues: unknown[]) => {
    if (!Array.isArray(issues) || issues.length === 0) return "No lint issues found.";
    return `Lint Results: ${issues.length} issue(s) in 1 file(s)`;
  },
}));

// ── Mock language config ───────────────────────────────────────────────────

const mockLanguageFromPath = vi.fn();

vi.mock("../../src/lsp/language-config.js", () => ({
  languageFromPath: (...args: unknown[]) => mockLanguageFromPath(...args),
}));

// ── Mock diagnostics ───────────────────────────────────────────────────────

vi.mock("../../src/formatting/diagnostics.js", () => ({
  countSeverities: (diagnostics: unknown[]) => {
    const diags = diagnostics as { severity: number }[];
    let errors = 0;
    let warnings = 0;
    for (const d of diags) {
      if (d.severity === 1) errors++;
      else if (d.severity === 2) warnings++;
    }
    return { errors, warnings, info: 0 };
  },
}));

// ── Import module (triggers registerCommand) ───────────────────────────────

await import("../../src/commands/fullCheck.js");

// ── Helpers ────────────────────────────────────────────────────────────────

function getHandler(): Function {
  const handler = registeredHandlers.get("fullCheck");
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
      parseOutput: () => [],
      timeout: 30_000,
    },
    version: "3.0.0",
    detectionSource: "config-file" as const,
  };
}

function makeDetectedLinter(): DetectedLinter {
  return {
    definition: {
      name: "eslint",
      label: "ESLint",
      languages: ["javascript", "typescript"],
      extensions: [".js", ".ts"],
      configFiles: [".eslintrc"],
      packageKeys: ["eslint"],
      versionCommand: "npx eslint --version",
      lintCommand: (files: string[]) => ["npx", "eslint", ...files],
      parseOutput: () => [],
      timeout: 30_000,
    },
    version: "8.0.0",
    detectionSource: "package-key" as const,
  };
}

function makeFormatterResult(
  file: string,
  overrides: Partial<FormatterResult> = {},
): FormatterResult {
  return { source: "prettier", file, changed: false, ...overrides };
}

function makeLintIssue(overrides: Partial<LintIssue> = {}): LintIssue {
  return {
    file: "/project/src/index.ts",
    line: 1,
    column: 1,
    severity: "error",
    message: "Unexpected var",
    source: "eslint",
    ...overrides,
  };
}

function makeMockManager() {
  return {
    onFileChanged: vi.fn().mockResolvedValue(undefined),
    getDiagnostics: vi.fn().mockResolvedValue([]),
  } as any;
}

function setupCleanAll() {
  mockDetectFormatters.mockResolvedValue([]);
  mockDetectLinters.mockResolvedValue([]);
  mockGetRelevantFormatters.mockReturnValue(new Map());
  mockGetRelevantLinters.mockReturnValue(new Map());
  mockRunFormatterDiagnose.mockResolvedValue([]);
  mockRunLinter.mockResolvedValue([]);
  mockLanguageFromPath.mockReturnValue(undefined);
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("fullCheck command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveFile.mockImplementation((file: string, _cwd: string) => `/project/${file}`);
    setupCleanAll();
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

  it("all checks skipped when config has all flags false → ok", async () => {
    const handler = getHandler();
    const result = (await handler(
      { files: ["src/index.ts"], config: { prettier: false, linters: false, lsp: false } },
      makeMockManager(),
      defaultCwd,
    )) as CommandResult;

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("All checks passed");
    expect(result.details).toMatchObject({ hasIssues: false });
  });

  it("all checks pass (clean) → ok", async () => {
    const formatter = makeDetectedFormatter();
    const linter = makeDetectedLinter();

    mockDetectFormatters.mockResolvedValue([formatter]);
    mockDetectLinters.mockResolvedValue([linter]);
    mockGetRelevantFormatters.mockReturnValue(new Map([[formatter, ["/project/src/index.ts"]]]));
    mockGetRelevantLinters.mockReturnValue(new Map([[linter, ["/project/src/index.ts"]]]));
    mockRunFormatterDiagnose.mockResolvedValue([
      makeFormatterResult("/project/src/index.ts", { changed: false }),
    ]);
    mockRunLinter.mockResolvedValue([]);
    mockLanguageFromPath.mockReturnValue(undefined); // No LSP

    const handler = getHandler();
    const result = (await handler(
      { files: ["src/index.ts"], config: { prettier: true, linters: true, lsp: true } },
      makeMockManager(),
      defaultCwd,
    )) as CommandResult;

    expect(result.isError).toBe(false);
    // When checks return sections, they are joined (not "All checks passed")
    expect(result.content[0].text).toContain("prettier: 1 file(s) formatted correctly");
    expect(result.content[0].text).toContain("linters: 0 issues");
    expect(result.details).toMatchObject({ hasIssues: false });
  });

  it("prettier has files needing formatting → isError: true", async () => {
    const formatter = makeDetectedFormatter();

    mockDetectFormatters.mockResolvedValue([formatter]);
    mockDetectLinters.mockResolvedValue([]);
    mockGetRelevantFormatters.mockReturnValue(new Map([[formatter, ["/project/src/index.ts"]]]));
    mockRunFormatterDiagnose.mockResolvedValue([
      makeFormatterResult("/project/src/index.ts", { changed: true }),
    ]);
    mockLanguageFromPath.mockReturnValue(undefined);

    const handler = getHandler();
    const result = (await handler(
      { files: ["src/index.ts"], config: { prettier: true, linters: false, lsp: false } },
      makeMockManager(),
      defaultCwd,
    )) as CommandResult;

    expect(result.isError).toBe(true);
    expect(result.details).toMatchObject({ hasIssues: true });
    expect(result.content[0].text).toContain("need formatting");
  });

  it("linter has issues → isError: true", async () => {
    const linter = makeDetectedLinter();

    mockDetectFormatters.mockResolvedValue([]);
    mockDetectLinters.mockResolvedValue([linter]);
    mockGetRelevantLinters.mockReturnValue(new Map([[linter, ["/project/src/index.ts"]]]));
    mockRunLinter.mockResolvedValue([
      makeLintIssue({ file: "/project/src/index.ts", line: 5, message: "no-unused-vars" }),
    ]);
    mockLanguageFromPath.mockReturnValue(undefined);

    const handler = getHandler();
    const result = (await handler(
      { files: ["src/index.ts"], config: { prettier: false, linters: true, lsp: false } },
      makeMockManager(),
      defaultCwd,
    )) as CommandResult;

    expect(result.isError).toBe(true);
    expect(result.details).toMatchObject({ hasIssues: true });
    expect(result.content[0].text).toContain("issue");
  });

  it("LSP has diagnostics → isError: true", async () => {
    mockLanguageFromPath.mockReturnValue({ language: "typescript" });
    mockDetectFormatters.mockResolvedValue([]);
    mockDetectLinters.mockResolvedValue([]);

    const manager = makeMockManager();
    manager.getDiagnostics.mockResolvedValue([
      {
        severity: 1, // Error
        range: { start: { line: 9, character: 0 }, end: { line: 9, character: 5 } },
        message: "Type 'string' is not assignable to type 'number'",
      },
    ]);

    const handler = getHandler();
    const result = (await handler(
      { files: ["src/index.ts"], config: { prettier: false, linters: false, lsp: true, lspDelayMs: 1 } },
      manager,
      defaultCwd,
    )) as CommandResult;

    expect(result.isError).toBe(true);
    expect(result.details).toMatchObject({ hasIssues: true });
    expect(result.content[0].text).toContain("diagnostic");
  });

  it("LSP has no diagnostics → ok", async () => {
    mockLanguageFromPath.mockReturnValue({ language: "typescript" });
    mockDetectFormatters.mockResolvedValue([]);
    mockDetectLinters.mockResolvedValue([]);

    const manager = makeMockManager();
    manager.getDiagnostics.mockResolvedValue([]);

    const handler = getHandler();
    const result = (await handler(
      { files: ["src/index.ts"], config: { prettier: false, linters: false, lsp: true, lspDelayMs: 1 } },
      manager,
      defaultCwd,
    )) as CommandResult;

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("lsp: 0 diagnostics");
  });

  it("returns sanitized error when detectLinters throws", async () => {
    mockDetectFormatters.mockResolvedValue([]);
    mockDetectLinters.mockRejectedValue(new Error("Internal failure in /home/user/project"));

    const handler = getHandler();
    const result = (await handler(
      { files: ["src/index.ts"], config: { prettier: true, linters: true, lsp: false } },
      makeMockManager(),
      defaultCwd,
    )) as CommandResult;

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Failed to run full check");
    expect(result.content[0].text).not.toContain("/home/user");
    expect(result.content[0].text).toContain("~");
  });

  it("details includes fileCount and durationMs", async () => {
    const handler = getHandler();
    const result = (await handler(
      { files: ["src/a.ts", "src/b.ts"], config: {} },
      makeMockManager(),
      defaultCwd,
    )) as CommandResult;

    expect(result.details).toHaveProperty("fileCount", 2);
    expect(result.details).toHaveProperty("durationMs");
    expect(typeof result.details.durationMs).toBe("number");
  });

  it("details includes statuses for each check type", async () => {
    const handler = getHandler();
    const result = (await handler(
      { files: ["src/index.ts"], config: { prettier: false, linters: false, lsp: false } },
      makeMockManager(),
      defaultCwd,
    )) as CommandResult;

    expect(result.details).toMatchObject({
      statuses: {
        prettier: "skipped",
        linters: "skipped",
        lsp: "skipped",
      },
    });
  });
});
