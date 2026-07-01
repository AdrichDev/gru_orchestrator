# Design: sync de skills

## Tamaño verificado (bajo riesgo)

Las 16 carpetas faltantes pesan 11M en total (`canvas-design` 5.6M es la mayor — assets de
diseño). Copiarlas es una operación de segundos, sin impacto en build/CI (skills no entran
en el bundle de ningún paquete TS).

## Comando de sync (a ejecutar)

```bash
cd "D:/Adrian/22. Proyectos/3A_Estudio"
for d in algorithmic-art brand-guidelines canvas-design claude-api doc-coauthoring docx \
         frontend-design internal-comms mcp-builder pdf pptx slack-gif-creator \
         theme-factory webapp-testing web-artifacts-builder xlsx; do
  cp -r ".claude/skills/$d" "gru_orchestrator/.claude/skills/$d"
done
```

Copia directa, sin transformación de contenido — mismo SKILL.md, mismos assets.

## Post-sync obligatorio

Tras copiar, ejecutar la skill `skill-registry` (ya presente en ambos catálogos) para
regenerar el índice de skills por trigger/ruta — el registro cacheado en Engram
(`mem_search("skill-registry")`) queda desactualizado tras cualquier sync y debe
refrescarse, según la regla ya escrita en `CLAUDE.md` (gru_orchestrator):
"Trigger: update skills, skill registry... after skill changes."

## Candidatos descartados — sin acción

`sandbox-npm-install`, `playwright-generate-test`, `playwright-explore-website`,
`playwright-automation-fill-in-form` — no se copian a ningún catálogo (ver justificación
en proposal.md).
