import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("typescript");

describe("TypeScript — status, errors, rename", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  // ── Status ──────────────────────────────────────────────────────────

  it("shows no servers before any commands", async () => {
    if (!ctx.isServerInstalled) return;
    // Stop any leftover daemon, then check status fresh
    await runCLI(ctx.fixtureDir, ["stop"]);
    const result = await runCLISlow(ctx.fixtureDir, ["status"]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("status-no-servers");
  });

  it("shows running server after a file command", async () => {
    if (!ctx.isServerInstalled) return;
    // First run a command that starts the TS server
    await runCLI(ctx.fixtureDir, [
      "find-document-symbols",
      "--file",
      "fixtures/valid.ts",
    ]);

    const result = await runCLI(ctx.fixtureDir, ["status"]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("status-with-server");
  });

  // ── Rename Symbol ───────────────────────────────────────────────────

  it("generates rename diff for a function", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.ts line 1: function greet — rename "greet" at col 18
    const result = await runCLI(ctx.fixtureDir, [
      "rename-symbol",
      "--file",
      "fixtures/valid.ts",
      "--line",
      "1",
      "--col",
      "18",
      "--new-name",
      "sayHello",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("rename-function");
  });

  it("generates cross-file rename diff", async () => {
    if (!ctx.isServerInstalled) return;
    // references.ts line 3: greet("world") — rename "greet" at col 18
    const result = await runCLI(ctx.fixtureDir, [
      "rename-symbol",
      "--file",
      "fixtures/references.ts",
      "--line",
      "3",
      "--col",
      "18",
      "--new-name",
      "sayHello",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("rename-cross-file");
  });

  // ── Error States ────────────────────────────────────────────────────

  it("errors on missing --file parameter", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLI(ctx.fixtureDir, [
      "find-references",
      "--line",
      "1",
      "--col",
      "1",
    ]);
    expect(result.exitCode).toBe(1);
  });

  it("errors on missing --line parameter", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLI(ctx.fixtureDir, [
      "find-references",
      "--file",
      "fixtures/valid.ts",
      "--col",
      "1",
    ]);
    expect(result.exitCode).toBe(1);
  });

  it("errors on missing --new-name for rename-symbol", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLI(ctx.fixtureDir, [
      "rename-symbol",
      "--file",
      "fixtures/valid.ts",
      "--line",
      "1",
      "--col",
      "18",
    ]);
    expect(result.exitCode).toBe(1);
  });
});
