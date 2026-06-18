/**
 * Gru ASCII banner — printed at the top of `gru init` (and reusable elsewhere).
 */

export const GRU_BANNER = `
    ____ ____  _   _
   / ___|  _ \\ | | | |
  | |  _| |_) | | | |
  | |_| |  _ <| |_| |
   \\____|_| \\_\\___/   H A R N E S S

  orchestrator · installable globally · gru init → pick your runtime
`;

export function printBanner(): void {
  process.stdout.write(GRU_BANNER + "\n");
}
