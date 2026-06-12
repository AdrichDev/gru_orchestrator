// Caveman persona — compresses PROSE only.
// Persona Scope rule (see harness docs): personas govern how Gru TALKS,
// never the artifacts. JSON, YAML, and fenced code blocks pass through intact.

const FILLER_LEADS =
  /^(claro(\s+que\s+s[ií])?|por\s+supuesto|sin\s+duda|perfecto|vale|bueno|en\s+resumen|como\s+puedes\s+ver|obviamente)[,:]?\s+/i;

function isJsonLike(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

function isYamlLike(text: string): boolean {
  const lines = text.split("\n").filter((line) => line.trim().length > 0);
  if (lines.length < 2) return false;
  const structural = lines.filter((line) => /^\s*(-\s+\S|[\w."'-]+\s*:)/.test(line));
  return structural.length / lines.length >= 0.8;
}

function isFencedCodeOnly(text: string): boolean {
  return /^```[\s\S]*```$/.test(text.trim());
}

export function applyCaveman(output: string): string {
  // Artifacts pass through untouched — caveman only talks, never edits.
  if (isJsonLike(output) || isYamlLike(output) || isFencedCodeOnly(output)) {
    return output;
  }

  const processed = output
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("["))
    .map((line) => line.replace(FILLER_LEADS, ""))
    .map((line) => (line.length > 0 ? line.charAt(0).toUpperCase() + line.slice(1) : line));

  if (processed.length === 0) {
    return `[MODIFICADOR CAVEMAN]\nHecho. Sin problemas.`;
  }

  return `[MODIFICADOR CAVEMAN]\n${processed.map((line) => `- ${line}`).join("\n")}`;
}
