// Chat platforms cap text length (~4096). Keep margin for the (n/m) prefix.
export const DEFAULT_MAX_CHARS = 3500;

/** Split long text on natural boundaries (newline > space > hard cut). */
export function fragment(text: string, max = DEFAULT_MAX_CHARS): string[] {
  if (text.length <= max) return [text];
  const out: string[] = [];
  let rest = text;
  while (rest.length > max) {
    let cut = rest.lastIndexOf("\n", max);
    if (cut < max * 0.5) cut = rest.lastIndexOf(" ", max);
    if (cut < max * 0.5) cut = max;
    out.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).replace(/^\s+/, "");
  }
  if (rest.length > 0) out.push(rest);
  return out;
}
