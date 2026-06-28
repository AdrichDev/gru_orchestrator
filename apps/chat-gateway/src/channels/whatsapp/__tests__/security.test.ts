import { describe, it, expect } from "vitest";
import crypto from "node:crypto";
import { verifyKapsoSignature, isWhitelisted } from "../security.js";

const SECRET = "test-secret";

function sign(body: string, secret = SECRET): string {
  return crypto.createHmac("sha256", secret).update(Buffer.from(body)).digest("hex");
}

describe("verifyKapsoSignature", () => {
  it("accepts a valid signature over the raw body", () => {
    const body = '{"hello":"world"}';
    expect(verifyKapsoSignature(Buffer.from(body), sign(body), SECRET)).toBe(true);
  });

  it("rejects a tampered body", () => {
    const sig = sign('{"hello":"world"}');
    expect(verifyKapsoSignature(Buffer.from('{"hello":"evil"}'), sig, SECRET)).toBe(false);
  });

  it("rejects a wrong secret", () => {
    const body = '{"a":1}';
    expect(verifyKapsoSignature(Buffer.from(body), sign(body, "other"), SECRET)).toBe(false);
  });

  it("rejects a missing signature", () => {
    expect(verifyKapsoSignature(Buffer.from("x"), undefined, SECRET)).toBe(false);
  });

  it("rejects a garbage signature of different length without throwing", () => {
    expect(verifyKapsoSignature(Buffer.from("x"), "abc", SECRET)).toBe(false);
  });
});

describe("isWhitelisted", () => {
  it("allows a configured number", () => {
    expect(isWhitelisted("34600111222", ["34600111222"])).toBe(true);
  });
  it("blocks an unknown number", () => {
    expect(isWhitelisted("34699999999", ["34600111222"])).toBe(false);
  });
});
