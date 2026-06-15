/**
 * T-8 Regression: pre-bash denylist — normalization-resistant regex
 *
 * Detection pattern id: T-8
 * DETECT phase: this test FAILS on the old naive 4-substring denylist and
 * PASSES on the fixed whitespace-normalized structural regex implementation.
 *
 * Proof the old code would fail:
 *   Old: cmd.includes('rm -rf /') — does NOT match "rm  -rf  /" (extra spaces)
 *   Old: no pattern for "rm --no-preserve-root /" or "dd if=/dev/zero of=/dev/sda"
 *   Old: ":(){:|:&};:" misses ": ( ) { : | : & } ; :" (spaced fork-bomb)
 *
 * The test invokes the REAL hook handler as a child process so it exercises the
 * actual production code path, not an in-process copy.
 */

import { describe, it, expect } from "vitest";
import { spawnSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Absolute path so the test works regardless of cwd reset between calls.
const HOOK_HANDLER = path.resolve(__dirname, "../.claude/helpers/hook-handler.cjs");

/**
 * Run hook-handler.cjs pre-bash with a given command string via stdin JSON.
 * Returns the exit code (0 = allowed, 1 = blocked).
 */
function runPreBash(command: string): number {
  const result = spawnSync(
    process.execPath, // node executable — avoids PATH issues on Windows
    [HOOK_HANDLER, "pre-bash"],
    {
      input: JSON.stringify({ command }),
      encoding: "utf8",
      timeout: 5000,
    }
  );
  return result.status ?? 1;
}

// ---------------------------------------------------------------------------
// T-8 — Commands that MUST be blocked (exit 1)
// Old code (4-substring denylist) missed every variant except "rm -rf /"
// ---------------------------------------------------------------------------
describe("T-8 pre-bash denylist — BLOCKED variants (regression)", () => {
  it("blocks canonical rm -rf /", () => {
    // Old code: caught this (includes 'rm -rf /')
    // New code: catches via regex
    // Test value: baseline — if this fails the handler is fundamentally broken
    expect(runPreBash("rm -rf /")).toBe(1);
  });

  it("blocks rm with double spaces (rm  -rf  /) — OLD CODE MISSED THIS", () => {
    // Old code: cmd.includes('rm -rf /') → false (double spaces don't match single-space literal)
    // New code: whitespace normalization collapses spaces before regex test → blocked
    expect(runPreBash("rm  -rf  /")).toBe(1);
  });

  it("blocks rm --no-preserve-root / — OLD CODE MISSED THIS", () => {
    // Old code: 'rm --no-preserve-root /' not in the 4-string denylist
    // New code: /\brm\b.*--no-preserve-root/i pattern catches it
    expect(runPreBash("rm --no-preserve-root /")).toBe(1);
  });

  it("blocks dd if=/dev/zero of=/dev/sda — OLD CODE MISSED THIS", () => {
    // Old code: no dd pattern in denylist
    // New code: /\bdd\b.*\bof=\/dev\//i catches it
    expect(runPreBash("dd if=/dev/zero of=/dev/sda")).toBe(1);
  });

  it("blocks canonical fork bomb :(){:|:&};:", () => {
    // Old code: caught this (includes ':(){:|:&};:')
    // New code: regex /:s*(s*)s*{s*:s*|/ catches it after normalization
    expect(runPreBash(":(){:|:&};:")).toBe(1);
  });

  it("blocks spaced fork-bomb variant : ( ) { : | : & } ; : — OLD CODE MISSED THIS", () => {
    // Old code: ':(){:|:&};:'.includes(': ( ) { : | : & } ; :') === false
    //   (literal substring with spaces doesn't match spaced version)
    // New code: after whitespace normalization the regex /:s*(s*)s*{s*:s*|/
    //   still matches the structural pattern
    expect(runPreBash(": ( ) { : | : & } ; :")).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// T-8 — Commands that MUST be allowed (exit 0)
// These must NOT be false-positives after the fix
// ---------------------------------------------------------------------------
describe("T-8 pre-bash denylist — ALLOWED commands (no regression in safe ops)", () => {
  it("allows rm -rf /tmp/x (subdirectory, not root)", () => {
    expect(runPreBash("rm -rf /tmp/x")).toBe(0);
  });

  it("allows ls -la", () => {
    expect(runPreBash("ls -la")).toBe(0);
  });

  it("allows git status", () => {
    expect(runPreBash("git status")).toBe(0);
  });

  it("allows npm test", () => {
    expect(runPreBash("npm test")).toBe(0);
  });

  it("allows pnpm exec vitest run", () => {
    expect(runPreBash("pnpm exec vitest run")).toBe(0);
  });
});
