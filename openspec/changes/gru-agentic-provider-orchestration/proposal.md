# Proposal: Gru Agentic Provider Orchestration

## Problema

Gru-Orchestrator tiene providers (Ruflo, AwesomeCopilot, Gentleman) pero los trata como ejecutores intercambiables sin roles diferenciados. No existe:

- Descubrimiento de agentes reales dentro de cada provider.
- Asignación de roles: quién escribe, quién revisa, quién testea.
- Supervisión independiente: quien implementa no puede aprobar.
- Quality gates antes de considerar una tarea completada.
- Trazabilidad a artefactos SDD (proposal/spec/design/tasks).

El resultado es que Gru puede ejecutar tareas sin reviewer independiente, sin evidencia de tests y sin respetar el workflow SDD de Gentleman.

## Propuesta

Construir una capa de orquestación agentic sobre los providers existentes:

1. **ProviderAdapter**: cada provider (Gentleman, AwesomeCopilot, Ruflo) expone un catálogo lazy de agentes reales.
2. **AgentCatalog**: índice de `AgentDescriptor` parseado de `SKILL.md` reales. No carga cuerpos completos hasta pedir un agente concreto.
3. **AgentResolver**: selecciona executor + reviewer independiente + tester Ruflo para cada tarea/fase SDD.
4. **ExecutionPlan**: plan ordenado con `TaskAssignment` y `QualityGate`.
5. **SupervisionPolicy**: impide autoaprobación, exige Ruflo tester/reviewer, bloquea sin evidencia.

## Recursos detectados

| Provider | Fuente real | Agentes clave |
|---|---|---|
| Ruflo | `D:\Adrian\10. IA\ruflo\.agents\skills\*\SKILL.md` | agent-coder, agent-reviewer, agent-tester, agent-architect, agent-planner, agent-production-validator, agent-security-manager |
| AwesomeCopilot | `vendor/awesome-copilot/skills\*\SKILL.md` | Skills de seguridad, arquitectura, docs |
| Gentleman | `gentle-ai` CLI — SDD workflow | Fases: explore → proposal → spec → design → tasks → apply → verify → sync → archive |

## Alternativas descartadas

**A: Ejecutar siempre con Ruflo swarm completo**
Descartado: invoca más agentes de los necesarios. No respeta roles ni independencia.

**B: Delegar todo a Gentleman**
Descartado: Gentleman es workflow, no ejecutor. Convertiría Gentleman en un ejecutor monolítico.

**C: Parsear SKILL.md en cada petición**
Descartado: ineficiente. El catálogo se indexa lazy al inicio, no se recarga en cada tarea.

## Decisión

Capa de orquestación con catálogos lazy, resolución por fase SDD, y SupervisionPolicy no negociable.

Gru es autoridad final. Gentleman define workflow. Ruflo supervisa y testea. AwesomeCopilot aporta skills cuando coinciden.

## Riesgos

- Ruflo `SKILL.md` puede tener frontmatter incompleto → marcar `availability: unavailable`, no inventar capacidades.
- AwesomeCopilot catálogo grande → lazy indexing, contexto mínimo.
- Gentleman CLI no disponible → adapter devuelve `unsupported`, no simula.
- Un agente Ruflo implementador no puede ser reviewer de la misma tarea.
