# Proposal — Orchestrator Dead Code Refactor

## Intent

Reduce technical debt in Gru-Orchestrator by identifying unused files, empty legacy folders, stale exports, and dead orchestration paths before any deletion or structural refactor.

The change must make the orchestrator easier to reason about without breaking the CLI, provider delegation, agentic pipeline, or existing SDD contracts.

## Proposal Question Round

Assumptions needing user review:

1. The first slice is audit and planning, not deletion.
2. Deletions require explicit approval after evidence is produced.
3. `vendor/`, `node_modules/`, `runs/`, and generated artifacts are excluded unless separately approved.
4. Refactoring `packages/kernel/src/orchestrator/index.ts` is allowed only when tests prove no behavior change.

Questions:

- Do you want the first implementation to only produce a dead-code inventory, or also delete low-risk empty folders?
- Should the orchestrator file be split in this change, or should dead-code cleanup happen first and refactor later?
- Are compatibility placeholders allowed, or should empty legacy folders be removed when unused?

## Scope

### In Scope

- Create a repeatable dead-code inventory for orchestrator-related packages.
- Classify candidates as `delete`, `keep`, `refactor`, or `needs-human-decision`.
- Verify candidates against imports, exports, package manifests, tsconfig paths, scripts, tests, docs, and config files.
- Remove only low-risk proven-dead files/folders after approval.
- Optionally split `packages/kernel/src/orchestrator/index.ts` into smaller modules if inventory proves the seam is safe.
- Update tests/docs only where needed to preserve behavior and explain cleanup rules.

### Out of Scope

- Changing provider runtime semantics.
- Replacing the task router, delegation layer, or agentic adapter contracts.
- Changing public CLI commands or output intentionally.
- Deleting `vendor/awesome-copilot`, `node_modules`, `runs`, or untracked external assets.
- Large architecture rewrite of Gru.
- Adding heavy dependencies unless approved.

## Capabilities

### New Capabilities

- `orchestrator-dead-code-refactor` — evidence-based inventory and cleanup workflow for unused orchestrator code and files.

### Modified Capabilities

- None initially. If implementation refactors runtime modules, affected capabilities must be added before apply.

## Proposed Workflow

1. Audit repository structure with generated/vendor exclusions.
2. Build a candidate inventory.
3. Cross-check each candidate against static and config references.
4. Mark deletion confidence and risk.
5. Ask human approval for deletion/refactor actions.
6. Apply cleanup in small batches.
7. Run regression gates.
8. Record final removals and kept exceptions.

## Success Criteria

- No file/folder is deleted without evidence and explicit classification.
- CLI behavior stays compatible for `pnpm gru status`, `pnpm gru doctor`, `pnpm gru "<prompt>"`, and agentic mode paths.
- Provider delegation and agentic orchestration SDD contracts remain intact.
- Tests and type checks are green, or pre-existing blockers are documented separately.
- The final report lists deleted, retained, and unresolved candidates.
