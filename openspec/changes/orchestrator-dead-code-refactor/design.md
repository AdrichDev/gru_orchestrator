# Design — Orchestrator Dead Code Refactor

## Technical Approach

Use an audit-first cleanup. The implementation must treat dead-code removal as a safety-critical refactor: detect, classify, approve, apply, verify.

No deletion is allowed from a single static-search result. Dynamic/config-driven usage is common in this repo because providers, SDD changes, CLI commands, and config files interact outside direct imports.

## Architecture Decisions

### Decision: Inventory before deletion

**Choice**: Generate an explicit candidate inventory before applying cleanup.
**Alternatives considered**: Delete obvious empty folders immediately; add a tool and trust its output.
**Rationale**: The repo has config-driven providers and OpenSpec history. False positives are likely without context.

### Decision: Keep cleanup separate from behavior changes

**Choice**: Separate pure deletion from orchestrator module extraction.
**Alternatives considered**: Split `orchestrator/index.ts` while deleting unused paths.
**Rationale**: Review stays smaller. If behavior breaks, root cause is easier to isolate.

### Decision: Optional tooling, not source of truth

**Choice**: Tool output may support inventory but cannot be the only proof.
**Alternatives considered**: Add `knip` or `ts-prune` as mandatory source of truth.
**Rationale**: CLI entrypoints, package exports, path aliases, test fixtures, and dynamic runtime paths create false positives.

### Decision: Preserve public CLI contract

**Choice**: `apps/cli/src/index.ts` keeps importing stable orchestration APIs.
**Alternatives considered**: Move/rename exports freely.
**Rationale**: CLI is the user-facing contract. Internal refactor must not leak.

## Candidate Classification Model

Each candidate gets:

| Field | Meaning |
|-------|---------|
| `path` | File/folder candidate |
| `kind` | `empty-folder`, `unused-export`, `unused-file`, `duplicate-fixture`, `legacy-doc`, `unknown` |
| `evidence` | Independent signals supporting classification |
| `risk` | `low`, `medium`, `high` |
| `decision` | `delete`, `keep`, `refactor`, `needs-human-decision` |
| `rollback` | How to restore if wrong |

## Initial Candidate Inventory

These are candidates from filesystem scan, not deletion approvals:

| Path | Initial kind | Initial risk | Notes |
|------|--------------|--------------|-------|
| `packages/kernel/orchestrator` | empty-folder | low | legacy mirror of `src/orchestrator`; verify docs/package refs first |
| `packages/kernel/task-router` | empty-folder | low | legacy mirror of `src/task-router`; verify refs first |
| `packages/kernel/precedence-engine` | empty-folder | low | no source found; verify refs first |
| `packages/kernel/src/precedence-engine` | empty-folder | low | no source found; verify planned specs/docs first |
| `packages/runtime/tool-runner` | empty-folder | low | runtime package appears mostly empty; verify package intent |
| `packages/runtime/src/tool-runner` | empty-folder | low | same as above |
| `packages/shared/ports` | empty-folder | medium | legacy mirror of `src/ports`; path may appear in docs |
| `packages/shared/types` | empty-folder | medium | legacy mirror of `src/types`; path may appear in docs |
| `packages/skills/registry` | empty-folder | low | verify future registry intent |
| `packages/skills/personas/caveman` | empty-folder | low | legacy mirror of `src/personas/caveman` |
| `packages/skills/personas/devils-advocate` | empty-folder | low | legacy mirror of `src/personas/devils-advocate` |
| `packages/skills/src/registry` | empty-folder | low | verify future registry intent |

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `openspec/changes/orchestrator-dead-code-refactor/exploration.md` | Create | Current-state exploration and candidate scan |
| `openspec/changes/orchestrator-dead-code-refactor/proposal.md` | Create | Scope and approval model |
| `openspec/changes/orchestrator-dead-code-refactor/specs/orchestrator-dead-code-refactor/spec.md` | Create | Delta requirements |
| `openspec/changes/orchestrator-dead-code-refactor/design.md` | Create | Technical design and classification model |
| `openspec/changes/orchestrator-dead-code-refactor/tasks.md` | Create | Implementation plan |
| `openspec/changes/orchestrator-dead-code-refactor/verification-plan.md` | Create | Verification commands and gates |
| `openspec/changes/orchestrator-dead-code-refactor/acceptance-criteria.md` | Create | Acceptance criteria |
| `openspec/changes/orchestrator-dead-code-refactor/dead-code-inventory.md` | Create during apply | Evidence table populated by implementation |
| `packages/kernel/src/orchestrator/index.ts` | Optional modify | Split only after inventory and approval |
| Empty candidate folders | Optional delete | Delete only after evidence and approval |

## Interfaces / Contracts

No public runtime interface changes in the first implementation slice.

Existing exports to preserve:

- `getProviderStatuses()`
- `orchestrateTask(prompt, forcedProvider?)`
- `orchestrateAgenticTask(prompt, phase?, sddId?)`
- `ProviderUnavailableError`

## Data Flow

```text
Filesystem scan
  -> candidate inventory
  -> reference cross-check
  -> risk classification
  -> human approval gate
  -> cleanup/refactor batch
  -> tests/typecheck/smoke
  -> cleanup report
```

## Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| False-positive deletion | Require multiple evidence signals and approval |
| Breaking CLI imports | Preserve public exports and run CLI smoke tests |
| Breaking provider delegation | Run delegate/adapter/gate tests |
| TypeScript blocker hides dead-code signal | Treat current `baseUrl` error as pre-existing until separately fixed |
| Review too large | Split inventory and deletion/refactor into separate PRs |
