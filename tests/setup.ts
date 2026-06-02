import { vi } from "vitest";

vi.mock("node:child_process", () => ({
  spawn: vi.fn(),
  exec: vi.fn(),
  execFile: vi.fn(),
  execSync: vi.fn(),
  execFileSync: vi.fn(),
}));

vi.mock("cross-spawn", () => ({
  default: vi.fn(),
}));

vi.mock("node:net", () => ({
  createServer: vi.fn(),
  createConnection: vi.fn(() => ({
    on: vi.fn(),
    once: vi.fn(),
    write: vi.fn(),
    end: vi.fn(),
    destroy: vi.fn(),
    setEncoding: vi.fn(),
    removeAllListeners: vi.fn(),
  })),
}));

vi.mock("node:readline", () => ({
  createInterface: vi.fn(),
}));
