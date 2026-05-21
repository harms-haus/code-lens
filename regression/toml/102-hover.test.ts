import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("toml");

describe("TOML — hover", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);
  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("returns hover information for table name", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "hover",
      "--file",
      "fixtures/valid.toml",
      "--line",
      "2",
      "--col",
      "1",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("hover-package");
  });
});
