import * as fs from "node:fs";
import * as path from "node:path";
import { execCommand } from "../utils/spawn.js";
import type { FormatterDefinition, DetectedFormatter } from "./types.js";
import { FORMATTER_DEFINITIONS } from "./formatter-definitions.js";

// ═══════════════════════════════════════════════════════════════════════
// Detection Logic
//════════════════════════════════════════════════════════════════════════

/**
 * Look for a config file from the formatter's list.
 */
function findConfigFile(
  cwd: string,
  configFiles: string[],
): string | undefined {
  for (const file of configFiles) {
    const fullPath = path.join(cwd, file);
    if (fs.existsSync(fullPath)) return fullPath;
  }
  return undefined;
}

/**
 * Check package.json for formatter-related dependency keys.
 * Reads package.json once and caches.
 */
function checkPackageJson(
  cwd: string,
  keys: string[],
  pkgCache?: Record<string, unknown>,
): boolean {
  let pkg: Record<string, unknown>;
  if (pkgCache) {
    pkg = pkgCache;
  } else {
    const pkgPath = path.join(cwd, "package.json");
    try {
      const content = fs.readFileSync(pkgPath, "utf-8");
      pkg = JSON.parse(content) as Record<string, unknown>;
    } catch {
      return false;
    }
  }

  const deps = Object.create(null) as Record<string, unknown>;
  const depSections = ["dependencies", "devDependencies", "optionalDependencies"] as const;
  for (const section of depSections) {
    const val = pkg[section];
    if (val && typeof val === "object") {
      for (const [k, v] of Object.entries(val)) {
        deps[k] = v;
      }
    }
  }

  return keys.some((key) => key in deps);
}

function checkProjectMarkers(cwd: string, markers: string[]): boolean {
  return markers.some((m) => fs.existsSync(path.join(cwd, m)));
}

async function verifyInstalled(versionCommand: string): Promise<string | undefined> {
  const parts = versionCommand.split(" ");
  const cmd = parts[0];
  const cmdArgs = parts.slice(1);
  try {
    const result = await execCommand(cmd, cmdArgs, {
      cwd: process.cwd(),
      timeout: 10_000,
    });
    if (result.exitCode !== 0) return undefined;
    const version = result.stdout.trim().split("\n")[0];
    return version || undefined;
  } catch {
    return undefined;
  }
}

type CandidateSource = "config-file" | "package-key" | "project-marker";

interface FormatterCandidate {
  def: FormatterDefinition;
  configFile: string | undefined;
  detectionSource: CandidateSource;
}

/** Check a single formatter definition against config files, package.json keys, and project markers. */
function checkFormatterCandidate(
  cwd: string,
  def: FormatterDefinition,
  pkgCache: Record<string, unknown> | undefined,
): FormatterCandidate | undefined {
  // Step 1: Check for config files
  const configFile = findConfigFile(cwd, def.configFiles);
  if (configFile) {
    return { def, configFile, detectionSource: "config-file" };
  }

  // Step 2: Check package.json devDependencies
  if (def.packageKeys && checkPackageJson(cwd, def.packageKeys, pkgCache)) {
    return { def, configFile: undefined, detectionSource: "package-key" };
  }

  // Step 3: Check project markers
  if (def.projectMarkers && def.projectMarkers.length > 0) {
    if (checkProjectMarkers(cwd, def.projectMarkers)) {
      return { def, configFile: undefined, detectionSource: "project-marker" };
    }
  }

  return undefined;
}

// ═══════════════════════════════════════════════════════════════════════
// Cache
// ═══════════════════════════════════════════════════════════════════════

let cachedFormatters: DetectedFormatter[] | null = null;
let cachedCwd: string | null = null;

/** Invalidate the formatter detection cache so the next call re-detects. */
export function invalidateFormatterCache(): void {
  cachedFormatters = null;
  cachedCwd = null;
}

// ═══════════════════════════════════════════════════════════════════════
// Public API
// ═══════════════════════════════════════════════════════════════════════

/**
 * Scan the project for available formatters.
 * Checks config files, package.json keys, project markers, and verifies installation.
 * Results are cached per cwd; call invalidateFormatterCache() to force re-detection.
 */
export async function detectFormatters(cwd: string): Promise<DetectedFormatter[]> {
  // Return cached result if cwd hasn't changed
  if (cachedFormatters !== null && cachedCwd === cwd) {
    return cachedFormatters;
  }

  // Cache file reads that are shared across formatter checks
  let pkgCache: Record<string, unknown> | undefined;
  const pkgPath = path.join(cwd, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const content = fs.readFileSync(pkgPath, "utf-8");
      pkgCache = JSON.parse(content) as Record<string, unknown>;
    } catch {
      /* ignore */
    }
  }

  // Phase 1: Collect candidates that pass config/marker checks (synchronous, fast)
  const candidates: FormatterCandidate[] = [];
  for (const def of FORMATTER_DEFINITIONS) {
    const candidate = checkFormatterCandidate(cwd, def, pkgCache);
    if (candidate) candidates.push(candidate);
  }

  if (candidates.length === 0) {
    cachedFormatters = [];
    cachedCwd = cwd;
    return [];
  }

  // Phase 2: Verify installation in parallel
  const results = await Promise.allSettled(
    candidates.map(async ({ def, configFile, detectionSource }) => ({
      definition: def,
      configFile,
      detectionSource,
      version: await verifyInstalled(def.versionCommand),
    })),
  );

  const detected: DetectedFormatter[] = [];
  for (const result of results) {
    if (result.status === "fulfilled" && result.value.version !== undefined) {
      detected.push({
        definition: result.value.definition,
        configFile: result.value.configFile,
        version: result.value.version,
        detectionSource: result.value.detectionSource,
      });
    }
  }

  cachedFormatters = detected;
  cachedCwd = cwd;
  return detected;
}

/**
 * Return the subset of detected formatters that can handle the given file.
 */
export function getFormattersForFile(
  formatters: DetectedFormatter[],
  filePath: string,
): DetectedFormatter[] {
  const ext = path.extname(filePath).toLowerCase();
  return formatters.filter((f) => f.definition.extensions.includes(ext));
}

/**
 * Return the subset of detected formatters that are relevant for the given files,
 * along with the matching files for each formatter.
 */
export function getRelevantFormatters(
  formatters: DetectedFormatter[],
  files: string[],
): Map<DetectedFormatter, string[]> {
  // Pre-group files by extension for O(1) lookup
  const filesByExt = new Map<string, string[]>();
  for (const f of files) {
    const ext = path.extname(f).toLowerCase();
    let arr = filesByExt.get(ext);
    if (!arr) {
      arr = [];
      filesByExt.set(ext, arr);
    }
    arr.push(f);
  }

  const result = new Map<DetectedFormatter, string[]>();
  for (const formatter of formatters) {
    const matchingFiles: string[] = [];
    for (const ext of formatter.definition.extensions) {
      const extFiles = filesByExt.get(ext);
      if (extFiles) {
        for (const f of extFiles) matchingFiles.push(f);
      }
    }
    if (matchingFiles.length > 0) {
      result.set(formatter, matchingFiles);
    }
  }
  return result;
}

/**
 * Return all file extensions covered by the detected formatters as a Set.
 */
export function getFormatterCoveredExtensions(formatters: DetectedFormatter[]): Set<string> {
  const exts = new Set<string>();
  for (const f of formatters) {
    for (const ext of f.definition.extensions) {
      exts.add(ext);
    }
  }
  return exts;
}
