import { registerCommand } from "../daemon/server.js";
import { ok, err } from "../formatting/output.js";
import { resolveFile } from "../utils/paths.js";
import { languageFromPath } from "../lsp/language-config.js";

registerCommand("fileChanged", async (params, manager, cwd) => {
  const file = params.file as string;
  if (typeof file !== "string" || file.length === 0) {
    return err("Missing or invalid 'file' parameter.", { file });
  }

  // Validate the file path is within the workspace
  let filePath: string;
  try {
    filePath = resolveFile(file, cwd);
  } catch {
    return err(`Path traversal rejected: "${file}"`, { file });
  }

  const config = languageFromPath(filePath);
  if (!config) {
    // Not an error — file just doesn't have LSP support
    return ok("skipped", { skipped: true });
  }

  await manager.onFileChanged(filePath);
  return ok("file updated", { language: config.language });
});
