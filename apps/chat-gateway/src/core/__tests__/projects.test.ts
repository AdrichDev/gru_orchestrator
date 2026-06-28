import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ProjectRegistry } from "../projects.js";

let dir: string;
let file: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "gw-proj-"));
  file = path.join(dir, "projects.json");
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("ProjectRegistry", () => {
  it("loads entries and matches names case-insensitively", () => {
    fs.writeFileSync(file, JSON.stringify({ "3A_ESTUDIO": { path: dir } }));
    const reg = new ProjectRegistry(file);
    expect(reg.get("3a_estudio")?.name).toBe("3A_ESTUDIO");
    expect(reg.get("3A_ESTUDIO")?.path).toBe(dir);
  });

  it("returns undefined for an unknown project", () => {
    fs.writeFileSync(file, JSON.stringify({ A: { path: dir } }));
    expect(new ProjectRegistry(file).get("NOPE")).toBeUndefined();
  });

  it("throws when the file does not exist", () => {
    expect(() => new ProjectRegistry(path.join(dir, "missing.json"))).toThrow();
  });

  it("throws when there are no valid entries", () => {
    fs.writeFileSync(file, JSON.stringify({ A: {} }));
    expect(() => new ProjectRegistry(file)).toThrow();
  });

  it("lists all loaded projects", () => {
    fs.writeFileSync(file, JSON.stringify({ A: { path: dir }, B: { path: dir } }));
    expect(new ProjectRegistry(file).list().map((p) => p.name).sort()).toEqual(["A", "B"]);
  });
});
