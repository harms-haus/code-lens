import type { LintIssue } from "./types.js";
import * as path from "node:path";

// ═══════════════════════════════════════════════════════════════════════
// Inline Interfaces for Parser Type Safety
// ═══════════════════════════════════════════════════════════════════════

interface EslintFileResult {
  filePath?: string;
  messages?: Array<{
    line?: number | null;
    column?: number | null;
    endLine?: number | null;
    endColumn?: number | null;
    severity?: number;
    message?: string;
    ruleId?: string | null;
  }>;
}

interface BiomeDiagnostic {
  location?: {
    path?: string;
    start?: { line?: number; column?: number };
    end?: { line?: number; column?: number };
  };
  severity?: string;
  message?: string;
  category?: string;
}

interface RuffResult {
  filename?: string;
  location?: { row?: number; column?: number };
  end_location?: { row?: number; column?: number };
  severity?: string;
  message?: string;
  code?: string;
}

interface PylintResult {
  path?: string;
  line?: number | null;
  column?: number | null;
  endLine?: number;
  endColumn?: number;
  type?: string;
  message?: string;
  symbol?: string;
  "message-id"?: string;
}

interface MypyResult {
  file?: string;
  line?: number | null;
  column?: number | null;
  end_line?: number;
  end_column?: number;
  severity?: string;
  message?: string;
  code?: string;
}

interface ClippySpan {
  file_name?: string;
  line_start?: number;
  column_start?: number;
  line_end?: number;
  column_end?: number;
}

interface ClippyMessage {
  spans?: ClippySpan[];
  level?: string;
  message?: string;
  code?: { code?: string } | null;
}

interface ClippyEntry {
  reason?: string;
  message?: ClippyMessage;
}

interface StaticcheckResult {
  file?: string;
  line?: number;
  column?: number;
  severity?: string;
  message?: string;
  code?: string;
}

interface RubocopLocation {
  line?: number;
  column?: number;
  last_line?: number;
  last_column?: number;
}

interface RubocopOffense {
  location?: RubocopLocation;
  severity?: string;
  message?: string;
  cop_name?: string;
}

interface RubocopFileEntry {
  path?: string;
  offenses?: RubocopOffense[];
}

interface RubocopOutputData {
  files?: RubocopFileEntry[];
}

interface ShellcheckResult {
  file?: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  level?: string;
  message?: string;
  code?: number;
}

interface StylelintWarning {
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  severity?: string;
  text?: string;
  rule?: string;
}

interface StylelintFileResult {
  source?: string;
  warnings?: StylelintWarning[];
}

// ═══════════════════════════════════════════════════════════════════════
// Parsers
// ═══════════════════════════════════════════════════════════════════════

export function parseEslintOutput(stdout: string, _cwd: string): LintIssue[] {
  try {
    const results = JSON.parse(stdout) as EslintFileResult[];
    if (!Array.isArray(results)) return [];

    const issues: LintIssue[] = [];
    for (const fileResult of results) {
      for (const msg of fileResult.messages || []) {
        issues.push({
          file: fileResult.filePath || "",
          line: msg.line ?? 1,
          column: msg.column ?? 1,
          endLine: msg.endLine ?? undefined,
          endColumn: msg.endColumn ?? undefined,
          severity: msg.severity === 2 ? "error" : "warning",
          message: msg.message || "",
          code: msg.ruleId ?? undefined,
          source: "eslint",
        });
      }
    }
    return issues;
  } catch {
    return [];
  }
}

function biomeResolvePath(locationPath: string | undefined, cwd: string): string {
  if (!locationPath) return "";
  return path.isAbsolute(locationPath) ? locationPath : path.resolve(cwd, locationPath);
}

function biomeSeverity(severity?: string): "error" | "warning" | "info" {
  if (severity === "error") return "error";
  if (severity === "warning") return "warning";
  return "info";
}

