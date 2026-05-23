import * as fs from "node:fs";
import * as path from "node:path";
import { execCommand } from "../utils/spawn.js";
import type { LinterDefinition, DetectedLinter } from "./types.js";
import { LINTER_DEFINITIONS } from "./definitions.js";

// ═══════════════════════════════════════════════════════════════════════
// Detection Logic
// ═══════════════════════════════════════════════════════════════════════

/** Map of linter names to their pyproject.toml section headers */
const PYPROJECT_SECTIONS: Record<string, string> = {
  ruff: "[tool.ruff]",
  pylint: "[tool.pylint]",
  mypy: "[tool.mypy]",
};

/** Map of linter names to their setup.cfg/tox.ini section headers */
const CFG_SECTIONS: Record<string, string> = {
  flake8: "[flake8]",
};

/** Directories to always ignore when scanning for project files */
const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  "__pycache__",
  ".venv",
  "venv",
  "target",
  ".mypy_cache",
  ".ruff_cache",
]);

/**
 * Check if pyproject.toml contains a specific section header at line start.
 */
function checkPyprojectSection(cwd: string, section: string): boolean {
  const pyprojectPath = path.join(cwd, "pyproject.toml");
  try {
    const content = fs.readFileSync(pyprojectPath, "utf-8");
    return content.split("\n").some((line) => line.trim() === section);
  } catch {
    return false;
  }
}

/**
 * Look for a config file from the linter's list.
 * Handles special cases:
 * - setup.cfg / tox.ini require a relevant section header
 * - pyproject.toml requires a linter-specific section
 */
function findConfigFile(
  cwd: string,
  configFiles: string[],
  linterName: string,
): string | undefined {
  for (const file of configFiles) {
    const fullPath = path.join(cwd, file);
    if (!fs.existsSync(fullPath)) continue;

    // setup.cfg and tox.ini: verify they contain the relevant section
    if (file === "setup.cfg" || file === "tox.ini") {
      const section = CFG_SECTIONS[linterName];
      if (section) {
        try {
          const content = fs.readFileSync(fullPath, "utf-8");
          if (!content.includes(section)) continue;
        } catch {
          continue;
        }
      }
    }

    // pyproject.toml: verify it contains the linter's section
    if (file === "pyproject.toml") {
      const section = PYPROJECT_SECTIONS[linterName];
      if (section && checkPyprojectSection(cwd, section)) return fullPath;
      continue;
    }

    return fullPath;
  }
  return undefined;
}

/**
 * Check package.json for linter-related dependency keys.
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

interface LinterCandidate {
  def: LinterDefinition;
  configFile: string | undefined;
  detectionSource: CandidateSource;
}

// ═══════════════════════════════════════════════════════════════════════
// Cache
// ═══════════════════════════════════════════════════════════════════════

let cachedLinters: DetectedLinter[] | null = null;
let cachedCwd: string | null = null;

/** Invalidate the linter detection cache so the next call re-detects. */
export function invalidateLinterCache(): void {
  cachedLinters = null;
  cachedCwd = null;
}

/** Check a single linter definition against config files, package.json keys, and project markers. */
function checkLinterCandidate(
  cwd: string,
  def: LinterDefinition,
  pkgCache: Record<string, unknown> | undefined,
): LinterCandidate | undefined {
  // Step 1: Check for config files
  const configFile = findConfigFile(cwd, def.configFiles, def.name);
  if (configFile) {
    return { def, configFile, detectionSource: "config-file" };
  }

  // Step 1b: Special pyproject.toml section checks
  if (PYPROJECT_SECTIONS[def.name]) {
    if (checkPyprojectSection(cwd, PYPROJECT_SECTIONS[def.name])) {
      return { def, configFile: path.join(cwd, "pyproject.toml"), detectionSource: "config-file" };
    }
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

/**
 * Scan the project for available linters.
 * Checks config files, package.json keys, project markers, and verifies installation.
 * Results are cached per cwd; call invalidateLinterCache() to force re-detection.
 */
export async function detectLinters(cwd: string): Promise<DetectedLinter[]> {
  // Return cached result if cwd hasn't changed
  if (cachedLinters !== null && cachedCwd === cwd) {
    return cachedLinters;
  }

  // Cache file reads that are shared across linter checks
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
  const candidates: LinterCandidate[] = [];
  for (const def of LINTER_DEFINITIONS) {
    const candidate = checkLinterCandidate(cwd, def, pkgCache);
    if (candidate) candidates.push(candidate);
  }

  if (candidates.length === 0) {
    cachedLinters = [];
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

  const detected: DetectedLinter[] = [];
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

  cachedLinters = detected;
  cachedCwd = cwd;
  return detected;
}

/**
 * Return the subset of detected linters that can handle the given file.
 */
export function getLintersForFile(filePath: string, detected: DetectedLinter[]): DetectedLinter[] {
  const ext = path.extname(filePath).toLowerCase();
  return detected.filter((d) => d.definition.extensions.includes(ext));
}

/**
 * Return the subset of detected linters that are relevant for the given files,
 * along with the matching files for each linter.
 */
export function getRelevantLinters(
  linters: DetectedLinter[],
  files: string[],
): Map<DetectedLinter, string[]> {
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

  const result = new Map<DetectedLinter, string[]>();
  for (const linter of linters) {
    const matchingFiles: string[] = [];
    for (const ext of linter.definition.extensions) {
      const extFiles = filesByExt.get(ext);
      if (extFiles) {
        for (const f of extFiles) matchingFiles.push(f);
      }
    }
    if (matchingFiles.length > 0) {
      result.set(linter, matchingFiles);
    }
  }
  return result;
}

/**
 * Return all file extensions covered by the detected linters (sorted for deterministic output).
 */
export function getCoveredExtensions(detected: DetectedLinter[]): string[] {
  const exts = new Set<string>();
  for (const d of detected) {
    for (const ext of d.definition.extensions) {
      exts.add(ext);
    }
  }
  return Array.from(exts).sort();
}

/**
 * Discover files matching given extensions using Node.js native fs (cross-platform, no shell injection).
 * Returns up to `maxFiles` results (default 1000).
 */
export async function discoverFilesNative(
  cwd: string,
  extensions: string[],
  maxFiles = 1000,
  signal?: AbortSignal,
): Promise<string[]> {
  if (extensions.length === 0) return [];

  const extSet = new Set(extensions);
  const files: string[] = [];

  async function walk(dir: string): Promise<void> {
    if (signal?.aborted) return;
    if (files.length >= maxFiles) return;

    let entries: fs.Dirent[];
    try {
      entries = await fs.promises.readdir(dir, { withFileTypes: true });
    } catch {
      return; // Permission denied or similar — skip
    }

    for (const entry of entries) {
      if (signal?.aborted) return;
      if (files.length >= maxFiles) return;

      if (entry.isDirectory()) {
        if (!IGNORE_DIRS.has(entry.name) && !entry.name.startsWith(".")) {
          await walk(path.join(dir, entry.name));
        }
      } else if (entry.isFile()) {
        if (extSet.has(path.extname(entry.name).toLowerCase())) {
          files.push(path.join(dir, entry.name));
        }
      }
    }
  }

  await walk(cwd);
  return files;
}
