<div align="center">

<img src="../assets/gru-banner.svg" alt="GRU Harness — orchestrator" width="640">

</div>

> **"Gru coordinates. Minions produce. Policies govern. Human approves."**

<div align="center">

![Node](https://img.shields.io/badge/node-%3E%3D20-3c873a) ![Runtime](https://img.shields.io/badge/runtime-strict-facc15) ![Niveaux](https://img.shields.io/badge/niveaux-0--4-64748b) ![Harness](https://img.shields.io/badge/blue%2Fred%2Fpurple-cybersec-8b5cf6)

</div>

---

<div align="center">

🇪🇸 [**Español**](../../README.md) &nbsp;|&nbsp; 🇺🇸 [**English**](README.en.md) &nbsp;|&nbsp; 🇨🇳 [**中文**](README.zh.md) &nbsp;|&nbsp; 🇫🇷 [**Français**](README.fr.md) &nbsp;|&nbsp; 🇩🇪 [**Deutsch**](README.de.md)

</div>

---

## 🧠 Qu'est-ce que Gru Harness ?

Gru est un **harness orchestrateur de LLM** : une couche de coordination qui centralise la prise de décision, évalue le risque de chaque tâche et délègue l'exécution à des providers spécialisés (Ruflo, Gentle-Pi, ECC, Engram, Awesome Copilot…). Il s'exécute dans Claude Code, Codex, Gemini CLI, OpenCode, Cursor ou Antigravity — ou en autonome via la CLI `gru`.

### Principes fondamentaux

* **Gru ne code pas directement** : il analyse, classe et délègue. Les Minions produisent les artefacts.
* **Runtime strict** : Gru **ne simule jamais de réponses**. Si un provider n'est pas installé, il bloque la tâche et indique comment l'installer.
* **Porte d'approbation humaine** : toute tâche destructive, de production, de sécurité, sur la branche principale ou engendrant un coût requiert votre approbation explicite. La porte est bilingue (ES/EN) et ne se négocie pas par prompt.
* **Workflows par niveaux** : les tâches sont classées du Niveau 0 (trivial) au Niveau 4 (critique) via une table de décision complexité + risque.

---

## 🧩 Minions vs Providers

Deux concepts distincts, **non** interchangeables :

* **Minion** — un *rôle* délégué (builder, reviewer, architect, tester, security, devil, pm, docs, filesystem, context7, memory, mcp). C'est l'**unité de travail** que Gru délègue. 13 rôles, chacun avec une responsabilité unique.
* **Provider** — un *backend* d'exécution (`local`, `ruflo`, `gentlePi`, `gentlemanCli`, `ecc`, `deepagents`, `engram`, `awesomeCopilot`). C'est le **runtime** qui exécute le travail du Minion.

> Un Minion est un RÔLE. Un Provider est un BACKEND. Gru choisit les deux selon le niveau et le type de tâche.

---

## 📊 Niveaux de tâche

Gru note chaque tâche (complexité + risque) et la classe avant d'agir :

| Niveau | Nom | Workflow (résumé) |
|:---:|---|---|
| **0** | Trivial | `local` |
| **1** | Petite | `local` + devil/caveman |
| **2** | Moyenne | architect léger → mini-spec → builder → tester → reviewer |
| **3** | Grande | architect → devil → spec → builder par unité → tester → security → reviewer |
| **4** | Critique | + Ruflo CONSULT + **approbation humaine** + reviewer indépendant |

Le **Filesystem Scan** est obligatoire avant toute classification. Les preuves du dépôt peuvent élever le niveau, jamais le baisser sans preuve.

---

## 🚀 Démarrage rapide

```bash
pnpm add -g github:AdrichDev/gru_orchestrator   # installe `gru` (dépôt privé, Node 20+)
cd votre-projet
gru init                    # menu interactif : choisir runtime(s) + scope
gru status                  # état réel de chaque provider
gru "<prompt>"              # orchestrer une tâche : classer → router → exécuter
```

Le `postinstall` prépare `~/.gru/` avec la config par défaut. Le catalogue awesome-copilot
est **opt-in** (`gru init --awesome-copilot`) ; il n'est pas téléchargé automatiquement.

---

## ⌨️ Commandes

```bash
gru "<prompt>"                       # orchestrer : classer → porte → router → exécuter
gru status                           # état réel des providers (alias : doctor, /status)
gru status --strict                  # CI : code de sortie 2 si un provider requis manque
gru --agentic "<prompt>"             # pipeline agentic : executor → reviewer → tester + portes
gru --agentic "<prompt>" --phase apply --sdd mon-changement
gru init [options]                   # scaffolding multi-runtime
```

Chaque exécution est journalisée dans `runs/run_*.json` (classification, niveau, provider,
code de sortie et présence d'une approbation humaine). En CI / non-TTY, une tâche à risque
**n'est pas exécutée** : elle se termine avec le code 2 — elle ne simule jamais.

---

## 🔌 Providers

Gru délègue à des providers spécialisés : `local`, `ruflo`, `gentlePi`, `gentlemanCli`,
`ecc`, `deepagents`, `engram` et `awesomeCopilot` (catalogue en recherche seule). Sous le
runtime strict, un provider absent bloque la tâche avec son indication d'installation —
sans repli silencieux.

---

## 🛡️ Harness de cybersécurité (Blue / Red / Purple)

Pour toute demande d'audit, d'exploitation, de durcissement ou de modélisation de menaces,
Gru délègue aux minions de cybersécurité. Le travail offensif est **toujours** borné par
`cybersec-minion-contract.md` (périmètre autorisé uniquement, lab/sandbox, sans cibles réelles).

| Équipe | Minions |
|---|---|
| 🔴 **RED** | redteam-coordinator · recon · exploit |
| 🔵 **BLUE** | blueteam-coordinator · hardening · detect · incident |
| 🟣 **PURPLE** | purpleteam-coordinator (pilote la boucle + persiste les apprentissages) |

**Boucle cyclique :** `RECON → EXPLOIT → ASSESS → HARDEN → DETECT → REAUDIT → LEARN → répéter`.
Une brèche du Red est un constat OPEN ; le Blue doit le corriger **et** ajouter une détection pour le clôturer.
`HARDENED` n'est jamais déclaré tant qu'un constat OPEN subsiste.
→ [docs/cybersec/ATTACK-DEFENSE-PLAYBOOK.md](../cybersec/ATTACK-DEFENSE-PLAYBOOK.md)

---

## 😈 Devil's Advocate

Une persona de veto qui conteste chaque décision. La rigidité est configurable dans
`.gru/config.yaml` (`devil.rigidity`) :

| Niveau | Comportement |
|---|---|
| `advisory` | avertit, ne bloque pas |
| `strict` *(par défaut)* | bloque les tâches à risque sans justification |
| `paranoid` | exige une approbation explicite même pour les tâches moyennes |

Les **règles dures** (destructif, production, sécurité, coût) sont toujours actives, quel
que soit le niveau de rigidité. → détails dans [USAGE.fr.md](../usage/USAGE.fr.md#devils-advocate--niveaux-de-rigidité).

---

## 📖 Documentation

* **[USAGE.fr.md](../usage/USAGE.fr.md)** — référence complète : commandes, `gru init`, providers, variables d'environnement et dépannage.
* **[STRICT_PROVIDER_RUNTIME.md](../../STRICT_PROVIDER_RUNTIME.md)** — le runtime strict des providers.
* **[SDD.md](../../SDD.md)** — Spec-Driven Development : phases, persistance et format Engram.
* **[docs/harness-reference.md](../harness-reference.md)** — catalogue de providers, personas, workflows et project intake.
* **[docs/cybersec/ATTACK-DEFENSE-PLAYBOOK.md](../cybersec/ATTACK-DEFENSE-PLAYBOOK.md)** — playbook red/blue/purple.

Développement / contribuer : clonez le dépôt, `pnpm install` et utilisez `pnpm gru ...` —
<https://github.com/AdrichDev/gru_orchestrator>.