function biomeDiagnosticToIssue(d: BiomeDiagnostic, cwd: string): LintIssue {
  return {
    file: biomeResolvePath(d.location?.path, cwd),
    line: d.location?.start?.line ?? 1,
    column: d.location?.start?.column ?? 1,
    endLine: d.location?.end?.line,
    endColumn: d.location?.end?.column,
    severity: biomeSeverity(d.severity),
    message: d.message || "",
    code: d.category?.replace("lint/", "") ?? undefined,
    source: "biome",
  };
}

export function parseBiomeOutput(stdout: string, cwd: string): LintIssue[] {
  try {
    const jsonStart = stdout.indexOf("{");
    if (jsonStart === -1) return [];

    const data = JSON.parse(stdout.slice(jsonStart)) as {
      diagnostics?: BiomeDiagnostic[];
    };
    if (!data.diagnostics) return [];

    return data.diagnostics.map((d: BiomeDiagnostic) => biomeDiagnosticToIssue(d, cwd));
  } catch {
    return [];
  }
}

export function parseRuffOutput(stdout: string, _cwd: string): LintIssue[] {
  try {
    const results = JSON.parse(stdout) as RuffResult[];
    if (!Array.isArray(results)) return [];

    return results.map((r: RuffResult) => ({
      file: r.filename || "",
      line: r.location?.row ?? 1,
      column: r.location?.column ?? 1,
      endLine: r.end_location?.row,
      endColumn: r.end_location?.column,
      severity: r.severity === "error" ? "error" : "warning",
      message: r.message || "",
      code: r.code ?? undefined,
      source: "ruff",
    }));
  } catch {
    return [];
  }
}

export function parseFlake8Output(stdout: string, _cwd: string): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    const parts = line.split("\t");
    if (parts.length >= 5) {
      issues.push({
        file: parts[0],
        line: parseInt(parts[1], 10) || 1,
        column: parseInt(parts[2], 10) || 1,
        severity: parts[3].startsWith("E") || parts[3].startsWith("F") ? "error" : "warning",
        message: parts.slice(4).join("\t"),
        code: parts[3],
        source: "flake8",
      });
    }
  }
  return issues;
}

export function parsePylintOutput(stdout: string, _cwd: string): LintIssue[] {
  try {
    const results = JSON.parse(stdout) as PylintResult[];
    if (!Array.isArray(results)) return [];

    return results.map((r: PylintResult) => ({
      file: r.path || "",
      line: r.line ?? 1,
      column: (r.column ?? 0) + 1,
      endLine: r.endLine,
      endColumn: r.endColumn ? r.endColumn + 1 : undefined,
      severity:
        r.type === "error" || r.type === "fatal"
          ? "error"
          : r.type === "warning"
            ? "warning"
            : "info",
      message: r.message || "",
      code: r.symbol ?? r["message-id"] ?? undefined,
      source: "pylint",
    }));
  } catch {
    return [];
  }
}

export function parseMypyOutput(stdout: string, _cwd: string): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    try {
      const parsed = JSON.parse(line) as MypyResult;
      if (parsed.file && parsed.message) {
        issues.push({
          file: parsed.file,
          line: parsed.line ?? 1,
          column: (parsed.column ?? 0) + 1,
          endLine: parsed.end_line,
          endColumn: parsed.end_column ? parsed.end_column + 1 : undefined,
          severity: parsed.severity === "error" ? "error" : "warning",
          message: parsed.message || "",
          code: parsed.code ?? undefined,
          source: "mypy",
        });
      }
    } catch {
      /* skip non-JSON lines */
    }
  }
  return issues;
}

function clippyMessageToIssues(msg: ClippyMessage, cwd: string): LintIssue[] {
  const issues: LintIssue[] = [];
  const severity = msg.level === "error" ? "error" : "warning";
  const spans = msg.spans;
  if (spans && spans.length > 0) {
    for (const span of spans) {
      issues.push({
        file: path.resolve(cwd, span.file_name ?? ""),
        line: span.line_start ?? 1,
        column: span.column_start ?? 1,
        endLine: span.line_end,
        endColumn: span.column_end,
        severity,
        message: msg.message || "",
        code: msg.code?.code ?? undefined,
        source: "clippy",
      });
    }
  } else if (msg.message) {
    // Module-level warnings without precise spans
    issues.push({
      file: "",
      line: 1,
      column: 1,
      severity,
      message: msg.message,
      code: msg.code?.code ?? undefined,
      source: "clippy",
    });
  }
  return issues;
}

