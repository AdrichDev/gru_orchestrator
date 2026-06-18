# Gru Harness — Guía de uso (referencia)

Referencia completa del CLI `gru` (paquete `@adrichdev/gru-harness`, repo privado —
se instala desde Git, no desde el registry público). Para la presentación del proyecto,
ver [README.md](README.md). Para el runtime estricto de providers, ver
[STRICT_PROVIDER_RUNTIME.md](STRICT_PROVIDER_RUNTIME.md).

---

## Instalación

```bash
# Repo privado → install directo desde Git (no clone manual; expone el comando `gru`).
pnpm add -g github:AdrichDev/gru_orchestrator
# o por SSH:
pnpm add -g git+ssh://git@github.com/AdrichDev/gru_orchestrator.git
```

Requiere acceso al repo privado, **git** y **Node.js 20+**. El install compila el
bundle en tu máquina (script `prepare` → tsup). No se publica en el registry npm público.

### Qué hace el `postinstall`

Tras la instalación global, el bootstrap (`scripts/postinstall.mjs`) **nunca falla la
instalación** (siempre sale con código 0) y:

1. Crea `~/.gru/` (idempotente).
2. Siembra los YAML por defecto desde `templates/.gru/` (config, providers, skills) sin
   sobrescribir lo existente.
3. Imprime un aviso: el catálogo **awesome-copilot es opt-in** — NO se descarga aquí.
   Para descargarlo, usa `gru init --awesome-copilot`.

En contexto monorepo (checkout de fuente) delega en la verificación del harness cybersec
en vez del bootstrap global.

---

## Comandos

```bash
gru "<prompt>"                       # orquesta una tarea: clasifica → enruta → ejecuta
gru status                           # estado real de providers (alias: doctor, /status)
gru --agentic "<prompt>"             # pipeline agentic: executor → reviewer → tester + gates
gru --agentic "<prompt>" --phase apply --sdd mi-cambio
gru init [opciones]                  # scaffolding multi-runtime (ver abajo)
```

Ejecutar `gru` sin argumentos imprime la ayuda de uso.

### `gru "<prompt>"`

Orquesta una tarea de punta a punta:

```text
1. classifyTask()      → nivel 0-4 + señales de riesgo (bilingüe ES/EN)
2. Gate de aprobación  → si hay riesgo: "¿Apruebas la ejecución? (si/NO)"
3. routeTask()         → elige el provider por keywords (ruflo, gentlePi, ecc, engram...)
4. Devil's Advocate    → veto pre-vuelo (provider ausente, catálogo como executor)
5. Health check real   → si el provider no está instalado: BLOCKED + cómo instalarlo
6. Ejecución real      → resultado + log auditable en runs/run_*.json
```

**Gate de aprobación humana**

- En terminal interactiva: Gru pregunta `¿Apruebas la ejecución de esta tarea? (si/NO)`
  y solo continúa con un `si`/`sí` explícito.
- En CI / no-TTY: la tarea **no se ejecuta** y el proceso termina con **exit code 2**.
- Escribir "ya está aprobado" o "es solo una prueba" dentro del prompt **no cuenta como
  aprobación** — el gate solo acepta el canal explícito.
- Cada ejecución queda registrada en `runs/run_*.json` con clasificación, nivel, provider,
  comando, exit code y si hubo aprobación humana.

**Fallback de provider**: si el provider elegido no está disponible pero hay alternativas
instaladas, en TTY Gru ofrece elegir una. En no-TTY: exit code 2, sin simular nada.

### `gru status`

Imprime una tabla con el estado REAL de cada connector (alias: `doctor`, `/status`,
`/doctor`). Cada fila muestra provider, kind, estado, ejecutable, versión y motivo.

