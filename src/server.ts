// Import command handlers (side-effect imports that call registerCommand)
import "./commands/diagnostics.js";
import "./commands/find-references.js";
import "./commands/find-definition.js";
import "./commands/find-implementations.js";
import "./commands/find-type-definition.js";
import "./commands/find-type-hierarchy.js";
import "./commands/find-symbols.js";
import "./commands/find-document-symbols.js";
import "./commands/find-calls.js";
import "./commands/hover.js";
import "./commands/rename-symbol.js";
import "./commands/status.js";
import "./commands/file-changed.js";
import "./commands/lint.js";
import "./commands/prettier.js";
import "./commands/fullCheck.js";
import "./commands/fix.js";

import { startServer } from "./daemon/server.js";

startServer();
