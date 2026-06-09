# 💻 GRU ORCHESTRATOR

```text
 ██████╗ ██████╗ ██╗   ██╗     ██████╗ ██████╗  ██████╗██╗  ██╗███████╗███████╗████████╗██████╗  █████╗ ████████╗ ██████╗ ██████╗ 
██╔════╝ ██╔══██╗██║   ██║    ██╔═══██╗██╔══██╗██╔════╝██║  ██║██╔════╝██╔════╝╚══██╔══╝██╔══██╗██╔══██╗╚══██╔══╝██╔═══██╗██╔══██╗
██║  ███╗██████╔╝██║   ██║    ██║   ██║██████╔╝██║     ███████║█████╗  ███████╗   ██║   ██████╔╝███████║   ██║   ██║   ██║██████╔╝
██║   ██║██╔══██╗██║   ██║    ██║   ██║██╔══██╗██║     ██╔══██║██╔══╝  ╚════██║   ██║   ██╔══██╗██╔══██║   ██║   ██║   ██║██╔══██╗
╚██████╔╝██║  ██║╚██████╔╝    ╚██████╔╝██║  ██║╚██████╗██║  ██║███████╗███████║   ██║   ██║  ██║██║  ██║   ██║   ╚██████╔╝██║  ██║
 ╚═════╝ ╚═╝  ╚═╝ ╚═════╝      ╚═════╝ ╚═╝  ╚═╝ ╚═════╝╚═╝  ╚═╝╚══════╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝
```

> **"Gru coordinates. Minions produce. Policies govern. Human approves."**

---

### 🌐 Idiomas / Languages / 语言 / Langues / Sprachen

* 🇪🇸 **[Español](../../README.md)**
* 🇺🇸 **[English](README.en.md)**
* 🇨🇳 **[中文](README.zh.md)**
* 🇫🇷 **[Français](README.fr.md)**
* 🇩🇪 **[Deutsch](README.de.md)**

---

## 🚀 Installation & Configuration

Suivez ces étapes pour cloner et installer l'environnement de développement de **Gru Orchestrator** :

### 1. Cloner le dépôt
```bash
git clone https://github.com/AdrichDev/gru_orchestrator.git
cd gru_orchestrator
```

### 2. Installer les dépendances du projet
Ce projet est un monorepo géré avec **pnpm** :
```bash
pnpm install
```

### 3. Installer les Providers globaux requis
Si vous ne disposez pas des binaires externes requis pour l'orchestration, installez-les en exécutant :

* **ruflo** (Construction et orchestration multi-agents) :
  ```bash
  npm install -g ruflo
  ```
* **gentlePi / gentlemanCli** (Spécification, SDD, et environnement) :
  ```bash
  npm install -g @gentle-ai/pi
  ```
* **engram** (Mémoire sémantique et persistante) :
  Installez le binaire depuis son canal officiel et assurez-vous qu'il est disponible dans votre variable d'environnement `PATH` ou configuré dans `ENGRAM_BIN`.

---

## 🧠 Qu'est-ce que Gru Orchestrator ?

Gru est un orchestrateur et un architecte conçu pour centraliser la prise de décision, évaluer les risques et coordonner les sous-agents (minions) pour le développement de logiciels.

### Principes Fondamentaux
* **Gru ne code pas directement** : Gru analyse la structure, conçoit des plans dans `implementation_plan.md` et délégue l'écriture du produit à des minions spécialisés.
* **Scan du système de fichiers** : Avant de prendre toute décision de conception ou de classifier une tâche, une analyse du dépôt est exécutée pour cartographier les dépendances et les risques.
* **Flux basés sur les niveaux** : Les tâches sont classées du niveau 0 (trivial) au niveau 4 (critique), en appliquant des processus d'approbation spécifiques basés sur leur niveau de risque.

---

## 🎛️ Abstraction du Runtime de Harness (Harness Runtime Abstraction)

