# Validation: agent-browser

## §T1 — Instalación

**Historia**: Como Gru quiero tener `agent-browser` disponible en PATH para poder verificar
cambios de UI sin depender solo de Playwright completo.

**Criterios de aceptación**:
- `agent-browser --version` responde con una versión, sin error de comando no encontrado.
- Chrome descargado por `agent-browser install` existe (el propio comando lo confirma).

**Test que valida**: `agent-browser --version` → **`agent-browser 0.31.1`**.
`agent-browser install` → Chrome 150.0.7871.46 instalado en
`C:\Users\achoz\.agent-browser\browsers\chrome-150.0.7871.46`. Estado: 🟢.

**OK**: [x] (OK humano dado: "si es una mejora adelante" tras confirmar que no duplica
`webapp-testing` — rol distinto, ver proposal.md)

## §T2 — Documentación

**Criterios de aceptación**: `CLAUDE.md` (raíz) menciona `agent-browser` sin duplicar
reglas existentes.

**Test que valida**: `grep -n "agent-browser" CLAUDE.md` → match en sección `GUARDRAILS`
(fila "UI/frontend change → verify with agent-browser..."). Estado: 🟢.

**OK**: [x]

## §T3 — Smoke test real

**Criterios de aceptación**: `agent-browser open` + `snapshot` devuelve un árbol de
accesibilidad no vacío.

**Test que valida**: ejecutado contra `https://example.com` (no contra un dev server local
del monorepo — ninguno estaba levantado en el momento del smoke test; se prioriza la
verificación funcional del CLI sobre la app concreta). Resultado real:
```
- heading "Example Domain" [level=1, ref=e1]
- paragraph
  - StaticText "This domain is..."
- paragraph
  - link "Learn more" [ref=e2]
```
Screenshot guardado en `smoke-check.png` (esta carpeta). `close` → "Browser closed".
Estado: 🟢. Pendiente (no bloqueante): repetir contra `creador_CRM/front` con dev server
levantado, la próxima vez que se trabaje ahí.

**OK**: [x]

## Checklist final

- [x] T1 OK
- [x] T2 OK
- [x] T3 OK (smoke funcional confirmado; repetición contra app real del monorepo queda
  como validación oportunista, no bloqueante)

Change aplicado completo.
