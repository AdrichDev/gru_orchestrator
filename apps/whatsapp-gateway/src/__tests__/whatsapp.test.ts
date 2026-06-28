import { describe, it, expect } from "vitest";
import { fragment } from "../whatsapp.js";

describe("fragment", () => {
  it("returns a single chunk when under the limit", () => {
    expect(fragment("short", 100)).toEqual(["short"]);
  });

  it("splits long text into chunks within the limit", () => {
    const text = Array.from({ length: 50 }, (_, i) => `line ${i}`).join("\n");
    const chunks = fragment(text, 40);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(40);
  });

  it("preserves content across chunks (modulo whitespace at cut points)", () => {
    const text = "abcdefg hijklmn opqrstu vwxyz0 123456 789012";
    const chunks = fragment(text, 12);
    const rejoined = chunks.join(" ").replace(/\s+/g, " ").trim();
    const original = text.replace(/\s+/g, " ").trim();
    expect(rejoined).toBe(original);
  });

  it("hard-cuts a single token longer than the limit", () => {
    const chunks = fragment("x".repeat(25), 10);
    expect(chunks.length).toBe(3);
    expect(chunks[0].length).toBe(10);
  });
});
