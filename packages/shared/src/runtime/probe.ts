import fs from "fs";
import path from "path";
import { execa } from "execa";

export async function probeCommand(
  command: string,
  args: string[] = ["--version"]
): Promise<{ available: boolean; version?: string; reason?: string }> {
  const candidates = process.platform === "win32" && !/\.(cmd|bat|exe)$/i.test(command)
    ? [`${command}.cmd`, command]
    : [command];

  let lastError = "Comando no encontrado";
  for (const candidate of candidates) {
    try {
      const result = await execa(candidate, args, { reject: false, timeout: 10_000 });
      if (result.exitCode === 0) {
        const version = (result.stdout || result.stderr).trim().split(/\r?\n/)[0];
        return { available: true, version: version || undefined };
      }
      lastError = (result.stderr || result.stdout || `exit code ${result.exitCode}`).trim();
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
  }
  return { available: false, reason: lastError };
}

export function directoryContains(root: string, child: string): boolean {
  return fs.existsSync(path.resolve(root, child));
}
