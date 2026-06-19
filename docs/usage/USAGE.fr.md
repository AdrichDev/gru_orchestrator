<div align="center">

<img src="../../docs/assets/gru-banner.svg" alt="GRU Harness — orchestrator" width="640">

</div>

> **"Gru coordinates. Minions produce. Policies govern. Human approves."**

<div align="center">

![Node](https://img.shields.io/badge/node-%3E%3D20-3c873a) ![Runtime](https://img.shields.io/badge/runtime-strict-facc15) ![Niveles](https://img.shields.io/badge/niveles-0--4-64748b) ![Harness](https://img.shields.io/badge/blue%2Fred%2Fpurple-cybersec-8b5cf6)

</div>

---

<div align="center">

🇪🇸 [**Español**](../../USAGE.md) &nbsp;|&nbsp; 🇺🇸 [**English**](USAGE.en.md) &nbsp;|&nbsp; 🇨🇳 [**中文**](USAGE.zh.md) &nbsp;|&nbsp; 🇫🇷 [**Français**](USAGE.fr.md) &nbsp;|&nbsp; 🇩🇪 [**Deutsch**](USAGE.de.md)

</div>

---

# Gru Harness — Guide d'utilisation (référence)

Référence complète du CLI `gru` (paquet `@adrichdev/gru-harness`, dépôt privé —
installé depuis Git, pas depuis le registre public). Pour la présentation du projet, voir
[README.md](../../README.md). Pour le runtime strict des providers, voir
[STRICT_PROVIDER_RUNTIME.md](../../STRICT_PROVIDER_RUNTIME.md).

---

## Où s'exécute le harness et que faut-il copier ?

Il y a **deux façons** d'utiliser Gru, et la réponse dépend de celle que vous choisissez.
Ne les mélangez pas.

### A) Le CLI `gru` (autonome)

- Installé **une seule fois, globalement** (`pnpm add -g github:AdrichDev/gru_orchestrator`).
  Il expose la commande `gru` sur tout le système.
- Il n'est **pas** nécessaire d'être dans le dossier de gru_orchestrator. Ce dépôt sert
  uniquement à *développer* le harness. Pour l'*utiliser*, vous lancez `gru` depuis la
  **racine de VOTRE projet** (celui sur lequel vous travaillez).
- Le `cwd` définit : la portée de la config (`<cwd>/.gru/`), la cible du filesystem scan et
  les logs (`runs/run_*.json`). C'est pourquoi on l'exécute à la racine de votre projet,
  pas à celle de gru.
- **Copier les fichiers canoniques ?** Pour que le CLI *démarre*, non : `postinstall` sème
  `~/.gru/*` et cela suffit. Vous n'avez besoin de `gru init` dans votre projet que si vous
  voulez une config à portée projet, des contrats ou un `.mcp.json` local.

### B) Le persona dans un harness LLM (Claude Code, Codex, Gemini, Cursor…)

- Ces outils chargent automatiquement leur fichier canonique **depuis l'arbre du `cwd`** :
  Claude Code lit `CLAUDE.md` ; Codex/Cursor/Antigravity lisent `AGENTS.md` ; Gemini lit
  `GEMINI.md`.
- **Ici, il FAUT bien avoir les fichiers canoniques à la racine de VOTRE projet.** Les
  fichiers du dépôt de gru **ne suffisent pas** : ils ne se chargent que lorsque vous
  travaillez *dans* `gru_orchestrator`. Un autre projet ne lit pas le `CLAUDE.md`/`AGENTS.md`
  d'un dépôt étranger.
- Pour les semer dans votre projet : `gru init --runtime <tool>` (voir
  [`gru init`](#gru-init--référence-complète)). Il écrit le fichier canonique du runtime
  choisi plus les fichiers partagés (`.gru/*`, contrats, `.mcp.json`).

### Récapitulatif

| Question | Réponse |
| :--- | :--- |
| Être dans le dossier de gru ? | **Non.** Seulement pour développer le harness. Pour l'utiliser, lancez depuis la racine de votre projet. |
| Où lancer `gru` ? | À la **racine du projet sur lequel vous travaillez** (le `cwd` définit config/scan/logs). |
| Les fichiers du dépôt de gru suffisent-ils ? | **CLI :** oui (global + `~/.gru/`). **Persona LLM :** non — chaque outil ne lit que le fichier canonique de son propre arbre `cwd`. |
| Faut-il copier les fichiers canoniques à la racine du projet ? | **Seulement pour le persona LLM.** Utilisez `gru init --runtime <tool>`. Le CLI n'en a pas besoin pour démarrer. |

---

## Installation

```bash
# Dépôt privé → install directement depuis Git (pas de clone manuel ; expose la commande `gru`).
pnpm add -g github:AdrichDev/gru_orchestrator
# ou via SSH :
pnpm add -g git+ssh://git@github.com/AdrichDev/gru_orchestrator.git
```

Nécessite l'accès au dépôt privé, **git** et **Node.js 20+**. L'installation compile le
bundle sur votre machine (script `prepare` → tsup). Non publié sur le registre npm public.

### Ce que fait le `postinstall`

Après l'installation globale, le bootstrap (`scripts/postinstall.mjs`) **ne fait jamais
échouer l'installation** (il sort toujours avec le code 0) et :

1. Crée `~/.gru/` (idempotent).
2. Sème les YAML par défaut depuis `templates/.gru/` (config, providers, skills) sans
   écraser ce qui existe déjà.
3. Affiche un avis : le catalogue **awesome-copilot est opt-in** — il n'est PAS téléchargé
   ici. Pour le télécharger, utilisez `gru init --awesome-copilot`.

En contexte monorepo (checkout des sources), il délègue à la vérification du harness cybersec
au lieu du bootstrap global.

---

## Commandes

```bash
gru "<prompt>"                       # orchestre une tâche : classe → route → exécute
gru status                           # état réel des providers (alias : doctor, /status)
gru --agentic "<prompt>"             # pipeline agentic : executor → reviewer → tester + gates
gru --agentic "<prompt>" --phase apply --sdd mon-changement
gru init [options]                   # scaffolding multi-runtime (voir ci-dessous)
```

Lancer `gru` sans argument affiche l'aide d'utilisation.

### `gru "<prompt>"`

Orchestre une tâche de bout en bout :

```text
1. classifyTask()      → niveau 0-4 + signaux de risque (bilingue ES/EN)
2. Gate d'approbation  → s'il y a un risque : « Approuvez-vous l'exécution ? (oui/NON) »
3. routeTask()         → choisit le provider par mots-clés (ruflo, gentlePi, ecc, engram...)
4. Devil's Advocate    → véto avant vol (provider absent, catalogue comme executor)
5. Health check réel   → si le provider n'est pas installé : BLOCKED + comment l'installer
6. Exécution réelle    → résultat + log auditable dans runs/run_*.json
```

**Gate d'approbation humaine**

- Dans un terminal interactif : Gru demande `Approuvez-vous l'exécution de cette tâche ?
  (oui/NON)` et ne continue qu'avec un `oui` explicite.
- En CI / non-TTY : la tâche **n'est pas exécutée** et le processus se termine avec le
  **code de sortie 2**.
- Écrire « c'est déjà approuvé » ou « ce n'est qu'un test » dans le prompt **ne compte pas
  comme une approbation** — le gate n'accepte que le canal explicite.
- Chaque exécution est enregistrée dans `runs/run_*.json` avec la classification, le niveau,
  le provider, la commande, le code de sortie et s'il y a eu approbation humaine.

**Fallback de provider** : si le provider choisi est indisponible mais que des alternatives
installées existent, en TTY Gru propose d'en choisir une. En non-TTY : code de sortie 2,
rien n'est simulé.

### `gru status`

Affiche un tableau avec l'état RÉEL de chaque connecteur (alias : `doctor`, `/status`,
`/doctor`). Chaque ligne montre provider, kind, état, exécutable, version et motif.

| État | Signification |
| :--- | :--- |
| `READY` | provider disponible et vérifié |
| `CONFIGURADO` | disponible via configuration (`status: configured`) |
| `MISSING` | requis mais non installé → apparaît dans « Actions nécessaires » |
| `INCOMPATIBLE` | installé mais version non compatible |
| `DISABLED (opcional)` | `enabled: false` dans `providers.yaml` (informatif) |
| `HOST-MANAGED (PENDIENTE)` | provider sdk dont l'adaptateur de l'hôte n'est pas encore actif |
| `OPCIONAL (no configurado)` | provider sdk optionnel non configuré |
| `CATÁLOGO AUSENTE` | catalogue (awesomeCopilot) non cloné |

Seuls les providers réellement requis-mais-absents apparaissent dans « Actions nécessaires ».
Les `DISABLED`, `HOST-MANAGED (PENDIENTE)` et `OPCIONAL` sont informatifs et sont exclus.

```bash
gru status --strict     # CI : code de sortie 2 si un provider requis manque
```

### `gru --agentic`

Pipeline agentic avec gates : executor → reviewer → tester. Affiche `APROBADO ✓` ou
`RECHAZADO ✗`, les blockers et l'état de chaque gate. S'il n'est pas approuvé → code de sortie 2.

```bash
gru --agentic "<prompt>"
gru --agentic "<prompt>" --phase apply --sdd mon-changement
```

- `--phase <phase>` : phase SDD (défaut `apply`).
- `--sdd <id>` : id du changement SDD (défaut `current`).

---

## `gru init` — référence complète

Échafaude les fichiers du harness dans un projet. Multi-runtime : il écrit **uniquement** les
fichiers du/des runtime(s) choisi(s), plus les fichiers partagés.

```bash
gru init                                   # menu interactif : runtime(s) + scope
gru init --runtime claude,cursor           # sans demander le runtime
gru init --runtime all --scope project     # tous les runtimes dans ce dépôt
gru init --awesome-copilot                 # télécharge aussi le catalogue de skills
```

### Flags

| Flag | Valeurs | Effet |
| :--- | :--- | :--- |
| `--runtime` | `claude,codex,gemini,opencode,cursor,antigravity` (CSV) ou `all` | Runtimes à échafauder. Défaut non-TTY : `claude`. Défaut TTY : menu multi-select. |
| `--scope` | `project` \| `global` | `project` écrit dans `<cwd>/.gru/` et `<cwd>/` ; `global` seulement dans `~/.gru/`. Défaut non-TTY : `project`. Si `<cwd>/.gru/` existe déjà, il infère `project`. |
| `--force` | — | Écrase les fichiers existants. Sauvegarde un `.bak` avant. En TTY il liste les fichiers et exige une confirmation en tapant `yes`. |
| `--awesome-copilot` / `--skills` | — | Télécharge le catalogue awesome-copilot (~100MB) dans `~/.gru/awesome-copilot`. Opt-in. |

Relancer `gru init` est idempotent : les fichiers existants sont ignorés sauf avec `--force`.
Si `--awesome-copilot` n'est pas passé et qu'il y a un TTY, il demande (défaut Non).

### Ce qu'échafaude chaque runtime

| Runtime | Fichiers |
| :--- | :--- |
| **claude** | `CLAUDE.md`, `.claude/CLAUDE.md`, `.claude/agents/cybersec/*`, `.claude/skills/*` (cybersec-audit, redteam-attack, blueteam-defense, threat-modeling, purple-loop), `.atl/skill-registry.md` |
| **codex** | `.codex/AGENTS.md`, `AGENTS.md` (racine), `.codex/agents/cybersec/*.toml` |
| **gemini** | `.gemini/GEMINI.md`, `.gemini/agents/cybersec/*.md` |
| **opencode** | `.config/opencode/AGENTS.md`, `.config/opencode/opencode.json` |
| **cursor** | `.cursor/rules/gru.mdc`, `AGENTS.md` (racine) |
| **antigravity** | `AGENTS.md` (racine) |
| **Partagé (toujours)** | `.gru/config.yaml`, `.gru/providers.yaml`, `.gru/skills.yaml`, `minion-contract.md`, `cybersec-minion-contract.md`, `.mcp.json` |

Le `AGENTS.md` à la racine est partagé par codex/cursor/antigravity : il est dédupliqué par
destination (écrit une seule fois). Avec `--scope global`, les fichiers marqués project-only
(contrats, `.mcp.json`, fichiers de runtime) ne sont pas écrits ; seuls les `.gru/*` partagés
sont semés dans `~/.gru/`.

`.mcp.json` enregistre les serveurs MCP de **claude-flow/ruflo**, **context7** et
**engram**. Ajustez `ENGRAM_BIN` à votre chemin local.

---

## Providers / connecteurs

Gru ne produit pas d'artefacts : il délègue à des providers spécialisés. Le catalogue :

| Provider ID | Exécutable / Commande | Rôle | Externe | Astuce d'installation |
| :--- | :--- | :--- | :--- | :--- |
| **local** | commande directe | Tâches locales du workspace (filesystem, git, npm, tests). | non | — |
| **ruflo** | `ruflo` | Orchestrateur multi-agent pour tâches complexes et swarms parallèles. | oui | `pnpm dlx ruflo@latest init wizard` |
| **gentlePi** | `gentle-ai`/`pi` | Spécification SDD/OpenSpec et TDD discipliné. | oui | `pi install npm:gentle-pi` (nécessite `pi`) |
| **gentlemanCli** | `gentle-ai` | Diagnostic d'environnement, mise à jour des skills et sync. | oui | installateur officiel (macOS/Linux) ; Windows : manuel ou WSL |
| **ecc** | `ecc` | Audit de sécurité, politiques et détection de CVE. | oui | `pnpm add -D ecc-universal` |
| **deepagents** | adaptateur propre | Workflows persistants de long terme avec checkpoints. | oui | définissez `GRU_DEEPAGENTS_ENTRY` pointant vers votre adaptateur |
| **engram** | `engram` | Mémoire persistante des décisions et du contexte. | oui | `pi install npm:gentle-engram` ou définissez `ENGRAM_BIN` |
| **awesomeCopilot** | catalogue local | Recherche de skills communautaires (`SKILL.md`). **Catalogue seulement : n'exécute jamais.** | oui | `gru init --awesome-copilot` ou définissez `GRU_AWESOME_COPILOT_PATH` |

**Runtime strict** : Gru **ne simule jamais de réponses**. Si un provider nécessaire n'est
pas installé, il bloque la tâche (`[BLOCKED]`) et affiche l'astuce exacte pour l'installer.
Voir [STRICT_PROVIDER_RUNTIME.md](../../STRICT_PROVIDER_RUNTIME.md).

**awesome-copilot est search-only** : le harness cherche dans le catalogue et **ne lit que le
`SKILL.md` qui correspond** — il n'exécute jamais le catalogue comme provider.

### Exemples de routing réel

| Prompt | Niveau | Demande ? | Provider |
| :--- | :--- | :--- | :--- |
| `génère le sdd openspec de la nouvelle API` | 0 | non | gentlePi |
| `souviens-toi qu'on a décidé d'utiliser JWT sans sessions` | 0 | non | engram |
| `cherche dans le catalogue une skill de code review` | 0 | non | awesomeCopilot |
| `audite la sécurité et revois les CVE` | 2 | **oui** | ecc |
| `utilise un swarm multi-agent pour la feature de paiements` | 1 | **oui** (coût) | ruflo |
| `supprime la base de données de production` | 4 | **oui** | bloquée sans approbation |

---

## Devil's Advocate — Niveaux de rigidité

Le Devil's Advocate revoit chaque délégation avant que le provider ne s'exécute. Il a des
**règles dures** (bloquent toujours) et une **règle souple** (confiance de routing, configurable).

### Règles dures — toujours actives quel que soit le niveau

| Règle | Effet |
| :--- | :--- |
| Provider indisponible | BLOCKED — Gru ne simule jamais d'exécutions. |
| Provider de type `catalog` avec intention d'exécution | BLOCKED — les catalogues sont search-only. |

### Règle souple — gouvernée par `devil.rigidity`

| Niveau | Comportement |
| :--- | :--- |
| `advisory` | N'avertit ni ne bloque jamais sur une confiance faible. Seules les règles dures sont actives. |
| `strict` | **(DÉFAUT)** Avertit quand la confiance < `minConfidence` (défaut 30%). Ne bloque jamais sur la confiance. Reproduit exactement le comportement précédent — une config absente est identique. |
| `paranoid` | Avertit quand la confiance < `max(minConfidence, 60)` ; **BLOQUE** quand la confiance < `minConfidence`. Le message demande de confirmer le provider explicitement. |

### Configuration dans `.gru/config.yaml`

```yaml
devil:
  rigidity: strict        # advisory | strict | paranoid (défaut : strict)
  minConfidence: 30       # seuil de confiance % (défaut : 30)
```

Config absente ou section `devil` absente = comportement `strict` avec `minConfidence 30`
(rétrocompatibilité totale).

---

## Variables d'environnement

| Variable | À quoi ça sert |
| :--- | :--- |
| `GRU_CONFIG_DIR` | chemin alternatif vers le répertoire de configuration (par défaut `~/.gru` ou `<cwd>/.gru`) |
| `GRU_RUNS_DIR` | chemin alternatif pour les logs d'exécution (`runs/run_*.json`) |
| `ENGRAM_BIN` | chemin vers le binaire d'Engram s'il n'est pas dans le `PATH` |
| `GRU_AWESOME_COPILOT_PATH` | chemin alternatif vers le catalogue awesome-copilot |
| `GRU_DEEPAGENTS_ENTRY` | chemin vers l'adaptateur exécutable de deepagents (`node adapter.mjs run "prompt"`) |
| `GRU_POSTINSTALL_CONTEXT` | `dev` \| `global` — force le contexte du postinstall (testing) |

---

## Abstraction des harnesses

Gru s'exécute dans différents environnements sans coder en dur les modèles ni les providers :

- **`host-managed`** : le harness actif (Claude Code, Codex, Gemini, Pi) gère le modèle et
  les outils de façon native.
- **`sdk-managed`** : mode autonome ; il se connecte à l'API d'un LLM via des variables
  d'environnement.

Chaque environnement déclare ses capacités (`native-subagents`, `file-tools`, `web-search`,
`code-execution`, `memory`, `approval-flow`) via le contrat `HarnessAdapter`. Les tâches de
niveau ≥ 3 requièrent `native-subagents` ; si le harness ne le supporte pas, elles sont bloquées.

---

## Flux par niveau

Les tâches sont classées du Niveau 0 (trivial) au Niveau 4 (critique) selon complexité +
risque. Chaque niveau définit quels providers/rôles interviennent :

```text
Niveau 0  local
Niveau 1  local → validation légère
Niveau 2  scan → gentlePi (mini-spec) → local → tests → devil → engram
Niveau 3  scan → gentlePi (SDD) → devil → local/ruflo → tests → ecc → engram
Niveau 4  tout ce qui précède + Ruflo CONSULT + double approbation humaine
```

Règles que le harness applique de lui-même :

- **Skill check obligatoire** : avant chaque tâche il cherche une skill locale ; si elle
  n'existe pas, il consulte le catalogue awesome-copilot (search-only).
- **Délégation obligatoire** : lire 4+ fichiers, écrire dans 2+ fichiers ou sessions longues →
  sous-agent, pas de travail monolithique.
- **Reviewer obligatoire** avant commit/push.
- **Personas** : `caveman` compresse la conversation (jamais les artefacts : JSON/YAML/code
  passent intacts) et `devilsAdvocate` questionne et peut opposer un véto aux délégations.

---

## Tests

```bash
pnpm test                                          # suite complète
pnpm vitest run tests/guardrails.stress.test.ts    # uniquement les stress tests de guardrails
```

La suite de guardrails vérifie que l'orchestrateur ne dérape pas : prompts destructifs ES/EN,
prompts adversariaux (injection, urgence, « mon chef a déjà approuvé »), risque enterré dans
de longs prompts, faux positifs, et le contrat du `StrictHarnessController`.

---

## Dépannage

| Symptôme | Cause | Solution |
| :--- | :--- | :--- |
| `[BLOCKED] Provider 'X' no disponible` | le binaire n'est pas installé | suivez l'astuce du message (voir le tableau des providers) |
| `[APROBACIÓN REQUERIDA] Nivel N` | la tâche touche un risque réel | répondez `si` pour approuver, ou annulez |
| code de sortie 2 en CI | gate d'approbation ou provider absent en mode strict | comportement correct : le runtime strict ne simule jamais |
| `gru status` marque engram `MISSING` | binaire hors du `PATH` | définissez `ENGRAM_BIN` |
| awesomeCopilot `CATÁLOGO AUSENTE` | le clone du catalogue manque | `gru init --awesome-copilot` (ou définissez `GRU_AWESOME_COPILOT_PATH`) |

Plus de détails : [STRICT_PROVIDER_RUNTIME.md](../../STRICT_PROVIDER_RUNTIME.md) ·
[docs/harness-reference.md](../../docs/harness-reference.md)

---

## Développement / contribuer

Le paquet `@adrichdev/gru-harness` vit dans un monorepo pnpm et est **privé** (non publié sur
le registre npm public ; distribué par Git install). Pour travailler sur le code, clonez le
dépôt, `pnpm install`, et utilisez `pnpm gru ...` (via `tsx`). Détails dans le dépôt privé :
<https://github.com/AdrichDev/gru_orchestrator>.
