import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("markdown");

describe("Markdown — hover", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("shows hover info for a link in Markdown", async () => {
    if (!ctx.isServerInstalled) return;
    // valid.md line 5: This is a paragraph with a [link](https://example.com) and **bold text**.
    // "link" at line 5, col 30 is on the link text
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "hover", "--file", "fixtures/valid.md", "--line", "5", "--col", "30",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("hover-link");
  });
});
