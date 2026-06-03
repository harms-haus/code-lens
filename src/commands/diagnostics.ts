/**
 * diagnostics command: Run LSP diagnostics on files or the workspace
 */

import { registerCommand } from "../daemon/server.js";
import type { LspManager } from "../lsp/lsp-manager.js";
import { uriToFilePath, resolveFile } from "../utils/paths.js";
import { formatDiagnosticLine, countSeverities } from "../formatting/diagnostics.js";
import { ok, err, sanitizeError } from "../formatting/output.js";
import { executePreamble } from "./preamble.js";
import { detectFormatters, getFormattersForFile } from "../linting/formatter-registry.js";
import { runFormattersDiagnose, formatFormatterResults, summarizeFormatterResults } from "../linting/formatter-runner.js";
import type { FormatterResult } from "../linting/types.js";

// ── Workspace Mode ─────────────────────────────────────────────────────────

function handleWorkspaceDiagnostics(manager: LspManager) {
  const allDiags = manager.getAllDiagnostics();
  if (allDiags.size === 0) {
    return ok(
      "No diagnostics available. No files have been opened yet or no servers are running.",
      { workspace: true, fileCount: 0, total: 0, errorCount: 0, warningCount: 0, infoCount: 0 },
    );
  }

  let totalErrors = 0;
  let totalWarnings = 0;
  let totalInfo = 0;
  let totalDiags = 0;
  const fileSections: string[] = [];

  for (const [uri, diagnostics] of allDiags) {
    if (diagnostics.length === 0) continue;

    const filePath = uri.startsWith("file://") ? uriToFilePath(uri) : uri;
    const { errors: errorCount, warnings: warningCount, info: infoCount } =
      countSeverities(diagnostics);

    totalErrors += errorCount;
    totalWarnings += warningCount;
    totalInfo += infoCount;
    totalDiags += diagnostics.length;

    const lines = diagnostics.map(formatDiagnosticLine);
    fileSections.push(
      `${filePath} (${errorCount} error(s), ${warningCount} warning(s), ${infoCount} info):\n` +
        lines.join("\n"),
    );
  }

  const summary =
    `Workspace diagnostics:\n` +
    `${allDiags.size} file(s), ${totalErrors} error(s), ${totalWarnings} warning(s), ${totalInfo} info message(s)\n\n` +
    (fileSections.length > 0 ? fileSections.join("\n\n") : "No issues found.");

  return ok(summary, {
    workspace: true,
    fileCount: allDiags.size,
    total: totalDiags,
    errorCount: totalErrors,
    warningCount: totalWarnings,
    infoCount: totalInfo,
  });
}

// ── Single File Mode ───────────────────────────────────────────────────────

async function handleSingleFileDiagnostics(
  file: string,
  refresh: boolean,
  raw: boolean,
  noFormatters: boolean,
  manager: LspManager,
  cwd: string,
) {
  const preamble = await executePreamble(file, manager, cwd);
  if ("error" in preamble) return preamble.error;

  const { filePath, config } = preamble.ok;
  const diagnostics = await manager.getDiagnostics(filePath, refresh);
  const { errors: errorCount, warnings: warningCount, info: infoCount } =
    countSeverities(diagnostics);

  // When raw=true, include structured Diagnostic[] in details
  if (raw) {
    return ok(
      `${diagnostics.length} diagnostic(s) for ${file} (${config.language})`,
      {
        file,
        language: config.language,
        errorCount,
        warningCount,
        infoCount,
        total: diagnostics.length,
        diagnostics: diagnostics.map(d => ({
          range: d.range,
          severity: d.severity,
          code: d.code,
          source: d.source,
          message: d.message,
        })),
      },
    );
  }

  const lines = diagnostics.map(formatDiagnosticLine);

  let summary =
    `Diagnostics for ${file} (${config.language}):\n` +
    `${errorCount} error(s), ${warningCount} warning(s), ${infoCount} info message(s)\n\n` +
    (lines.length > 0 ? lines.join("\n") : "No issues found.");

  // Run formatter diagnose unless explicitly disabled
  let formatterResults: FormatterResult[] = [];
  if (!noFormatters) {
    const formatters = await detectFormatters(cwd);
    const matching = getFormattersForFile(formatters, filePath);
    if (matching.length > 0) {
      formatterResults = await runFormattersDiagnose(matching, [filePath], cwd);
      const formatterOutput = formatFormatterResults(formatterResults, cwd);
      if (formatterOutput) {
        summary += `\n\nFormatter: ${summarizeFormatterResults(formatterResults)}\n${formatterOutput}`;
      }
    }
  }

  const details = {
    file,
    language: config.language,
    errorCount,
    warningCount,
    infoCount,
    total: diagnostics.length,
  };

  if (errorCount > 0 || formatterResults.some(r => r.changed)) {
    return err(summary, details);
  }
  return ok(summary, details);
}

