import { defineConfig } from "tsup";

// Production build config for the gru-orchestrator CLI.
//
// Format: CJS (not ESM).
// Rationale: deepagents -> micromatch@4 (CJS-only) uses dynamic require() of
// Node built-ins. ESM bundle format cannot handle this at runtime ("Dynamic
// require of X is not supported"). CJS inline avoids the issue cleanly.
// M0 PoC confirmed: CJS self-contained bundle (~3.3 MB) runs `gru status`
// from an arbitrary cwd with no module-resolution errors.
//
// Strategy: bundle everything inline EXCEPT execa and yaml.
// - @gru/* workspace packages -> inline (no workspace resolution needed at runtime)
// - deepagents, langchain, @langchain/* -> inline (CJS-only; pnpm strict isolation
//   means they can't be found at runtime without monorepo node_modules)
// - execa, yaml -> external (declared as dependencies in package.json, so npm
//   installs them for the consumer after `pnpm add -g gru-orchestrator`)
// - Node built-ins -> external (platform provides them)

export default defineConfig({
  // Named entry produces dist/cli.cjs (not dist/index.cjs)
  entry: { cli: "apps/cli/src/index.ts" },
  format: ["cjs"],
  platform: "node",
  target: "node20",
  bundle: true,
  dts: false,
  splitting: false,
  sourcemap: false,
  clean: true,
  outDir: "dist",

  // Runtime externals: consumer npm install provides these.
  external: [
    "execa",
    "yaml",
    // Node built-ins (bare and node: protocol)
    /^node:.*/,
    "util",
    "os",
    "crypto",
    "events",
    "stream",
    "http",
    "https",
    "zlib",
    "buffer",
    "path",
    "fs",
    "net",
    "tls",
    "url",
    "querystring",
    "string_decoder",
    "assert",
    "child_process",
    "worker_threads",
    "perf_hooks",
    "async_hooks",
    "readline",
    "process",
    "tty",
    "constants",
    "vm",
    "module",
  ],

  // Force workspace packages AND deepagents/langchain bundled inline.
  // This makes the artifact self-contained — no runtime workspace resolution needed.
  noExternal: [/^@gru\/.*/, "deepagents", /^langchain.*/, /^@langchain\/.*/],

  // Shebang: required so the file is executable as a global CLI binary.
  banner: {
    js: "#!/usr/bin/env node",
  },

  // Use the root tsconfig so esbuild resolves @gru/* path aliases correctly.
  tsconfig: "./tsconfig.json",
});
