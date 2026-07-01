# Design: agent-browser

## Comandos de instalación (a ejecutar tras aprobación humana)

```bash
npm install -g agent-browser
agent-browser install
agent-browser --version   # smoke check
```

## Flujo de uso por Gru (ejemplo)

```bash
agent-browser open http://localhost:3002
agent-browser snapshot           # árbol de accesibilidad con refs @e1, @e2...
agent-browser click @e3          # ej. botón "Guardar"
agent-browser screenshot check.png
agent-browser close
```

## Texto a añadir en CLAUDE.md (raíz)

En la regla existente (sección "Doing tasks" del harness / equivalente):

> "For UI or frontend changes, start the dev server and use the feature in a browser
> before reporting the task as complete."

Añadir inmediatamente después:

> Usar `agent-browser` (CLI instalado globalmente) para el check rápido: `open` → `snapshot`
> → interacción (`click`/`fill`) → `screenshot` si hace falta evidencia. Para test
> automatizado reproducible en CI, usar la skill `webapp-testing` (Playwright) en su lugar.

## No-cambios explícitos

- No se toca la tabla de niveles 0-4.
- No se crea una skill nueva envolviendo agent-browser (el CLI ya es autoexplicativo,
  una skill wrapper sería paja — ver `canonical-docs-critical-audit`).
- No se instala en `package.json` de ningún subproyecto (creador_CRM, agents-agency,
  gru_orchestrator) — es una herramienta de la máquina de desarrollo, no del código
  productivo.
