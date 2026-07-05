<div align="center">

<img src="docs/assets/gru-banner.svg" alt="GRU Harness — orchestrator" width="640">

</div>

> **"Gru coordinates. Minions produce. Policies govern. Human approves."**

<div align="center">

![Node](https://img.shields.io/badge/node-%3E%3D20-3c873a) ![Runtime](https://img.shields.io/badge/runtime-strict-facc15) ![Niveles](https://img.shields.io/badge/niveles-0--4-64748b) ![Harness](https://img.shields.io/badge/blue%2Fred%2Fpurple-cybersec-8b5cf6)

</div>

---

<div align="center">

🇪🇸 [**Español**](README.md) &nbsp;|&nbsp; 🇺🇸 [**English**](docs/readme/README.en.md) &nbsp;|&nbsp; 🇨🇳 [**中文**](docs/readme/README.zh.md) &nbsp;|&nbsp; 🇫🇷 [**Français**](docs/readme/README.fr.md) &nbsp;|&nbsp; 🇩🇪 [**Deutsch**](docs/readme/README.de.md)

</div>

---

## 🧠 ¿Qué es Gru Harness?

Gru es un **harness orquestador de LLMs**: una capa de coordinación que centraliza la toma de decisiones, evalúa el riesgo de cada tarea y delega la ejecución en providers especializados (Gentle-Pi, ECC, Engram, Awesome Copilot…). Corre dentro de Claude Code, Codex, Gemini CLI, OpenCode, Cursor o Antigravity — o standalone vía el CLI `gru`.

### Principios fundamentales

* **Gru no codifica directamente**: analiza, clasifica y delega. Los Minions producen los artefactos.
* **Runtime estricto**: Gru **nunca simula respuestas**. Si un provider no está instalado, bloquea la tarea y te dice cómo instalarlo.
* **Gate de aprobación humana**: toda tarea destructiva, de producción, seguridad, rama principal o con gasto económico requiere tu aprobación explícita. El gate es bilingüe (ES/EN) y no se negocia por prompt.
* **Flujos por niveles**: las tareas se clasifican de Nivel 0 (trivial) a Nivel 4 (crítico) según una tabla de decisión de complejidad + riesgo.

---

## 🧩 Minions vs Providers

Dos conceptos distintos, **no** intercambiables:

* **Minion** — un *rol* delegado (builder, reviewer, architect, tester, security, devil, pm, docs, filesystem, context7, memory, mcp). Es la **unidad de trabajo** que Gru delega. 13 roles, cada uno con una responsabilidad única.
* **Provider** — un *backend* de ejecución (`local`, `gentlePi`, `gentlemanCli`, `ecc`, `deepagents`, `engram`, `awesomeCopilot`). Es el **runtime** que ejecuta el trabajo del Minion.

> Un Minion es un ROL. Un Provider es un BACKEND. Gru elige ambos según nivel y tipo de tarea.

---

## 📊 Niveles de tarea

Gru puntúa cada tarea (complejidad + riesgo) y la clasifica antes de actuar:

| Nivel | Nombre | Workflow (resumen) |
|:---:|---|---|
| **0** | Trivial | `local` |
| **1** | Pequeña | `local` + devil/caveman |
| **2** | Media | architect ligero → mini-spec → builder → tester → reviewer |
| **3** | Grande | architect → devil → spec → builder por unidades → tester → security → reviewer |
| **4** | Crítica | + ECC CONSULT + **aprobación humana** + reviewer independiente |

El **Filesystem Scan** es obligatorio antes de clasificar. La evidencia del repo puede subir el nivel, nunca bajarlo sin pruebas.

---

## 🚀 Quickstart

```bash
pnpm add -g github:AdrichDev/gru_orchestrator   # instala `gru` (repo privado, Node 20+)
cd tu-proyecto
gru init                    # menú interactivo: elige runtime(s) + scope
gru status                  # estado real de cada provider
gru "<prompt>"              # orquesta una tarea: clasifica → enruta → ejecuta
```

¿Prefieres no instalar nada global a mano? El atajo npx hace exactamente lo de
arriba (instala el harness y lanza `gru init`):

```bash
cd tu-proyecto
pnpm dlx create-gru                 # = pnpm add -g github:… && gru init
pnpm dlx create-gru init --runtime all --scope project
```

Hay **una sola vía de instalación** real: el CLI nativo `gru init`. `create-gru`
([`packages/create-gru`](packages/create-gru)) es solo la entrada cómoda por npm
que delega en él — no copia ni mantiene archivos propios, así que nunca se
desincroniza del harness.

El `postinstall` prepara `~/.gru/` con la config por defecto. El catálogo awesome-copilot
es **opt-in** (`gru init --awesome-copilot`), no se descarga solo.

---

## ⌨️ Comandos

```bash
gru "<prompt>"                       # orquesta: clasifica → gate → enruta → ejecuta
gru status                           # estado real de providers (alias: doctor, /status)
gru status --strict                  # CI: exit code 2 si falta un provider requerido
gru --agentic "<prompt>"             # pipeline agentic: executor → reviewer → tester + gates
gru --agentic "<prompt>" --phase apply --sdd mi-cambio
gru init [opciones]                  # scaffolding multi-runtime
```

Cada ejecución queda registrada en `runs/run_*.json` (clasificación, nivel, provider, exit
code y si hubo aprobación humana). En CI / no-TTY una tarea con riesgo **no se ejecuta**:
termina con exit code 2 — nunca simula.

---

## 🔌 Providers

Gru delega en providers especializados: `local`, `gentlePi`, `gentlemanCli`,
`ecc`, `deepagents`, `engram` y `awesomeCopilot` (catálogo search-only). Bajo runtime
estricto, un provider ausente bloquea la tarea con el hint de instalación — sin fallback
silencioso.

---

## 🛡️ Harness de ciberseguridad (Blue / Red / Purple)

Ante cualquier pedido de auditar, explotar, endurecer o modelar amenazas, Gru delega en
minions de ciberseguridad. El trabajo ofensivo **siempre** está acotado por
`cybersec-minion-contract.md` (solo alcance autorizado, lab/sandbox, sin objetivos reales).

| Equipo | Minions |
|---|---|
| 🔴 **RED** | redteam-coordinator · recon · exploit |
| 🔵 **BLUE** | blueteam-coordinator · hardening · detect · incident |
| 🟣 **PURPLE** | purpleteam-coordinator (conduce el loop + persiste aprendizajes) |

**Loop cíclico:** `RECON → EXPLOIT → ASSESS → HARDEN → DETECT → REAUDIT → LEARN → repetir`.
Una brecha del Red es un hallazgo OPEN; Blue lo corrige **y** añade detección para cerrarlo.
Nunca se declara `HARDENED` mientras haya un hallazgo OPEN.
→ [docs/cybersec/ATTACK-DEFENSE-PLAYBOOK.md](docs/cybersec/ATTACK-DEFENSE-PLAYBOOK.md)

---

## 😈 Devil's Advocate

Persona de veto que cuestiona cada decisión. Rigidez configurable en `.gru/config.yaml`
(`devil.rigidity`):

| Nivel | Comportamiento |
|---|---|
| `advisory` | avisa, no bloquea |
| `strict` *(default)* | bloquea tareas de riesgo sin justificación |
| `paranoid` | exige aprobación explícita incluso en tareas medias |

Las **reglas duras** (destructivo, producción, seguridad, gasto) están siempre activas,
independientemente del nivel de rigidez. → detalle en [USAGE.md](USAGE.md#devils-advocate--niveles-de-rigidez).

---

## 📖 Documentación

* **[USAGE.md](USAGE.md)** — referencia completa: comandos, `gru init`, providers, variables de entorno y troubleshooting.
* **[STRICT_PROVIDER_RUNTIME.md](STRICT_PROVIDER_RUNTIME.md)** — el runtime estricto de providers.
* **[SDD.md](SDD.md)** — Spec-Driven Development: fases, persistencia y formato Engram.
* **[docs/harness-reference.md](docs/harness-reference.md)** — catálogo de providers, personas, workflows y project intake.
* **[docs/cybersec/ATTACK-DEFENSE-PLAYBOOK.md](docs/cybersec/ATTACK-DEFENSE-PLAYBOOK.md)** — playbook red/blue/purple.

Desarrollo / contribuir: clona el repo, `pnpm install` y usa `pnpm gru ...` —
<https://github.com/AdrichDev/gru_orchestrator>.
