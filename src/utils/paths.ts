/**
 * Path/URI utility functions for LSP operations
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";
import type { Location } from "vscode-languageserver-types";

// ── Path Helpers ───────────────────────────────────────────────────────────

/** Resolve a file path relative to cwd, with workspace boundary validation */
export function resolveFile(file: string, cwd: string): string {
  const resolved = path.isAbsolute(file) ? file : path.resolve(cwd, file);
  // Normalize to prevent path traversal
  const normalized = path.normalize(resolved);
  // Validate the resolved path is within the workspace
  try {
    const realCwd = fs.realpathSync(cwd);
    // For paths that don't exist yet, use normalized path; for existing paths, use realpath
    let realPath: string;
    try {
      realPath = fs.realpathSync(normalized);
    } catch {
      // File doesn't exist — resolve the parent directory instead
      const parent = path.dirname(normalized);
      try {
        const realParent = fs.realpathSync(parent);
        realPath = path.join(realParent, path.basename(normalized));
      } catch {
        throw new Error(`Path traversal: "${file}" resolves outside the workspace.`);
      }
    }
    if (!realPath.startsWith(realCwd + path.sep) && realPath !== realCwd) {
      throw new Error(`Path traversal: "${file}" resolves outside the workspace.`);
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Path traversal:")) throw err;
    // If realpath fails (cwd doesn't exist), just use normalized path
  }
  return normalized;
}

/** Convert a file:// URI to a local file path */
export function uriToFilePath(uri: string): string {
  return decodeURIComponent(uri.replace(/^file:\/\//, ""));
}

/** Convert a local file path to a file:// URI */
export function filePathToUri(filePath: string): string {
  return pathToFileURL(filePath).href;
}

// ── Workspace Boundary Check ───────────────────────────────────────────────

/** Check whether a file path is within the given workspace root */
export function isWithinWorkspace(filePath: string, workspaceRoot: string): boolean {
  const normalizedFile = path.normalize(filePath);
  const normalizedRoot = path.normalize(workspaceRoot);
  try {
    const realRoot = fs.realpathSync(workspaceRoot);
    let realFile: string;
    try {
      realFile = fs.realpathSync(normalizedFile);
    } catch {
      // File doesn't exist — resolve the parent directory instead
      const parent = path.dirname(normalizedFile);
      try {
        const realParent = fs.realpathSync(parent);
        realFile = path.join(realParent, path.basename(normalizedFile));
      } catch {
        return false;
      }
    }
    return realFile.startsWith(realRoot + path.sep) || realFile === realRoot;
  } catch {
    return normalizedFile.startsWith(normalizedRoot + path.sep);
  }
}

// ── Location Helpers ───────────────────────────────────────────────────────

/** Normalize LSP Location result (single, array, or null) into a flat array */
export function flattenLocations(result: Location | Location[] | null): Location[] {
  if (Array.isArray(result)) return result;
  if (result && typeof result === "object" && "uri" in result) return [result];
  return [];
}

/** Format locations as `filepath:line:col` lines */
export function formatLocations(locations: Location[]): string {
  return locations.length > 0
    ? locations
        .map(
          (l) =>
            `  ${uriToFilePath(l.uri)}:${l.range.start.line + 1}:${l.range.start.character + 1}`,
        )
        .join("\n")
    : "(none)";
}
