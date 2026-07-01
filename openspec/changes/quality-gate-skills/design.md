# Design: six-hats-review + adopción quality-playbook / ADR

## Estructura de la skill nueva `six-hats-review`

Ubicación: `.claude/skills/six-hats-review/SKILL.md` (raíz) — se sincroniza a
`gru_orchestrator/.claude/skills/` vía el change `skills-sync-gru-orchestrator`.

Frontmatter (formato LLM-first, ver `skill-creator`):
```yaml
---
name: six-hats-review
description: 'Revisión estructurada de una decisión de diseño en 6 perspectivas (De Bono).
  Trigger: architect propone solución con 2+ alternativas viables o "Requires new
  architecture" marcado en la tabla de complejidad. No usar en tareas triviales o de
  una sola solución obvia.'
---
```

Contenido (guion de las 6 pasadas, en orden fijo):
1. **White** — solo datos/hechos: qué dice el Filesystem Scan, qué restricciones técnicas
   son innegociables (versión de librería, contrato de API existente).
2. **Red** — instinto/riesgo emocional: "¿qué de esto me preocupa aunque no sepa
   justificarlo con datos?" (input crudo, sin filtrar — se cruza después con Black).
3. **Black** — crítica formal: qué puede romperse, qué deuda técnica genera. (Este es el
   solapamiento intencional con `devil`; six-hats lo produce como INSUMO, `devil` lo AUDITA
   después con más rigor).
4. **Yellow** — beneficios: por qué esta alternativa es mejor que no hacer nada.
5. **Green** — alternativas: ¿qué otras 1-2 formas de resolver esto existen? Compararlas
   objetivamente, no defender la primera idea.
6. **Blue** — síntesis: de las alternativas de Green, ¿cuál se recomienda y por qué? Esto
   es lo que pasa a `devil` para auditoría de riesgo.

Salida: documento corto (no un ensayo) con 1-2 líneas por sombrero + recomendación final.
Se adjunta a la carpeta del change (`openspec/changes/<slug>/six-hats.md`) — NO es un
archivo separado obligatorio en todos los changes, solo cuando el trigger se activa.

## Integración con quality-playbook (sin copiar el catálogo)

En el paso `reviewer` de L3/L4, cuando el cambio afecta 4+ archivos:
```text
reviewer (existente) → si 4+ archivos: invocar quality-playbook desde
  vendor/awesome-copilot/skills/quality-playbook/SKILL.md (leer bajo demanda, no cachear
  en catálogo local — evita duplicar 2738 líneas en dos sitios)
```

## Integración con create-architectural-decision-record

En el paso `architect`, cuando se toma una decisión arquitectónica (misma señal que activa
Six Hats): generar el ADR usando la plantilla de
`vendor/awesome-copilot/skills/create-architectural-decision-record/SKILL.md`, guardar el
ADR en `docs/adr/<fecha>-<slug>.md` (carpeta nueva, crear si no existe) y referenciarlo
desde la entrada de Engram (`architecture:[module]` → incluir ruta del ADR en el `VALUE`).

## No-cambios explícitos

- No se crea una skill wrapper para `quality-playbook` ni para el ADR template — se
  referencian por ruta directa al catálogo vendor, siguiendo el patrón ya establecido en
  `CLAUDE.md` raíz ("Sub-Agent Startup Pattern... pasar rutas, no resúmenes").
- `docs/adr/` es carpeta nueva — confirmar con el usuario si prefiere otra ubicación antes
  de aplicar (no asumir; bajo riesgo pero es una decisión de estructura de repo).
