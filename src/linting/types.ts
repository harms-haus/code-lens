/**
 * Shared types for linting modules
 */

/** Normalized lint issue — the universal output format */
export interface LintIssue {
  file: string; // Absolute path
  line: number; // 1-based
  column: number; // 1-based
  endLine?: number; // 1-based, optional
  endColumn?: number; // 1-based, optional
  severity: "error" | "warning" | "info";
  message: string;
  code?: string; // Rule ID (e.g., "no-unused-vars", "E501")
  source?: string; // Linter name (e.g., "eslint", "ruff")
}

/** Static definition of a supported linter */
export interface LinterDefinition {
  /** Unique identifier (e.g., "eslint", "ruff") */
  name: string;
  /** Human-readable label */
  label: string;
  /** Languages this linter handles */
  languages: string[]; // e.g., ["javascript", "typescript"]
  /** File extensions this linter handles (with dot, e.g., [".js", ".ts"]) */
  extensions: string[];
  /** Config files to look for (relative to cwd) */
  configFiles: string[];
  /** Additional detection: check package.json devDependencies keys */
  packageKeys?: string[]; // e.g., ["eslint"]
  /** Project marker files that indicate this language ecosystem */
  projectMarkers?: string[]; // e.g., ["package.json"]
  /** Command to verify the linter is installed */
  versionCommand: string; // e.g., "npx eslint --version"
  /** Command to lint files with JSON output. Returns [cmd, ...args] */
  lintCommand: (files: string[]) => string[];
  /** Parser: raw JSON stdout → LintIssue[] */
  parseOutput: (stdout: string, cwd: string) => LintIssue[];
  /** Timeout for lint command execution (ms) */
  timeout: number;
}

/** A linter detected as available in the current project */
export interface DetectedLinter {
  definition: LinterDefinition;
  /** Resolved config file path (if found) */
  configFile?: string;
  /** Version string from `versionCommand` */
  version?: string;
  /** How this linter was detected */
  detectionSource: "config-file" | "package-key" | "project-marker";
}

/** Result of running prettier on a single file */
export interface PrettierResult {
  file: string;
  changed: boolean;
  error?: string;
}

/** Parsed tsc diagnostic */
export interface TscIssue {
  file: string;
  line: number;
  column: number;
  severity: "error" | "warning";
  message: string;
  code?: string;
}

/** Status of a check */
export type CheckStatus = "pending" | "running" | "clean" | "issues" | "error" | "skipped";
