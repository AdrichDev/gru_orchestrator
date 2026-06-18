/**
 * Rigidity level for Devil's Advocate delegation review.
 *
 * "advisory"  — never blocks on routing confidence; emits no confidence warning.
 *               Only hard-rule violations (unavailable provider, catalog-as-executor)
 *               can block.
 *
 * "strict"    — (DEFAULT) warns when confidence < minConfidence (default 30).
 *               Never blocks on confidence alone. Reproduces the original behavior
 *               exactly — absent config is identical to this level.
 *
 * "paranoid"  — warns when confidence < max(minConfidence, 60); BLOCKS when
 *               confidence < minConfidence, asking the user to confirm the provider
 *               explicitly.
 */
export type DevilRigidity = "advisory" | "strict" | "paranoid";

export interface ProjectConfig {
  project: { name: string };
  routing: {
    defaultMode: string;
    enableRuflo: boolean;
    enableGentlePi: boolean;
    enableGentlemanCli: boolean;
    enableECC: boolean;
    enableDeepagents: boolean;
    enableEngram: boolean;
    enableAwesomeCopilot: boolean;
  };
  /**
   * Optional Devil's Advocate configuration.
   * When absent, defaults are: rigidity "strict", minConfidence 30.
   * This preserves full backward compatibility with configs that predate this field.
   */
  devil?: {
    /**
     * Controls how aggressively the delegation review reacts to low routing
     * confidence. See `DevilRigidity` for the semantics of each level.
     * Default: "strict"
     */
    rigidity?: DevilRigidity;
    /**
     * Minimum confidence percentage (0-100) used as the block/warn threshold.
     * In "strict" mode: warn when confidence < minConfidence.
     * In "paranoid" mode: block when confidence < minConfidence; warn when
     *   confidence < max(minConfidence, 60).
     * In "advisory" mode: unused.
     * Default: 30
     */
    minConfidence?: number;
  };
}

export interface ProviderConfig {
  enabled: boolean;
  kind: string;
  command?: string;
  args?: string[];
  healthCheckArgs?: string[];
  path?: string;
  entry?: string;
  installHint?: string;
}

export interface ProvidersFile {
  providers: Record<string, ProviderConfig>;
}

export interface SkillsFile {
  skills: {
    personas: Record<string, { enabled: boolean; path: string }>;
  };
}
