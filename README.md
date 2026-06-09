<div align="center">

```text
 █▀▀ █▀▀█ █  █    █▀▀█ █▀▀█ █▀▀ █  █ █▀▀ █▀▀ ▀▀█▀▀ █▀▀█ █▀▀█ ▀▀█▀▀ █▀▀█ █▀▀█ 
 █ █ █▄▄▀ █  █    █  █ █▄▄▀ █   █▀▀█ █▀▀ ▀▀█   █   █▄▄▀ █▄▄█   █   █  █ █▄▄▀ 
 ▀▀▀ ▀ ▀▀  ▀▀     ▀▀▀▀ ▀ ▀▀  ▀▀ ▀  ▀ ▀▀▀ ▀▀▀   ▀   ▀ ▀▀ ▀  ▀   ▀   ▀▀▀▀ ▀ ▀▀
```

</div>

> **"Gru coordinates. Minions produce. Policies govern. Human approves."**

---

### 🌐 Idiomas / Languages / 语言 / Langues / Sprachen

* 🇪🇸 **[Español](README.md)**
* 🇺🇸 **[English](docs/readme/README.en.md)**
* 🇨🇳 **[中文](docs/readme/README.zh.md)**
* 🇫🇷 **[Français](docs/readme/README.fr.md)**
* 🇩🇪 **[Deutsch](docs/readme/README.de.md)**

---

## 🚀 Instalación y Setup

Siga estos pasos para clonar e instalar el entorno de desarrollo de **Gru Orchestrator**:

### 1. Clonar el repositorio
```bash
git clone https://github.com/AdrichDev/gru_orchestrator.git
cd gru_orchestrator
```

### 2. Instalar dependencias del proyecto
Este proyecto es un monorepo administrado con **pnpm**:
```bash
pnpm install
```

### 3. Instalar Providers globales obligatorios
Si no dispone de los binarios externos necesarios para la orquestación, instálelos ejecutando:

* **ruflo** (Construcción y orquestación multi-agente):
  ```bash
  npm install -g ruflo
  ```
* **gentlePi / gentlemanCli** (Especificación, SDD y entorno):
  ```bash
  npm install -g @gentle-ai/pi
  ```
* **engram** (Memoria semántica y persistente):
  Instale el binario desde su canal oficial y asegúrese de que esté disponible en su variable de entorno `PATH` o configurado en `ENGRAM_BIN`.

---

## 🧠 ¿Qué es Gru Orchestrator?

Gru es un orquestador y arquitecto diseñado para centralizar la toma de decisiones, evaluar riesgos y coordinar subagentes (minions) para el desarrollo de software. 

### Principios Fundamentales
* **Gru no codifica directamente**: Gru analiza la estructura, diseña planes en `implementation_plan.md` y delega la escritura del producto a sus minions especializados.
* **Escaneo del sistema de archivos**: Antes de tomar cualquier decisión de diseño o clasificar una tarea, se ejecuta un análisis del repositorio para mapear dependencias y riesgos.
* **Flujos por niveles**: Las tareas se clasifican de Nivel 0 (trivial) a Nivel 4 (crítico), aplicando procesos de aprobación específicos en base a su nivel de riesgo.

---

## 🎛️ Abstracción de Harnesses (Harness Runtime Abstraction)

Gru utiliza una capa de abstracción para ejecutarse en diferentes entornos de ejecución (*harnesses*) sin hardcodear modelos ni proveedores en su núcleo.

### Modos de Ejecución
* **`host-managed`**: El harness activo (Claude Code, Codex, Gemini, Pi) gestiona directamente el modelo nativo y la ejecución de herramientas. No se abre ninguna conexión de SDK secundaria de cara al LLM.
* **`sdk-managed`**: Modo de ejecución autónomo (`standalone`). Se conecta directamente a la API de un LLM utilizando variables de entorno de proveedor (`GRU_DEEPAGENTS_PROVIDER`, `GRU_DEEPAGENTS_API_KEY_ENV`, etc.).

### Flujo de Ejecución
```text
pnpm gru "prompt"
        ↓
HarnessDetector.detect()            ← Identifica el entorno activo
        ↓
AdapterRegistry.get(harnessId)      ← Resuelve el HarnessAdapter correspondiente
        ↓
adapter.supports(requiredCapability)?
   ├── Sí → adapter.execute(task)      ← Ejecución nativa optimizada para el entorno
   └── No  → fallbackSequentially()    ← Ejecución secuencial alternativa de Gru Core
        ↓
GruResult → Consola del sistema
```

### Matriz de Capacidades (`GruCapability`)
Cada entorno declara qué capacidades soporta dinámicamente mediante el contrato `HarnessAdapter`:
* **`native-subagents`**: Capacidad del entorno para lanzar subagentes de forma nativa sin consumir tokens del proceso principal (p. ej. Claude Code).
* **`file-tools`**: Herramientas integradas de lectura y escritura de archivos.
* **`web-search`**: Navegación o búsqueda en internet provista por el host.
* **`code-execution`**: Entorno de ejecución de código o sandbox seguro.
* **`memory`**: Persistencia de contexto/memoria a largo plazo.
* **`approval-flow`**: Mecanismos interactivos para la solicitud y obtención de permisos.

### Sincronización Canónica (`pnpm gru sync`)
Gru mantiene las definiciones de reglas, workflows y skills de forma centralizada en su estructura nativa. Al ejecutar el comando de sincronización:
1. Se leen las carpetas `gru/skills/`, `gru/workflows/` y `gru/policies/`.
2. Se distribuyen y compilan de forma idempotente en los subdirectorios específicos de cada entorno: `.claude/`, `.codex/`, `.gemini/` y `.pi/`.
3. El sistema muestra un diff de los cambios propuestos antes de sobrescribir, protegiendo las ediciones manuales a menos que se use el flag `--force`.

---

## 🔌 Catálogo de Providers

Gru utiliza una arquitectura modular basada en **Providers** para interactuar con el entorno y ejecutar las tareas delegadas:

| Provider ID | Ejecutable / Comando | Rol y Responsabilidad |
| :--- | :--- | :--- |
| **`local`** | Comando directo | Ejecución de tareas locales en el workspace (sistema de archivos, git, npm, tests). |
| **`ruflo`** | `ruflo` | Orquestador multi-agente para tareas complejas y swarms paralelos de minions. |
| **`gentlePi`** | `gentle-ai/pi` | Soporte y herramientas para la especificación del sistema bajo metodología SDD/OpenSpec. |
| **`gentlemanCli`** | `gentle-ai` | Diagnóstico de entorno, actualización de habilidades y sincronización de estado. |
| **`ecc`** | `ecc` | Auditoría de políticas de seguridad, análisis de código y detección de vulnerabilidades CVE. |
| **`deepagents`** | `deepagents` | Flujos de trabajo e hilos de tareas persistentes de largo plazo. |
| **`engram`** | `engram` | Acceso a memoria persistente de decisiones y contexto histórico del proyecto. |
| **`awesomeCopilot`** | Catálogo local | Búsqueda de habilidades (`SKILL.md`) y plantillas en el repositorio de la comunidad. |
