---
name: six-hats-review
description: "Revisión estructurada de una decisión de diseño en 6 perspectivas (De Bono). Trigger: architect propone solución con 2+ alternativas viables, o la tabla de complejidad marcó 'Requires new architecture'. NO usar en tareas triviales o de una sola solución obvia."
metadata:
  author: gru-orchestrator
  version: "1.0"
---

## When to Use

Load this skill in el paso `architect` de un cambio L3/L4, solo cuando:

- La tabla de complejidad marcó **"Requires new architecture"** (2 pts), o
- Hay 2 o más alternativas de diseño viables sobre la mesa.

No se activa en L0-L2 ni en tareas con una sola solución obvia — activarla siempre sería
paja: ralentiza tareas triviales sin añadir valor.

## Relación con `devil` (persona built-in)

`devil` ya cubre riesgo/bloqueo (Black Hat). Six Hats NO lo duplica: añade las 5
perspectivas que `devil` no cubre. Se ejecuta ANTES de `devil`, en la misma fase de
`architect`. Su salida (síntesis del sombrero Blue) es lo que `devil` audita después.

## Las 6 pasadas (orden fijo)

| Sombrero | Pregunta | Salida esperada |
|---|---|---|
| White | Solo datos/hechos: ¿qué dice el Filesystem Scan? ¿qué restricciones técnicas son innegociables? | 1-2 líneas de hechos verificados |
| Red | Instinto/riesgo emocional: ¿qué me preocupa aunque no sepa justificarlo con datos? | 1-2 líneas, input crudo sin filtrar |
| Black | Crítica formal: ¿qué puede romperse? ¿qué deuda técnica genera? | 1-2 líneas — insumo para `devil`, no auditoría final |
| Yellow | Beneficios: ¿por qué esta alternativa es mejor que no hacer nada? | 1-2 líneas |
| Green | Alternativas: ¿qué otras 1-2 formas de resolver esto existen? Comparar objetivamente. | 1-2 alternativas concretas |
| Blue | Síntesis: de las alternativas de Green, ¿cuál se recomienda y por qué? | Recomendación final → pasa a `devil` |

## Salida

Documento corto (no un ensayo): 1-2 líneas por sombrero + recomendación final. Se adjunta
a la carpeta del change (`openspec/changes/<slug>/six-hats.md`) solo cuando el trigger se
activa — no es obligatorio en todos los changes.

## Critical Rules

| Rule | Requirement |
|------|-------------|
| Orden fijo | Las 6 pasadas se hacen en el orden White→Red→Black→Yellow→Green→Blue, siempre. |
| Sin ensayo | Cada sombrero es 1-2 líneas, no un párrafo largo. |
| No sustituye a devil | Black Hat aquí es insumo; `devil` sigue auditando después con más rigor. |
| Trigger acotado | Solo L3/L4 con nueva arquitectura o 2+ alternativas — nunca por defecto. |
