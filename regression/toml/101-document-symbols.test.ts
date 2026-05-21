import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("toml");

describe("TOML — document-symbols", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);
  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("lists document symbols in TOML", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-document-symbols",
      "--file",
      "fixtures/valid.toml",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("document-symbols");
  });
});
