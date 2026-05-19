/**
 * find-calls command: Show incoming/outgoing calls for a function
 */

import { registerCommand } from "../daemon/server.js";
import { executePreamble } from "./preamble.js";
import { uriToFilePath } from "../utils/paths.js";
import { ok, err, sanitizeError } from "../formatting/output.js";
import { extractPositionParams } from "./params.js";
import type {
  CallHierarchyIncomingCall,
  CallHierarchyOutgoingCall,
} from "vscode-languageserver-types";

// ── Helpers ────────────────────────────────────────────────────────────────

function formatCall(
  call: CallHierarchyIncomingCall | CallHierarchyOutgoingCall,
): string {
  const node = "from" in call ? call.from : call.to;
  const name = node.name;
  const fp = uriToFilePath(node.uri);
  const line = node.range.start.line + 1;
  const ranges = ((call.fromRanges as typeof call.fromRanges | undefined) ?? [])
    .map((r) => `    at line ${r.start.line + 1}`)
    .join("\n");
  return `  ${name} — ${fp}:${line}\n${ranges}`;
}

// ── Handler ────────────────────────────────────────────────────────────────

registerCommand("find-calls", async (params, manager, cwd) => {
  const extracted = extractPositionParams(params);
  if (!extracted.ok) return extracted.error;
  const { file, line, col } = extracted.params;

  const preamble = await executePreamble(file, manager, cwd);
  if ("error" in preamble) return preamble.error;

  const { client, uri } = preamble.ok;

  try {
    const prepareResult = await client.prepareCallHierarchy(uri, line - 1, col - 1);
    const items = Array.isArray(prepareResult) ? prepareResult : [];

    if (items.length === 0) {
      return ok(
        "No call hierarchy available at this position. Place cursor on a function/method name.",
        { file },
      );
    }

    const item = items[0];
    let incomingCalls: CallHierarchyIncomingCall[] = [];
    let outgoingCalls: CallHierarchyOutgoingCall[] = [];

    try {
      const incoming = await client.incomingCalls(item);
      incomingCalls = Array.isArray(incoming) ? incoming : [];
    } catch {
      /* not supported */
    }

    try {
      const outgoing = await client.outgoingCalls(item);
      outgoingCalls = Array.isArray(outgoing) ? outgoing : [];
    } catch {
      /* not supported */
    }

    let output = `Call hierarchy for "${item.name}" in ${file}:${line}:${col}\n`;

    if (incomingCalls.length > 0) {
      output += `\n─── Incoming Calls (${incomingCalls.length}) ───\n`;
      output += incomingCalls.map((c) => formatCall(c)).join("\n\n");
    }

    if (outgoingCalls.length > 0) {
      output += `\n─── Outgoing Calls (${outgoingCalls.length}) ───\n`;
      output += outgoingCalls.map((c) => formatCall(c)).join("\n\n");
    }

    if (incomingCalls.length === 0 && outgoingCalls.length === 0) {
      output += "\nNo incoming or outgoing calls found.";
    }

    return ok(output, {
      file,
      line,
      col,
      functionName: item.name,
      incomingCount: incomingCalls.length,
      outgoingCount: outgoingCalls.length,
    });
  } catch (e) {
    return err(sanitizeError(e, "Failed to get call hierarchy"), { file });
  }
});
