# Tasks: agent-browser

## T1 — Instalación (requiere OK humano: instala software global en la máquina)

- [x] `npm install -g agent-browser` → validation.md §T1
- [x] `agent-browser install` (descarga Chrome) → validation.md §T1
- [x] `agent-browser --version` confirma instalación → validation.md §T1

## T2 — Documentación

- [x] `CLAUDE.md` (raíz): añadir mención de `agent-browser` en la regla de UI/frontend
  (ver design.md, texto exacto) → validation.md §T2

## T3 — Smoke test real

- [x] Levantar un dev server local existente (ej. `creador_CRM/front`) y correr
  `agent-browser open` + `snapshot` + `screenshot` contra él → validation.md §T3
