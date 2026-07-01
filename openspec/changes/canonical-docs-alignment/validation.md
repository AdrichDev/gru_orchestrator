# Validation: canonical-docs-alignment

## §T0 — Aprobación humana

**Historia**: Como usuario quiero decidir explícitamente qué idioma/versión es la fuente
de verdad, porque hoy hay dos documentos que se autoproclaman canónicos y difieren en
idioma y contenido.

**Criterios de aceptación**: existe una respuesta explícita del usuario (inglés o español)
antes de escribir ningún archivo.

**Test que valida**: usuario respondió explícitamente **"EN"** (inglés) — mismo idioma que
`CLAUDE.md` (raíz) ya usaba y que los 3 archivos de `gru_orchestrator` ya usan. Estado: 🟢.

**OK**: [x] (humano — decisión: inglés)

## §T1 — Backup

**Criterios de aceptación**: `legacy-backup/AGENTS.md` y `legacy-backup/GEMINI.md`
contienen el texto pre-cambio (542 y 596 líneas).

**Test que valida**: `wc -l legacy-backup/AGENTS.md legacy-backup/GEMINI.md` →
**542** y **596** respectivamente. Estado: 🟢.

**OK**: [x]

## §T2 — Consolidación

**Criterios de aceptación**: `CLAUDE.md` (raíz) contiene 3c/3d y mención de agent-browser.

**Test que valida**: `grep -n "3c\|agent-browser" CLAUDE.md` → 3 matches (líneas 140, 141:
tabla compacta con 3c/3d en Level 3 y 4; línea 358: agent-browser en GUARDRAILS). Nota:
"six-hats" NO aparece literal en `CLAUDE.md` — es correcto por diseño: tras
`canonical-docs-critical-audit`, ese detalle vive en `docs/harness-reference.md` (raíz),
no en el kernel compacto. Estado: 🟢.

**OK**: [x]

## §T3 — Sincronización

**Criterios de aceptación**: `diff CLAUDE.md AGENTS.md` y `diff CLAUDE.md GEMINI.md`
(raíz) devuelven exit 0.

**Test que valida**: `diff CLAUDE.md AGENTS.md; echo $?` → **0**.
`diff CLAUDE.md GEMINI.md; echo $?` → **0**. Estado: 🟢.

**OK**: [x]

## §T4 — No-regresión en gru_orchestrator

**Criterios de aceptación**: los 3 archivos de `gru_orchestrator/` siguen idénticos entre sí.

**Test que valida**:
```
diff gru_orchestrator/CLAUDE.md gru_orchestrator/AGENTS.md  → exit 0
diff gru_orchestrator/CLAUDE.md gru_orchestrator/GEMINI.md  → exit 0
```
Estado: 🟢.

**OK**: [x]

## Checklist final

- [x] T0 OK (humano — EN)
- [x] T1 OK
- [x] T2 OK
- [x] T3 OK
- [x] T4 OK

Change aplicado completo. Estado final: **7 archivos canónicos, todos alineados**
(`CLAUDE.md`/`AGENTS.md`/`GEMINI.md` en raíz — inglés — y los mismos 3 en
`gru_orchestrator/` — inglés, 464 líneas cada uno, sin cambios). Contenido histórico
en español de los antiguos `AGENTS.md`/`GEMINI.md` (raíz) preservado en `legacy-backup/`.

## Addendum — redefinición de "alineado" (post-aplicación)

**Hallazgo posterior**: `gentle-ai` (herramienta externa, actualizada a 1.43.2 en esta
sesión) inyecta automáticamente — vía hook de sesión, no vía ninguna acción de Gru —
un bloque auto-gestionado en `AGENTS.md` (raíz), delimitado por
`<!-- gentle-ai:engram-protocol -->` ... `<!-- /gentle-ai:sdd-orchestrator -->`
(protocolo Engram + orquestador SDD propio de gentle-ai). El mismo mecanismo toca
`~/.claude/CLAUDE.md` (global, fuera del repo) con marcadores idénticos.

**Decisión del usuario**: aceptar coexistencia. `diff CLAUDE.md AGENTS.md` YA NO será
`exit 0` puro — es esperado y correcto. La invariante real pasa a ser:

```bash
diff <(head -431 AGENTS.md) CLAUDE.md   # debe ser exit 0 — kernel Gru idéntico
# El resto de AGENTS.md (líneas 432+) es el bloque de gentle-ai — no tocar, no luchar
# contra él, se reinyecta solo. No usar AGENTS.md completo como test de alineación.
```

`GEMINI.md` no recibe este bloque (confirmado, sigue en exit 0 puro contra `CLAUDE.md`) —
el mecanismo de gentle-ai es específico de `AGENTS.md`. `gru_orchestrator`'s 3 archivos
no tienen este problema (gentle-ai no inyecta ahí en esta sesión, verificar en el futuro
si empieza a hacerlo).

**No se investigó ni desactivó el hook** (opción descartada por el usuario) — se acepta
como comportamiento esperado de una herramienta externa, no como bug de este change.
