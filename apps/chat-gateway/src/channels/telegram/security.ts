/** Whitelist gate: only configured Telegram user ids may inject tasks into Gru. */
export function isTelegramAdmin(userId: string, adminIds: string[]): boolean {
  return adminIds.includes(userId);
}
