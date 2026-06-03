import { describe, it, expect, vi, beforeEach } from "vitest";
import { FORMATTER_DEFINITIONS } from "../../src/linting/formatter-definitions.js";
import type { DetectedFormatter } from "../../src/linting/types.js";

vi.mock("../../src/utils/spawn.js", () => ({
  execCommand: vi.fn(),
}));

import { execCommand } from "../../src/utils/spawn.js";
import {
  runFormatterDiagnose,
  runFormatterFix,
  runFormattersDiagnose,
  runFormattersFix,
  formatFormatterResults,
  summarizeFormatterResults,
} from "../../src/linting/formatter-runner.js";

const mockExecCommand = vi.mocked(execCommand);

const testFormatter: DetectedFormatter = {
  definition: FORMATTER_DEFINITIONS[0],
  configFile: undefined,
  version: "3.0.0",
  detectionSource: "config-file",
};

beforeEach(() => {
  vi.clearAllMocks();
});

// ─── runFormatterDiagnose ──────────────────────────────────────────────────

describe("runFormatterDiagnose", () => {
  it("returns changed: false for all files when exit code 0", async () => {
    mockExecCommand.mockResolvedValueOnce({
      stdout: "",
      stderr: "",
      exitCode: 0,
    });

    const results = await runFormatterDiagnose(
      testFormatter,
      ["src/foo.ts", "src/bar.ts"],
      "/test/cwd",
    );

    expect(results).toHaveLength(2);
    expect(results[0]).toEqual({
      source: "prettier",
      file: "src/foo.ts",
      changed: false,
    });
    expect(results[1]).toEqual({
      source: "prettier",
      file: "src/bar.ts",
      changed: false,
    });
  });

  it("marks listed files as changed:true when exit code 1 with stdout", async () => {
    mockExecCommand.mockResolvedValueOnce({
      stdout: "src/foo.ts\nsrc/baz.css\n",
      stderr: "",
      exitCode: 1,
    });

    const results = await runFormatterDiagnose(
      testFormatter,
      ["src/foo.ts", "src/bar.ts", "src/baz.css"],
      "/test/cwd",
    );

    expect(results).toHaveLength(3);
    const fooResult = results.find((r) => r.file === "src/foo.ts")!;
    const barResult = results.find((r) => r.file === "src/bar.ts")!;
    const bazResult = results.find((r) => r.file === "src/baz.css")!;
    expect(fooResult.changed).toBe(true);
    expect(barResult.changed).toBe(false);
    expect(bazResult.changed).toBe(true);
  });

  it("returns error for all files when exit code 1 with empty stdout", async () => {
    mockExecCommand.mockResolvedValueOnce({
      stdout: "   ",
      stderr: "some stderr output",
      exitCode: 1,
    });

    const results = await runFormatterDiagnose(
      testFormatter,
      ["src/foo.ts"],
      "/test/cwd",
    );

    expect(results).toHaveLength(1);
    expect(results[0]!.changed).toBe(false);
    expect(results[0]!.error).toBeDefined();
    expect(results[0]!.error).toContain("exited with code 1");
  });

  it("returns error for all files when execCommand throws", async () => {
    mockExecCommand.mockRejectedValueOnce(new Error("command not found"));

    const results = await runFormatterDiagnose(
      testFormatter,
      ["src/foo.ts", "src/bar.ts"],
      "/test/cwd",
    );

    expect(results).toHaveLength(2);
    expect(results[0]!.changed).toBe(false);
    expect(results[0]!.error).toBe("command not found");
    expect(results[1]!.changed).toBe(false);
    expect(results[1]!.error).toBe("command not found");
  });

  it("filters out files with unsupported extensions", async () => {
    mockExecCommand.mockResolvedValueOnce({
      stdout: "",
      stderr: "",
      exitCode: 0,
    });

    const results = await runFormatterDiagnose(
      testFormatter,
      ["src/foo.ts", "script.py", "style.css"],
      "/test/cwd",
    );

    // .py is not in prettier's extensions, so only .ts and .css processed
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.file)).toEqual(["src/foo.ts", "style.css"]);

    // Verify the command was called with only the supported files
    const callArgs = mockExecCommand.mock.calls[0];
    expect(callArgs).toBeDefined();
    const allArgs = callArgs!.slice(1).flat() as string[];
    expect(allArgs).toContain("src/foo.ts");
    expect(allArgs).toContain("style.css");
    expect(allArgs).not.toContain("script.py");
  });

  it("applies timeout cap via Math.min", async () => {
    mockExecCommand.mockResolvedValueOnce({
      stdout: "",
      stderr: "",
      exitCode: 0,
    });

    // Formatter timeout is 30_000, cap at 5_000
    await runFormatterDiagnose(
      testFormatter,
      ["src/foo.ts"],
      "/test/cwd",
      undefined,
      5_000,
    );

    const callOptions = mockExecCommand.mock.calls[0]![2] as Record<string, unknown>;
    expect(callOptions.timeout).toBe(5_000);

    // Now with a cap higher than the formatter timeout
    mockExecCommand.mockResolvedValueOnce({
      stdout: "",
      stderr: "",
      exitCode: 0,
    });

    await runFormatterDiagnose(
      testFormatter,
      ["src/foo.ts"],
      "/test/cwd",
      undefined,
      60_000,
    );

    const callOptions2 = mockExecCommand.mock.calls[1]![2] as Record<string, unknown>;
    expect(callOptions2.timeout).toBe(30_000);
  });
});

