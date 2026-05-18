/**
 * Formatting utilities — re-export everything from submodules
 */
export { SEVERITY_NAMES, countSeverities, formatDiagnosticLine } from "./diagnostics.js";
export { flattenLocations, formatLocations } from "../utils/paths.js";
export {
  SYMBOL_KIND_NAMES,
  parseSymbolKind,
  formatDocumentSymbols,
  formatSymbolInformationList,
  MAX_SYMBOL_RESULTS,
} from "./symbols.js";
export { applyEdits, buildDiff } from "./diff.js";
export { ok, err, sanitizeError, type CommandResult } from "./output.js";
