import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("dockerfile");

describe("Dockerfile — document-symbols", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("lists document symbols for Dockerfile", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLI(ctx.fixtureDir, [
      "find-document-symbols", "--file", "fixtures/Dockerfile",
    ], { timeout: 15_000 });
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("document-symbols");
  });
});
