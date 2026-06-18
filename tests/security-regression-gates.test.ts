/**
 * Security regression gates — blueteam-detect phase.
 * Pattern IDs: SEC-01, SEC-02, SEC-04.
 *
 * Each test is labelled with its pattern ID and:
 *   - FAILS on the vulnerable code / bad state.
 *   - PASSES on the current (fixed) code.
 *
 * SEC-03 (path traversal env vars) is already covered in full by
 * packages/kernel/src/config/__tests__/security.test.ts — not duplicated here.
 *
 * Run: pnpm test (vitest run)
 */

import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Walk up from __dirname until we find package.json "files" (= project root). */
function findProjectRoot(start: string): string {
  let dir = start;
  for (;;) {
    if (fs.existsSync(path.join(dir, "package.json"))) {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf-8")) as {
        files?: string[];
      };
      if (pkg.files) return dir; // root package.json has the "files" list
    }
    const parent = path.dirname(dir);
    if (parent === dir) return start;
    dir = parent;
  }
}

const ROOT = findProjectRoot(__dirname);

/**
 * Expand a package.json "files" entry to a list of real file paths.
 * Handles globs like "templates/**" by walking the directory.
 */
function expandFilesEntry(entry: string, root: string): string[] {
  // Resolve the leading path component (before any glob)
  const normalized = entry.replace(/\\/g, "/");
  const isGlob = normalized.endsWith("/**") || normalized.endsWith("/*");

  if (isGlob) {
    const baseDir = path.join(root, normalized.replace(/\/\*\*?$/, "").replace(/\//g, path.sep));
    if (!fs.existsSync(baseDir)) return [];
    return walkDir(baseDir);
  }

  const resolved = path.join(root, entry.replace(/\//g, path.sep));
  if (!fs.existsSync(resolved)) return [];
  if (fs.statSync(resolved).isDirectory()) return walkDir(resolved);
  return [resolved];
}

function walkDir(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkDir(full));
    else if (entry.isFile()) results.push(full);
  }
  return results;
}

// ---------------------------------------------------------------------------
// SEC-04 — no developer absolute path / PII in published artifacts
// ---------------------------------------------------------------------------

describe("SEC-04 — published artifact files must not contain developer paths or PII", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8")) as {
    files?: string[];
  };

  const publishedFiles: string[] = (pkg.files ?? []).flatMap((entry) =>
    expandFilesEntry(entry, ROOT)
  );

  it("package.json has a 'files' list (gate depends on it)", () => {
    expect(Array.isArray(pkg.files)).toBe(true);
    expect((pkg.files ?? []).length).toBeGreaterThan(0);
  });

  it("published files list is not empty after expansion", () => {
    // If this fails, the path expansion broke — fix the helper, not the gate.
    expect(publishedFiles.length).toBeGreaterThan(0);
  });

  it.each(publishedFiles)(
    "file '%s' — no Windows developer absolute path (C:\\\\Users\\\\...)",
    (filePath) => {
      const content = fs.readFileSync(filePath, "utf-8");
      // Match C:\Users\<anything> or D:\Users\<anything> etc.
      const matches = content.match(/[A-Za-z]:\\Users\\[^\s"']+/g) ?? [];
      expect(
        matches,
        `Found Windows developer path(s) in ${filePath}: ${matches.join(", ")}`
      ).toHaveLength(0);
    }
  );

  it.each(publishedFiles)(
    "file '%s' — no Unix developer absolute path (/Users/... or /home/...)",
    (filePath) => {
      const content = fs.readFileSync(filePath, "utf-8");
      // Match /Users/<name>/... or /home/<name>/... paths that look like real paths
      // Exclude documentation examples that mention placeholder names (e.g. "name", "username")
      const matches =
        content.match(/\/(?:Users|home)\/(?!(?:name|username|user)\b)[a-zA-Z0-9._-]{2,}\/[^\s"']+/g) ?? [];
      expect(
        matches,
        `Found Unix developer path(s) in ${filePath}: ${matches.join(", ")}`
      ).toHaveLength(0);
    }
  );

  it.each(publishedFiles)(
    "file '%s' — must not contain the literal developer username 'achoz'",
    (filePath) => {
      const content = fs.readFileSync(filePath, "utf-8");
      expect(
        content,
        `Literal developer username 'achoz' found in ${filePath}`
      ).not.toContain("achoz");
    }
  );
});

// ---------------------------------------------------------------------------
// SEC-02 — SAST gate: shell:true must not reappear in project source
// ---------------------------------------------------------------------------

describe("SEC-02 — shell:true must not exist in project source (SAST gate)", () => {
  /**
   * Source roots to scan. Excludes: node_modules, vendor, dist, __tests__, .test.
   * We scan: scripts/*.mjs, packages/** src files, apps/** src files.
   */
  const SOURCE_ROOTS = [
    path.join(ROOT, "scripts"),
    path.join(ROOT, "packages"),
    path.join(ROOT, "apps"),
  ];

  const EXCLUDED_PATH_PATTERNS = [
    /node_modules/,
    /[/\\]vendor[/\\]/,
    /[/\\]dist[/\\]/,
    // Allow the pattern in test files themselves (they describe the detection)
    /\.test\.[jt]s$/,
    /\.spec\.[jt]s$/,
  ];

  function gatherSourceFiles(roots: string[]): string[] {
    const results: string[] = [];
    for (const root of roots) {
      if (!fs.existsSync(root)) continue;
      results.push(...collectSourceFiles(root));
    }
    return results;
  }

  function collectSourceFiles(dir: string): string[] {
    const results: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (EXCLUDED_PATH_PATTERNS.some((p) => p.test(full))) continue;
      if (entry.isDirectory()) results.push(...collectSourceFiles(full));
      else if (entry.isFile() && /\.(ts|mjs|js|cjs)$/.test(entry.name)) {
        results.push(full);
      }
    }
    return results;
  }

  const sourceFiles = gatherSourceFiles(SOURCE_ROOTS);

  it("source file list is not empty", () => {
    expect(sourceFiles.length).toBeGreaterThan(0);
  });

  /**
   * The banned patterns are any LIVE usage of shell:true (not a comment or string literal
   * describing the fix). We check for the pattern in actual code by looking for
   * `shell: true` or `shell:true` outside of comment lines.
   *
   * NEGATIVE CHECK (proof the gate catches the regression):
   * If you change setup-providers.mjs run() to `shell: true` instead of `shell: false`,
   * this test will fail.  Revert to `shell: false` to pass.
   */
  it.each(sourceFiles)(
    "file '%s' — no 'shell: true' outside comments",
    (filePath) => {
      const lines = fs.readFileSync(filePath, "utf-8").split("\n");
      const violations: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trimStart();
        // Skip comment lines (// ... or * ...)
        if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("#")) continue;
        // Detect shell: true or shell:true as actual code
        if (/shell\s*:\s*true/.test(line)) {
          violations.push(`  line ${i + 1}: ${line.trim()}`);
        }
      }
      expect(
        violations,
        `SEC-02 violation in ${filePath}:\n${violations.join("\n")}`
      ).toHaveLength(0);
    }
  );

  /**
   * Additionally guard against `shell: IS_WIN` being reintroduced.
   * The fix replaced this with explicit .cmd shim resolution (no shell needed).
   *
   * NEGATIVE CHECK: adding `shell: IS_WIN` to any spawn/exec call in source
   * will cause this test to fail.
   */
  it.each(sourceFiles)(
    "file '%s' — no 'shell: IS_WIN' in spawn/exec calls",
    (filePath) => {
      const lines = fs.readFileSync(filePath, "utf-8").split("\n");
      const violations: string[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trimStart();
        if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("#")) continue;
        if (/shell\s*:\s*IS_WIN/.test(line)) {
          violations.push(`  line ${i + 1}: ${line.trim()}`);
        }
      }
      expect(
        violations,
        `SEC-02 violation (shell:IS_WIN) in ${filePath}:\n${violations.join("\n")}`
      ).toHaveLength(0);
    }
  );
});

