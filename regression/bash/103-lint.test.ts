import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";
import * as fs from "node:fs";
import * as path from "node:path";

const ctx = new RegressionTestContext("bash");

describe("Bash — lint", () => {
  beforeAll(async () => {
    await ctx.setup();
    // Copy .shellcheckrc to workspace root for shellcheck detection
    const shellcheckrcSrc = path.join(ctx.fixtureDir, "fixtures", ".shellcheckrc");
    if (fs.existsSync(shellcheckrcSrc)) {
      fs.copyFileSync(shellcheckrcSrc, path.join(ctx.fixtureDir, ".shellcheckrc"));
    }
  }, 120_000);

  afterAll(async () => { await ctx.teardown(); }, 30_000);

  it("returns lint result for valid file", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLISlow(ctx.fixtureDir, [
      "lint", "--files", "fixtures/valid.sh",
    ]);

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    // shellcheck may report issues or "No linters" if not installed
    expect(normalized).toMatch(/\d+ issues|No linters|0 issues/i);
  });

  it("returns lint result for references file", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLISlow(ctx.fixtureDir, [
      "lint", "--files", "fixtures/references.sh",
    ]);

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatch(/\d+ issues|No linters|0 issues/i);
  });
});
