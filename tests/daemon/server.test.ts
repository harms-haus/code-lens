import { describe, it, expect } from "vitest";
import { DaemonServer, createServer } from "../../src/daemon/server.js";
import { DAEMON_ERROR_CODES } from "../../src/daemon/protocol.js";
import type { DaemonRequest } from "../../src/daemon/protocol.js";

describe("daemon/server", () => {
  // ── Helpers ───────────────────────────────────────────────────────────

  function makeRequest(method: string, id = 1): DaemonRequest {
    return { jsonrpc: "2.0", method, params: {}, id };
  }

  // ── Constructor ───────────────────────────────────────────────────────

  describe("DaemonServer constructor", () => {
    it("creates an instance", () => {
      const server = new DaemonServer();
      expect(server).toBeInstanceOf(DaemonServer);
    });
  });

  // ── Command Registration ──────────────────────────────────────────────

  describe("registerCommand", () => {
    it("stores a handler that is retrievable via getRegisteredCommands()", () => {
      const server = new DaemonServer();

      const handler = async () => ({ output: "ok", format: "text" as const });
      server.registerCommand("test-cmd", handler);

      expect(server.getRegisteredCommands()).toContain("test-cmd");
    });

    it("stores multiple handlers", () => {
      const server = new DaemonServer();

      server.registerCommand("cmd-a", async () => ({ output: "a", format: "text" as const }));
      server.registerCommand("cmd-b", async () => ({ output: "b", format: "text" as const }));

      const cmds = server.getRegisteredCommands();
      expect(cmds).toContain("cmd-a");
      expect(cmds).toContain("cmd-b");
      expect(cmds).toHaveLength(2);
    });
  });

  // ── Request Routing ───────────────────────────────────────────────────

  describe("handleRequest", () => {
    it("dispatches to the registered handler and returns its result", async () => {
      const server = new DaemonServer();

      server.registerCommand("echo", async (params) => ({
        output: JSON.stringify(params),
        format: "text" as const,
      }));

      const request: DaemonRequest = {
        jsonrpc: "2.0",
        method: "echo",
        params: { key: "value" },
        id: 42,
      };

      const response = await server.handleRequest(request, "/tmp");

      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(42);
      expect(response.result).toEqual({ output: '{"key":"value"}', format: "text" });
      expect(response.error).toBeUndefined();
    });

    it("returns an error for an unknown method", async () => {
      const server = new DaemonServer();

      const request = makeRequest("nonexistent");
      const response = await server.handleRequest(request, "/tmp");

      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(1);
      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(DAEMON_ERROR_CODES.INVALID_PARAMS);
      expect(response.error!.message).toContain("Unknown method: nonexistent");
      expect(response.result).toBeUndefined();
    });

    it("returns INTERNAL_ERROR when the handler throws", async () => {
      const server = new DaemonServer();

      server.registerCommand("fail", async () => {
        throw new Error("something went wrong");
      });

      const request = makeRequest("fail");
      const response = await server.handleRequest(request, "/tmp");

      expect(response.jsonrpc).toBe("2.0");
      expect(response.id).toBe(1);
      expect(response.error).toBeDefined();
      expect(response.error!.code).toBe(DAEMON_ERROR_CODES.INTERNAL);
      expect(response.error!.message).toBe("Internal error: something went wrong");
      expect(response.result).toBeUndefined();
    });

    it("preserves the request id in all response paths", async () => {
      const server = new DaemonServer();

      // Known method
      server.registerCommand("ping", async () => ({ output: "pong", format: "text" as const }));

      const knownResponse = await server.handleRequest(makeRequest("ping", 99), "/tmp");
      expect(knownResponse.id).toBe(99);

      // Unknown method
      const unknownResponse = await server.handleRequest(makeRequest("nope", 77), "/tmp");
      expect(unknownResponse.id).toBe(77);
    });
  });

  // ── Active Connections ────────────────────────────────────────────────

  describe("getActiveConnections", () => {
    it("starts at 0", () => {
      const server = new DaemonServer();
      expect(server.getActiveConnections()).toBe(0);
    });
  });

  // ── Factory ───────────────────────────────────────────────────────────

  describe("createServer factory", () => {
    it("returns a DaemonServer instance", () => {
      const server = createServer();
      expect(server).toBeInstanceOf(DaemonServer);
    });
  });

  // ── Idle Timer Reset Guard ────────────────────────────────────────────

  describe("shouldResetIdleTimer", () => {
    it("returns false for 'status' method", () => {
      const server = createServer();
      expect(server.shouldResetIdleTimer("status")).toBe(false);
    });

    it("returns true for 'diagnostics' method", () => {
      const server = createServer();
      expect(server.shouldResetIdleTimer("diagnostics")).toBe(true);
    });

    it("returns true for 'hover' method", () => {
      const server = createServer();
      expect(server.shouldResetIdleTimer("hover")).toBe(true);
    });

    it("returns true for unknown methods", () => {
      const server = createServer();
      expect(server.shouldResetIdleTimer("unknown-method")).toBe(true);
    });
  });
});
