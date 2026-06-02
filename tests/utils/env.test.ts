import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getSanitizedEnv } from "../../src/utils/env.js";

describe("getSanitizedEnv", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Replace process.env with a controlled copy for deterministic tests
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns only allowed keys that are present in process.env", () => {
    // Wipe all allowed keys first so we have a deterministic baseline
    const allAllowed = [
      "PATH",
      "HOME",
      "LANG",
      "LC_ALL",
      "TERM",
      "NODE_PATH",
      "GOPATH",
      "PYTHONPATH",
      "CARGO_HOME",
      "RUSTUP_HOME",
      // Windows-specific
      "USERPROFILE",
      "TEMP",
      "TMP",
      "APPDATA",
      "LOCALAPPDATA",
      "SystemRoot",
      "ComSpec",
      "PATHEXT",
      "WINDIR",
      "PROGRAMFILES",
      "PROGRAMFILES(X86)",
      "PROGRAMDATA",
    ];
    for (const key of allAllowed) {
      delete process.env[key];
    }

    process.env.PATH = "/usr/bin:/bin";
    process.env.HOME = "/home/testuser";
    process.env.LANG = "en_US.UTF-8";
    process.env.GOPATH = "/home/testuser/go";

    const result = getSanitizedEnv();

    expect(result.PATH).toBe("/usr/bin:/bin");
    expect(result.HOME).toBe("/home/testuser");
    expect(result.LANG).toBe("en_US.UTF-8");
    expect(result.GOPATH).toBe("/home/testuser/go");
    // Should not contain extra keys beyond the 4 we set
    expect(Object.keys(result).length).toBe(4);
  });

  it("omits disallowed keys like SECRET_TOKEN and DATABASE_URL", () => {
    process.env.SECRET_TOKEN = "super-secret";
    process.env.DATABASE_URL = "postgres://user:pass@host/db";
    process.env.PATH = "/usr/bin";

    const result = getSanitizedEnv();

    expect(result).not.toHaveProperty("SECRET_TOKEN");
    expect(result).not.toHaveProperty("DATABASE_URL");
    expect(result.PATH).toBe("/usr/bin");
  });

  it("includes PATH if present in env", () => {
    // Clear other allowed keys for determinism
    const allAllowed = [
      "HOME",
      "LANG",
      "LC_ALL",
      "TERM",
      "NODE_PATH",
      "GOPATH",
      "PYTHONPATH",
      "CARGO_HOME",
      "RUSTUP_HOME",
      // Windows-specific
      "USERPROFILE",
      "TEMP",
      "TMP",
      "APPDATA",
      "LOCALAPPDATA",
      "SystemRoot",
      "ComSpec",
      "PATHEXT",
      "WINDIR",
      "PROGRAMFILES",
      "PROGRAMFILES(X86)",
      "PROGRAMDATA",
    ];
    for (const key of allAllowed) {
      delete process.env[key];
    }
    process.env.PATH = "/usr/local/bin:/usr/bin";

    const result = getSanitizedEnv();

    expect(result.PATH).toBe("/usr/local/bin:/usr/bin");
    expect(Object.keys(result)).toEqual(["PATH"]);
  });

  it("returns an empty-ish object when no allowed keys are in env", () => {
    // Strip all allowed keys (including Windows-specific)
    for (const key of [
      "PATH",
      "HOME",
      "LANG",
      "LC_ALL",
      "TERM",
      "NODE_PATH",
      "GOPATH",
      "PYTHONPATH",
      "CARGO_HOME",
      "RUSTUP_HOME",
      "USERPROFILE",
      "TEMP",
      "TMP",
      "APPDATA",
      "LOCALAPPDATA",
      "SystemRoot",
      "ComSpec",
      "PATHEXT",
      "WINDIR",
      "PROGRAMFILES",
      "PROGRAMFILES(X86)",
      "PROGRAMDATA",
    ]) {
      delete process.env[key];
    }

    const result = getSanitizedEnv();

    // Should have no keys
    expect(Object.keys(result)).toEqual([]);
  });

  it("does not include undefined values for missing allowed keys", () => {
    delete process.env.GOPATH;
    delete process.env.PYTHONPATH;
    process.env.PATH = "/usr/bin";

    const result = getSanitizedEnv();

    expect(result).toHaveProperty("PATH");
    expect(result).not.toHaveProperty("GOPATH");
    expect(result).not.toHaveProperty("PYTHONPATH");
  });
});

describe("Windows environment variables", () => {
  it("includes Windows-essential keys when present", () => {
    vi.stubEnv("SystemRoot", "C:\\Windows");
    vi.stubEnv("ComSpec", "C:\\Windows\\System32\\cmd.exe");
    vi.stubEnv("USERPROFILE", "C:\\Users\\test");
    vi.stubEnv("TEMP", "C:\\Users\\test\\AppData\\Local\\Temp");
    const result = getSanitizedEnv();
    expect(result.SystemRoot).toBe("C:\\Windows");
    expect(result.ComSpec).toBe("C:\\Windows\\System32\\cmd.exe");
    expect(result.USERPROFILE).toBe("C:\\Users\\test");
    expect(result.TEMP).toBe("C:\\Users\\test\\AppData\\Local\\Temp");
    vi.unstubAllEnvs();
  });
});
