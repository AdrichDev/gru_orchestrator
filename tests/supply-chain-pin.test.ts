import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * WS-3 regression — ruflo must be invoked at a pinned version, never `@latest`.
 *
 * An unpinned `ruflo@latest` resolves the newest published version at run time,
 * so a compromised or breaking release executes on the host with no review.
 * This test fails if any source file reintroduces the floating tag.
 */
const ROOT = resolve(__dirname, "..");

const GUARDED_FILES = [
  "scripts/setup-providers.mjs",
];

describe("supply-chain: ruflo version pinning (WS-3)", () => {
  for (const rel of GUARDED_FILES) {
    it(`${rel} pins ruflo (no @latest)`, () => {
      const src = readFileSync(resolve(ROOT, rel), "utf8");
      expect(src).not.toMatch(/ruflo@latest/);
    });
  }

  it("pinned ruflo references use an explicit semver", () => {
    for (const rel of GUARDED_FILES) {
      const src = readFileSync(resolve(ROOT, rel), "utf8");
      const refs = src.match(/ruflo@[^"'`\s)]+/g) ?? [];
      for (const ref of refs) {
        expect(ref).toMatch(/ruflo@\d+\.\d+\.\d+/);
      }
    }
  });
});
