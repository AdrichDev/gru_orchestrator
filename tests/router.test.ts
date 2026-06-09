import test from "node:test";
import assert from "node:assert/strict";
import { routeTask } from "../packages/kernel/src/task-router/index.js";

test("router elige gentlePi para SDD/OpenSpec", () => {
  const route = routeTask({ taskId: "t1", prompt: "generar sdd openspec con tdd" });
  assert.equal(route.provider, "gentlePi");
});

test("router elige deepagents para workflows persistentes", () => {
  const route = routeTask({ taskId: "t2", prompt: "workflow persistente con checkpoints" });
  assert.equal(route.provider, "deepagents");
});

test("router elige ecc para seguridad/CVE", () => {
  const route = routeTask({ taskId: "t3", prompt: "security review cve hooks" });
  assert.equal(route.provider, "ecc");
});

test("router elige awesomeCopilot para catalogo Copilot", () => {
  const route = routeTask({ taskId: "t4", prompt: "buscar en catalogo awesome copilot" });
  assert.equal(route.provider, "awesomeCopilot");
});
