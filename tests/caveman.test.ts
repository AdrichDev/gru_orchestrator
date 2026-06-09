import test from "node:test";
import assert from "node:assert/strict";
import { applyCaveman } from "../packages/skills/src/personas/caveman/index.js";

test("Caveman no altera JSON", () => {
  const json = '{\n  "status": "ok",\n  "items": [1, 2]\n}';
  assert.equal(applyCaveman(json), json);
});

test("Caveman no altera YAML", () => {
  const yaml = "project:\n  name: gru\n  enabled: true";
  assert.equal(applyCaveman(yaml), yaml);
});

test("Caveman no altera bloques de codigo", () => {
  const code = "```ts\nconst value = 1;\n```";
  assert.equal(applyCaveman(code), code);
});

test("Caveman comprime prosa sin truncar a seis palabras", () => {
  const text = "Claro, el provider elegido esta disponible y la tarea puede ejecutarse con seguridad.";
  const result = applyCaveman(text);
  assert.doesNotMatch(result, /^Claro/);
  assert.match(result, /provider elegido/);
  assert.match(result, /seguridad/);
});
