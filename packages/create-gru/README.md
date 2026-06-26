# create-gru

Instalador del **harness Gru** (modo B) para cualquier proyecto. Cero dependencias.

Gru es una capa de orquestación de LLMs: clasifica cada tarea por complejidad y
riesgo, exige aprobación humana en lo destructivo y delega la ejecución en
*providers* especializados. Este paquete solo **copia los archivos de
instrucciones del harness** (persona, contratos de minions, config MCP y los
agentes Gru-nativos) a tu proyecto. No ejecuta nada por sí mismo.

```bash
pnpm dlx create-gru init                 # interactivo, en el directorio actual
pnpm dlx create-gru init ./mi-proyecto   # destino explícito
pnpm dlx create-gru init --yes           # sin preguntar (perfil recomendado)
pnpm dlx create-gru init --minimal       # solo CLAUDE.md + minion-contract.md
pnpm dlx create-gru init --force         # sobrescribe (copia por archivo, hace merge)
pnpm dlx create-gru init --dry-run       # muestra qué haría, sin escribir
```

Con TTY pregunta grupo por grupo. Sin TTY (CI) usa el perfil recomendado. La
copia es **por archivo**: respeta tus archivos existentes y añade los que falten.

---

## ⚠️ Aviso de uso

**Este paquete es para uso propio, no para comercialización.**

`create-gru` y el harness Gru son un proyecto personal. Se distribuye tal cual,
sin garantía, y **no está destinado a la venta ni a uso comercial**. Orquesta
herramientas de terceros que mantienen sus propios autores y licencias: el uso
de cada una se rige por la licencia de su repositorio de origen. Respeta esas
licencias. Los nombres y marcas de cada proyecto pertenecen a sus autores.

---

## Providers que orquesta el harness

Gru no incluye estos providers; los **invoca** si están instalados. Cada uno es
un proyecto independiente con su propio repositorio y licencia:

| Provider | Rol en Gru | Instalación | Repositorio / fuente |
| :--- | :--- | :--- | :--- |
| **pnpm** | Gestor de paquetes / runner | `corepack enable` · `npm i -g pnpm` | https://github.com/pnpm/pnpm |
| **pi** | Runtime de Gentle-Pi | `npm install -g pi` | https://www.npmjs.com/package/pi |
| **gentle-pi** | Especificación SDD/OpenSpec y TDD | `pi install npm:gentle-pi` | https://www.npmjs.com/package/gentle-pi |
| **gentle-ai** (gentlemanCli) | Diagnóstico de entorno y sync de skills | instalador oficial | https://github.com/Gentleman-Programming/gentle-ai |
| **engram** (gentle-engram) | Memoria persistente de decisiones | `pi install npm:gentle-engram` | https://www.npmjs.com/package/gentle-engram |
| **ruflo** | Orquestador multi-agente / swarms (MCP) | `pnpm dlx ruflo@latest init wizard` | https://www.npmjs.com/package/ruflo |
| **ecc** (ecc-universal) | Auditoría de seguridad, políticas, CVEs | `pnpm add -D ecc-universal` | https://www.npmjs.com/package/ecc-universal |
| **awesome-copilot** | Catálogo de skills comunitarias (solo lectura) | `git clone … vendor/awesome-copilot` | https://github.com/github/awesome-copilot |
| **context7** | Documentación técnica al día (MCP) | bajo demanda vía `.mcp.json` | https://github.com/upstash/context7 · https://www.npmjs.com/package/@upstash/context7-mcp |
| **deepagents** | Workflows persistentes de largo plazo | adaptador propio (`GRU_DEEPAGENTS_ENTRY`) | adaptador provisto por el usuario — sin repo fijo |

> Las direcciones apuntan al repositorio o página oficial del paquete de cada
> proyecto. Si alguna cambia, manda el origen del proyecto upstream.

---

## Qué instala

Perfil recomendado (lo que copia por defecto):

- `.claude/CLAUDE.md` — la persona Gru (siempre).
- `minion-contract.md` — contrato de subagentes (siempre).
- `cybersec-minion-contract.md`, `SDD.md` — contrato cybersec + protocolo SDD.
- `.mcp.json` — servidores MCP (ruflo, context7, engram). `engram` se deja en
  modo `lazy` y `ENGRAM_BIN=engram`: no intenta arrancar si engram no está.
- `.claude/agents/` — solo los minions **Gru-nativos** (raíz + `cybersec/`).
  No incluye los agentes/skills específicos de claude-flow.
- `.claude/output-styles/` — estilos de salida (caveman, etc.).

Nunca copia `settings.local.json` (rutas y permisos de tu máquina).

---

## Tras instalar

1. Abre el proyecto con tu harness (Claude Code: `claude`).
2. Si usas el MCP de engram, ajusta `ENGRAM_BIN` en `.mcp.json` si tu binario no
   está en el `PATH`.
3. Instala los providers que vayas a usar (ver tabla de arriba).

---

## Para mantenedores

El directorio `template/` se genera desde el repo (fuente única de verdad) para
evitar drift:

```bash
node scripts/build-installer-template.mjs   # también corre en prepublishOnly
```

Repositorio del harness Gru: https://github.com/AdrichDev/gru_orchestrator
