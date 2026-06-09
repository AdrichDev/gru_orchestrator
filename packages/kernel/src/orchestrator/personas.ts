import { PersonaId } from "../../../shared/src/ports/provider.js";
import { applyCaveman } from "../../../skills/src/personas/caveman/index.js";
import { applyDevilsAdvocate } from "../../../skills/src/personas/devils-advocate/index.js";

export function applyPersonas(output: string, prompt: string, personas: PersonaId[]): string {
  let finalOutput = output;
  for (const persona of personas) {
    if (persona === "caveman") {
      finalOutput = applyCaveman(finalOutput);
    } else if (persona === "devilsAdvocate") {
      finalOutput = applyDevilsAdvocate(finalOutput, prompt);
    }
  }
  return finalOutput;
}
