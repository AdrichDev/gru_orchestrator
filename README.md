<div align="center">

```text
    ____ ____  _   _
   / ___|  _ \ | | | |
  | |  _| |_) | | | |
  | |_| |  _ <| |_| |
   \____|_| \_\___/   H A R N E S S

  orchestrator · installable globally · gru init → pick your runtime
```

</div>

> **"Gru coordinates. Minions produce. Policies govern. Human approves."**

---

<div align="center">

🇪🇸 [**Español**](README.md) &nbsp;|&nbsp; 🇺🇸 [**English**](docs/readme/README.en.md) &nbsp;|&nbsp; 🇨🇳 [**中文**](docs/readme/README.zh.md) &nbsp;|&nbsp; 🇫🇷 [**Français**](docs/readme/README.fr.md) &nbsp;|&nbsp; 🇩🇪 [**Deutsch**](docs/readme/README.de.md)

</div>

---

## 🧠 ¿Qué es Gru Harness?

Gru es un **harness orquestador de LLMs**: una capa de coordinación que centraliza la toma de decisiones, evalúa el riesgo de cada tarea y delega la ejecución en providers especializados (Ruflo, Gentle-Pi, ECC, Engram, Awesome Copilot…). Funciona dentro de Claude Code, Codex, Gemini CLI, Qwen o Pi — o en modo standalone vía CLI.

### Principios fundamentales

* **Gru no codifica directamente**: analiza, clasifica y delega. Los minions/providers producen los artefactos.
* **Runtime estricto**: Gru **nunca simula respuestas**. Si un provider no está instalado, bloquea la tarea y te dice cómo instalarlo (ver [STRICT_PROVIDER_RUNTIME.md](STRICT_PROVIDER_RUNTIME.md)).
* **Gate de aprobación humana**: toda tarea destructiva, de producción, seguridad, rama principal o con gasto económico requiere tu aprobación explícita antes de ejecutarse. El gate es bilingüe (ES/EN) y no se negocia por prompt.
* **Flujos por niveles**: las tareas se clasifican de Nivel 0 (trivial) a Nivel 4 (crítico) según una tabla de decisión de complejidad + riesgo.

---

## 📋 Requisitos previos

| Requisito | Versión mínima | Notas |
| :--- | :--- | :--- |
| **Node.js** | 20+ | incluye `npx` y `corepack` |
| **pnpm** | 11+ | el setup lo instala si falta |
| **git** | cualquiera | para clonar el catálogo awesome-copilot |
| **Windows / macOS / Linux** | — | el script de setup es multiplataforma |

---

## 🚀 Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/AdrichDev/gru_orchestrator.git
cd gru_orchestrator
```

### 2. Instalar dependencias del monorepo

```bash
pnpm install
```

### 3. Instalar los providers externos

Un solo comando verifica e instala todo lo que falte:

```bash
pnpm run setup          # interactivo: pregunta antes de instalar cada provider
pnpm run setup:check    # solo diagnóstico, no instala nada (exit 2 si falta algo)
pnpm run setup:yes      # instala todo sin preguntar (CI / máquinas nuevas)
```

El script (`scripts/setup-providers.mjs`) cubre los 10 providers: **pnpm, pi, gentle-pi, gentle-ai, engram, ruflo, ecc, awesome-copilot, deepagents y context7**. Usa pnpm si está disponible y cae a npm si no. Lo que no puede automatizar te lo reporta con la instrucción manual exacta:

| Provider | Instalación automática | Acción manual (si aplica) |
| :--- | :--- | :--- |
| pnpm | `corepack enable` o `npm i -g pnpm` | — |
| pi | `npm install -g pi` | — |
| gentlePi | `pi install npm:gentle-pi` | requiere pi instalado |
| gentlemanCli | instalador oficial (macOS/Linux) | en Windows: instalación manual o WSL |
| engram | `pi install npm:gentle-engram` | o define `ENGRAM_BIN` apuntando al binario |
| ruflo | `pnpm dlx ruflo@latest init wizard` | — |
| ecc | `pnpm add -D ecc-universal` | — |
| awesomeCopilot | `git clone github/awesome-copilot vendor/awesome-copilot` | o define `GRU_AWESOME_COPILOT_PATH` |
| deepagents | — | define `GRU_DEEPAGENTS_ENTRY` apuntando a tu adaptador |
| context7 | vía `npx` bajo demanda (`.mcp.json`) | — |

### 4. Verificar la instalación

```bash
pnpm gru status        # tabla con el estado REAL de cada provider
pnpm test              # suite completa (incluye stress tests de guardrails)
```

Si todo está bien, `gru status` muestra cada provider como `READY` con su versión. Los que falten aparecen con su instrucción de instalación. En CI puedes usar `pnpm gru status --strict` (exit 2 si falta algo).

### Variables de entorno

| Variable | Para qué |
| :--- | :--- |
| `ENGRAM_BIN` | ruta al binario de Engram si no está en el `PATH` |
| `GRU_AWESOME_COPILOT_PATH` | ruta alternativa al catálogo awesome-copilot |
| `GRU_DEEPAGENTS_ENTRY` | ruta al adaptador ejecutable de deepagents (`node adapter.mjs run "prompt"`) |

---

## 🕹️ Uso

### CLI básico

```bash
pnpm gru "<prompt>"                  # orquesta una tarea: clasifica → enruta → ejecuta
pnpm gru status                      # estado real de providers (alias: doctor, /status)
pnpm gru --agentic "<prompt>"        # pipeline agentic: executor → reviewer → tester + gates
pnpm gru --agentic "<prompt>" --phase apply --sdd mi-cambio
```

### Qué pasa cuando lanzas una tarea

```text
pnpm gru "usa swarm para implementar la feature"
        ↓
