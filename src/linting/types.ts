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
  /** Command to auto-fix issues (optional). Returns [cmd, ...args] */
  fixCommand?: (files: string[]) => string[];
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

/** Static definition of a supported formatter */
export interface FormatterDefinition {
  /** Unique identifier (e.g., "prettier") */
  name: string;
  /** Human-readable label (e.g., "Prettier") */
  label: string;
  /** File extensions this formatter handles (with dot, e.g., [".js", ".ts"]) */
  extensions: string[];
  /** Config files to look for (relative to cwd) */
  configFiles: string[];
  /** Additional detection: check package.json devDependencies keys */
  packageKeys?: string[];
  /** Project marker files that indicate this ecosystem */
  projectMarkers?: string[];
  /** Command to verify the formatter is installed */
  versionCommand: string;
  /** Command to check formatting (diagnose mode). Returns [cmd, ...args] */
  diagnoseCommand: (files: string[]) => string[];
  /** Command to fix formatting (fix mode). Returns [cmd, ...args] */
  fixCommand: (files: string[]) => string[];
  /** Parse diagnose output into per-file results */
  parseOutput: (stdout: string, cwd: string) => FormatterResult[];
  /** Timeout for command execution (ms) */
  timeout: number;
}

/** Result of running a formatter on files */
export interface FormatterResult {
  /** The formatter that produced this result */
  source: string;
  /** Absolute file path */
  file: string;
  /** Whether the file needs formatting (diagnose) or was formatted (fix) */
  changed: boolean;
  /** Error message if formatting failed for this file */
  error?: string;
}

/** A formatter detected as available in the current project */
export interface DetectedFormatter {
  definition: FormatterDefinition;
  /** Resolved config file path (if found) */
  configFile?: string;
  /** Version string from versionCommand */
  version?: string;
  /** How this formatter was detected */
  detectionSource: "config-file" | "package-key" | "project-marker";
}

/** Status of a check */
export type CheckStatus = "pending" | "running" | "clean" | "issues" | "error" | "skipped";