// ─── runFormatterFix ───────────────────────────────────────────────────────

describe("runFormatterFix", () => {
  it("returns changed:true for all files when exit code 0", async () => {
    mockExecCommand.mockResolvedValueOnce({
      stdout: "",
      stderr: "",
      exitCode: 0,
    });

    const results = await runFormatterFix(
      testFormatter,
      ["src/foo.ts", "src/bar.ts"],
      "/test/cwd",
    );

    expect(results).toHaveLength(2);
    expect(results[0]!.changed).toBe(true);
    expect(results[1]!.changed).toBe(true);
  });

  it("returns error for all files when exit code non-zero", async () => {
    mockExecCommand.mockResolvedValueOnce({
      stdout: "",
      stderr: "fix failed",
      exitCode: 2,
    });

    const results = await runFormatterFix(
      testFormatter,
      ["src/foo.ts"],
      "/test/cwd",
    );

    expect(results).toHaveLength(1);
    expect(results[0]!.changed).toBe(false);
    expect(results[0]!.error).toBe("fix failed");
  });

  it("returns error for all files when execCommand throws", async () => {
    mockExecCommand.mockRejectedValueOnce(new Error("spawn error"));

    const results = await runFormatterFix(
      testFormatter,
      ["src/foo.ts"],
      "/test/cwd",
    );

    expect(results).toHaveLength(1);
    expect(results[0]!.changed).toBe(false);
    expect(results[0]!.error).toBe("spawn error");
  });

  it("filters out files with unsupported extensions", async () => {
    mockExecCommand.mockResolvedValueOnce({
      stdout: "",
      stderr: "",
      exitCode: 0,
    });

    const results = await runFormatterFix(
      testFormatter,
      ["src/foo.ts", "script.py"],
      "/test/cwd",
    );

    expect(results).toHaveLength(1);
    expect(results[0]!.file).toBe("src/foo.ts");
  });
});

// ─── runFormattersDiagnose (multi-formatter) ───────────────────────────────

describe("runFormattersDiagnose", () => {
  it("returns empty when no formatters provided", async () => {
    const results = await runFormattersDiagnose([], ["src/foo.ts"], "/test/cwd");
    expect(results).toEqual([]);
  });

  it("returns empty when no files provided", async () => {
    const results = await runFormattersDiagnose([testFormatter], [], "/test/cwd");
    expect(results).toEqual([]);
  });
});

// ─── runFormattersFix (multi-formatter) ────────────────────────────────────

describe("runFormattersFix", () => {
  it("returns empty when no formatters provided", async () => {
    const results = await runFormattersFix([], ["src/foo.ts"], "/test/cwd");
    expect(results).toEqual([]);
  });

  it("returns empty when no files provided", async () => {
    const results = await runFormattersFix([testFormatter], [], "/test/cwd");
    expect(results).toEqual([]);
  });
});

// ─── formatFormatterResults ────────────────────────────────────────────────

describe("formatFormatterResults", () => {
  it("returns empty string for empty results", () => {
    expect(formatFormatterResults([])).toBe("");
  });

  it("formats a mix of changed, unchanged, and errored results", () => {
    const results = [
      { source: "prettier", file: "src/foo.ts", changed: true },
      { source: "prettier", file: "src/bar.ts", changed: false },
      { source: "prettier", file: "src/baz.ts", changed: false, error: "parse failed" },
    ];
    const output = formatFormatterResults(results);
    expect(output).toContain("src/foo.ts — needs formatting");
    expect(output).toContain("src/bar.ts — formatted correctly");
    expect(output).toContain("src/baz.ts — error: parse failed");
    expect(output).toContain("1 file(s) need formatting");
    expect(output).toContain("1 file(s) had errors");
  });

  it("uses relative paths when cwd is provided", () => {
    const results = [
      { source: "prettier", file: "/project/src/foo.ts", changed: true },
    ];
    const output = formatFormatterResults(results, "/project");
    // Use forward-slash normalization for cross-platform compatibility (Windows uses backslashes)
    const normalized = output.replace(/\\/g, "/");
    expect(normalized).toContain("src/foo.ts — needs formatting");
  });
});

// ─── summarizeFormatterResults ─────────────────────────────────────────────

describe("summarizeFormatterResults", () => {
  it("returns no-results message for empty array", () => {
    expect(summarizeFormatterResults([])).toBe("No formatter results.");
  });

  it("produces correct one-line summary", () => {
    const results = [
      { source: "prettier", file: "a.ts", changed: true },
      { source: "prettier", file: "b.ts", changed: true },
      { source: "prettier", file: "c.ts", changed: false },
    ];
    expect(summarizeFormatterResults(results)).toBe(
      "Formatter Results: 2 file(s) need formatting, 1 file(s) formatted correctly",
    );
  });
});