// ── Multi-File Mode ────────────────────────────────────────────────────────

async function handleMultiFileDiagnostics(
  files: string,
  refresh: boolean,
  noFormatters: boolean,
  manager: LspManager,
  cwd: string,
) {
  const filePaths = files
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean);
  const sections: string[] = [];
  let totalErrors = 0;
  let totalWarnings = 0;
  let totalInfo = 0;

  for (const file of filePaths) {
    const preamble = await executePreamble(file, manager, cwd);
    if ("error" in preamble) {
      sections.push(preamble.error.content[0]?.text ?? "Unknown error");
      continue;
    }

    const { filePath, config } = preamble.ok;
    const diagnostics = await manager.getDiagnostics(filePath, refresh);
    const { errors: errorCount, warnings: warningCount, info: infoCount } =
      countSeverities(diagnostics);

    totalErrors += errorCount;
    totalWarnings += warningCount;
    totalInfo += infoCount;

    const lines = diagnostics.map(formatDiagnosticLine);
    sections.push(
      `Diagnostics for ${file} (${config.language}):\n` +
        `${errorCount} error(s), ${warningCount} warning(s), ${infoCount} info message(s)\n\n` +
        (lines.length > 0 ? lines.join("\n") : "No issues found."),
    );
  }

  let output = sections.join("\n\n---\n\n");

  // Run formatter diagnose on all files unless explicitly disabled
  let formatterResults: FormatterResult[] = [];
  if (!noFormatters) {
    const formatters = await detectFormatters(cwd);
    if (formatters.length > 0) {
      const validatedPaths: string[] = [];
      for (const file of filePaths) {
        try {
          validatedPaths.push(resolveFile(file, cwd));
        } catch {
          // skip paths that fail validation (already reported above)
        }
      }
      formatterResults = await runFormattersDiagnose(formatters, validatedPaths, cwd);
      const formatterOutput = formatFormatterResults(formatterResults, cwd);
      if (formatterOutput) {
        output += `\n\nFormatter: ${summarizeFormatterResults(formatterResults)}\n${formatterOutput}`;
      }
    }
  }

  const details = {
    files: filePaths,
    totalErrors,
    totalWarnings,
    totalInfo,
  };

  if (totalErrors > 0 || formatterResults.some(r => r.changed)) {
    return err(output, details);
  }
  return ok(output, details);
}

// ── Handler ────────────────────────────────────────────────────────────────

registerCommand("diagnostics", async (params, manager, cwd) => {
  const workspace = params.workspace === true;
  const refresh = params.refresh === true;
  const raw = params.raw === true;
  const noFormatters = params.noFormatters === true;
  const files = typeof params.files === "string" ? params.files : undefined;

  if (workspace) {
    try {
      return handleWorkspaceDiagnostics(manager);
    } catch (e) {
      return err(sanitizeError(e, "Failed to get workspace diagnostics"));
    }
  }

  if (files) {
    try {
      return await handleMultiFileDiagnostics(files, refresh, noFormatters, manager, cwd);
    } catch (e) {
      return err(sanitizeError(e, "Failed to get diagnostics"), { files });
    }
  }

  if (typeof params.file === "string") {
    try {
      return await handleSingleFileDiagnostics(params.file, refresh, raw, noFormatters, manager, cwd);
    } catch (e) {
      return err(sanitizeError(e, "Failed to get diagnostics"), { file: params.file });
    }
  }

  return err("No files or workspace mode specified. Provide --files or --workspace.");
});
