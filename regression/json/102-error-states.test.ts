import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("json");

describe("JSON — error states", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 60_000);
  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("errors on missing --file for diagnostics", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLI(ctx.fixtureDir, ["diagnostics"]);
    expect(result.exitCode).toBe(1);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("missing-file-error");
  });
});
