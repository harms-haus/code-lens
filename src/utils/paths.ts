/**
 * Path/URI utility functions for LSP operations
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import type { Location } from "vscode-languageserver-types";

// ── Cached Realpath ─────────────────────────────────────────────────────────

const realpathCache = new Map<string, string>();

/** Resolve a path to its real (canonical) path, caching results.
 *  Throws if the path does not exist (callers already have try/catch). */
function cachedRealpath(p: string): string {
  const cached = realpathCache.get(p);
  if (cached !== undefined) return cached;
  const real = fs.realpathSync(p);
  realpathCache.set(p, real);
  return real;
}

// ── Path Helpers ───────────────────────────────────────────────────────────

/** Resolve a file path relative to cwd, with workspace boundary validation */
export function resolveFile(file: string, cwd: string): string {
  const resolved = path.isAbsolute(file) ? file : path.resolve(cwd, file);
  // Normalize to prevent path traversal
  const normalized = path.normalize(resolved);
  // Validate the resolved path is within the workspace
  try {
    const realCwd = cachedRealpath(cwd);
    // For paths that don't exist yet, use normalized path; for existing paths, use realpath
    let realPath: string;
    try {
      realPath = cachedRealpath(normalized);
    } catch {
      // File doesn't exist — resolve the parent directory instead
      const parent = path.dirname(normalized);
      try {
        const realParent = cachedRealpath(parent);
        realPath = path.join(realParent, path.basename(normalized));
      } catch {
        throw new Error(`Path traversal: "${file}" resolves outside the workspace.`);
      }
    }
    const isWithin = process.platform === "win32"
      ? realPath.toLowerCase().startsWith(realCwd.toLowerCase() + path.sep) || realPath.toLowerCase() === realCwd.toLowerCase()
      : realPath.startsWith(realCwd + path.sep) || realPath === realCwd;
    if (!isWithin) {
      throw new Error(`Path traversal: "${file}" resolves outside the workspace.`);
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith("Path traversal:")) throw err;
    throw new Error(`Workspace directory is inaccessible: "${cwd}"`, { cause: err });
  }
  return normalized;
}

/** Convert a file:// URI to a local file path */
export function uriToFilePath(uri: string): string {
  const filePath = fileURLToPath(uri);
  // On non-Windows platforms, fileURLToPath may leave a leading slash before
  // a Windows-style drive letter (e.g. "/C:/..."). Strip it for correctness.
  return filePath.replace(/^\/+([A-Za-z]:)/, "$1");
}

/** Convert a local file path to a file:// URI */
export function filePathToUri(filePath: string): string {
  return pathToFileURL(filePath).href;
}

// ── Workspace Boundary Check ───────────────────────────────────────────────

/** Check whether a file path is within the given workspace root */
export function isWithinWorkspace(filePath: string, workspaceRoot: string): boolean {
  const normalizedFile = path.normalize(filePath);
  try {
    const realRoot = cachedRealpath(workspaceRoot);
    let realFile: string;
    try {
      realFile = cachedRealpath(normalizedFile);
    } catch {
      // File doesn't exist — resolve the parent directory instead
      const parent = path.dirname(normalizedFile);
      try {
        const realParent = cachedRealpath(parent);
        realFile = path.join(realParent, path.basename(normalizedFile));
      } catch {
        return false;
      }
    }
    const isWithin = process.platform === "win32"
      ? realFile.toLowerCase().startsWith(realRoot.toLowerCase() + path.sep) || realFile.toLowerCase() === realRoot.toLowerCase()
      : realFile.startsWith(realRoot + path.sep) || realFile === realRoot;
    return isWithin;
  } catch {
    return false; // Don't trust unresolved paths
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
