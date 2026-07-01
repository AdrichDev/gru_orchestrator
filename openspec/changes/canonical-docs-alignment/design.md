# Design: alineación canónica

## Orden de aplicación

```text
1. Esperar aprobación + aplicación de:
   - l3-spec-doublecheck
   - agent-browser-integration
   - quality-gate-skills
   - skills-sync-gru-orchestrator (no toca CLAUDE.md, pero debe estar hecho para que el
     registro de skills esté fresco antes de documentar referencias a skills en el texto)
2. Backup: copiar AGENTS.md y GEMINI.md (raíz) actuales a
   openspec/changes/canonical-docs-alignment/legacy-backup/
3. Human approval del punto de idioma (inglés vs español como canónico raíz) — AskUserQuestion
4. Actualizar CLAUDE.md (raíz) con los 3 cambios de los changes 1-3 ya aplicados
5. Copiar CLAUDE.md (raíz) → AGENTS.md (raíz) y → GEMINI.md (raíz), byte-idéntico
6. Verificar gru_orchestrator/CLAUDE.md sigue siendo byte-idéntico a
   gru_orchestrator/AGENTS.md y gru_orchestrator/GEMINI.md (no debería haber tocado esto,
   pero se confirma)
```

## Patrón a preservar (ya correcto en gru_orchestrator)

```bash
diff gru_orchestrator/CLAUDE.md gru_orchestrator/AGENTS.md   # debe seguir dando exit 0
diff gru_orchestrator/CLAUDE.md gru_orchestrator/GEMINI.md   # debe seguir dando exit 0
```

## Patrón a lograr (raíz)

```bash
diff CLAUDE.md AGENTS.md   # hoy: 500c1,542 (todo distinto) → objetivo: exit 0
diff CLAUDE.md GEMINI.md   # hoy: 500c1,596 (todo distinto) → objetivo: exit 0
```

## Nota sobre "Fuente de verdad canónica"

Si se mantiene esa línea de encabezado (útil, es información real), debe aparecer
IDÉNTICA en los 3 archivos apuntando a "este documento, en cualquiera de sus 3 copias" —
no a un archivo específico, porque los 3 SON el mismo contenido tras este change.
