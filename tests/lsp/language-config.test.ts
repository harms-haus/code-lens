import { describe, it, expect, vi } from "vitest";
import {
  languageFromPath,
  isServerInstalled,
  LANGUAGE_SERVERS,
} from "../../src/lsp/language-config.js";
import { getConfigForExtension } from "../../src/lsp/language-registry.js";
import type { LspServerConfig } from "../../src/lsp/types.js";
import spawn from "cross-spawn";

vi.mock("cross-spawn", () => ({ default: vi.fn() }));

describe("language-config", () => {
  describe("languageFromPath", () => {
    it("maps .ts extension to typescript config", () => {
      const config = languageFromPath("src/index.ts");
      expect(config).toBeDefined();
      expect(config!.language).toBe("typescript");
    });

    it("maps .tsx extension to typescript config", () => {
      const config = languageFromPath("src/App.tsx");
      expect(config).toBeDefined();
      expect(config!.language).toBe("typescript");
    });

    it("maps .py extension to python config", () => {
      const config = languageFromPath("main.py");
      expect(config).toBeDefined();
      expect(config!.language).toBe("python");
    });

    it("maps .rs extension to rust config", () => {
      const config = languageFromPath("src/main.rs");
      expect(config).toBeDefined();
      expect(config!.language).toBe("rust");
    });

    it("maps .go extension to go config", () => {
      const config = languageFromPath("main.go");
      expect(config).toBeDefined();
      expect(config!.language).toBe("go");
    });

    it("returns undefined for .unknown extension", () => {
      const config = languageFromPath("file.unknown");
      expect(config).toBeUndefined();
    });

    it("maps Dockerfile (bare filename) to dockerfile config", () => {
      const config = languageFromPath("Dockerfile");
      expect(config).toBeDefined();
      expect(config!.language).toBe("dockerfile");
    });

    it("returns undefined for Dockerfile.dev (not a recognized extension)", () => {
      const config = languageFromPath("Dockerfile.dev");
      expect(config).toBeUndefined();
    });

    it("maps .js extension to typescript config (shared with JS)", () => {
      const config = languageFromPath("index.js");
      expect(config).toBeDefined();
      expect(config!.language).toBe("typescript");
    });

    it("maps .css extension to css config", () => {
      const config = languageFromPath("styles.css");
      expect(config).toBeDefined();
      expect(config!.language).toBe("css");
    });

    it("maps .sh extension to bash config", () => {
      const config = languageFromPath("script.sh");
      expect(config).toBeDefined();
      expect(config!.language).toBe("bash");
    });

    it("returns undefined for a path with no extension and no matching basename", () => {
      const config = languageFromPath("Makefile");
      expect(config).toBeUndefined();
    });

    it("handles multiple dots in filename: file.test.ts → typescript", () => {
      const config = languageFromPath("file.test.ts");
      expect(config).toBeDefined();
      expect(config!.language).toBe("typescript");
    });

    it("handles directory with dots: src/v2.0/module.rs → rust", () => {
      const config = languageFromPath("src/v2.0/module.rs");
      expect(config).toBeDefined();
      expect(config!.language).toBe("rust");
    });

    it("returns undefined for empty string", () => {
      const config = languageFromPath("");
      expect(config).toBeUndefined();
    });
  });

  describe("LANGUAGE_SERVERS registry", () => {
    it("has at least 25 entries", () => {
      expect(LANGUAGE_SERVERS.length).toBeGreaterThanOrEqual(25);
    });

    it("every entry has required fields: language, command, args, extensions, detectCommand", () => {
      for (const entry of LANGUAGE_SERVERS) {
        expect(entry.language).toBeTruthy();
        expect(typeof entry.language).toBe("string");

        expect(entry.command).toBeTruthy();
        expect(typeof entry.command).toBe("string");

        expect(Array.isArray(entry.args)).toBe(true);

        expect(Array.isArray(entry.extensions)).toBe(true);
        expect(entry.extensions.length).toBeGreaterThan(0);

        expect(entry.detectCommand).toBeTruthy();
        expect(typeof entry.detectCommand).toBe("string");
      }
    });

    it("every entry has at least one extension starting with '.'", () => {
      for (const entry of LANGUAGE_SERVERS) {
        const dotExtensions = entry.extensions.filter((ext) => ext.startsWith("."));
        expect(dotExtensions.length).toBeGreaterThan(0);
      }
    });
  });

  describe("getConfigForExtension", () => {
    it("returns typescript config for '.ts'", () => {
      const config = getConfigForExtension(".ts");
      expect(config).toBeDefined();
      expect(config!.language).toBe("typescript");
    });

    it("returns python config for '.py'", () => {
      const config = getConfigForExtension(".py");
      expect(config).toBeDefined();
      expect(config!.language).toBe("python");
    });

    it("returns undefined for unknown extension", () => {
      const config = getConfigForExtension(".zzzzz");
      expect(config).toBeUndefined();
    });

    it("returns dockerfile config for 'Dockerfile'", () => {
      const config = getConfigForExtension("Dockerfile");
      expect(config).toBeDefined();
      expect(config!.language).toBe("dockerfile");
    });
  });

  describe("isServerInstalled", () => {
    const mockConfigSuccess: LspServerConfig = {
      language: "test-success",
      command: "test-server",
      args: [],
      extensions: [".test"],
      detectCommand: "test-server --version",
      installCommand: "",
      installInstructions: "",
    };
    const mockConfigEnoent: LspServerConfig = {
      language: "test-enoent",
      command: "test-server",
      args: [],
      extensions: [".test"],
      detectCommand: "test-server --version",
      installCommand: "",
      installInstructions: "",
    };
    const mockConfigNonEnoent: LspServerConfig = {
      language: "test-non-enoent",
      command: "test-server",
      args: [],
      extensions: [".test"],
      detectCommand: "test-server --version",
      installCommand: "",
      installInstructions: "",
    };

    it("returns true when spawn succeeds (close with code 0)", async () => {
      vi.mocked(spawn).mockReturnValueOnce({
        on: vi.fn((event: string, handler: (...args: any[]) => void) => {
          if (event === "close") {
            process.nextTick(() => handler(0));
          }
          return undefined as any;
        }),
      } as any);

      const result = await isServerInstalled(mockConfigSuccess);
      expect(result).toBe(true);
    });

    it("returns false when spawn emits an ENOENT error (binary not found)", async () => {
      const notFoundError = new Error("not found") as NodeJS.ErrnoException;
      notFoundError.code = "ENOENT";
      vi.mocked(spawn).mockReturnValueOnce({
        on: vi.fn((event: string, handler: (...args: any[]) => void) => {
          if (event === "error") {
            process.nextTick(() => handler(notFoundError));
          }
          return undefined as any;
        }),
      } as any);

      const result = await isServerInstalled(mockConfigEnoent);
      expect(result).toBe(false);
    });

    it("returns true when spawn emits a non-ENOENT error (binary exists but --version fails)", async () => {
      const versionError = new Error("Connection input stream is not set") as NodeJS.ErrnoException;
      versionError.code = "ERR_CHILD_PROCESS_STDIO_MAXBUFFER";
      vi.mocked(spawn).mockReturnValueOnce({
        on: vi.fn((event: string, handler: (...args: any[]) => void) => {
          if (event === "error") {
            process.nextTick(() => handler(versionError));
          }
          return undefined as any;
        }),
      } as any);

      const result = await isServerInstalled(mockConfigNonEnoent);
      expect(result).toBe(true);
    });
  });
});
