# Design: Agent Wizard Widget Configuration

## Backend

- Add Prisma models `Sector` and `Lead`.
- Add widget fields to `Agent`.
- Add `metadata` JSON to `Conversation` for lead-flow state.
- Add `services/sectors`, `services/widget-config`, `services/knowledge-ingest`, and `services/lead-flow`.
- Keep `/api/skills` compatible with marketplace pagination.
- Extend `/api/knowledge` with `overwriteDuplicates`.
- Add `/api/sectors`, `/api/widget/config`, and `/api/agents/:id/widget-config`.

## Frontend

- Split agent wizard into components under `components/agent-wizard`.
- Add hooks under `hooks/` for sectors, wizard skills, and prompt behavior.
- Add shared navigation icon constants and `SidebarNavItem`.
- Add widget configuration controls in the channel step.
- Keep styling aligned with existing `card`, `btn-grad`, `btn-dark`, `input-dark`, and chip classes.

## Widget

- `widget.js` fetches `/api/widget/config?publicKey=...`.
- It applies primary/secondary colors, avatar, and header name.
- It defaults safely if config fetch fails.

## Lead Flow

- `chatWithAgent` uses a lead-flow service before calling the LLM.
- Conversation metadata stores the current step.
- Leads are created once contact details are collected.

