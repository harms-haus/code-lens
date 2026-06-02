import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CommandResult } from "../../src/formatting/output.js";

const { registeredHandlers, mockExecutePreamble } = vi.hoisted(() => {
  return { registeredHandlers: new Map<string, Function>(), mockExecutePreamble: vi.fn() };
});
vi.mock("../../src/daemon/server.js", () => ({
  registerCommand: (name: string, handler: Function) => {
    registeredHandlers.set(name, handler);
  },
}));
vi.mock("../../src/commands/preamble.js", () => ({
  executePreamble: (...args: unknown[]) => mockExecutePreamble(...args),
}));

await import("../../src/commands/find-type-hierarchy.js");

// ── Helpers ────────────────────────────────────────────────────────────────

function getHandler(): Function {
  const handler = registeredHandlers.get("find-type-hierarchy");
  expect(handler).toBeDefined();
  return handler!;
}

function makeTypeHierarchyItem(
  name: string,
  kind: number,
  uri: string,
  line: number,
) {
  return {
    name,
    kind,
    uri,
    range: {
      start: { line, character: 0 },
      end: { line, character: 10 },
    },
    selectionRange: {
      start: { line, character: 0 },
      end: { line, character: 10 },
    },
  };
}

const mockClient = {
  prepareTypeHierarchy: vi.fn(),
  typeHierarchySupertypes: vi.fn(),
  typeHierarchySubtypes: vi.fn(),
};

const mockManager = {};
const defaultCwd = "/project";
const validParams = { file: "src/index.ts", line: 10, col: 5 };

function setupPreambleSuccess() {
  mockExecutePreamble.mockResolvedValue({
    ok: {
      filePath: "/project/src/index.ts",
      config: { language: "typescript" },
      client: mockClient,
      uri: "file:///project/src/index.ts",
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

describe("find-type-hierarchy command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Test 1: direction="both" → both supertypes and subtypes sections ───
  it("shows both supertypes and subtypes when direction is 'both'", async () => {
    setupPreambleSuccess();

    const baseItem = makeTypeHierarchyItem("MyClass", 5, "file:///project/src/index.ts", 9);
    mockClient.prepareTypeHierarchy.mockResolvedValue([baseItem]);
    mockClient.typeHierarchySupertypes.mockResolvedValue([
      makeTypeHierarchyItem("BaseClass", 5, "file:///project/src/base.ts", 3),
    ]);
    mockClient.typeHierarchySubtypes.mockResolvedValue([
      makeTypeHierarchyItem("ChildClass", 5, "file:///project/src/child.ts", 7),
    ]);

    const handler = getHandler();
    const result = (await handler(
      { ...validParams, direction: "both" },
      mockManager,
      defaultCwd,
    )) as CommandResult;

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Supertypes (1)");
    expect(result.content[0].text).toContain("Subtypes (1)");
    expect(result.content[0].text).toContain("BaseClass");
    expect(result.content[0].text).toContain("ChildClass");
    expect(result.details).toMatchObject({
      file: "src/index.ts",
      line: 10,
      col: 5,
      typeName: "MyClass",
      supported: true,
    });
    expect(result.details.supertypes).toHaveLength(1);
    expect(result.details.subtypes).toHaveLength(1);
  });

  // ── Test 2: direction="supertypes" → only supertypes section ───────────
  it("shows only supertypes when direction is 'supertypes'", async () => {
    setupPreambleSuccess();

    const baseItem = makeTypeHierarchyItem("MyClass", 5, "file:///project/src/index.ts", 9);
    mockClient.prepareTypeHierarchy.mockResolvedValue([baseItem]);
    mockClient.typeHierarchySupertypes.mockResolvedValue([
      makeTypeHierarchyItem("BaseClass", 5, "file:///project/src/base.ts", 3),
    ]);
    mockClient.typeHierarchySubtypes.mockResolvedValue([
      makeTypeHierarchyItem("ChildClass", 5, "file:///project/src/child.ts", 7),
    ]);

    const handler = getHandler();
    const result = (await handler(
      { ...validParams, direction: "supertypes" },
      mockManager,
      defaultCwd,
    )) as CommandResult;

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Supertypes (1)");
    expect(result.content[0].text).toContain("BaseClass");
    expect(result.content[0].text).not.toContain("Subtypes");
    expect(result.details.supertypes).toHaveLength(1);
    expect(result.details.subtypes).toHaveLength(0);
  });

  // ── Test 3: direction="subtypes" → only subtypes section ───────────────
  it("shows only subtypes when direction is 'subtypes'", async () => {
    setupPreambleSuccess();

    const baseItem = makeTypeHierarchyItem("MyClass", 5, "file:///project/src/index.ts", 9);
    mockClient.prepareTypeHierarchy.mockResolvedValue([baseItem]);
    mockClient.typeHierarchySupertypes.mockResolvedValue([
      makeTypeHierarchyItem("BaseClass", 5, "file:///project/src/base.ts", 3),
    ]);
    mockClient.typeHierarchySubtypes.mockResolvedValue([
      makeTypeHierarchyItem("ChildClass", 5, "file:///project/src/child.ts", 7),
    ]);

    const handler = getHandler();
    const result = (await handler(
      { ...validParams, direction: "subtypes" },
      mockManager,
      defaultCwd,
    )) as CommandResult;

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("Subtypes (1)");
    expect(result.content[0].text).toContain("ChildClass");
    expect(result.content[0].text).not.toContain("Supertypes");
    expect(result.details.supertypes).toHaveLength(0);
    expect(result.details.subtypes).toHaveLength(1);
  });

  // ── Test 4: No items at position → "not supported" message ─────────────
  it("returns 'not supported' message when no items at position", async () => {
    setupPreambleSuccess();
    mockClient.prepareTypeHierarchy.mockResolvedValue([]);

    const handler = getHandler();
    const result = (await handler(validParams, mockManager, defaultCwd)) as CommandResult;

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("not supported");
    expect(result.details).toMatchObject({
      file: "src/index.ts",
      supported: false,
    });
  });

  // ── Test 5: Empty supertypes/subtypes → "(none found)" ─────────────────
  it("shows '(none found)' when supertypes or subtypes are empty", async () => {
    setupPreambleSuccess();

    const baseItem = makeTypeHierarchyItem("MyClass", 5, "file:///project/src/index.ts", 9);
    mockClient.prepareTypeHierarchy.mockResolvedValue([baseItem]);
    mockClient.typeHierarchySupertypes.mockResolvedValue([]);
    mockClient.typeHierarchySubtypes.mockResolvedValue([]);

    const handler = getHandler();
    const result = (await handler(
      { ...validParams, direction: "both" },
      mockManager,
      defaultCwd,
    )) as CommandResult;

    expect(result.isError).toBe(false);
    // "(none found)" appears for each empty section
    const text = result.content[0].text;
    const noneCount = (text.match(/\(none found\)/g) || []).length;
    expect(noneCount).toBe(2);
    expect(result.details.supertypes).toHaveLength(0);
    expect(result.details.subtypes).toHaveLength(0);
  });

  // ── Test 6: LSP throws → sanitized error ───────────────────────────────
  it("returns sanitized error when prepareTypeHierarchy throws", async () => {
    setupPreambleSuccess();
    mockClient.prepareTypeHierarchy.mockRejectedValue(new Error("Connection lost"));

    const handler = getHandler();
    const result = (await handler(validParams, mockManager, defaultCwd)) as CommandResult;

    expect(result.isError).toBe(false);
    expect(result.content[0].text).toContain("not supported");
    expect(result.details).toMatchObject({
      file: "src/index.ts",
      supported: false,
    });
  });
});