export function parseClippyOutput(stdout: string, cwd: string): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as ClippyEntry;
      if (entry.reason === "compiler-message" && entry.message) {
        issues.push(...clippyMessageToIssues(entry.message, cwd));
      }
    } catch {
      /* skip non-JSON lines */
    }
  }
  return issues;
}

export function parseStaticcheckOutput(stdout: string, cwd: string): LintIssue[] {
  const issues: LintIssue[] = [];
  for (const line of stdout.split("\n")) {
    if (!line.trim()) continue;
    try {
      const entry = JSON.parse(line) as StaticcheckResult;
      issues.push({
        file: path.resolve(cwd, entry.file || ""),
        line: entry.line ?? 1,
        column: entry.column ?? 1,
        severity: entry.severity === "error" ? "error" : "warning",
        message: entry.message || "",
        code: entry.code ?? undefined,
        source: "staticcheck",
      });
    } catch {
      // Try text format: file:line:col: message (code)
      const match = line.match(/^(.+?):(\d+):(\d+):\s*(.+?)(?:\s*\((\S+)\))?\s*$/);
      if (match) {
        issues.push({
          file: path.resolve(cwd, match[1]),
          line: parseInt(match[2], 10),
          column: parseInt(match[3], 10),
          severity: "warning",
          message: match[4],
          code: match[5],
          source: "staticcheck",
        });
      }
    }
  }
  return issues;
}

function rubocopSeverity(severity?: string): "error" | "warning" {
  return severity === "error" || severity === "fatal" ? "error" : "warning";
}

function rubocopOffenseToIssue(offense: RubocopOffense, filePath: string): LintIssue {
  return {
    file: filePath,
    line: offense.location?.line ?? 1,
    column: offense.location?.column ?? 1,
    endLine: offense.location?.last_line,
    endColumn: offense.location?.last_column,
    severity: rubocopSeverity(offense.severity),
    message: offense.message || "",
    code: offense.cop_name ?? undefined,
    source: "rubocop",
  };
}

export function parseRubocopOutput(stdout: string, _cwd: string): LintIssue[] {
  try {
    const data = JSON.parse(stdout) as RubocopOutputData;
    if (!data.files) return [];

    const issues: LintIssue[] = [];
    for (const fileEntry of data.files) {
      const filePath = fileEntry.path || "";
      for (const offense of fileEntry.offenses || []) {
        issues.push(rubocopOffenseToIssue(offense, filePath));
      }
    }
    return issues;
  } catch {
    return [];
  }
}

export function parseShellcheckOutput(stdout: string, _cwd: string): LintIssue[] {
  try {
    const results = JSON.parse(stdout) as ShellcheckResult[];
    if (!Array.isArray(results)) return [];

    return results.map((r: ShellcheckResult) => ({
      file: r.file || "",
      line: r.line ?? 1,
      column: r.column ?? 1,
      endLine: r.endLine,
      endColumn: r.endColumn,
      severity: r.level === "error" ? "error" : r.level === "warning" ? "warning" : "info",
      message: r.message || "",
      code: r.code ? `SC${r.code}` : undefined,
      source: "shellcheck",
    }));
  } catch {
    return [];
  }
}

export function parseStylelintOutput(stdout: string, _cwd: string): LintIssue[] {
  try {
    const results = JSON.parse(stdout) as StylelintFileResult[];
    if (!Array.isArray(results)) return [];

    const issues: LintIssue[] = [];
    for (const fileResult of results) {
      const warnings = fileResult.warnings || [];
      for (const w of warnings) {
        issues.push({
          file: fileResult.source || "",
          line: w.line ?? 1,
          column: w.column ?? 1,
          endLine: w.endLine,
          endColumn: w.endColumn,
          severity: w.severity === "error" ? "error" : "warning",
          message: w.text || "",
          code: w.rule ?? undefined,
          source: "stylelint",
        });
      }
    }
    return issues;
  } catch {
    return [];
  }
}
