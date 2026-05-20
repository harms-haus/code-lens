import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("typescript");

describe("TypeScript — find-document-symbols", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 60_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("lists all symbols in valid.ts", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLISlow(ctx.fixtureDir, [
      "find-document-symbols",
      "--file",
      "fixtures/valid.ts",
    ]);
    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("document-symbols-valid");
  });

  it("lists symbols in classes.ts including class members", async () => {
    if (!ctx.isServerInstalled) return;
    const result = await runCLI(ctx.fixtureDir, [
      "find-document-symbols",
      "--file",
      "fixtures/classes.ts",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("document-symbols-classes");
  });

  it("returns no symbols for empty file", async () => {
    if (!ctx.isServerInstalled) return;
    const { writeFileSync } = await import("node:fs");
    const { join } = await import("node:path");
    writeFileSync(join(ctx.fixtureDir, "fixtures", "empty.ts"), "// empty file\n");

    const result = await runCLI(ctx.fixtureDir, [
      "find-document-symbols",
      "--file",
      "fixtures/empty.ts",
    ]);
    const normalized = normalizeOutput(result.stdout, { fixtureDir: ctx.fixtureDir });
    expect(normalized).toMatchSnapshot("document-symbols-empty");
  });
});
