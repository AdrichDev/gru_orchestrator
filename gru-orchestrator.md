# Gru — Orquestador Principal
# Ubicación: .pi/agents/gru-orchestrator.md
# Versión: 2.0
#
# DIP aplicado: este archivo hereda de AGENTS.md (fuente de verdad canónica).
# Solo contiene lo específico del runtime Pi + Gentle-AI.
# Cualquier regla general vive en AGENTS.md, no aquí.
# Si hay conflicto entre este archivo y AGENTS.md → AGENTS.md gana.

---

## HERENCIA

```text
Base:    AGENTS.md (todas las reglas de Gru)
Extiende: comportamiento específico de Pi runtime
```

Este archivo NO redefine:
- Identidad.
- Regla central.
- Tabla de decisión.
- Contrato de Minions.
- Workflows por nivel.
- Escalación a Ruflo.

---

## RUNTIME PI — ARRANQUE

Al iniciar en Pi:

```text
1. Cargar AGENTS.md como contexto base.
2. Ejecutar arranque estándar de AGENTS.md.
3. Verificar paquetes Pi disponibles:
   - gentle-pi
   - gentle-engram
   - pi-subagents
   - pi-intercom
4. Si falta alguno → avisar al usuario antes de continuar.
```

Verificación rápida:
```text
gentle-ai doctor
```

---

## INTEGRACIÓN CON GENTLE-PI

```text
gentle-pi      → persona, SDD workflow, skills, chains
gentle-engram  → integración Pi ↔ Engram
pi-subagents   → ejecuta Minions desde .pi/agents/
pi-intercom    → Minions consultan a Gru durante chains
```

Regla de intercom:
```text
Un Minion puede consultar a Gru durante su ejecución.
Gru puede responder con: CONTINÚA / PARA / RECLASIFICA.
Gru no toma el control de la tarea del Minion.
```

---

## RUTAS DE MINIONS EN PI

```text
.pi/agents/minion-filesystem.md
.pi/agents/minion-architect.md
.pi/agents/minion-spec.md
.pi/agents/minion-builder.md
.pi/agents/minion-reviewer.md
.pi/agents/minion-tester.md
.pi/agents/minion-security.md
.pi/agents/minion-devil.md
.pi/agents/minion-pm.md
.pi/agents/minion-docs.md
.pi/agents/minion-context7.md
.pi/agents/minion-memory.md
.pi/agents/minion-mcp.md
```

Regla:
```text
Si el archivo del Minion no existe → no invocar.
Avisar al usuario y pedir que lo cree o lo descargue.
```

---

## RUTAS DE SKILLS EN PI

```text
/skills/core/caveman.md
/skills/core/devils-advocate.md
/skills/core/principal-architect.md
/skills/core/spec-driven-workflow.md
/skills/core/human-in-the-loop.md
/skills/core/code-review.md
/skills/core/testing.md
/skills/core/security-review.md
/skills/core/ai-ready-repository.md
/skills/ruflo/                    → skills que requieren Ruflo DELEGATE
/skills/community/                → skills de terceros
```

---

## ENGRAM EN PI

Gru accede a Engram vía `gentle-engram`.

```text
engram search "query"   → buscar memoria
engram tui              → interfaz interactiva
```

Namespace por proyecto:
```text
proyecto:[nombre]:[clave]
```

Ejemplo:
```text
proyecto:mi-app:stack
proyecto:mi-app:convenciones
proyecto:mi-app:decisiones-arquitectura
```

---

## MCP ACTIVATION EN PI

MCPs se activan bajo demanda, no en arranque.

```text
1. Gru detecta necesidad de MCP durante intake o clasificación.
2. Gru pregunta al usuario si el MCP está disponible.
3. Si está disponible → activar vía minion-mcp.
4. Si no está disponible → continuar sin él o escalar.
```

MCPs disponibles por defecto en Pi:
```text
GitHub, Bitbucket, GitLab
Jira, Linear, Notion
Supabase
Context7
Google Drive, Calendar
```

---

## COMANDOS PI

```text
/sdd-init                → iniciar SDD en Pi
/gentleman:models        → ver modelos disponibles
/gentle-ai:status        → estado del ecosistema
engram search "query"    → buscar en memoria
engram tui               → interfaz Engram
gentle-ai doctor         → diagnóstico del entorno
pi install npm:gentle-pi → instalar gentle-pi si falta
```

---

## SINCRONIZACIÓN

Si se actualiza AGENTS.md:
```text
1. Revisar si este archivo entra en conflicto.
2. Actualizar solo las secciones específicas de Pi que sean necesarias.
3. No copiar reglas generales aquí — heredarlas.
```

Señal de desincronización:
```text
Si una regla de este archivo contradice AGENTS.md → bug.
Reportar y resolver a favor de AGENTS.md.
```
