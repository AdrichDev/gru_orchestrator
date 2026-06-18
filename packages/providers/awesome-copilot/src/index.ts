import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import { resolveAwesomeCopilotPath } from "../../../kernel/src/config/resolve.js";
import { GruProvider, ProviderAvailability, ProviderTask, ProviderResult } from "../../../shared/src/ports/provider.js";

// ─── Async DFS walk ──────────────────────────────────────────────────────────

async function walkSkillFilesAsync(root: string, limit = 500): Promise<string[]> {
  const results: string[] = [];
  const stack = [root];
  while (stack.length > 0 && results.length < limit) {
    const current = stack.pop()!;
    let entries: fs.Dirent[] = [];
    try {
      entries = await fsPromises.readdir(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && entry.name === "SKILL.md") results.push(full);
    }
  }
  return results;
}

// ─── Per-instance cache ──────────────────────────────────────────────────────
//
// The catalog is expensive: a DFS walk over potentially 376+ SKILL.md files
// with a readFileSync per match.  We cache:
//   1. The discovered file list (populated after first checkAvailability or run).
//   2. A prebuilt search index: { file, haystackLower } per file — avoids
//      re-reading content on every run() call.
//
// Cache invalidation: the cache lives on the instance.  If the catalog on disk
// changes between calls, create a new AwesomeCopilotProvider instance.

interface CachedEntry {
  file: string;
  content: string;
  haystackLower: string;
}

export class AwesomeCopilotProvider implements GruProvider {
  id = "awesomeCopilot" as const;
  private readonly root: string;

  // Populated lazily on the first run() call (or warm() if called explicitly).
  private _cache: CachedEntry[] | null = null;
  // A pending warm promise, so concurrent first-calls don't double-walk.
  private _warmPromise: Promise<CachedEntry[]> | null = null;

  constructor(root?: string) {
    this.root = root ?? resolveAwesomeCopilotPath();
  }

  canHandle(task: ProviderTask): boolean {
    return /cat[aá]logo|awesome|copilot|skill/i.test(task.prompt);
  }

  async checkAvailability(): Promise<ProviderAvailability> {
    const skillsDir = path.join(this.root, "skills");
    let available = false;
    try {
      const stat = await fsPromises.stat(skillsDir);
      available = stat.isDirectory();
    } catch {
      available = false;
    }
    return {
      providerId: this.id,
      available,
      status: available ? "ready" : "missing",
      kind: "catalog",
      executable: available ? skillsDir : undefined,
      reason: available ? undefined : `No se encontró el catálogo real en ${skillsDir}`,
      installHint: "Run `gru init` and accept the awesome-copilot download, or: git clone --depth 1 https://github.com/github/awesome-copilot ~/.gru/awesome-copilot — alternatively set GRU_AWESOME_COPILOT_PATH."
    };
  }

  // ─── Cache warm (async, deduplicated) ────────────────────────────────────

  private warm(): Promise<CachedEntry[]> {
    if (this._cache !== null) return Promise.resolve(this._cache);
    if (this._warmPromise !== null) return this._warmPromise;

    this._warmPromise = (async (): Promise<CachedEntry[]> => {
      const skillsDir = path.join(this.root, "skills");
      const files = await walkSkillFilesAsync(skillsDir);
      const entries: CachedEntry[] = await Promise.all(
        files.map(async (file) => {
          let content = "";
          try {
            content = await fsPromises.readFile(file, "utf8");
          } catch {
            content = "";
          }
          return {
            file,
            content,
            haystackLower: `${file}\n${content}`.toLowerCase(),
          };
        })
      );
      this._cache = entries;
      this._warmPromise = null; // allow GC
      return entries;
    })();

    return this._warmPromise;
  }

  // ─── run (hot path) ────────────────────────────────────────────────────────

  async run(task: ProviderTask): Promise<ProviderResult> {
    const availability = await this.checkAvailability();
    if (!availability.available) {
      return { providerId: this.id, success: false, output: "", error: availability.reason };
    }

    const terms = task.prompt.toLowerCase().split(/[^a-záéíóúüñ0-9-]+/i).filter((term) => term.length > 3);

    // Use cache — warm on first call, instant on subsequent calls.
    const entries = await this.warm();

    const matches = entries
      .map((entry) => {
        const score = terms.reduce(
          (total, term) => total + (entry.haystackLower.includes(term) ? 1 : 0),
          0
        );
        return { file: entry.file, score, content: entry.content };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    const output = matches.length
      ? matches.map((item) => `- ${path.relative(this.root, item.file)} (score ${item.score})`).join("\n")
      : `Catálogo cargado correctamente, pero no se encontraron skills relacionadas con: ${task.prompt}`;

    return {
      providerId: this.id,
      success: true,
      output,
      executedCommand: `search ${entries.length} SKILL.md files under ${this.root}`
    };
  }
}