| Estado | Significado |
| :--- | :--- |
| `READY` | provider disponible y verificado |
| `CONFIGURADO` | disponible vía configuración (`status: configured`) |
| `MISSING` | requerido pero no instalado → aparece en "Acciones necesarias" |
| `INCOMPATIBLE` | instalado pero versión no compatible |
| `DISABLED (opcional)` | `enabled: false` en `providers.yaml` (informativo) |
| `HOST-MANAGED (PENDIENTE)` | provider sdk cuyo adaptador del host aún no está activo |
| `OPCIONAL (no configurado)` | provider sdk opcional sin configurar |
| `CATÁLOGO AUSENTE` | catálogo (awesomeCopilot) no clonado |

Solo los providers genuinamente requeridos-pero-ausentes aparecen en "Acciones
necesarias". Los `DISABLED`, `HOST-MANAGED (PENDIENTE)` y `OPCIONAL` son informativos y se
excluyen.

```bash
gru status --strict     # CI: exit code 2 si falta algún provider requerido
```

### `gru --agentic`

Pipeline agentic con gates: executor → reviewer → tester. Imprime `APROBADO ✓` o
`RECHAZADO ✗`, los blockers y el estado de cada gate. Si no se aprueba → exit code 2.

```bash
gru --agentic "<prompt>"
gru --agentic "<prompt>" --phase apply --sdd mi-cambio
```

- `--phase <fase>`: fase SDD (default `apply`).
- `--sdd <id>`: id del cambio SDD (default `current`).

---

## `gru init` — referencia completa

Scaffoldea los archivos del harness en un proyecto. Multi-runtime: escribe **solo** los
archivos del/los runtime(s) elegido(s), más los archivos compartidos.

```bash
gru init                                   # menú interactivo: runtime(s) + scope
gru init --runtime claude,cursor           # sin preguntar runtime
gru init --runtime all --scope project     # todos los runtimes en este repo
gru init --awesome-copilot                 # además descarga el catálogo de skills
```

### Flags

| Flag | Valores | Efecto |
| :--- | :--- | :--- |
| `--runtime` | `claude,codex,gemini,opencode,cursor,antigravity` (CSV) o `all` | Runtimes a scaffoldear. Default no-TTY: `claude`. Default TTY: menú multi-select. |
| `--scope` | `project` \| `global` | `project` escribe en `<cwd>/.gru/` y `<cwd>/`; `global` solo en `~/.gru/`. Default no-TTY: `project`. Si ya existe `<cwd>/.gru/` infiere `project`. |
| `--force` | — | Sobrescribe archivos existentes. Guarda `.bak` antes. En TTY lista los archivos y exige confirmación escribiendo `yes`. |
| `--awesome-copilot` / `--skills` | — | Descarga el catálogo awesome-copilot (~100MB) en `~/.gru/awesome-copilot`. Opt-in. |

Re-ejecutar `gru init` es idempotente: los archivos existentes se omiten salvo con
`--force`. Si `--awesome-copilot` no se pasa y hay TTY, pregunta (default No).

### Qué scaffoldea cada runtime

| Runtime | Archivos |
| :--- | :--- |
| **claude** | `CLAUDE.md`, `.claude/CLAUDE.md`, `.claude/agents/cybersec/*`, `.claude/skills/*` (cybersec-audit, redteam-attack, blueteam-defense, threat-modeling, purple-loop), `.atl/skill-registry.md` |
| **codex** | `.codex/AGENTS.md`, `AGENTS.md` (raíz), `.codex/agents/cybersec/*.toml` |
| **gemini** | `.gemini/GEMINI.md`, `.gemini/agents/cybersec/*.md` |
| **opencode** | `.config/opencode/AGENTS.md`, `.config/opencode/opencode.json` |
| **cursor** | `.cursor/rules/gru.mdc`, `AGENTS.md` (raíz) |
| **antigravity** | `AGENTS.md` (raíz) |
| **Compartido (siempre)** | `.gru/config.yaml`, `.gru/providers.yaml`, `.gru/skills.yaml`, `minion-contract.md`, `cybersec-minion-contract.md`, `.mcp.json` |

