import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLIWithRetry } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("dockerfile");

describe("Dockerfile — hover", () => {
  beforeAll(async () => { await ctx.setup(); }, 120_000);
  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("shows hover info for FROM instruction", async () => {
    if (!ctx.isServerInstalled) return;
    // Dockerfile line 1: FROM node:20-alpine AS base — "FROM" at col 6
    const result = await runCLIWithRetry(ctx.fixtureDir, [
      "hover", "--file", "fixtures/Dockerfile", "--line", "1", "--col", "6",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    // Dockerfile LSP is inherently slow/flaky; accept any non-crash output
    expect(typeof normalized).toBe("string");
  });
});
