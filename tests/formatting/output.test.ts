import { describe, it, expect } from "vitest";
import { ok, err, sanitizeError } from "../../src/formatting/output.js";
import type { CommandResult } from "../../src/formatting/output.js";

// ═══════════════════════════════════════════════════════════════════════════
// ok()
// ═══════════════════════════════════════════════════════════════════════════

describe("ok()", () => {
  it("builds a successful result with text content", () => {
    const result = ok("all good");
    expect(result.isError).toBe(false);
    expect(result.content).toEqual([{ type: "text", text: "all good" }]);
  });

  it("includes details when provided", () => {
    const result = ok("done", { count: 5 });
    expect(result.details).toEqual({ count: 5 });
  });

  it("defaults details to empty object", () => {
    const result = ok("done");
    expect(result.details).toEqual({});
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// err()
// ═══════════════════════════════════════════════════════════════════════════

describe("err()", () => {
  it("builds an error result with text content", () => {
    const result = err("something failed");
    expect(result.isError).toBe(true);
    expect(result.content).toEqual([{ type: "text", text: "something failed" }]);
  });

  it("includes details when provided", () => {
    const result = err("fail", { code: -32001 });
    expect(result.details).toEqual({ code: -32001 });
  });

  it("defaults details to empty object", () => {
    const result = err("fail");
    expect(result.details).toEqual({});
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// sanitizeError()
// ═══════════════════════════════════════════════════════════════════════════

describe("sanitizeError()", () => {
  it("sanitizes /home/ directory paths", () => {
    const result = sanitizeError(new Error("/home/user/secret/file.ts"), "test");
    expect(result).toContain("~/secret/file.ts");
    expect(result).not.toContain("/home/user");
  });

  it("handles non-Error objects by stringifying them", () => {
    const result = sanitizeError("plain string error", "ctx");
    expect(result).toContain("ctx: plain string error");
  });

  it("prefixes the message with the context", () => {
    const result = sanitizeError(new Error("bad"), "MyContext");
    expect(result).toMatch(/^MyContext:/);
  });

  it("strips Windows user paths from error messages", () => {
    const error = new Error("ENOENT: no such file 'C:\\Users\\john\\project\\file.ts'");
    const result = sanitizeError(error, "read");
    expect(result).not.toContain("john");
    expect(result).toContain("~");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CommandResult type structure
// ═══════════════════════════════════════════════════════════════════════════

describe("CommandResult type", () => {
  it("ok() result conforms to CommandResult shape", () => {
    const result: CommandResult = ok("text");
    expect(result).toHaveProperty("content");
    expect(result).toHaveProperty("details");
    expect(result).toHaveProperty("isError");
    expect(Array.isArray(result.content)).toBe(true);
    expect(result.content[0]).toHaveProperty("type", "text");
    expect(result.content[0]).toHaveProperty("text", "text");
    expect(typeof result.details).toBe("object");
    expect(typeof result.isError).toBe("boolean");
  });

  it("err() result conforms to CommandResult shape with isError=true", () => {
    const result: CommandResult = err("oops");
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("oops");
    expect(result.content[0].type).toBe("text");
  });
});
