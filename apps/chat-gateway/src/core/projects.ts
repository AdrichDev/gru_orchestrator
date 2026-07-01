import fs from "node:fs";
import path from "node:path";

export interface ProjectEntry {
  name: string;
  path: string;
}

export interface ProjectRegistryOptions {
  /** Optional explicit map file (projects.json). Entries override discovery. */
  projectsFile?: string;
  /** Roots scanned for git repos. Empty = discovery disabled. */
  roots?: string[];
  /** Max directory depth to descend from each root. Default 3. */
  maxDepth?: number;
  /** Allow zero projects (e.g. ops-crm bot, which targets businesses, not repos). */
  allowEmpty?: boolean;
}

// Dirs never worth scanning into — keeps startup fast and avoids junk repos.
const SKIP_DIRS = new Set([
  "node_modules", ".git", "vendor", "dist", "build", ".next", ".turbo",
  ".cache", "coverage", "venv", ".venv", "__pycache__", ".idea", ".vscode",
]);

/**
 * Project name -> repo path map. Two sources, merged:
 *  1) Auto-discovery: every git repo found under the configured roots.
 *  2) An explicit projects.json (optional) whose entries OVERRIDE discovery.
 *
 * `/proyecto <NAME>` selects which repo the active CWD points at. Names match
 * case-insensitively. Keys are derived from the folder name; on collision the
 * parent folder (then a counter) disambiguates, so two repos with the same
 * basename (e.g. agents-agency in different roots) both remain reachable.
 */
export class ProjectRegistry {
  private readonly projects = new Map<string, ProjectEntry>();

  constructor(options: ProjectRegistryOptions | string) {
    // Back-compat: a bare string is treated as projectsFile.
    const opts: ProjectRegistryOptions =
      typeof options === "string" ? { projectsFile: options } : options;

    for (const root of opts.roots ?? []) {
      this.discover(root, opts.maxDepth ?? 3);
    }
    if (opts.projectsFile) {
      this.loadFile(opts.projectsFile, (opts.roots ?? []).length === 0);
    }

    if (this.projects.size === 0 && !opts.allowEmpty) {
      throw new Error(
        "No projects found. Set PROJECT_ROOTS to scan for repos, or provide a projects.json.",
      );
    }
  }

  /** Recursively find git repos under `root`, registering each (no nested repos). */
  private discover(root: string, maxDepth: number): void {
    if (!fs.existsSync(root)) {
      console.warn(`[projects] WARNING: scan root does not exist: ${root}`);
      return;
    }
    const walk = (dir: string, depth: number): void => {
      let isRepo = false;
      try {
        isRepo = fs.existsSync(path.join(dir, ".git"));
      } catch {
        return;
      }
      if (isRepo) {
        this.register(path.basename(dir), dir);
        return; // do not descend into a repo (skip nested/submodule repos)
      }
      if (depth <= 0) return;
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        if (!e.isDirectory() || e.name.startsWith(".") || SKIP_DIRS.has(e.name)) continue;
        walk(path.join(dir, e.name), depth - 1);
      }
    };
    walk(root, maxDepth);
  }

  /** Derive a stable key from a folder name, disambiguating on collision. */
  private register(folderName: string, repoPath: string): void {
    const base = folderName.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    let key = base || "REPO";
    if (this.projects.has(key)) {
      // Qualify with the parent folder, then a counter, until unique.
      const parent = path.basename(path.dirname(repoPath)).toUpperCase().replace(/[^A-Z0-9]+/g, "_");
      key = `${parent}_${base}`.replace(/^_+|_+$/g, "");
      let n = 2;
      while (this.projects.has(key)) key = `${base}_${n++}`;
    }
    this.projects.set(key, { name: key, path: repoPath });
  }

  /** Load explicit projects.json. With discovery on, entries override/add. */
  private loadFile(projectsFile: string, requireNonEmpty: boolean): void {
    if (!fs.existsSync(projectsFile)) {
      if (requireNonEmpty) {
        throw new Error(
          `Projects file not found: ${projectsFile}. Create it (see projects.example.json) or set PROJECT_ROOTS.`,
        );
      }
      return; // discovery is the source of truth; file is optional.
    }
    const raw = JSON.parse(fs.readFileSync(projectsFile, "utf-8")) as Record<string, { path?: string }>;
    for (const [name, entry] of Object.entries(raw)) {
      if (!entry?.path) continue;
      if (!fs.existsSync(entry.path)) {
        console.warn(`[projects] WARNING: path for "${name}" does not exist: ${entry.path}`);
      }
      this.projects.set(name.toUpperCase(), { name, path: entry.path });
    }
  }

  get(name: string): ProjectEntry | undefined {
    return this.projects.get(name.trim().toUpperCase());
  }

  list(): ProjectEntry[] {
    return [...this.projects.values()];
  }
}
