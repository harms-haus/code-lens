import type { FormatterDefinition, FormatterResult } from "./types.js";

/**
 * Parse prettier --check output into FormatterResult[].
 * Prettier outputs one file path per line for files that need formatting.
 * Exit code 0 = all formatted, exit code 1 = some need formatting.
 */
function parsePrettierOutput(stdout: string, _cwd: string): FormatterResult[] {
  const lines = stdout.trim().split("\n").filter(Boolean);
  return lines.map((line) => ({
    source: "prettier",
    file: line.trim(),
    changed: true,
  }));
}

export const FORMATTER_DEFINITIONS: FormatterDefinition[] = [
  {
    name: "prettier",
    label: "Prettier",
    extensions: [
      ".js",
      ".jsx",
      ".ts",
      ".tsx",
      ".mjs",
      ".cjs",
      ".json",
      ".jsonc",
      ".css",
      ".scss",
      ".less",
      ".html",
      ".htm",
      ".md",
      ".mdx",
      ".yaml",
      ".yml",
      ".vue",
      ".svelte",
      ".graphql",
      ".gql",
    ],
    configFiles: [
      ".prettierrc",
      ".prettierrc.json",
      ".prettierrc.yaml",
      ".prettierrc.yml",
      ".prettierrc.toml",
      ".prettierrc.js",
      ".prettierrc.cjs",
      ".prettierrc.mjs",
      "prettier.config.js",
      "prettier.config.cjs",
      "prettier.config.mjs",
    ],
    packageKeys: ["prettier"],
    projectMarkers: ["package.json"],
    versionCommand: "npx prettier --version",
    diagnoseCommand: (files) => ["npx", "prettier", "--check", ...files],
    fixCommand: (files) => ["npx", "prettier", "--write", ...files],
    parseOutput: parsePrettierOutput,
    timeout: 30_000,
  },
];
