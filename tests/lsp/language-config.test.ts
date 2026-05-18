import { describe, it, expect, vi } from "vitest";
import { languageFromPath, isServerInstalled } from "../../src/lsp/language-config.js";
import type { LspServerConfig } from "../../src/lsp/types.js";
import { execFile } from "node:child_process";

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
  });

  describe("isServerInstalled", () => {
    const mockConfig: LspServerConfig = {
      language: "test",
      command: "test-server",
      args: [],
      extensions: [".test"],
      detectCommand: "test-server --version",
      installCommand: "",
      installInstructions: "",
    };

    it("returns true when execFile succeeds (no error)", async () => {
      vi.mocked(execFile).mockImplementation(
        (_cmd: string, _args: string[], _opts: any, cb: any) => {
          cb(null, { stdout: "1.0.0", stderr: "" });
        },
      );

      const result = await isServerInstalled(mockConfig);
      expect(result).toBe(true);
    });

    it("returns false when execFile returns an error", async () => {
      vi.mocked(execFile).mockImplementation(
        (_cmd: string, _args: string[], _opts: any, cb: any) => {
          cb(new Error("not found"), null);
        },
      );

      const result = await isServerInstalled(mockConfig);
      expect(result).toBe(false);
    });
  });
});
