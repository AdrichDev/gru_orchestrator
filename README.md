<div align="center">

```text
 ██████╗ ██████╗ ██╗   ██╗
██╔════╝ ██╔══██╗██║   ██║
██║  ███╗██████╔╝██║   ██║
██║   ██║██╔══██╗██║   ██║
╚██████╔╝██║  ██║╚██████╔╝   H A R N E S S
 ╚═════╝ ╚═╝  ╚═╝ ╚═════╝

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

Gru es un **harness orquestador de LLMs**: una capa de coordinación que centraliza la toma de decisiones, evalúa el riesgo de cada tarea y delega la ejecución en providers especializados (Ruflo, Gentle-Pi, ECC, Engram, Awesome Copilot…). Corre dentro de Claude Code, Codex, Gemini CLI, OpenCode, Cursor o Antigravity — o standalone vía el CLI `gru`.

### Principios fundamentales

* **Gru no codifica directamente**: analiza, clasifica y delega. Los providers producen los artefactos.
* **Runtime estricto**: Gru **nunca simula respuestas**. Si un provider no está instalado, bloquea la tarea y te dice cómo instalarlo.
* **Gate de aprobación humana**: toda tarea destructiva, de producción, seguridad, rama principal o con gasto económico requiere tu aprobación explícita. El gate es bilingüe (ES/EN) y no se negocia por prompt.
* **Flujos por niveles**: las tareas se clasifican de Nivel 0 (trivial) a Nivel 4 (crítico) según una tabla de decisión de complejidad + riesgo.

---

## 🚀 Quickstart

```bash
pnpm add -g github:AdrichDev/gru_orchestrator   # instala `gru` (repo privado, Node 20+)
cd tu-proyecto
gru init                    # menú interactivo: elige runtime(s) + scope
gru status                  # estado real de cada provider
gru "<prompt>"              # orquesta una tarea: clasifica → enruta → ejecuta
```

El `postinstall` prepara `~/.gru/` con la config por defecto. El catálogo awesome-copilot
es **opt-in** (`gru init --awesome-copilot`), no se descarga solo.

---

## 🔌 Providers

Gru delega en providers especializados: `local`, `ruflo`, `gentlePi`, `gentlemanCli`,
`ecc`, `deepagents`, `engram` y `awesomeCopilot` (catálogo search-only). Bajo runtime
estricto, un provider ausente bloquea la tarea con el hint de instalación.

---

## 📖 Documentación

* **[USAGE.md](USAGE.md)** — referencia completa: comandos, `gru init`, providers, variables de entorno y troubleshooting.
* **[STRICT_PROVIDER_RUNTIME.md](STRICT_PROVIDER_RUNTIME.md)** — el runtime estricto de providers.
* **[docs/harness-reference.md](docs/harness-reference.md)** — catálogo de providers, personas, workflows y project intake.

Desarrollo / contribuir: clona el repo, `pnpm install` y usa `pnpm gru ...` —
<https://github.com/AdrichDev/gru_orchestrator>.
