import crypto from "node:crypto";

/**
 * Verify a Kapso webhook signature.
 *
 * Kapso signs the RAW request body with HMAC-SHA256 using the webhook secret and
 * delivers the hex digest in the `X-Webhook-Signature` header. We MUST hash the
 * raw bytes (not a re-serialized object) and compare in constant time.
 *
 * If your Kapso project signs a JSON.stringify() of the parsed body instead of
 * the raw bytes, swap `rawBody` for `Buffer.from(JSON.stringify(parsed))`.
 */
export function verifyKapsoSignature(
  rawBody: Buffer,
  signature: string | undefined,
  secret: string,
): boolean {
  if (!signature) return false;
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const got = Buffer.from(signature);
  const exp = Buffer.from(expected);
  if (got.length !== exp.length) return false;
  return crypto.timingSafeEqual(got, exp);
}

/** Whitelist gate: only admin numbers may inject tasks into Gru. */
export function isWhitelisted(fromDigits: string, adminNumbers: string[]): boolean {
  return adminNumbers.includes(fromDigits);
}
