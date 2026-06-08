export function applyCaveman(output: string): string {
  const lines = output.split("\n");
  const processed = lines
    .map(line => line.trim())
    .filter(line => line.length > 0 && !line.startsWith("["))
    .map(line => {
      const words = line.split(" ");
      if (words.length > 6) {
        return words.slice(0, 6).join(" ") + ".";
      }
      return line;
    });

  if (processed.length === 0) {
    return `[MODIFICADOR CAVEMAN]\nHecho. Sin problemas.`;
  }

  return `[MODIFICADOR CAVEMAN]\n${processed.map(line => `- ${line}`).join("\n")}`;
}
