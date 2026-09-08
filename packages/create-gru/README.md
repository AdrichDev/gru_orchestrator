# create-gru

Lanzador npx del **harness Gru**. Una sola entrada por npm que te lleva al
instalador nativo.

`create-gru` **no copia archivos propios** ni mantiene una plantilla. Su único
trabajo es: instalar el CLI nativo del harness (`gru`) si falta y ejecutar
`gru init`. Así hay **un solo instalador** (la fuente canónica del harness,
generada con `harness:gen`) y **cero contenido duplicado**: no hay drift.

```bash
pnpm dlx create-gru                       # instala el harness y lanza `gru init`
pnpm dlx create-gru init --scope project  # flags reenviados tal cual a `gru init`
pnpm dlx create-gru init --runtime all
pnpm dlx create-gru init --force --awesome-copilot
```

Equivale a hacerlo a mano:

```bash
pnpm add -g github:AdrichDev/gru_orchestrator
gru init
```

Dos formas de llegar al mismo sitio:

- **CLI directo** — `pnpm add -g github:AdrichDev/gru_orchestrator` y luego `gru init`.
- **npx** — `pnpm dlx create-gru`, que hace lo de arriba por ti.

El instalador real es siempre `gru init`. `create-gru` solo es el atajo por npm.

---

## ⚠️ Aviso de uso

**Para uso propio, no para comercialización.** Se distribuye tal cual, sin
garantía. El harness Gru orquesta herramientas de terceros que mantienen sus
propios autores y licencias; respeta cada licencia.

## Providers que orquesta el harness

Gru no los incluye: los invoca si están instalados. Proyectos independientes,
cada uno con su repositorio y licencia:

| Provider | Rol | Fuente |
| :--- | :--- | :--- |
| pnpm | gestor de paquetes / runner | https://github.com/pnpm/pnpm |
| pi | runtime de Gentle-Pi | https://www.npmjs.com/package/pi |
| gentle-pi | SDD/OpenSpec + TDD | https://www.npmjs.com/package/gentle-pi |
| gentle-ai | diagnóstico de entorno y skills | https://github.com/Gentleman-Programming/gentle-ai |
| engram (gentle-engram) | memoria persistente | https://www.npmjs.com/package/gentle-engram |
| ecc (ecc-universal) | auditoría de seguridad / CVEs | https://www.npmjs.com/package/ecc-universal |
| awesome-copilot | catálogo de skills (solo lectura) | https://github.com/github/awesome-copilot |
| context7 | documentación técnica (MCP) | https://github.com/upstash/context7 |
| deepagents | workflows persistentes | adaptador provisto por el usuario |

---

Repositorio del harness Gru: https://github.com/AdrichDev/gru_orchestrator
