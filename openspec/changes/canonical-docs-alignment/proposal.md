# Proposal: Resolver divergencia canónica CLAUDE.md/AGENTS.md/GEMINI.md

## Problema (hallazgo, no supuesto — verificado por diff)

En `gru_orchestrator/`, los 3 archivos canónicos son **byte-idénticos** (`diff` exit 0):
`CLAUDE.md` = `AGENTS.md` = `GEMINI.md`, 464 líneas, inglés, "Version 2.0". Este es el
patrón correcto — un solo documento, 3 nombres para que cada harness (Claude Code, Codex/
OpenAI, Gemini CLI) lo cargue automáticamente.

En la **raíz** del proyecto, los 3 archivos NO coinciden:

| Archivo | Líneas | Idioma | Se autodeclara canónico |
|---|---|---|---|
| `CLAUDE.md` | 500 | Inglés | No lo dice explícitamente, pero es el formato "v2.0 portable persona" activo (es el que este propio agente carga cada sesión) |
| `AGENTS.md` | 542 | Español | Sí: `# Fuente de verdad canónica. Todos los demás archivos heredan de este.` |
| `GEMINI.md` | 596 | Español | Sí: misma línea que AGENTS.md |

Hay **dos documentos que se autoproclaman canónicos, en idiomas distintos, con contenido
distinto** (`diff` da 500c1,542 y 500c1,596 — reemplazo total, no una sección). Esto es
exactamente la clase de inconsistencia que la tarea 6 de esta sesión pide auditar: dos
"fuentes de verdad" no pueden ambas ser la fuente de verdad.

## Propuesta

**Decisión recomendada** (requiere OK humano explícito — no se aplica sola):

1. `CLAUDE.md` (raíz) es la fuente canónica real: es el archivo que efectivamente carga
   este agente en cada sesión (confirmado — su contenido es el que aparece en el contexto
   de arranque de esta conversación). Mantiene el mismo idioma/formato que
   `gru_orchestrator`'s 3 archivos (inglés, "portable persona v2.0"), lo cual da
   consistencia entre el nivel raíz y el nivel `gru_orchestrator`.
2. `AGENTS.md` y `GEMINI.md` (raíz) se sobrescriben para ser copias byte-idénticas de
   `CLAUDE.md` (raíz) — mismo patrón que ya funciona en `gru_orchestrator`. Se pierde el
   contenido Spanish-only actual de esos dos archivos (542/596 líneas) — por eso requiere
   OK humano, es una decisión con pérdida de contenido irreversible sin backup.
3. Antes de sobrescribir, guardar una copia del `AGENTS.md`/`GEMINI.md` actuales en
   `openspec/changes/canonical-docs-alignment/legacy-backup/` para no perder trabajo
   histórico sin registro.
4. Incorporar en el `CLAUDE.md` (raíz) resultante los cambios ya propuestos en los changes
   hermanos de esta sesión (3c/3d, mención de `agent-browser`, trigger de `six-hats-review`)
   — este change es el punto de integración final, se aplica DESPUÉS de que 1-4 se aprueben.

## Alternativas descartadas

**A — Mantener AGENTS.md/GEMINI.md en español como "traducción", CLAUDE.md en inglés
como "original"**
Descartado: una traducción que diverge en contenido real (no solo idioma) deja de ser
traducción — son dos documentos distintos que un harness u otro cargará según el CLI que
use. Codex vería reglas distintas a Claude Code. Riesgo de comportamiento inconsistente
entre harnesses del mismo proyecto.

**B — Fusionar ambos contenidos en un documento híbrido más largo**
Descartado: contradice el principio "menos es más" (tarea 6). Un documento más largo con
contenido de ambos no resuelve la contradicción, la esconde.

**C — Elegir español como canónico (ya que el usuario habla español y Gru responde en
español)**
Evaluada, no descartada de forma definitiva — se presenta como pregunta al usuario en la
fase de aprobación humana (paso T0 de tasks.md), no se decide unilateralmente aquí.

## Riesgos

- Pérdida de contenido si AGENTS.md/GEMINI.md (raíz) tienen matices ES que no están en
  CLAUDE.md (raíz) y nadie los rescata antes de sobrescribir. Mitigado por el backup (punto 3).
- Cambia el comportamiento de cualquier harness que hoy lea AGENTS.md/GEMINI.md (raíz) y
  confiaba en su contenido actual — riesgo medio, requiere aviso explícito.

## Dependencias

Depende de que `l3-spec-doublecheck`, `agent-browser-integration` y `quality-gate-skills`
estén aprobados y aplicados primero — este change es el que consolida sus cambios en los
3 archivos canónicos a la vez, para no tocar los mismos archivos 4 veces por separado.