`AGENTS.md` en la raíz lo comparten codex/cursor/antigravity: se deduplica por destino
(se escribe una sola vez). Con `--scope global`, los archivos marcados como project-only
(contratos, `.mcp.json`, archivos de runtime) no se escriben; solo se siembran los `.gru/*`
compartidos en `~/.gru/`.

`.mcp.json` registra los servidores MCP de **claude-flow/ruflo**, **context7** y
**engram**. Ajusta `ENGRAM_BIN` a tu ruta local.

---

## Providers / connectors

Gru no produce artefactos: delega en providers especializados. El catálogo:

| Provider ID | Ejecutable / Comando | Rol | Externo | Hint de instalación |
| :--- | :--- | :--- | :--- | :--- |
| **local** | comando directo | Tareas locales del workspace (filesystem, git, npm, tests). | no | — |
| **ruflo** | `ruflo` | Orquestador multi-agente para tareas complejas y swarms paralelos. | sí | `pnpm dlx ruflo@latest init wizard` |
| **gentlePi** | `gentle-ai`/`pi` | Especificación SDD/OpenSpec y TDD disciplinado. | sí | `pi install npm:gentle-pi` (requiere `pi`) |
| **gentlemanCli** | `gentle-ai` | Diagnóstico de entorno, actualización de skills y sync. | sí | instalador oficial (macOS/Linux); Windows: manual o WSL |
| **ecc** | `ecc` | Auditoría de seguridad, políticas y detección de CVEs. | sí | `pnpm add -D ecc-universal` |
| **deepagents** | adaptador propio | Workflows persistentes de largo plazo con checkpoints. | sí | define `GRU_DEEPAGENTS_ENTRY` apuntando a tu adaptador |
| **engram** | `engram` | Memoria persistente de decisiones y contexto. | sí | `pi install npm:gentle-engram` o define `ENGRAM_BIN` |
| **awesomeCopilot** | catálogo local | Búsqueda de skills (`SKILL.md`) comunitarias. **Solo catálogo: nunca ejecuta.** | sí | `gru init --awesome-copilot` o define `GRU_AWESOME_COPILOT_PATH` |

**Runtime estricto**: Gru **nunca simula respuestas**. Si un provider necesario no está
instalado, bloquea la tarea (`[BLOCKED]`) y muestra el hint exacto para instalarlo. Ver
[STRICT_PROVIDER_RUNTIME.md](STRICT_PROVIDER_RUNTIME.md).

**awesome-copilot es search-only**: el harness busca en el catálogo y **solo lee el
`SKILL.md` que hace match** — nunca ejecuta el catálogo como provider.

### Ejemplos de routing real

| Prompt | Nivel | ¿Pregunta? | Provider |
| :--- | :--- | :--- | :--- |
| `genera el sdd openspec de la nueva API` | 0 | no | gentlePi |
| `recuerda que decidimos usar JWT sin sesiones` | 0 | no | engram |
| `busca en el catalogo una skill de code review` | 0 | no | awesomeCopilot |
| `audita la seguridad y revisa CVEs` | 2 | **sí** | ecc |
| `usa swarm multiagente para la feature de pagos` | 1 | **sí** (gasto) | ruflo |
| `borra la base de datos de producción` | 4 | **sí** | bloqueada sin aprobación |

---

## Variables de entorno

| Variable | Para qué |
| :--- | :--- |
| `GRU_CONFIG_DIR` | ruta alternativa al directorio de configuración (por defecto `~/.gru` o `<cwd>/.gru`) |
| `GRU_RUNS_DIR` | ruta alternativa para los logs de ejecución (`runs/run_*.json`) |
| `ENGRAM_BIN` | ruta al binario de Engram si no está en el `PATH` |
| `GRU_AWESOME_COPILOT_PATH` | ruta alternativa al catálogo awesome-copilot |
| `GRU_DEEPAGENTS_ENTRY` | ruta al adaptador ejecutable de deepagents (`node adapter.mjs run "prompt"`) |
| `GRU_POSTINSTALL_CONTEXT` | `dev` \| `global` — fuerza el contexto del postinstall (testing) |

