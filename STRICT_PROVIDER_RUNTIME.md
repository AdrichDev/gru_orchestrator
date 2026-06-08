# Strict Provider Runtime

Gru no devuelve respuestas simuladas.

## Comandos

```bash
pnpm gru status
pnpm gru /status
pnpm gru doctor
pnpm gru "usa swarm para esta tarea"
```

## Comportamiento

- Antes de ejecutar, Gru comprueba que el provider esté realmente disponible.
- Si falta, bloquea la ejecución y muestra la instrucción de instalación/configuración.
- En terminal interactiva ofrece únicamente fallbacks que también hayan superado el health check.
- En CI/no-TTY termina con código 2.
- Los fallos del proceso externo se registran como `success: false`; nunca se convierten en éxito.
- Los logs de `runs/` incluyen comando, exit code, error, inicio y fin.

## Providers especiales

### Awesome Copilot

No es un CLI de ejecución. Gru lo trata como catálogo local y busca `SKILL.md` reales.

```powershell
git clone https://github.com/github/awesome-copilot vendor/awesome-copilot
```

También puede configurarse:

```powershell
$env:GRU_AWESOME_COPILOT_PATH="D:\ruta\awesome-copilot"
```

### DeepAgents

No se considera instalado por tener Node. Requiere un adaptador ejecutable:

```powershell
$env:GRU_DEEPAGENTS_ENTRY="D:\ruta\deepagents-adapter.mjs"
```

El adaptador debe aceptar:

```text
node deepagents-adapter.mjs run "prompt"
```