// ---------------------------------------------------------------------------
// SEC-01 — arg-injection: provider sanitizePrompt function contract
// (verifies the actual sanitizer the providers import/inline, using
//  the same regex as the implementation so any change is caught)
// ---------------------------------------------------------------------------

describe("SEC-01 — provider arg-injection: sanitizePrompt contract on leading-dash prompts", () => {
  /**
   * All three providers (engram, gentle-pi, gentleman-cli) implement:
   *   function sanitizePrompt(prompt: string): string {
   *     return prompt.replace(/^-+/, "");
   *   }
   *
   * This test verifies the contract axioms.  If any provider changes its
   * sanitizer to something weaker (e.g., removes the replace), the test
   * catches it at the source level.
   *
   * We also verify the source text contains the implementation.
   */

  const PROVIDER_FILES = [
    path.join(ROOT, "packages", "providers", "engram", "src", "index.ts"),
    path.join(ROOT, "packages", "providers", "gentle-pi", "src", "index.ts"),
    path.join(ROOT, "packages", "providers", "gentleman-cli", "src", "index.ts"),
  ];

  it.each(PROVIDER_FILES)(
    "provider '%s' — defines a sanitizePrompt function that strips leading dashes",
    (filePath) => {
      expect(fs.existsSync(filePath)).toBe(true);
      const source = fs.readFileSync(filePath, "utf-8");
      // Must contain the sanitization regex /^-+/
      expect(source).toMatch(/\/\^-\+\//);
    }
  );

  it.each(PROVIDER_FILES)(
    "provider '%s' — sanitizePrompt(task.prompt) call is present (the prompt is sanitized before use)",
    (filePath) => {
      const source = fs.readFileSync(filePath, "utf-8");
      // Must call sanitizePrompt with task.prompt as the argument — not just define the function.
      // Matches: sanitizePrompt(task.prompt) with optional whitespace.
      expect(source).toMatch(/sanitizePrompt\(\s*task\.prompt\s*\)/);
    }
  );

  it.each(PROVIDER_FILES)(
    "provider '%s' — does NOT pass raw task.prompt directly to exec without sanitizing",
    (filePath) => {
      const source = fs.readFileSync(filePath, "utf-8");
      // The safe call pattern: safePrompt is produced by sanitizePrompt(task.prompt)
      // The bad pattern would be passing task.prompt straight into execa args.
      // We check: any occurrence of `task.prompt` in an execa args array is absent.
      // The allowed form is: sanitizePrompt(task.prompt) → safePrompt → execa(cmd,[..., safePrompt])
      //
      // Detect the dangerous pattern: execa(..., [..., task.prompt, ...], ...)
      // We look for `task.prompt` appearing directly inside an array literal next to execa.
      const dangerousPattern = /execa\([^)]*\[\s*[^[\]]*\btask\.prompt\b/;
      expect(
        dangerousPattern.test(source),
        `Provider ${filePath} passes task.prompt directly to execa args (unsanitized)`
      ).toBe(false);
    }
  );

  // Contract axioms (pure logic — same as what the providers inline)
  describe("contract axioms for the sanitizer logic itself", () => {
    function sanitize(prompt: string): string {
      return prompt.replace(/^-+/, "");
    }

    it("strips a single leading dash from --flag", () => {
      expect(sanitize("--version")).toBe("version");
    });

    it("strips a single leading dash from -h", () => {
      expect(sanitize("-h")).toBe("h");
    });

    it("strips '--flag=value' to 'flag=value'", () => {
      expect(sanitize("--flag=value")).toBe("flag=value");
    });

    it("does not mutate prompts without a leading dash", () => {
      expect(sanitize("search memory")).toBe("search memory");
      expect(sanitize("what is Gru?")).toBe("what is Gru?");
    });

    it("does not strip interior dashes", () => {
      expect(sanitize("find-and-replace")).toBe("find-and-replace");
    });

    it("does not strip dashes after leading whitespace (whitespace blocks dash stripping)", () => {
      // " --flag" starts with a space, not a dash — must be unchanged
      expect(sanitize("  --leading spaces")).toBe("  --leading spaces");
    });

    it("a prompt that is only dashes is reduced to empty string", () => {
      // Corner case: "---" → "" — not ideal but matches the contract
      expect(sanitize("---")).toBe("");
    });
  });
});

// ---------------------------------------------------------------------------
// SEC-04 (package files) — package.json "files" list does not leak source
// ---------------------------------------------------------------------------

describe("SEC-04 — package.json 'files' list does not include raw source directories", () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf-8")) as {
    files?: string[];
    name?: string;
  };

  const DANGEROUS_SOURCE_DIRS = [
    "packages",
    "apps",
    "src",
    "tests",
    ".env",
    ".gru",
    "scripts/setup-cybersec.mjs",
    "scripts/setup-providers.mjs",
    "scripts/generate-harness.mjs",
  ];

  it.each(DANGEROUS_SOURCE_DIRS)(
    "package 'files' list does not include source dir/file '%s'",
    (dangerousEntry) => {
      const files = pkg.files ?? [];
      const matched = files.filter((f) => {
        const norm = f.replace(/\\/g, "/").toLowerCase();
        return (
          norm === dangerousEntry.toLowerCase() ||
          norm.startsWith(dangerousEntry.toLowerCase() + "/")
        );
      });
      expect(
        matched,
        `'files' in package.json includes '${dangerousEntry}' which would leak source code`
      ).toHaveLength(0);
    }
  );

  it("package 'files' only exposes the intended published artifacts", () => {
    const files = pkg.files ?? [];
    // Allowlist: dist/cli.cjs, templates (and subtree), scripts/postinstall.mjs
    const ALLOWED_PREFIXES = ["dist/", "templates", "scripts/postinstall.mjs"];
    for (const entry of files) {
      const norm = entry.replace(/\\/g, "/");
      const isAllowed = ALLOWED_PREFIXES.some(
        (prefix) => norm === prefix || norm.startsWith(prefix)
      );
      expect(
        isAllowed,
        `Unexpected entry in package.json 'files': '${entry}'. Add it to ALLOWED_PREFIXES if intentional.`
      ).toBe(true);
    }
  });
});
