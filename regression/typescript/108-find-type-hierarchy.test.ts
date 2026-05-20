import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { RegressionTestContext } from "../_shared/test-context.js";
import { runCLI, runCLISlow } from "../_shared/run-cli.js";
import { normalizeOutput } from "../_shared/normalize.js";

const ctx = new RegressionTestContext("typescript");

describe("TypeScript — find-type-hierarchy", () => {
  beforeAll(async () => {
    await ctx.setup();
  }, 120_000);

  afterAll(async () => {
    await ctx.teardown();
  }, 30_000);

  it("shows supertypes of Dog class", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLISlow(ctx.fixtureDir, [
      "find-type-hierarchy",
      "--file",
      "fixtures/classes.ts",
      "--line",
      "9",
      "--col",
      "14",
      "--direction",
      "supertypes",
    ]);

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, {
      fixtureDir: ctx.fixtureDir,
    });
    expect(normalized).toMatchSnapshot("type-hierarchy-dog-supertypes");
  });

  it("shows subtypes of Animal class", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLI(ctx.fixtureDir, [
      "find-type-hierarchy",
      "--file",
      "fixtures/classes.ts",
      "--line",
      "1",
      "--col",
      "14",
      "--direction",
      "subtypes",
    ]);

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, {
      fixtureDir: ctx.fixtureDir,
    });
    expect(normalized).toMatchSnapshot("type-hierarchy-animal-subtypes");
  });

  it("shows both directions for Document class", async () => {
    if (!ctx.isServerInstalled) return;

    const result = await runCLI(ctx.fixtureDir, [
      "find-type-hierarchy",
      "--file",
      "fixtures/classes.ts",
      "--line",
      "26",
      "--col",
      "14",
      "--direction",
      "both",
    ]);

    expect(result.exitCode).toBe(0);
    const normalized = normalizeOutput(result.stdout, {
      fixtureDir: ctx.fixtureDir,
    });
    expect(normalized).toMatchSnapshot("type-hierarchy-document-both");
  });
});