1. classifyTask()      → nivel 0-4 + señales de riesgo (bilingüe ES/EN)
2. Gate de aprobación  → si hay riesgo: "¿Apruebas la ejecución? (si/NO)"
3. routeTask()         → elige el provider por keywords (ruflo, gentlePi, ecc...)
4. Devil's Advocate    → veto pre-vuelo (provider ausente, catálogo como executor)
5. Health check real   → si el provider no está instalado: BLOCKED + cómo instalarlo
6. Ejecución real      → resultado + log auditable en runs/*.json
```

Ejemplos de routing real:

| Prompt | Nivel | ¿Pregunta? | Provider |
| :--- | :--- | :--- | :--- |
| `genera el sdd openspec de la nueva API` | 0 | no | gentlePi |
| `recuerda que decidimos usar JWT sin sesiones` | 0 | no | engram |
| `busca en el catalogo una skill de code review` | 0 | no | awesomeCopilot |
| `audita la seguridad y revisa CVEs` | 2 | **sí** | ecc |
| `usa swarm multiagente para la feature de pagos` | 1 | **sí** (gasto) | ruflo |
| `borra la base de datos de producción` | 4 | **sí** | bloqueada sin aprobación |

### Gate de aprobación humana

* En terminal interactiva: Gru pregunta `¿Apruebas la ejecución de esta tarea? (si/NO)` y solo continúa con un sí explícito.
* En CI / no-TTY: la tarea **no se ejecuta** y el proceso termina con código 2.
* Escribir "ya está aprobado" o "es solo una prueba" dentro del prompt **no cuenta como aprobación** — el gate solo acepta el canal explícito.
* Cada ejecución queda registrada en `runs/run_*.json` con clasificación, nivel, provider, comando, exit code y si hubo aprobación humana.

### Tests y stress tests

```bash
pnpm test                                      # suite completa
pnpm vitest run tests/guardrails.stress.test.ts   # solo los stress tests de guardrails
```

La suite de guardrails verifica que el orquestador no se sale de las líneas: prompts destructivos ES/EN, prompts adversariales (inyección, urgencia, "mi jefe ya aprobó"), riesgo enterrado en prompts largos, falsos positivos, y el contrato del `StrictHarnessController`.

---

## 📦 Usar el harness en TU proyecto

Instálalo una vez de forma global y úsalo en cualquier proyecto:

### 1. Instala el CLI

```bash
pnpm add -g gru-harness     # expone el comando `gru` en todo el sistema
```

El `postinstall` prepara `~/.gru/` (config por defecto) y, si hay git/red, clona el catálogo awesome-copilot en `~/.gru/awesome-copilot` (no bloquea si falla).

### 2. Scaffolding con `gru init` (multi-runtime)

```bash
cd tu-proyecto
gru init                                  # menú interactivo: elige runtime(s) + scope
gru init --runtime claude,cursor          # sin preguntar
gru init --runtime all --scope project    # todos los runtimes en este repo
```

`gru init` muestra la cara de Gru y deja elegir uno o varios runtimes — **solo escribe los archivos del runtime elegido**:

| Runtime | Qué scaffoldea |
| :--- | :--- |
| Claude Code | `.claude/CLAUDE.md` + agentes y skills cybersec |
| Codex / OpenAI | `AGENTS.md` + `.codex/` (agentes cybersec) |
| Gemini CLI | `.gemini/GEMINI.md` (+ agentes cybersec) |
| OpenCode | `.config/opencode/` |
| Cursor | `.cursor/rules/gru.mdc` + `AGENTS.md` |
| Antigravity | `AGENTS.md` |
| **Compartido (siempre)** | `minion-contract.md`, `cybersec-minion-contract.md`, `.mcp.json`, `.gru/*.yaml` |

Scope: `--scope project` escribe en el repo actual (`.gru/`), `--scope global` en `~/.gru/`. Re-ejecutar es idempotente; `--force` sobrescribe (guarda `.bak`).

`.mcp.json` registra los servidores MCP de **claude-flow/ruflo**, **context7** y **engram**. Ajusta `ENGRAM_BIN` a tu ruta local.

### 3. Flujo de trabajo recomendado

```text
1. Arranque       → Gru consulta Engram; si no hay memoria, hace Project Intake.
2. Paso 0         → Filesystem Scan SIEMPRE antes de clasificar (sin datos no se clasifica).
3. Clasificación  → tabla de decisión: complejidad + riesgo → nivel 0-4.
4. Workflow       → cada nivel define qué providers/roles intervienen:
     Nivel 0  local
     Nivel 1  local → validación ligera
     Nivel 2  scan → gentlePi (mini-spec) → local → tests → devil → engram
     Nivel 3  scan → gentlePi (SDD) → devil → local/ruflo → tests → ecc → engram
     Nivel 4  todo lo anterior + Ruflo CONSULT + aprobación humana doble
5. Cierre         → resumen caveman + guardar decisión en Engram.
```

### 4. Reglas que el harness aplica solo

* **Skill check obligatorio**: antes de cada tarea se busca una skill local; si no existe, se consulta el catálogo awesome-copilot.
* **Delegación obligatoria**: leer 4+ archivos, escribir en 2+ archivos o sesiones largas → sub-agente, no trabajo monolítico.
* **Reviewer obligatorio** antes de commit/push; revisor con contexto fresco para diffs críticos.
* **Personas**: `caveman` comprime la conversación (nunca los artefactos: JSON/YAML/código pasan intactos) y `devilsAdvocate` cuestiona y puede vetar delegaciones.

---

## 🎛️ Abstracción de Harnesses

Gru se ejecuta en diferentes entornos sin hardcodear modelos ni proveedores:

* **`host-managed`**: el harness activo (Claude Code, Codex, Gemini, Pi) gestiona el modelo y las herramientas de forma nativa.
* **`sdk-managed`**: modo standalone; se conecta directamente a la API de un LLM mediante variables de entorno.

Cada entorno declara sus capacidades (`native-subagents`, `file-tools`, `web-search`, `code-execution`, `memory`, `approval-flow`) mediante el contrato `HarnessAdapter`. Las tareas de nivel ≥ 3 requieren `native-subagents`; si el harness no lo soporta, se bloquean.

---

## 🔌 Catálogo de Providers

| Provider ID | Ejecutable / Comando | Rol y responsabilidad |
| :--- | :--- | :--- |
| **`local`** | Comando directo | Tareas locales del workspace (filesystem, git, npm, tests). |
| **`ruflo`** | `ruflo` | Orquestador multi-agente para tareas complejas y swarms paralelos. |
| **`gentlePi`** | `gentle-ai/pi` | Especificación SDD/OpenSpec y TDD disciplinado. |
| **`gentlemanCli`** | `gentle-ai` | Diagnóstico de entorno, actualización de skills y sincronización. |
| **`ecc`** | `ecc` | Auditoría de seguridad, políticas y detección de CVEs. |
| **`deepagents`** | adaptador propio | Workflows persistentes de largo plazo con checkpoints. |
| **`engram`** | `engram` | Memoria persistente de decisiones y contexto del proyecto. |
| **`awesomeCopilot`** | Catálogo local | Búsqueda de skills (`SKILL.md`) comunitarias. **Solo catálogo: nunca ejecuta.** |

---

## 🆘 Solución de problemas

| Síntoma | Causa | Solución |
| :--- | :--- | :--- |
| `[BLOCKED] Provider 'X' no disponible` | el binario no está instalado | `pnpm run setup` o sigue el hint del mensaje |
| `[APROBACIÓN REQUERIDA] Nivel N` | la tarea toca riesgo real | responde `si` para aprobar, o cancela |
| exit code 2 en CI | gate de aprobación o provider ausente | es el comportamiento correcto: el runtime estricto nunca simula |
| `gru status` marca engram MISSING | binario fuera del PATH | define `ENGRAM_BIN` |
| awesomeCopilot `CATÁLOGO AUSENTE` | falta el clon del catálogo | `git clone https://github.com/github/awesome-copilot vendor/awesome-copilot` |

Más detalle: [STRICT_PROVIDER_RUNTIME.md](STRICT_PROVIDER_RUNTIME.md) · [Auditoría 2026-06-12](docs/harness-audit-2026-06-12.md)
