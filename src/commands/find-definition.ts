/**
 * find-definition command: Find the definition of a symbol
 */

import { registerCommand } from "../daemon/server.js";
import { executePreamble } from "./preamble.js";
import { flattenLocations, formatLocations } from "../utils/paths.js";
import { ok, err, sanitizeError } from "../formatting/output.js";

// ── Handler ────────────────────────────────────────────────────────────────

registerCommand("find-definition", async (params, manager, cwd) => {
  const file = params.file as string;
  const line = params.line as number;
  const col = params.col as number;

  const preamble = await executePreamble(file, manager, cwd);
  if ("error" in preamble) return preamble.error;

  const { client, uri } = preamble.ok;

  try {
    const result = await client.gotoDefinition(uri, line - 1, col - 1);
    const locations = flattenLocations(result);
    const formatted = formatLocations(locations);
    const mapped = locations.map((l) => ({
      uri: l.uri,
      line: l.range.start.line + 1,
      col: l.range.start.character + 1,
    }));

    return ok(
      `Definition found: ${mapped.length} location(s)\n\n${formatted}`,
      { file, line, col, locations: mapped, count: mapped.length },
    );
  } catch (e) {
    return err(sanitizeError(e, "Failed to find definition"), { file, line, col });
  }
});
