import { describe, expect, test } from "vitest";
import { applyCaveman } from "../packages/skills/src/personas/caveman/index.js";

// Persona Scope rule: caveman compresses Gru's TALK, never the artifacts.
describe("caveman persona — artifact safety", () => {
  test("Caveman no altera JSON", () => {
    const json = '{\n  "status": "ok",\n  "items": [1, 2]\n}';
    expect(applyCaveman(json)).toBe(json);
  });

  test("Caveman no altera YAML", () => {
    const yaml = "project:\n  name: gru\n  enabled: true";
    expect(applyCaveman(yaml)).toBe(yaml);
  });

  test("Caveman no altera bloques de codigo", () => {
    const code = "```ts\nconst value = 1;\n```";
    expect(applyCaveman(code)).toBe(code);
  });

  test("Caveman comprime prosa sin truncar contenido", () => {
    const text =
      "Claro, el provider elegido esta disponible y la tarea puede ejecutarse con seguridad.";
    const result = applyCaveman(text);
    expect(result).not.toMatch(/Claro,/);
    expect(result).toMatch(/provider elegido/);
    expect(result).toMatch(/seguridad/);
  });
});
