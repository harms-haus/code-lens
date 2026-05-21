import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("markdown");

describe("Markdown — find-references", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("finds references to valid.md from references.md", async () => {
    if (!ctx.isServerInstalled) return;
    // references.md line 3: See [Main Document](./valid.md) for details.
    // Position col 10 is on the link to valid.md
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "find-references", "--file", "fixtures/references.md", "--line", "3", "--col", "10",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("references-to-valid");
  });
});