---

## Abstracción de harnesses

Gru se ejecuta en distintos entornos sin hardcodear modelos ni proveedores:

- **`host-managed`**: el harness activo (Claude Code, Codex, Gemini, Pi) gestiona el modelo
  y las herramientas de forma nativa.
- **`sdk-managed`**: modo standalone; se conecta a la API de un LLM vía variables de entorno.

Cada entorno declara sus capacidades (`native-subagents`, `file-tools`, `web-search`,
`code-execution`, `memory`, `approval-flow`) mediante el contrato `HarnessAdapter`. Las
tareas de nivel ≥ 3 requieren `native-subagents`; si el harness no lo soporta, se bloquean.

---

## Flujos por nivel

Las tareas se clasifican de Nivel 0 (trivial) a Nivel 4 (crítico) según complejidad +
riesgo. Cada nivel define qué providers/roles intervienen:

```text
Nivel 0  local
Nivel 1  local → validación ligera
Nivel 2  scan → gentlePi (mini-spec) → local → tests → devil → engram
Nivel 3  scan → gentlePi (SDD) → devil → local/ruflo → tests → ecc → engram
Nivel 4  todo lo anterior + Ruflo CONSULT + aprobación humana doble
```

Reglas que el harness aplica solo:

- **Skill check obligatorio**: antes de cada tarea busca una skill local; si no existe,
  consulta el catálogo awesome-copilot (search-only).
- **Delegación obligatoria**: leer 4+ archivos, escribir en 2+ archivos o sesiones largas →
  sub-agente, no trabajo monolítico.
- **Reviewer obligatorio** antes de commit/push.
- **Personas**: `caveman` comprime la conversación (nunca los artefactos: JSON/YAML/código
  pasan intactos) y `devilsAdvocate` cuestiona y puede vetar delegaciones.

---

## Tests

```bash
pnpm test                                          # suite completa
pnpm vitest run tests/guardrails.stress.test.ts    # solo stress tests de guardrails
```

La suite de guardrails verifica que el orquestador no se sale de las líneas: prompts
destructivos ES/EN, prompts adversariales (inyección, urgencia, "mi jefe ya aprobó"),
riesgo enterrado en prompts largos, falsos positivos, y el contrato del
`StrictHarnessController`.

---

## Solución de problemas

| Síntoma | Causa | Solución |
| :--- | :--- | :--- |
| `[BLOCKED] Provider 'X' no disponible` | el binario no está instalado | sigue el hint del mensaje (ver tabla de providers) |
| `[APROBACIÓN REQUERIDA] Nivel N` | la tarea toca riesgo real | responde `si` para aprobar, o cancela |
| exit code 2 en CI | gate de aprobación o provider ausente en modo estricto | comportamiento correcto: el runtime estricto nunca simula |
| `gru status` marca engram `MISSING` | binario fuera del `PATH` | define `ENGRAM_BIN` |
| awesomeCopilot `CATÁLOGO AUSENTE` | falta el clon del catálogo | `gru init --awesome-copilot` (o define `GRU_AWESOME_COPILOT_PATH`) |

Más detalle: [STRICT_PROVIDER_RUNTIME.md](STRICT_PROVIDER_RUNTIME.md) ·
[docs/harness-reference.md](docs/harness-reference.md)

---

## Desarrollo / contribuir

El paquete `@adrichdev/gru-harness` vive en un monorepo pnpm y es **privado** (no se
publica en el registry npm público; se distribuye por Git install). Para trabajar sobre
el código, clona el repo, `pnpm install`, y usa `pnpm gru ...` (vía `tsx`). Detalles en
el repositorio privado: <https://github.com/AdrichDev/gru_orchestrator>.
