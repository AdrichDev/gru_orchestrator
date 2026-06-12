import { describe, expect, test } from "vitest";
import { routeTask } from "../packages/kernel/src/task-router/index.js";

describe("task router — provider selection", () => {
  test("router elige gentlePi para SDD/OpenSpec", () => {
    const route = routeTask({ taskId: "t1", prompt: "generar sdd openspec con tdd" });
    expect(route.provider).toBe("gentlePi");
  });

  test("router elige deepagents para workflows persistentes", () => {
    const route = routeTask({ taskId: "t2", prompt: "workflow persistente con checkpoints" });
    expect(route.provider).toBe("deepagents");
  });

  test("router elige ecc para seguridad/CVE", () => {
    const route = routeTask({ taskId: "t3", prompt: "security review cve hooks" });
    expect(route.provider).toBe("ecc");
  });

  test("router elige awesomeCopilot para catalogo Copilot", () => {
    const route = routeTask({ taskId: "t4", prompt: "buscar en catalogo awesome copilot" });
    expect(route.provider).toBe("awesomeCopilot");
  });
});
