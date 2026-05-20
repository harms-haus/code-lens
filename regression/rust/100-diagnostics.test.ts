import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow, runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("rust");

describe("Rust — full suite", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("reports diagnostics for main.rs", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, ["diagnostics", "--file", "src/main.rs"]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("diagnostics-main");
  });

  it("lists document symbols", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-document-symbols", "--file", "src/main.rs",
    ], { maxAttempts: 3, delayMs: 2_000 });
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toContain("Function greet");
    expect(normalized).toContain("Struct Calculator");
    expect(normalized).toMatchSnapshot("document-symbols");
  });

  it("shows hover info for a function", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "hover", "--file", "src/main.rs", "--line", "1", "--col", "4",
    ], { maxAttempts: 5, delayMs: 3_000 });
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("hover-function");
  });

  it("finds definition of greet from call site", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-definition", "--file", "src/main.rs", "--line", "25", "--col", "19",
    ], { maxAttempts: 5, delayMs: 3_000 });
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("definition-of-greet");
  });

  it("finds references to greet function", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-references", "--file", "src/main.rs", "--line", "1", "--col", "4",
    ], { maxAttempts: 5, delayMs: 3_000 });
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("references-to-greet");
  });
});
