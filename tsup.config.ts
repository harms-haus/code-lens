import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/cli.ts"],
    outDir: "dist",
    format: ["esm"],
    target: "es2022",
    splitting: false,
    sourcemap: true,
    banner: { js: "#!/usr/bin/env node" },
    platform: "node",
    clean: true,
    external: ["commander", "@commander-js/extra-typings", "vscode-languageserver-types"],
  },
  {
    entry: ["src/server.ts"],
    outDir: "dist",
    format: ["esm"],
    target: "es2022",
    splitting: false,
    sourcemap: true,
    platform: "node",
    clean: false,
    banner: {
      js: "try{if(process.argv[1]&&!process.argv[1].includes('://'))process.argv[1]=new URL('file://'+process.argv[1]).href}catch(e){}\n",
    },
    external: ["commander", "@commander-js/extra-typings", "vscode-languageserver-types"],
  },
  {
    // Library entry — NEW
    entry: {
      "lib": "src/lib.ts",
      "lib-client": "src/lib-client.ts",
      "lib-lsp": "src/lib-lsp.ts",
    },
    outDir: "dist",
    format: ["esm"],
    target: "es2022",
    splitting: false,
    sourcemap: true,
    platform: "node",
    clean: false,
    dts: true,
    external: ["vscode-languageserver-types"],
  },
]);
