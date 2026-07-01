# Proposal: Sincronizar catálogo de skills raíz → gru_orchestrator

## Problema

`.claude/skills/` (raíz) tiene 74 directorios. `gru_orchestrator/.claude/skills/` tiene 58.
Diff exacto (16 faltantes en gru_orchestrator):

```
algorithmic-art, brand-guidelines, canvas-design, claude-api, doc-coauthoring, docx,
frontend-design, internal-comms, mcp-builder, pdf, pptx, slack-gif-creator, theme-factory,
webapp-testing, web-artifacts-builder, xlsx
```

Gru orquesta TODO (instrucción del usuario en esta sesión) — cualquier sub-agente lanzado
desde `gru_orchestrator` que necesite, por ejemplo, generar un PDF, un XLSX, o testear una
webapp con Playwower (`webapp-testing`) no encuentra la skill si opera solo con el catálogo
de `gru_orchestrator/.claude/skills/`.

Caso concreto que expone el hueco: `gru_orchestrator/tests/deepagents-harness.test.ts`
verifica que el `DeepagentsProvider` en modo `host-managed` delega SIEMPRE al
`HarnessAdapter` activo y nunca abre una conexión SDK paralela — y que harnesses sin
adapter real (codex, gemini, pi, standalone) devuelven `StubHarnessAdapter` conservador
(`supports() → false`, `checkAvailability() → unsupported`). Esto es exactamente el tipo de
componente que se beneficiaría de `webapp-testing` (verificación de comportamiento real,
no solo mock) si el harness expusiera una superficie web — hoy no la expone, pero el
patrón de test (adapter real vs stub conservador) es el mismo patrón que debe seguir
cualquier skill nueva que se adopte: si no hay integración real, declarar explícitamente
"no soportado", nunca fingir.

## Propuesta

### 1. Sync mecánico (copia directa, sin transformación)

Copiar los 16 directorios faltantes de `.claude/skills/` (raíz) a
`gru_orchestrator/.claude/skills/`, tal cual (mismo SKILL.md, mismos assets). Es una
operación reversible y de bajo riesgo — no modifica contenido, solo replica.

### 2. Candidatos de `vendor/awesome-copilot/skills/` evaluados para el flujo de tareas

Revisados contra `deepagents-harness.test.ts` y el patrón de harness/adapters:

- **`sandbox-npm-install`** — descartado. Es específico de contenedores Docker con
  virtiofs (crashes de binarios nativos). El monorepo corre nativo en Windows, no en
  sandbox Docker. No aplica.
- **`playwright-generate-test` / `playwright-explore-website` /
  `playwright-automation-fill-in-form`** — evaluados como complemento de
  `agent-browser-integration` (change hermano). Decisión: NO adoptar ahora — `webapp-testing`
  (ya en el catálogo raíz, falta sync a gru_orchestrator, ítem 1 de este change) cubre el
  mismo rol con Playwright. Adoptar los 3 de awesome-copilot sería duplicar la misma
  capacidad con una herramienta distinta → paja.
- **`mcp-builder`** (raíz, falta sync) — SÍ relevante: `packages/kernel/src/adapters/`
  define `HarnessAdapter` como contrato tipo-MCP (checkAvailability/supports/getContext/
  execute). Si en el futuro se expone un adapter como servidor MCP real, `mcp-builder`
  es la skill correcta. Ya está en la lista de sync del punto 1, no requiere acción extra.
- **`create-architectural-decision-record`** — ya cubierto en el change `quality-gate-skills`
  (no se repite aquí).

### 3. NO se propone importar todo el catálogo de awesome-copilot

`vendor/awesome-copilot/skills/` tiene ~300 skills, la mayoría específicas de stacks que
este monorepo no usa (Azure, Salesforce, Power Platform, Java/Kotlin/Rust MCP generators,
etc.). Importarlas "porque existen" viola la regla ya escrita en `CLAUDE.md`
(`gru_orchestrator`): "Do not activate a Minion because it exists. Activate it only because
the decision table requires it." — mismo principio aplica a skills.

## Riesgos

- Sync mecánico de 16 carpetas puede traer assets pesados (ej. `docx`/`pdf`/`pptx` suelen
  incluir plantillas binarias) → verificar tamaño total antes de copiar, avisar si es
  significativo.
- Ninguna de las 16 skills faltantes toca código de producción — son todas skills de
  generación de documentos/artefactos (docx, pdf, pptx, xlsx, canvas, slack-gif) o testing
  (webapp-testing, web-artifacts-builder) — riesgo bajo, reversible.

## Dependencias

Ninguna dura. Complementa `quality-gate-skills` (no se solapan: ese change trata
six-hats/quality-playbook/ADR, este trata el sync mecánico + investigación puntual).
