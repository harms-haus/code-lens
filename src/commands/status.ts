/**
 * status command: Show running LSP servers
 */

import { registerCommand } from "../daemon/server.js";
import { ok, err, sanitizeError } from "../formatting/output.js";

registerCommand("status", async (_params, manager, _cwd) => {
  try {
    const servers = await Promise.resolve(manager.getStatus());

    if (servers.length === 0) {
      return ok("No LSP servers running.", { servers: [] });
    }

    const lines = servers.map((s) => {
      const pidPart = s.pid !== null ? ` (pid: ${s.pid})` : "";
      return `${s.language}: ${s.status}${pidPart}`;
    });

    return ok(lines.join("\n"), { servers });
  } catch (e: unknown) {
    return err(sanitizeError(e, "status"));
  }
});
