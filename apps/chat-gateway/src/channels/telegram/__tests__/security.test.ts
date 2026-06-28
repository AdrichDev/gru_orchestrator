import { describe, it, expect } from "vitest";
import { isTelegramAdmin } from "../security.js";

describe("isTelegramAdmin", () => {
  it("allows a configured user id", () => {
    expect(isTelegramAdmin("12345", ["12345", "67890"])).toBe(true);
  });
  it("blocks an unknown user id", () => {
    expect(isTelegramAdmin("99999", ["12345"])).toBe(false);
  });
  it("treats ids as exact strings (no numeric coercion)", () => {
    expect(isTelegramAdmin("0123", ["123"])).toBe(false);
  });
});
