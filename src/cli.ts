import { Command, CommanderError } from "@commander-js/extra-typings";
import { ensureDaemon, stopDaemon } from "./daemon/lifecycle.js";
import { sendRequest } from "./daemon/client.js";
import { getSocketPath } from "./utils/socket-path.js";
import type { DaemonRequest } from "./daemon/protocol.js";
import type { CommandResult } from "./formatting/output.js";

let requestId = 1;

async function dispatch(method: string, params: Record<string, unknown>): Promise<void> {
  const cwd = process.cwd();
  await ensureDaemon(cwd);
  const socketPath = getSocketPath(cwd);

  const request: DaemonRequest = {
    jsonrpc: "2.0",
    method,
    params,
    id: requestId++,
  };

  let result: CommandResult;
  try {
    result = await sendRequest(socketPath, request);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    process.stderr.write(`Error: ${message}\n`);
    process.exit(1);
  }

  for (const item of result.content) {
    process.stdout.write(item.text + "\n");
  }

  if (result.isError) {
    process.exit(1);
  }
}

const program = new Command();
program
  .name("code-lens")
  .description("LSP-powered code intelligence CLI")
  .version("0.1.0")
  .exitOverride()
  .showHelpAfterError();

// ── Position command helper ──────────────────────────────────────────────

function registerPositionCommand(
  parent: Command,
  name: string,
  description: string,
  extraOptions: (cmd: Command) => Command = (cmd) => cmd,
  extraParams: (opts: Record<string, unknown>) => Record<string, unknown> = () => ({}),
): void {
  extraOptions(
    parent
      .command(name)
      .description(description)
      .requiredOption("--file <path>", "File path")
      .requiredOption("--line <n>", "Line number (1-indexed)", parseInt)
      .requiredOption("--col <n>", "Column number (1-indexed)", parseInt),
  ).action(async (opts: Record<string, unknown>) => {
    await dispatch(name, {
      file: opts.file,
      line: opts.line,
      col: opts.col,
      ...extraParams(opts),
    });
  });
}

// 1. diagnostics
program
  .command("diagnostics")
  .description("Get LSP diagnostics for files or workspace")
  .option("--files <paths>", "Comma-separated file paths")
  .option("--file <path>", "Single file path")
  .option("--workspace", "Check entire workspace")
  .option("--refresh", "Force refresh diagnostics")
  .action(async (opts) => {
    await dispatch("diagnostics", {
      files: opts.files ?? undefined,
      file: opts.file ?? undefined,
      workspace: opts.workspace ?? false,
      refresh: opts.refresh ?? false,
    });
  });

// 2. find-references
registerPositionCommand(program, "find-references", "Find all references to a symbol");

// 3. find-definition
registerPositionCommand(program, "find-definition", "Find the definition of a symbol");

// 4. find-implementations
registerPositionCommand(program, "find-implementations", "Find implementations of a symbol");

// 5. find-type-definition
registerPositionCommand(program, "find-type-definition", "Find the type definition of a symbol");

// 6. find-type-hierarchy
program
  .command("find-type-hierarchy")
  .description("Show the inheritance chain for a type")
  .requiredOption("--file <path>", "File path")
  .requiredOption("--line <n>", "Line number (1-indexed)", parseInt)
  .requiredOption("--col <n>", "Column number (1-indexed)", parseInt)
  .option("--direction <dir>", "Direction: supertypes, subtypes, or both", "both")
  .option("--depth <n>", "Max depth to traverse", parseInt, 2)
  .action(async (opts) => {
    await dispatch("find-type-hierarchy", {
      file: opts.file,
      line: opts.line,
      col: opts.col,
      direction: opts.direction,
      depth: opts.depth,
    });
  });

// 7. find-symbols
program
  .command("find-symbols")
  .description("Search for symbols across the workspace")
  .requiredOption("--query <string>", "Fuzzy symbol query")
  .option("--kind <kind>", "Filter by symbol kind (e.g., class, function, interface)")
  .action(async (opts) => {
    await dispatch("find-symbols", {
      query: opts.query,
      kind: opts.kind,
    });
  });

// 8. find-document-symbols
program
  .command("find-document-symbols")
  .description("List all symbols in a file")
  .requiredOption("--file <path>", "File path")
  .action(async (opts) => {
    await dispatch("find-document-symbols", {
      file: opts.file,
    });
  });

// 9. find-calls
registerPositionCommand(program, "find-calls", "List callers and callees for a function");

// 10. hover
registerPositionCommand(program, "hover", "Get type info and docs for a symbol");

// 11. rename-symbol
registerPositionCommand(
  program,
  "rename-symbol",
  "Rename a symbol",
  (cmd) => cmd.requiredOption("--new-name <string>", "New name for the symbol"),
  (opts) => ({ newName: opts.newName }),
);

// 12. status
program
  .command("status")
  .description("Show daemon and LSP server status")
  .action(async () => {
    await dispatch("status", {});
  });

// 13. stop (special: does not dispatch, stops daemon directly)
program
  .command("stop")
  .description("Stop the daemon")
  .action(async () => {
    await stopDaemon(process.cwd());
    process.stdout.write("Daemon stopped.\n");
  });

try {
  program.parse();
} catch (err) {
  if (err instanceof CommanderError) {
    process.exit(err.exitCode);
  }
  throw err;
}
