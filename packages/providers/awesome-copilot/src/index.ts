import fs from "fs";
import path from "path";
import { resolveAwesomeCopilotPath } from "../../../kernel/src/config/resolve.js";
import { GruProvider, ProviderAvailability, ProviderTask, ProviderResult } from "../../../shared/src/ports/provider.js";

function walkSkillFiles(root: string, limit = 500): string[] {
  const results: string[] = [];
  const stack = [root];
  while (stack.length > 0 && results.length < limit) {
    const current = stack.pop()!;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile() && entry.name === "SKILL.md") results.push(full);
    }
  }
  return results;
}

export class AwesomeCopilotProvider implements GruProvider {
  id = "awesomeCopilot" as const;
  private readonly root: string;

  constructor(root?: string) {
    this.root = root ?? resolveAwesomeCopilotPath();
  }

  canHandle(task: ProviderTask): boolean {
    return /cat[aá]logo|awesome|copilot|skill/i.test(task.prompt);
  }

  async checkAvailability(): Promise<ProviderAvailability> {
    const skillsDir = path.join(this.root, "skills");
    const available = fs.existsSync(skillsDir) && fs.statSync(skillsDir).isDirectory();
    return {
      providerId: this.id,
      available,
      status: available ? "ready" : "missing",
      kind: "catalog",
      executable: available ? skillsDir : undefined,
      reason: available ? undefined : `No se encontró el catálogo real en ${skillsDir}`,
      installHint: "Clona https://github.com/github/awesome-copilot en .gru/awesome-copilot o define GRU_AWESOME_COPILOT_PATH."
    };
  }

  async run(task: ProviderTask): Promise<ProviderResult> {
    const availability = await this.checkAvailability();
    if (!availability.available) {
      return { providerId: this.id, success: false, output: "", error: availability.reason };
    }

    const terms = task.prompt.toLowerCase().split(/[^a-záéíóúüñ0-9-]+/i).filter((term) => term.length > 3);
    const files = walkSkillFiles(path.join(this.root, "skills"));
    const matches = files
      .map((file) => {
        const content = fs.readFileSync(file, "utf8");
        const haystack = `${file}\n${content}`.toLowerCase();
        const score = terms.reduce((total, term) => total + (haystack.includes(term) ? 1 : 0), 0);
        return { file, score, content };
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
      executedCommand: `search ${files.length} SKILL.md files under ${this.root}`
    };
  }
}
