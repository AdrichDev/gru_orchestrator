import { ProviderTask, RoutingDecision, ProviderId, PersonaId } from "../../../shared/src/ports/provider.js";

interface ScoringRule {
  keywords: string[];
  weight: number;
}

const PROVIDER_RULES: Record<Exclude<ProviderId, "local">, ScoringRule[]> = {
  ruflo: [
    { keywords: ["swarm", "swarms", "multiagente", "paralelo"], weight: 5 },
    { keywords: ["agente", "coordinacion", "coordinación", "distribuida"], weight: 2 }
  ],
  gentlePi: [
    { keywords: ["sdd", "openspec", "tdd", "adr", "arnes", "arnés"], weight: 5 },
    { keywords: ["especificaciones", "test-driven", "disciplinado"], weight: 3 }
  ],
  gentlemanCli: [
    { keywords: ["gentle-ai", "doctor", "diagnostico", "diagnóstico", "sync", "sincroniza"], weight: 5 },
    { keywords: ["ecosistema", "instalacion", "perfiles"], weight: 2 }
  ],
  ecc: [
    { keywords: ["skill", "hook", "patron", "patrón", "seguridad", "cve"], weight: 5 },
    { keywords: ["políticas", "politicas", "reglas", "revisión técnica"], weight: 2 }
  ],
  deepagents: [
    { keywords: ["workflow", "checkpoint", "persistente", "cadenas"], weight: 5 },
    { keywords: ["largo", "estado"], weight: 2 }
  ],
  engram: [
    { keywords: ["recuerda", "memoria", "contexto", "descubrimiento"], weight: 5 },
    { keywords: ["decisión", "decision", "buscar", "semántica", "semantica"], weight: 2 }
  ],
  awesomeCopilot: [
    { keywords: ["catálogo", "catalogo", "awesome", "copilot"], weight: 5 },
    { keywords: ["prompts", "plantillas"], weight: 2 }
  ]
};

const PERSONA_RULES: Record<PersonaId, ScoringRule[]> = {
  devilsAdvocate: [
    { keywords: ["devil", "abogado", "critica", "crítica", "riesgos", "grietas", "diablo"], weight: 5 },
    { keywords: ["edge cases", "arquitectura", "validar"], weight: 2 }
  ],
  caveman: [
    { keywords: ["caveman", "directo", "bruto", "corto", "florituras"], weight: 5 },
    { keywords: ["simple", "rapido", "rápido"], weight: 2 }
  ]
};

export function routeTask(task: ProviderTask): RoutingDecision {
  const prompt = task.prompt.toLowerCase();
  
  const providerScores: Record<ProviderId, number> = {
    local: 0,
    ruflo: 0,
    gentlePi: 0,
    gentlemanCli: 0,
    ecc: 0,
    deepagents: 0,
    engram: 0,
    awesomeCopilot: 0
  };

  const providerReasons: Record<ProviderId, string[]> = {
    local: [],
    ruflo: [],
    gentlePi: [],
    gentlemanCli: [],
    ecc: [],
    deepagents: [],
    engram: [],
    awesomeCopilot: []
  };

  // Calculate provider scores
  for (const [pId, rules] of Object.entries(PROVIDER_RULES)) {
    const providerId = pId as ProviderId;
    for (const rule of rules) {
      for (const keyword of rule.keywords) {
        if (prompt.includes(keyword)) {
          providerScores[providerId] += rule.weight;
          providerReasons[providerId].push(`Coincidencia con '${keyword}' (+${rule.weight})`);
        }
      }
    }
  }

  // Calculate persona scores
  const activePersonas: PersonaId[] = [];
  const reasons: string[] = [];
  for (const [perId, rules] of Object.entries(PERSONA_RULES)) {
    const personaId = perId as PersonaId;
    let score = 0;
    for (const rule of rules) {
      for (const keyword of rule.keywords) {
        if (prompt.includes(keyword)) {
          score += rule.weight;
          reasons.push(`Persona ${personaId}: Coincidencia con '${keyword}' (+${rule.weight})`);
        }
      }
    }
    if (score > 0) {
      activePersonas.push(personaId);
    }
  }

  // Determine winner
  let bestProvider: ProviderId = "local";
  let maxScore = 0;

  for (const [pId, score] of Object.entries(providerScores)) {
    const providerId = pId as ProviderId;
    if (score > maxScore) {
      maxScore = score;
      bestProvider = providerId;
    }
  }

  // If no score matched, select local provider
  if (maxScore === 0) {
    bestProvider = "local";
    reasons.push("Sin coincidencias de proveedor específico. Enrutado a local.");
  } else {
    reasons.push(`Proveedor principal '${bestProvider}' seleccionado con puntuación ${maxScore}.`);
    reasons.push(...providerReasons[bestProvider]);
  }

  // Collect fallbacks
  const scoredProviders = Object.entries(providerScores)
    .filter(([pId, score]) => pId !== bestProvider && score > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([pId]) => pId as ProviderId);

  // Calculate confidence score (scale 0-100)
  let confidence = 0;
  if (bestProvider === "local") {
    confidence = 100;
  } else {
    const totalScore = Object.values(providerScores).reduce((a, b) => a + b, 0);
    confidence = Math.round((maxScore / totalScore) * 100);
  }

  return {
    provider: bestProvider,
    personas: activePersonas,
    confidence,
    reasons,
    fallbacks: scoredProviders.length > 0 ? scoredProviders : ["local"]
  };
}
