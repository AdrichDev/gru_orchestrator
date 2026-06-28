import fs from "node:fs";

export interface ProjectEntry {
  name: string;
  path: string;
}

/**
 * Loads the project name -> repo path map from a JSON file. Names are matched
 * case-insensitively. The map is what makes the gateway adaptive across repos:
 * `/proyecto <NAME>` selects which repo the active CWD points at.
 */
export class ProjectRegistry {
  private readonly projects = new Map<string, ProjectEntry>();

  constructor(projectsFile: string) {
    this.load(projectsFile);
  }

  private load(projectsFile: string): void {
    if (!fs.existsSync(projectsFile)) {
      throw new Error(
        `Projects file not found: ${projectsFile}. Create it (see projects.example.json).`,
      );
    }
    const raw = JSON.parse(fs.readFileSync(projectsFile, "utf-8")) as Record<
      string,
      { path?: string }
    >;
    for (const [name, entry] of Object.entries(raw)) {
      if (!entry?.path) continue;
      if (!fs.existsSync(entry.path)) {
        console.warn(`[projects] WARNING: path for "${name}" does not exist: ${entry.path}`);
      }
      this.projects.set(name.toUpperCase(), { name, path: entry.path });
    }
    if (this.projects.size === 0) {
      throw new Error(`Projects file ${projectsFile} has no valid entries.`);
    }
  }

  get(name: string): ProjectEntry | undefined {
    return this.projects.get(name.trim().toUpperCase());
  }

  list(): ProjectEntry[] {
    return [...this.projects.values()];
  }
}
