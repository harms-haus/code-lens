import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from "vitest";
import * as net from "node:net";
import * as readline from "node:readline";
import { sendRequest, probeSocket } from "../../src/daemon/client.js";
import type { DaemonRequest } from "../../src/daemon/protocol.js";

// The module-level mocks are set up in tests/setup.ts.
// We grab the mocked functions and override them per-test to control behavior.

const mockCreateConnection = net.createConnection as Mock;
const mockCreateInterface = readline.createInterface as Mock;

/**
 * Helper: build a minimal DaemonRequest for testing.
 */
function makeRequest(overrides?: Partial<DaemonRequest>): DaemonRequest {
  return {
    jsonrpc: "2.0",
    method: "test-method",
    params: {},
    id: 1,
    ...overrides,
  };
}

/**
 * Helper: create a mock socket with .on() that records event listeners.
 */
function makeMockSocket() {
  const listeners: Record<string, Function[]> = {};
  return {
    on: vi.fn((event: string, cb: Function) => {
      (listeners[event] ??= []).push(cb);
    }),
    write: vi.fn(),
    destroy: vi.fn(),
    /** Get the first registered listener for an event */
    listenerFor(event: string): Function | undefined {
      return listeners[event]?.[0];
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── sendRequest ──────────────────────────────────────────────────────────

describe("sendRequest", () => {
  it("resolves with a successful CommandResult", async () => {
    const request = makeRequest();
    const mockSocket = makeMockSocket();
    const rlListeners: Record<string, Function[]> = {};
    const mockReadline = {
      on: vi.fn((event: string, cb: Function) => {
        (rlListeners[event] ??= []).push(cb);
      }),
      close: vi.fn(),
    };

    mockCreateConnection.mockReturnValue(mockSocket);
    mockCreateInterface.mockReturnValue(mockReadline);

    const promise = sendRequest("/tmp/test.sock", request);

    // Capture the connect callback that createConnection received
    const connectCb = mockCreateConnection.mock.calls[0]![1] as () => void;
    connectCb();

    // Simulate the daemon sending a successful response line
    const lineCb = rlListeners["line"]![0] as (line: string) => void;
    lineCb(
      JSON.stringify({
        jsonrpc: "2.0",
        result: {
          content: [{ type: "text", text: "success" }],
          details: { file: "a.ts" },
          isError: false,
        },
        id: 1,
      }),
    );

    const result = await promise;
    expect(result.isError).toBe(false);
    expect(result.content[0]!.text).toBe("success");
    expect(result.details).toEqual({ file: "a.ts" });
  });

  it("resolves with an error CommandResult when response contains error", async () => {
    const request = makeRequest({ id: 2 });
    const mockSocket = makeMockSocket();
    const rlListeners: Record<string, Function[]> = {};
    const mockReadline = {
      on: vi.fn((event: string, cb: Function) => {
        (rlListeners[event] ??= []).push(cb);
      }),
      close: vi.fn(),
    };

    mockCreateConnection.mockReturnValue(mockSocket);
    mockCreateInterface.mockReturnValue(mockReadline);

    const promise = sendRequest("/tmp/test.sock", request);

    const connectCb = mockCreateConnection.mock.calls[0]![1] as () => void;
    connectCb();

    const lineCb = rlListeners["line"]![0] as (line: string) => void;
    lineCb(
      JSON.stringify({
        jsonrpc: "2.0",
        error: {
          code: -32002,
          message: "File not found",
          data: { file: "missing.ts" },
        },
        id: 2,
      }),
    );

    const result = await promise;
    expect(result.isError).toBe(true);
    expect(result.content[0]!.text).toBe("File not found");
    expect(result.details).toEqual({
      code: -32002,
      data: { file: "missing.ts" },
    });
  });

  it("rejects when the socket emits an error", async () => {
    const request = makeRequest();
    const mockSocket = makeMockSocket();
    const mockReadline = {
      on: vi.fn(),
      close: vi.fn(),
    };

    mockCreateConnection.mockReturnValue(mockSocket);
    mockCreateInterface.mockReturnValue(mockReadline);

    const promise = sendRequest("/tmp/test.sock", request);

    const errorCb = mockSocket.listenerFor("error") as (err: Error) => void;
    errorCb(new Error("Connection refused"));

    await expect(promise).rejects.toThrow("Failed to connect to daemon: Connection refused");
  });

  it("rejects when readline emits an error", async () => {
    const request = makeRequest();
    const mockSocket = makeMockSocket();
    const rlListeners: Record<string, Function[]> = {};
    const mockReadline = {
      on: vi.fn((event: string, cb: Function) => {
        (rlListeners[event] ??= []).push(cb);
      }),
      close: vi.fn(),
    };

    mockCreateConnection.mockReturnValue(mockSocket);
    mockCreateInterface.mockReturnValue(mockReadline);

    const promise = sendRequest("/tmp/test.sock", request);

    // Simulate readline emitting an error (this happens when socket connect fails)
    const errorCb = rlListeners["error"]![0] as (err: Error) => void;
    errorCb(new Error("connect ENOENT /tmp/nonexistent.sock"));

    await expect(promise).rejects.toThrow("Failed to connect to daemon: connect ENOENT /tmp/nonexistent.sock");
    expect(mockSocket.destroy).toHaveBeenCalled();
  });

  it("rejects when the socket closes before a response", async () => {
    const request = makeRequest();
    const mockSocket = makeMockSocket();
    const mockReadline = {
      on: vi.fn(),
      close: vi.fn(),
    };

    mockCreateConnection.mockReturnValue(mockSocket);
    mockCreateInterface.mockReturnValue(mockReadline);

    const promise = sendRequest("/tmp/test.sock", request);

    const connectCb = mockCreateConnection.mock.calls[0]![1] as () => void;
    connectCb();

    const closeCb = mockSocket.listenerFor("close") as () => void;
    closeCb();

    await expect(promise).rejects.toThrow("Daemon closed connection before sending a response");
  });

  it("rejects on timeout when no response arrives", async () => {
    // Capture timeout callback by spying on global setTimeout
    let capturedTimeoutCb: Function | undefined;
    const spySetTimeout = vi.spyOn(global, "setTimeout").mockImplementation(
      ((cb: Function, _ms?: number) => {
        capturedTimeoutCb = cb;
        return {} as NodeJS.Timeout;
      }) as any,
    );
    const spyClearTimeout = vi.spyOn(global, "clearTimeout").mockImplementation(() => {});

    const request = makeRequest();
    const mockSocket = makeMockSocket();
    const mockReadline = {
      on: vi.fn(),
      close: vi.fn(),
    };

    mockCreateConnection.mockReturnValue(mockSocket);
    mockCreateInterface.mockReturnValue(mockReadline);

    const promise = sendRequest("/tmp/test.sock", request);

    const connectCb = mockCreateConnection.mock.calls[0]![1] as () => void;
    connectCb();

    // Manually fire the captured timeout callback
    expect(capturedTimeoutCb).toBeDefined();
    capturedTimeoutCb!();

    await expect(promise).rejects.toThrow("Daemon request timed out after 60s");

    spySetTimeout.mockRestore();
    spyClearTimeout.mockRestore();
  });
});

// ─── probeSocket ──────────────────────────────────────────────────────────

describe("probeSocket", () => {
  it("resolves true on successful connect", async () => {
    const mockSocket = makeMockSocket();

    mockCreateConnection.mockReturnValue(mockSocket);

    const promise = probeSocket("/tmp/test.sock");

    const connectCb = mockCreateConnection.mock.calls[0]![1] as () => void;
    connectCb();

    await expect(promise).resolves.toBe(true);
  });

  it("resolves false when socket emits an error", async () => {
    const mockSocket = makeMockSocket();

    mockCreateConnection.mockReturnValue(mockSocket);

    const promise = probeSocket("/tmp/nonexistent.sock");

    const errorCb = mockSocket.listenerFor("error") as () => void;
    errorCb();

    await expect(promise).resolves.toBe(false);
  });

  it("resolves false on timeout", async () => {
    vi.useFakeTimers();

    const mockSocket = makeMockSocket();

    mockCreateConnection.mockReturnValue(mockSocket);

    const promise = probeSocket("/tmp/test.sock");

    // Advance past the 2s probe timeout
    await vi.advanceTimersByTimeAsync(2_000);

    await expect(promise).resolves.toBe(false);
  });
});
