# Exploration — Orchestrator Dead Code Refactor

## Current State

Gru-Orchestrator is a TypeScript pnpm monorepo. The runtime entrypoint is `apps/cli/src/index.ts`, which imports orchestration functions from `packages/kernel/src/orchestrator/index.ts`.

The current orchestrator concentrates several responsibilities in one file:

- provider construction and availability checks;
- `.gru/config.yaml` and `.gru/providers.yaml` loading;
- simple task routing/execution;
- run logging into `runs/`;
- agentic execution pipeline;
- review/test evidence normalization;
- gate evaluation.

There are also legacy-looking empty folders outside `src/` and in some package roots. These are not proven dead yet. They are candidates only.

## Affected Areas

- `packages/kernel/src/orchestrator/index.ts` — main orchestration implementation and likely refactor target.
- `apps/cli/src/index.ts` — CLI imports orchestration APIs and must remain behavior-compatible.
- `packages/kernel/src/task-router/index.ts` — routing contract used by simple orchestration.
- `packages/kernel/src/adapters/*` — agentic provider pipeline used by `orchestrateAgenticTask`.
- `packages/kernel/src/delegates/*` — delegation layer from existing SDD; may overlap with provider orchestration cleanup.
- `packages/shared/src/ports/*` — public contracts used across packages.
- `packages/providers/*/src/index.ts` — provider implementations consumed by orchestrator/delegates.
- `tests/*` and `packages/kernel/src/**/__tests__/*` — regression coverage for router, providers, gates, adapters.
- Empty candidate folders: `packages/kernel/orchestrator`, `packages/kernel/task-router`, `packages/kernel/precedence-engine`, `packages/kernel/src/precedence-engine`, `packages/runtime/tool-runner`, `packages/runtime/src/tool-runner`, `packages/shared/ports`, `packages/shared/types`, `packages/skills/registry`, `packages/skills/personas/*`, `packages/skills/src/registry`.

## Evidence From Scan

- `pnpm exec tsc --noEmit` currently fails before type analysis because TypeScript 6 reports deprecated `baseUrl`; add `ignoreDeprecations: "6.0"` or use another analysis path before relying on `tsc` as a dead-code signal.
- `node_modules` exists inside provider package folders; scans must exclude nested `node_modules` to avoid false positives.
- `vendor/awesome-copilot` is untracked in git status and should not be included in deletion/refactor scope unless explicitly approved.
- Existing OpenSpec changes exist for provider delegation and agentic orchestration. This refactor must not break their contracts.

## Approaches

1. **Audit-first cleanup** — build an inventory of references, exports, scripts, package manifests, tests, and docs before deleting anything.
   - Pros: safest, low false-positive risk.
   - Cons: slower, may produce fewer immediate deletions.
   - Complexity: Medium.

2. **Tool-first dead-code detection** — add tools such as `knip` or `ts-prune`, then delete reported files.
   - Pros: faster repeatable signal.
   - Cons: new dependency and false positives for CLI/dynamic paths/config-loaded files.
   - Complexity: Medium.

3. **Manual targeted orchestrator split** — refactor `packages/kernel/src/orchestrator/index.ts` by responsibility, then remove obvious empty/legacy paths.
   - Pros: improves maintainability quickly.
   - Cons: can mix behavior refactor with cleanup and make review harder.
   - Complexity: High.

## Recommendation

Use approach 1 with optional local-only tooling. Do not delete based on a single signal. Require at least two independent proofs before removal:

- no static imports/exports;
- no package/script/tsconfig path reference;
- no runtime/config/documentation reference;
- no tests relying on the path;
- replacement or no behavior impact proven by tests.

Split delivery into two reviewable phases: inventory first, cleanup second.

## Open Questions

- Should generated/runtime folders like `runs/` be documented as ignored artifacts instead of cleanup targets?
- Should empty compatibility folders be deleted, or retained as placeholders with `.gitkeep` and explanation?
- Is the goal only dead files, or also extracting responsibilities from the large orchestrator file?
