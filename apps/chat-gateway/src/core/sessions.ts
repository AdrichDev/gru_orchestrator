export type ConfirmStage = "single" | "double";

export interface PendingApproval {
  prompt: string;
  reasons: string[];
  level: number;
  levelName: string;
  /** "single" = one SÍ; "double" = destructive/irreversible, needs SÍ then CONFIRMO. */
  stage: ConfirmStage;
  confirmedOnce: boolean;
  projectName: string;
  projectPath: string;
}

export interface SenderSession {
  activeProject?: string;
  pending?: PendingApproval;
}

/** In-memory per-sender state. Single-user/personal scope; not persisted. */
export class SessionStore {
  private readonly sessions = new Map<string, SenderSession>();

  get(sender: string): SenderSession {
    let s = this.sessions.get(sender);
    if (!s) {
      s = {};
      this.sessions.set(sender, s);
    }
    return s;
  }
}
