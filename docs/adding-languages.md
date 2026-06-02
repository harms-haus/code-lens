# Adding a New Language

This guide explains how to add support for a new programming language to @harms-haus/code-lens by registering an LSP (Language Server Protocol) server.

---

## How LSP Integration Works

@harms-haus/code-lens uses the Language Server Protocol to provide code intelligence features (go-to-definition, hover, references, etc.) for any language that has an LSP-compliant server. The architecture works like this:

1. **Language registry** (`src/lsp/language-registry.ts`) — defines a `LANGUAGE_SERVERS` array containing one `LspServerConfig` entry per supported language.
2. **Language detection** (`src/lsp/language-config.ts`) — maps file extensions to the correct `LspServerConfig` via `languageFromPath()`.
3. **LSP manager** (`src/lsp/lsp-manager.ts`) — starts LSP server processes as child processes and communicates with them over stdio using JSON-RPC.
4. **Command handlers** (`src/commands/`) — invoke LSP methods (hover, definition, references, etc.) and format the results.

When a CLI command like `hover` is invoked on a file, the preamble logic:

1. Resolves the file path.
2. Detects the language from the file extension.
3. Checks if the LSP server is installed.
4. Starts the server if it isn't already running.
5. Opens the file in the server.
6. Sends the LSP request and returns the result.

To add a new language, you only need to add one entry to the `LANGUAGE_SERVERS` array.

---

## Step 1: Add an Entry to LANGUAGE_SERVERS

Open `src/lsp/language-registry.ts` and add a new object to the `LANGUAGE_SERVERS` array:

```typescript
{
  language: "my-language",
  command: "my-language-server",
  args: ["--stdio"],
  extensions: [".myext"],
  detectCommand: "my-language-server --version",
  installCommand: "npm install -g my-language-server",
  installInstructions: "npm install -g my-language-server",
},
```

Place the entry in alphabetical order by `language` name, following the existing convention of a comment header for each language block.

---

## Step 2: Understand Each Field

Here is the full `LspServerConfig` interface (defined in `src/lsp/types.ts`):

```typescript
interface LspServerConfig {
  language: string;
  command: string;
  args: string[];
  extensions: string[];
  initializationOptions?: Record<string, unknown>;
  detectCommand: string;
  installInstructions: string;
  installCommand: string;
}
```

### `language` (required)

A unique identifier string for the language. This is used internally to key server instances and display language names in status output.

- Use lowercase (e.g. `"typescript"`, `"python"`, `"rust"`).
- Must be unique across all entries in `LANGUAGE_SERVERS`.

### `command` (required)

The executable name (or path) used to start the LSP server process. This is the command passed to `cross-spawn`, which handles cross-platform binary resolution (including `.cmd`/`.bat` extension lookups on Windows).

- For npm-installed servers: the bin name (e.g. `"typescript-language-server"`).
- For servers invoked through a runtime: the runtime itself (e.g. `"java"` for Eclipse JDT LS, `"dart"` for the Dart analysis server).

### `args` (required)

An array of command-line arguments passed to the server command. Common patterns:

| Server type | Typical args |
|-------------|-------------|
| stdio-based npm servers | `["--stdio"]` |
| Servers that default to stdio | `[]` |
| Runtime-based servers | Runtime-specific flags + main entry point |

**Important**: @harms-haus/code-lens communicates with servers over **stdio**. Your server must support stdio mode. If the server defaults to stdio, use an empty array `[]`.

### `extensions` (required)

An array of file extensions (with leading dot) that should be routed to this server. For example:

```typescript
extensions: [".py"]                    // Python
extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]  // TypeScript/JavaScript
```

**Special case**: You can also match bare filenames (no leading dot). This is used for files like `Dockerfile`:

```typescript
extensions: [".dockerfile", "Dockerfile"]
```

The extension lookup uses a `Map`, so each extension can only map to **one** language. If two languages share an extension, the last entry in the array wins.

### `initializationOptions` (optional)

An optional object sent as the `initializationOptions` field during the LSP `initialize` handshake. Some servers require specific configuration to function correctly.

```typescript
initializationOptions: {
  "someServer": {
    "setting": true,
  },
},
```

Most servers don't need this. Omit it unless the server's documentation requires it.

### `detectCommand` (required)

A shell command that exits with code 0 if the server is installed. This is used by `isServerInstalled()` to check whether the LSP server binary is available before trying to start it.

Typically this is `<command> --version` or `<command> version`:

```typescript
detectCommand: "rust-analyzer --version"
detectCommand: "gopls version"
detectCommand: "pylsp --version"
```

