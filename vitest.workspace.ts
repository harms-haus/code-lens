/**
 * Vitest workspace for regression tests.
 *
 * Defines one project per language, each with maxForks=1 so tests
 * within a language run sequentially. Vitest runs up to 5 projects
 * concurrently (controlled via --maxWorkers flag).
 *
 * NOTE: This workspace is used ONLY when vitest is invoked without
 * an explicit --config flag. The existing "test" script uses
 * --config vitest.config.ts to bypass workspace mode.
 */

import { defineWorkspace } from "vitest/config";

const LANGUAGES = [
  "typescript",
  "python",
  "go",
  "rust",
  "json",
  "bash",
  "yaml",
  "css",
  "cpp",
  "php",
  "ruby",
  "html",
  "markdown",
  "vue",
  "dockerfile",
  "toml",
  "terraform",
  "lua",
  "java",
  "svelte",
] as const;

export default defineWorkspace(
  LANGUAGES.map((lang) => ({
    extends: "vitest.config.regression.ts",
    test: {
      name: `regression:${lang}`,
      include: [`regression/${lang}/**/*.test.ts`],
      // One concurrent test per language — prevents daemon port collisions
      // and ensures predictable LSP server behavior
      poolOptions: {
        forks: {
          maxForks: 1,
        },
      },
    },
  })),
);
