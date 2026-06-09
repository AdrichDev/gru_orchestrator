import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { AwesomeCopilotProvider } from "../packages/providers/awesome-copilot/src/index.js";

test("Awesome Copilot status distingue catalogo workspace de ejecucion", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gru-awesome-"));
  fs.mkdirSync(path.join(root, "skills", "security-review"), { recursive: true });
  fs.writeFileSync(path.join(root, "skills", "security-review", "SKILL.md"), "# Security Review\n");

  const previous = process.env.GRU_AWESOME_COPILOT_PATH;
  process.env.GRU_AWESOME_COPILOT_PATH = root;
  try {
    const provider = new AwesomeCopilotProvider();
    const status = await provider.checkAvailability();
    assert.ok([
      "AWESOME_COPILOT_CATALOG_READY",
      "AWESOME_COPILOT_PLUGIN_INSTALLED_CATALOG_READY"
    ].includes(status.statusLabel ?? ""));
    assert.equal(status.catalogReady, true);
    assert.equal(status.operationCallable, true);
    assert.equal(status.completionVerified, false);
    assert.deepEqual(status.capabilities, ["catalog.search", "catalog.read"]);
  } finally {
    if (previous === undefined) delete process.env.GRU_AWESOME_COPILOT_PATH;
    else process.env.GRU_AWESOME_COPILOT_PATH = previous;
    fs.rmSync(root, { recursive: true, force: true });
  }
});
