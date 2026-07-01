# Validation: quality-gate-skills

## §T1 — six-hats-review

**Historia**: Como Gru quiero una revisión estructurada de alternativas de diseño cuando
hay 2+ opciones viables, para no quedarme con la primera solución que "funciona" sin
comparar si es la mejor.

**Criterios de aceptación**:
- `six-hats-review/SKILL.md` existe con las 6 secciones (White/Red/Black/Yellow/Green/Blue)
  en ese orden fijo.
- El trigger documentado en `docs/harness-reference.md` dice explícitamente que NO se
  activa en L0-L2 salvo excepción justificada, y que en L3-L4 solo se activa con
  "Requires new architecture" o 2+ alternativas viables.

**Given-When-Then**:
```gherkin
Dado un cambio Nivel 3 que marcó "Requires new architecture" en la tabla de complejidad
Cuando Gru llega al paso "architect"
Entonces se ejecuta six-hats-review antes de "devil"
Y la salida incluye una recomendación final (sombrero Blue) que devil audita después

Dado un cambio Nivel 1 de un solo archivo sin alternativas de diseño
Cuando Gru clasifica la tarea
Entonces six-hats-review NO se activa
```

**Test que valida**: `.claude/skills/six-hats-review/SKILL.md` creado con las 6 filas en
la tabla, orden fijo White→Red→Black→Yellow→Green→Blue, más frontmatter con
`description` que documenta el trigger. `grep -c "six-hats" docs/harness-reference.md
gru_orchestrator/docs/harness-reference.md` → 2 y 3 matches respectivamente (Level 3 y
Level 4 en cada archivo, más la nota de architect+ADR en gru_orchestrator). Skill también
aparece en la lista de skills disponibles de la sesión tras crearla. Estado: 🟢.

**OK**: [x]

## §T2 — Referencias quality-playbook / ADR

**Criterios de aceptación**: `gru_orchestrator/docs/harness-reference.md` referencia la
ruta exacta `vendor/awesome-copilot/skills/quality-playbook/SKILL.md` (no copia su
contenido) y condiciona su uso a "4+ archivos" en el paso `reviewer`. Mismo patrón para
el ADR template.

**Test que valida**: `grep -n "quality-playbook" gru_orchestrator/docs/harness-reference.md`
→ match en sección `Minion Catalog` (nota "reviewer + quality-playbook"). `grep -n
"architectural-decision-record"` → match en la nota "architect + ADR", con convención
`docs/adr/<date>-<slug>.md`. Estado: 🟢.

Decisión sobre ubicación de `docs/adr/`: se documentó la convención por texto (referencia
en `harness-reference.md`), **sin pre-crear la carpeta vacía** — se crea cuando exista el
primer ADR real que registrar. No bloquea este change; evita crear estructura sin contenido.

**OK**: [x]

## §T3 — No-duplicación

**Criterios de aceptación**: ninguna de las skills descartadas (`doublecheck`, `eyeball`,
`review-and-refactor`, `structured-autonomy-plan`, `structured-autonomy-implement`,
`structured-autonomy-generate`) aparece copiada en `.claude/skills/` (raíz) ni en
`gru_orchestrator/.claude/skills/`.

**Test que valida**: `ls .claude/skills gru_orchestrator/.claude/skills | grep -iE
"doublecheck|eyeball|review-and-refactor|structured-autonomy"` → **sin resultados**.
Estado: 🟢.

**OK**: [x]

## Checklist final

- [x] T1 OK
- [x] T2 OK (decisión: convención documentada, carpeta `docs/adr/` no pre-creada)
- [x] T3 OK

Change aplicado completo.
