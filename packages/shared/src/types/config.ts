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
