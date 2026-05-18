import { describe, it, expect } from "vitest";
import type { DaemonRequest, DaemonResponse } from "../../src/daemon/protocol.js";
import { DAEMON_ERROR_CODES } from "../../src/daemon/protocol.js";

describe("daemon/protocol", () => {
  describe("DaemonRequest serialization", () => {
    it("serializes and deserializes a request as NDJSON", () => {
      const request: DaemonRequest = {
        jsonrpc: "2.0",
        method: "diagnostics",
        params: { file: "src/index.ts" },
        id: 1,
      };

      const serialized = JSON.stringify(request);
      const deserialized = JSON.parse(serialized) as DaemonRequest;

      expect(deserialized.jsonrpc).toBe("2.0");
      expect(deserialized.method).toBe("diagnostics");
      expect(deserialized.params).toEqual({ file: "src/index.ts" });
      expect(deserialized.id).toBe(1);
    });

    it("roundtrips with newline separator (NDJSON framing)", () => {
      const req: DaemonRequest = {
        jsonrpc: "2.0",
        method: "hover",
        params: { file: "a.ts", line: 5, character: 10 },
        id: 42,
      };

      // NDJSON format: JSON + newline
      const frame = JSON.stringify(req) + "\n";
      const lines = frame.trim().split("\n");
      expect(lines).toHaveLength(1);

      const parsed = JSON.parse(lines[0]!) as DaemonRequest;
      expect(parsed.id).toBe(42);
      expect(parsed.method).toBe("hover");
    });
  });

  describe("DaemonResponse serialization", () => {
    it("serializes a success response", () => {
      const response: DaemonResponse = {
        jsonrpc: "2.0",
        result: {
          content: [{ type: "text", text: "all good" }],
          details: {},
          isError: false,
        },
        id: 1,
      };

      const serialized = JSON.stringify(response);
      const deserialized = JSON.parse(serialized) as DaemonResponse;

      expect(deserialized.result).toBeDefined();
      expect(deserialized.error).toBeUndefined();
      expect(deserialized.result!.isError).toBe(false);
    });

    it("serializes an error response", () => {
      const response: DaemonResponse = {
        jsonrpc: "2.0",
        error: {
          code: DAEMON_ERROR_CODES.FILE_NOT_FOUND,
          message: "File not found: missing.ts",
        },
        id: 2,
      };

      const serialized = JSON.stringify(response);
      const deserialized = JSON.parse(serialized) as DaemonResponse;

      expect(deserialized.error).toBeDefined();
      expect(deserialized.result).toBeUndefined();
      expect(deserialized.error!.code).toBe(-32002);
      expect(deserialized.error!.message).toBe("File not found: missing.ts");
    });

    it("roundtrips error with data field", () => {
      const response: DaemonResponse = {
        jsonrpc: "2.0",
        error: {
          code: DAEMON_ERROR_CODES.LSP_ERROR,
          message: "LSP crashed",
          data: { language: "typescript" },
        },
        id: 3,
      };

      const serialized = JSON.stringify(response);
      const deserialized = JSON.parse(serialized) as DaemonResponse;

      expect(deserialized.error!.data).toEqual({ language: "typescript" });
    });
  });

  describe("DAEMON_ERROR_CODES", () => {
    it("all error codes are negative numbers in -32xxx range", () => {
      for (const [name, code] of Object.entries(DAEMON_ERROR_CODES)) {
        expect(code).toBeLessThan(0);
        expect(code).toBeGreaterThanOrEqual(-32999);
        expect(code).toBeLessThanOrEqual(-32000);
        expect(Number.isInteger(code)).toBe(true);
      }
    });

    it("has expected error code values", () => {
      expect(DAEMON_ERROR_CODES.INTERNAL).toBe(-32000);
      expect(DAEMON_ERROR_CODES.SERVER_NOT_FOUND).toBe(-32001);
      expect(DAEMON_ERROR_CODES.FILE_NOT_FOUND).toBe(-32002);
      expect(DAEMON_ERROR_CODES.LSP_ERROR).toBe(-32003);
      expect(DAEMON_ERROR_CODES.INVALID_PARAMS).toBe(-32004);
    });

    it("all error codes are unique", () => {
      const values = Object.values(DAEMON_ERROR_CODES);
      const unique = new Set(values);
      expect(unique.size).toBe(values.length);
    });
  });

  describe("NDJSON framing", () => {
    it("multiple messages can be separated by newlines", () => {
      const messages = [
        { jsonrpc: "2.0", method: "a", params: {}, id: 1 },
        { jsonrpc: "2.0", method: "b", params: {}, id: 2 },
        { jsonrpc: "2.0", method: "c", params: {}, id: 3 },
      ];

      const ndjson = messages.map((m) => JSON.stringify(m)).join("\n") + "\n";
      const lines = ndjson.trim().split("\n");

      expect(lines).toHaveLength(3);
      for (let i = 0; i < lines.length; i++) {
        const parsed = JSON.parse(lines[i]!);
        expect(parsed.id).toBe(i + 1);
      }
    });
  });
});