The implementation splits this string by whitespace and runs it via `cross-spawn` with a 10-second timeout. On Windows, `cross-spawn` automatically resolves `.cmd`/`.bat` extensions, so npm-installed binaries (e.g. `typescript-language-server.cmd`) are found without explicit extension handling.

### `installCommand` (required)

A machine-runnable command that installs the LSP server. This is shown to users when they try to use a language whose server is not installed.

```typescript
installCommand: "npm install -g typescript-language-server typescript"
installCommand: "pip install python-lsp-server"
installCommand: "go install golang.org/x/tools/gopls@latest"
```

### `installInstructions` (required)

A human-readable string with installation instructions. This is displayed alongside `installCommand` in error messages when the server is not found.

```typescript
installInstructions: "npm install -g intelephense"
installInstructions: "Install via Swift toolchain; sourcekit-lsp is included"
installInstructions: "Download from https://github.com/fwcd/kotlin-language-server"
```

---

## Step 3: Test with a Sample File

After adding your entry:

1. **Build the project** (if applicable).
2. Create or open a file with one of your registered extensions.
3. Run a command against it, e.g.:

   ```bash
   code-lens hover path/to/sample.myext --line 10 --col 5
   ```

4. Verify that:
   - The language server starts (check with `code-lens status`).
   - The command returns useful output.
   - Errors are handled gracefully if the server is not installed.

---

## Step 4: Verify Extension Mapping

The `languageFromPath()` function in `src/lsp/language-config.ts` resolves file paths to `LspServerConfig` entries. It works by:

1. Extracting the file extension (the substring after the last `.`).
2. Looking it up in a pre-built `Map<string, LspServerConfig>`.
3. If no extension is found, falling back to matching the bare filename (e.g. `Dockerfile`).

To verify your extension mapping works:

```typescript
import { languageFromPath } from "./src/lsp/language-config.js";

const config = languageFromPath("/path/to/my-file.myext");
console.log(config?.language); // should print "my-language"
```

Also verify that extensions don't collide with existing entries. Since the extension map is built by iterating `LANGUAGE_SERVERS`, the **last** entry in the array that claims an extension wins.

---

## Common Pitfalls

### Server doesn't support --stdio

Most LSP servers communicate over stdio, but some default to TCP or require a specific flag. Check the server's documentation:

- `typescript-language-server` → requires `--stdio`
- `pylsp` → defaults to stdio, no flag needed
- `gopls` → defaults to stdio, no flag needed
- `haskell-language-server` → requires `--lsp`

If you omit a required stdio flag, the server may hang or fail silently.

### Server needs initialization options

Some servers require specific `initializationOptions` to enable features or configure behavior. Without them, the server may start but return empty results.

Check the server's documentation for any required initialization options and add them to the `initializationOptions` field.

### Server takes a long time to start

Some servers (e.g. Eclipse JDT LS for Java, Metals for Scala) have slow startup times. The daemon has a 60-second request timeout, which should be sufficient, but if a server regularly times out, consider noting this in `installInstructions`.

### Extension collision

If two languages share the same file extension, only one will win. For example, if both `"javascript"` and `"typescript"` entries claimed `.js`, the last one in the array would handle it. The current registry avoids this by assigning `.js`/`.jsx` to the TypeScript server (which handles both).

### detectCommand fails silently

The `isServerInstalled()` check runs `detectCommand` with a 10-second timeout. If the command takes longer than 10 seconds, it's treated as "not installed." Make sure your `detectCommand` is fast (e.g., `--version` flags are usually instant).

### Server requires a project/build context

Some language servers (e.g., `rust-analyzer`, `gopls`, Eclipse JDT LS) need a project or build file to function. They may return empty results or errors if invoked on standalone files without a proper project structure. This is expected behavior and is documented per-language.

---

## Example: Adding a New Language

Here's a complete example of adding support for **Erlang** using the `erlang_ls` language server:

```typescript
// In src/lsp/language-registry.ts, add to the LANGUAGE_SERVERS array:

{
  language: "erlang",
  command: "erlang_ls",
  args: [],
  extensions: [".erl", ".hrl", ".src", ".app.src"],
  detectCommand: "erlang_ls --version",
  installCommand: "rebar3 install  # or build from https://github.com/erlang-ls/erlang_ls",
  installInstructions: "Build and install erlang_ls from https://github.com/erlang-ls/erlang_ls",
},
```

After adding this entry:

1. Any file ending in `.erl`, `.hrl`, `.src`, or `.app.src` will be routed to `erlang_ls`.
2. The daemon will check if `erlang_ls` is installed by running `erlang_ls --version`.
3. If not installed, the user sees the install instructions in the error message.
4. If installed, the daemon starts `erlang_ls` as a child process and communicates over stdio.

No other code changes are needed — all existing commands (hover, definition, references, etc.) automatically work with the new language.
