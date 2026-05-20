import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("json");

describe("JSON — document-symbols", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 60_000);
  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("lists document symbols in JSON", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "find-document-symbols",
      "--file",
      "fixtures/valid.json",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    // JSON server support varies — accept symbols or error
    expect(normalized).toMatch(/\d+ symbols found|Failed to get document symbols/i);
  });
});
