# Proposal: Instalar e integrar agent-browser como paso de verificación

## Problema

Hoy Gru no puede comprobar visualmente/interactivamente que un cambio de frontend funciona.
La skill `webapp-testing` (Playwright) existe pero es pesada de invocar caso por caso.
El usuario pide una herramienta ligera de CLI para que, "por cada tarea que te mando",
Gru pueda abrir el navegador, navegar, hacer clic/fill y capturar screenshot como parte
del cierre de una tarea — no solo cuando se invoca explícitamente `/verify` o `webapp-testing`.

## Investigación (hecha en esta sesión)

`vercel-labs/agent-browser`: CLI en Rust, browser automation para agentes IA.
- Instalación: `npm install -g agent-browser` + `agent-browser install` (descarga Chrome).
- Soporta Windows x64/ARM64. No requiere Node en el daemon tras instalar.
- Comandos clave: `open`, `snapshot` (árbol de accesibilidad con refs `@e1`, `@e2`...),
  `click @ref`, `fill @ref "texto"`, `screenshot`, `close`.
- Sesiones aisladas (`--session`), perfiles Chrome reutilizables (`--profile`), streaming
  WebSocket para preview en vivo.
- Sin API keys para uso local. Integraciones cloud (Browserless/Browserbase/etc.) son
  opcionales, no las necesitamos.
- Entorno verificado: Node v24.16.0, npm 11.13.0 en esta máquina → cumple requisitos.

## Propuesta

1. Instalar global: `npm install -g agent-browser` → `agent-browser install`.
2. NO sustituye a `webapp-testing` (Playwright) ni a `browser` (skill existente de
   browser automation para claude-flow). Rol distinto:
   - `agent-browser` = comprobación rápida ad-hoc, snapshot/click/screenshot en 1-2 comandos,
     usada por Gru mismo al cerrar una tarea de frontend (regla existente en `CLAUDE.md`:
     "For UI or frontend changes, start the dev server and use the feature in a browser
     before reporting the task as complete").
   - `webapp-testing` (Playwright) = suite de test automatizado, reproducible, para CI.
   - `browser` (skill claude-flow) = automation orientada a swarms/agentes paralelos.
3. Añadir referencia en `CLAUDE.md` (raíz) dentro de la regla ya existente de UI/frontend:
   mencionar `agent-browser` como la herramienta concreta para el check manual pre-cierre.
4. NO añadir un paso nuevo en la tabla de niveles (0-4): esto no es un gate de workflow,
   es una herramienta que la regla de UI/frontend ya exige usar — solo se nombra el CLI.

## Alternativas descartadas

**A — Solo usar Playwright (`webapp-testing`) para todo**
Descartado: Playwright vía skill requiere levantar contexto de test completo (browser,
page, assertions) para una comprobación de "¿esto se ve bien?". Overkill para el check
rápido que `CLAUDE.md` ya exige antes de reportar terminado un cambio de UI.

**B — Instalar vía Homebrew/Cargo**
Descartado: proyecto corre en Windows; Homebrew no aplica, Cargo requiere toolchain Rust
que no tenemos instalado. `npm install -g` es la vía soportada y ya tenemos Node/npm.

**C — Integración cloud (Browserbase/Browserless)**
Descartado por ahora: fuera de scope, requiere API keys y coste. Uso 100% local basta
para el caso de uso (verificación manual de Gru en dev).

## Riesgos

- `agent-browser install` descarga un Chrome propio (~100-300MB) → espacio en disco,
  una sola vez. Aceptado.
- Instalación global (`-g`) afecta al PATH del usuario, no solo al proyecto → acción
  reversible (`npm uninstall -g agent-browser`), de bajo riesgo, pero se comunica antes
  de ejecutar (regla de "acciones con efecto fuera del repo").
- Descarga desde npm registry — dependencia de terceros nueva en la máquina del usuario,
  no en el repo (no entra en `package.json` de ningún proyecto).

## Dependencias

Ninguna. Independiente del resto de changes de esta sesión.
