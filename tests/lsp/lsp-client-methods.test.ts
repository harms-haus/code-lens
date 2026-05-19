import { describe, it, expect, vi } from "vitest";
import { LspClient } from "../../src/lsp/lsp-client-methods.js";
import type { LspServerInstance } from "../../src/lsp/types.js";
import type { TypeHierarchyItem } from "../../src/lsp/lsp-protocol.js";

function createMockClient(): { client: LspClient; request: any; notify: any } {
  const serverInstance: LspServerInstance = {
    config: {
      language: "test",
      command: "test",
      args: [],
      extensions: [".ts"],
      detectCommand: "test",
      installCommand: "",
      installInstructions: "",
    },
    status: "running",
    pid: 123,
    nextId: 1,
    pendingRequests: new Map(),
    lastActive: Date.now(),
    fileVersions: new Map(),
    diagnostics: new Map(),
    rootUri: "file:///test",
  };
  const client = new LspClient(serverInstance);
  const request = vi.fn().mockResolvedValue(null);
  const notify = vi.fn();
  (client as any).request = request;
  (client as any).notify = notify;
  return { client, request, notify };
}

const testUri = "file:///test/foo.ts";
const testLine = 5;
const testCol = 10;

describe("LspClient high-level methods", () => {
  // ── Request-based methods ─────────────────────────────────────────────

  describe("gotoDefinition", () => {
    it("sends textDocument/definition with correct params", async () => {
      const { client, request } = createMockClient();
      await client.gotoDefinition(testUri, testLine, testCol);
      expect(request).toHaveBeenCalledWith(
        "textDocument/definition",
        expect.objectContaining({
          textDocument: { uri: testUri },
          position: { line: testLine, character: testCol },
        }),
        expect.any(Number),
      );
    });
  });

  describe("findReferences", () => {
    it("sends textDocument/references with context.includeDeclaration: true", async () => {
      const { client, request } = createMockClient();
      await client.findReferences(testUri, testLine, testCol);
      expect(request).toHaveBeenCalledWith(
        "textDocument/references",
        expect.objectContaining({
          textDocument: { uri: testUri },
          position: { line: testLine, character: testCol },
          context: { includeDeclaration: true },
        }),
        expect.any(Number),
      );
    });
  });

  describe("findImplementations", () => {
    it("sends textDocument/implementation with correct params", async () => {
      const { client, request } = createMockClient();
      await client.findImplementations(testUri, testLine, testCol);
      expect(request).toHaveBeenCalledWith(
        "textDocument/implementation",
        expect.objectContaining({
          textDocument: { uri: testUri },
          position: { line: testLine, character: testCol },
        }),
        expect.any(Number),
      );
    });
  });

  describe("findTypeDefinition", () => {
    it("sends textDocument/typeDefinition with correct params", async () => {
      const { client, request } = createMockClient();
      await client.findTypeDefinition(testUri, testLine, testCol);
      expect(request).toHaveBeenCalledWith(
        "textDocument/typeDefinition",
        expect.objectContaining({
          textDocument: { uri: testUri },
          position: { line: testLine, character: testCol },
        }),
        expect.any(Number),
      );
    });
  });

  describe("hover", () => {
    it("sends textDocument/hover with correct params", async () => {
      const { client, request } = createMockClient();
      await client.hover(testUri, testLine, testCol);
      expect(request).toHaveBeenCalledWith(
        "textDocument/hover",
        expect.objectContaining({
          textDocument: { uri: testUri },
          position: { line: testLine, character: testCol },
        }),
        expect.any(Number),
      );
    });
  });

  // ── Notification-based methods ────────────────────────────────────────

  describe("didOpen", () => {
    it("sends textDocument/didOpen notification with TextDocumentItem", () => {
      const { client, notify } = createMockClient();
      client.didOpen(testUri, "typescript", 1, "const x = 1;");
      expect(notify).toHaveBeenCalledWith("textDocument/didOpen", {
        textDocument: {
          uri: testUri,
          languageId: "typescript",
          version: 1,
          text: "const x = 1;",
        },
      });
    });
  });

  describe("didChange", () => {
    it("sends textDocument/didChange notification with content changes", () => {
      const { client, notify } = createMockClient();
      client.didChange(testUri, 2, "const x = 2;");
      expect(notify).toHaveBeenCalledWith("textDocument/didChange", {
        textDocument: { uri: testUri, version: 2 },
        contentChanges: [{ text: "const x = 2;" }],
      });
    });
  });

  describe("didClose", () => {
    it("sends textDocument/didClose notification with uri", () => {
      const { client, notify } = createMockClient();
      client.didClose(testUri);
      expect(notify).toHaveBeenCalledWith("textDocument/didClose", {
        textDocument: { uri: testUri },
      });
    });
  });

  // ── Workspace / document symbol ───────────────────────────────────────

  describe("workspaceSymbol", () => {
    it("sends workspace/symbol with query param", async () => {
      const { client, request } = createMockClient();
      await client.workspaceSymbol("MyClass");
      expect(request).toHaveBeenCalledWith(
        "workspace/symbol",
        { query: "MyClass" },
        expect.any(Number),
      );
    });
  });

  describe("documentSymbol", () => {
    it("sends textDocument/documentSymbol with correct URI param", async () => {
      const { client, request } = createMockClient();
      await client.documentSymbol(testUri);
      expect(request).toHaveBeenCalledWith(
        "textDocument/documentSymbol",
        { textDocument: { uri: testUri } },
        expect.any(Number),
      );
    });
  });

  // ── Call hierarchy ────────────────────────────────────────────────────

  describe("prepareCallHierarchy", () => {
    it("sends textDocument/prepareCallHierarchy with position params", async () => {
      const { client, request } = createMockClient();
      await client.prepareCallHierarchy(testUri, testLine, testCol);
      expect(request).toHaveBeenCalledWith(
        "textDocument/prepareCallHierarchy",
        expect.objectContaining({
          textDocument: { uri: testUri },
          position: { line: testLine, character: testCol },
        }),
        expect.any(Number),
      );
    });
  });

  describe("incomingCalls", () => {
    it("sends callHierarchy/incomingCalls with item param", async () => {
      const { client, request } = createMockClient();
      const item = {
        name: "myFunc",
        kind: 12,
        uri: testUri,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 10 },
        },
        selectionRange: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 6 },
        },
      };
      await client.incomingCalls(item);
      expect(request).toHaveBeenCalledWith(
        "callHierarchy/incomingCalls",
        { item },
        expect.any(Number),
      );
    });
  });

  describe("outgoingCalls", () => {
    it("sends callHierarchy/outgoingCalls with item param", async () => {
      const { client, request } = createMockClient();
      const item = {
        name: "myFunc",
        kind: 12,
        uri: testUri,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 10 },
        },
        selectionRange: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 6 },
        },
      };
      await client.outgoingCalls(item);
      expect(request).toHaveBeenCalledWith(
        "callHierarchy/outgoingCalls",
        { item },
        expect.any(Number),
      );
    });
  });

  // ── Type hierarchy ────────────────────────────────────────────────────

  describe("prepareTypeHierarchy", () => {
    it("sends textDocument/prepareTypeHierarchy with position params", async () => {
      const { client, request } = createMockClient();
      await client.prepareTypeHierarchy(testUri, testLine, testCol);
      expect(request).toHaveBeenCalledWith(
        "textDocument/prepareTypeHierarchy",
        expect.objectContaining({
          textDocument: { uri: testUri },
          position: { line: testLine, character: testCol },
        }),
        expect.any(Number),
      );
    });
  });

  describe("typeHierarchySupertypes", () => {
    it("sends typeHierarchy/supertypes with item param", async () => {
      const { client, request } = createMockClient();
      const item: TypeHierarchyItem = {
        name: "MyClass",
        kind: 5,
        uri: testUri,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 10, character: 1 },
        },
        selectionRange: {
          start: { line: 0, character: 6 },
          end: { line: 0, character: 13 },
        },
      };
      await client.typeHierarchySupertypes(item);
      expect(request).toHaveBeenCalledWith(
        "typeHierarchy/supertypes",
        expect.objectContaining({ item }),
        expect.any(Number),
      );
    });

    it("includes resolve when provided", async () => {
      const { client, request } = createMockClient();
      const item: TypeHierarchyItem = {
        name: "MyClass",
        kind: 5,
        uri: testUri,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 10, character: 1 },
        },
        selectionRange: {
          start: { line: 0, character: 6 },
          end: { line: 0, character: 13 },
        },
      };
      await client.typeHierarchySupertypes(item, 2);
      expect(request).toHaveBeenCalledWith(
        "typeHierarchy/supertypes",
        expect.objectContaining({ item, resolve: 2 }),
        expect.any(Number),
      );
    });
  });

  describe("typeHierarchySubtypes", () => {
    it("sends typeHierarchy/subtypes with item param", async () => {
      const { client, request } = createMockClient();
      const item: TypeHierarchyItem = {
        name: "BaseClass",
        kind: 5,
        uri: testUri,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 5, character: 1 },
        },
        selectionRange: {
          start: { line: 0, character: 6 },
          end: { line: 0, character: 15 },
        },
      };
      await client.typeHierarchySubtypes(item);
      expect(request).toHaveBeenCalledWith(
        "typeHierarchy/subtypes",
        expect.objectContaining({ item }),
        expect.any(Number),
      );
    });

    it("includes resolve when provided", async () => {
      const { client, request } = createMockClient();
      const item: TypeHierarchyItem = {
        name: "BaseClass",
        kind: 5,
        uri: testUri,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 5, character: 1 },
        },
        selectionRange: {
          start: { line: 0, character: 6 },
          end: { line: 0, character: 15 },
        },
      };
      await client.typeHierarchySubtypes(item, 3);
      expect(request).toHaveBeenCalledWith(
        "typeHierarchy/subtypes",
        expect.objectContaining({ item, resolve: 3 }),
        expect.any(Number),
      );
    });
  });

  // ── Rename ────────────────────────────────────────────────────────────

  describe("rename", () => {
    it("sends textDocument/rename with correct params including newName", async () => {
      const { client, request } = createMockClient();
      await client.rename(testUri, testLine, testCol, "newVarName");
      expect(request).toHaveBeenCalledWith(
        "textDocument/rename",
        {
          textDocument: { uri: testUri },
          position: { line: testLine, character: testCol },
          newName: "newVarName",
        },
        expect.any(Number),
      );
    });
  });

  describe("prepareRename", () => {
    it("sends textDocument/prepareRename with position params", async () => {
      const { client, request } = createMockClient();
      await client.prepareRename(testUri, testLine, testCol);
      expect(request).toHaveBeenCalledWith(
        "textDocument/prepareRename",
        {
          textDocument: { uri: testUri },
          position: { line: testLine, character: testCol },
        },
        expect.any(Number),
      );
    });
  });
});
