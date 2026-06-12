import { describe, expect, test } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AwesomeCopilotProvider } from "../packages/providers/awesome-copilot/src/index.js";

describe("awesome copilot — provider status", () => {
  test("status distingue catálogo presente (kind=catalog, ready)", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "gru-awesome-"));
    fs.mkdirSync(path.join(root, "skills", "security-review"), { recursive: true });
    fs.writeFileSync(path.join(root, "skills", "security-review", "SKILL.md"), "# Security Review\n");

    try {
      const provider = new AwesomeCopilotProvider(root);
      const status = await provider.checkAvailability();
      expect(status.available).toBe(true);
      expect(status.status).toBe("ready");
      expect(status.kind).toBe("catalog");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  test("status reporta missing con installHint cuando no hay catálogo", async () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "gru-awesome-empty-"));
    try {
      const provider = new AwesomeCopilotProvider(root);
      const status = await provider.checkAvailability();
      expect(status.available).toBe(false);
      expect(status.status).toBe("missing");
      expect(status.installHint).toMatch(/awesome-copilot/i);
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
