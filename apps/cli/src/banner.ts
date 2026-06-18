/**
 * Gru ASCII banner — printed at the top of `gru init` (and reusable elsewhere).
 */

export const GRU_BANNER = `
   ___  ____  _   _
  / __||  _ \\| | | |     ____
 | |  _| |_) | |_| |    /    \\
 | |_| |  _ <|  _  |   | o  o |   GRU
  \\____|_| \\_\\_| |_|   |  __  |   HARNESS
                         \\_/  \\_/   orchestrator, globally
                          \\ __ /    installable
`;

export function printBanner(): void {
  process.stdout.write(GRU_BANNER + "\n");
}
