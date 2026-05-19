/**
 * find-references command: Find all references to a symbol
 */

import { registerCommand } from "../daemon/server.js";
import { executePreamble } from "./preamble.js";
import { flattenLocations, formatLocations } from "../utils/paths.js";
import { ok, err, sanitizeError } from "../formatting/output.js";
import { extractPositionParams } from "./params.js";

// ── Handler ────────────────────────────────────────────────────────────────

registerCommand("find-references", async (params, manager, cwd) => {
  const extracted = extractPositionParams(params);
  if (!extracted.ok) return extracted.error;
  const { file, line, col } = extracted.params;

  const preamble = await executePreamble(file, manager, cwd);
  if ("error" in preamble) return preamble.error;

  const { client, uri } = preamble.ok;

  try {
    const result = await client.findReferences(uri, line - 1, col - 1);
    const locations = flattenLocations(result);
    const formatted = formatLocations(locations);
    const mapped = locations.map((l) => ({
      uri: l.uri,
      line: l.range.start.line + 1,
      col: l.range.start.character + 1,
    }));

    return ok(
      `References found: ${mapped.length} location${mapped.length === 1 ? "" : "s"}\n\n${formatted}`,
      { file, line, col, references: mapped, count: mapped.length },
    );
  } catch (e) {
    return err(sanitizeError(e, "Failed to find references"), { file, line, col });
  }
});