Gru utilise une couche d'abstraction pour s'exécuter dans différents environnements d'exécution (*harnesses*) sans intégrer de modèles LLM ni de fournisseurs spécifiques dans son noyau.

### Modes d'Exécution
* **`host-managed`** : Le harness actif (Claude Code, Codex, Gemini, Pi) gère directement le modèle natif et l'exécution des outils. Aucune connexion de SDK secondaire n'est ouverte pour le LLM.
* **`sdk-managed`** : Mode d'exécution autonome (`standalone`). Se connecte directement à l'API d'un fournisseur de LLM en utilisant les variables d'environnement configurées (`GRU_DEEPAGENTS_PROVIDER`, `GRU_DEEPAGENTS_API_KEY_ENV`, etc.).

### Flux d'Exécution
```text
pnpm gru "prompt"
        ↓
HarnessDetector.detect()            ← Identifie l'environnement d'exécution actif
        ↓
AdapterRegistry.get(harnessId)      ← Résout le HarnessAdapter correspondant
        ↓
adapter.supports(requiredCapability)?
   ├── Oui → adapter.execute(task)     ← Exécution native optimisée pour l'environnement
   └── Non → fallbackSequentially()    ← Exécution séquentielle alternative de Gru Core
        ↓
GruResult → Console du système
```

### Matrice des Capacités (`GruCapability`)
Chaque environnement d'exécution déclare les capacités qu'il prend en charge dynamiquement via le contrat `HarnessAdapter` :
* **`native-subagents`** : Capacité de l'environnement à lancer des sous-agents de manière native sans consommer la capacité de jetons du processus principal (ex. Claude Code).
* **`file-tools`** : Outils intégrés pour la lecture et l'écriture de fichiers.
* **`web-search`** : Recherche sur Internet ou navigation fournie par le système hôte.
* **`code-execution`** : Bac à sable d'exécution de code ou environnement d'exécution sécurisé.
* **`memory`** : Persistance du contexte et de la mémoire à long terme.
* **`approval-flow`** : Flux interactifs pour demander et accorder des autorisations.

### Synchronisation Canonique (`pnpm gru sync`)
Gru maintient les définitions de règles, workflows et compétences de manière centralisée dans sa structure native. Lors de l'exécution de la commande de synchronisation :
1. Il lit les dossiers `gru/skills/`, `gru/workflows/` et `gru/policies/`.
2. Il les compile et les distribue de manière idempotente dans les répertoires spécifiques de chaque harness : `.claude/`, `.codex/`, `.gemini/` et `.pi/`.
3. Le système affiche un diff des modifications proposées avant d'écraser, protégeant les modifications manuelles à moins d'utiliser le flag `--force`.

---

## 🔌 Catalogue des Providers

Gru utilise une architecture modulaire basée sur des **Providers** pour interagir avec l'environnement et exécuter les tâches déléguées :

| Provider ID | Exécutable / Commande | Rôle et Responsabilité |
| :--- | :--- | :--- |
| **`local`** | Commande directe | Exécution de tâches locales dans l'espace de travail (système de fichiers, git, npm, tests). |
| **`ruflo`** | `ruflo` | Orchestrateur multi-agents pour les tâches complexes et les swarms parallèles de minions. |
| **`gentlePi`** | `gentle-ai/pi` | Support et outils pour la spécification du système sous la méthodologie SDD/OpenSpec. |
| **`gentlemanCli`** | `gentle-ai` | Diagnostics d'environnement, mises à jour des compétences et synchronisation d'état. |
| **`ecc`** | `ecc` | Audit des politiques de sécurité, analyse du code et détection des vulnérabilités CVE. |
| **`deepagents`** | `deepagents` | Workflows à long terme et threads de tâches persistants. |
| **`engram`** | `engram` | Accès à la mémoire persistante des décisions et au contexte historique du projet. |
| **`awesomeCopilot`** | Catalogue local | Recherche de compétences (`SKILL.md`) et de templates dans le dépôt de la communauté. |
