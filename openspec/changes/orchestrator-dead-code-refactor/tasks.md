# Tasks — Orchestrator Dead Code Refactor

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 200–500 for SDD + inventory; 50–250 for first cleanup batch |
| 400-line budget risk | Medium |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 inventory/report → PR 2 low-risk cleanup → PR 3 optional orchestrator split |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: Yes  
Chained PRs recommended: Yes  
Chain strategy: feature-branch-chain  
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Notes |
|------|------|-----------|-------|
| 1 | Build inventory only | PR 1 | No deletion; creates `dead-code-inventory.md` |
| 2 | Delete low-risk empty folders | PR 2 | Requires human approval after inventory |
| 3 | Optional orchestrator module split | PR 3 | Only if desired after cleanup |

## Phase 1: Inventory Foundation

- [x] 1.1 Create `openspec/changes/orchestrator-dead-code-refactor/dead-code-inventory.md` with the classification table.
- [x] 1.2 Enumerate source files excluding `node_modules`, nested provider `node_modules`, `vendor`, `runs`, `dist`, and generated outputs.
- [x] 1.3 List empty folders and legacy mirror folders.
- [x] 1.4 Search references in `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `.gru/`, `.codex/`, `.claude/`, `README.md`, `docs/`, `openspec/`, `apps/`, `packages/`, and `tests/`.
- [x] 1.5 Classify each candidate as `delete`, `keep`, `refactor`, or `needs-human-decision`.

## Phase 2: Verification Baseline

- [x] 2.1 Run `pnpm test` and record baseline.
- [x] 2.2 Run `pnpm exec tsc --noEmit` and record the current TypeScript 6 `baseUrl` blocker if still present.
- [x] 2.3 Run `pnpm gru status` and/or `pnpm gru doctor` as CLI smoke baseline.
- [x] 2.4 Confirm git status and exclude untracked `vendor/awesome-copilot` from scope.

## Phase 3: Human Approval Gate

- [x] 3.1 Present deletion/refactor candidates with evidence and risk.
- [x] 3.2 Ask approval for each delete/refactor batch. — Human approved 10 low-risk; deferred 2 medium.
- [x] 3.3 If approval is denied, mark candidates as `keep` or `defer` with rationale. — `shared/ports` and `shared/types` marked `defer`.

## Phase 4: Low-Risk Cleanup Batch

- [x] 4.1 Delete approved empty folders only. — 9/10 deleted. `packages/skills/personas/caveman` blocked by OS handle; pending manual deletion.
- [x] 4.2 Update docs if they mention removed legacy paths. — No doc references found; no updates needed.
- [x] 4.3 Re-run reference search for removed paths. — Zero references to deleted paths in source/manifests.
- [x] 4.4 Re-run tests and smoke commands. — 83 tests pass. CLI smoke OK. No regression.

## Phase 5: Optional Orchestrator Refactor

- [x] 5.1 Extract config loading from `packages/kernel/src/orchestrator/index.ts` if approved.
- [x] 5.2 Extract simple orchestration execution helpers if approved.
- [x] 5.3 Extract agentic result builders/helpers if approved.
- [x] 5.4 Preserve current public exports from `packages/kernel/src/orchestrator/index.ts`.
- [x] 5.5 Add/adjust tests for extracted seams.

## Phase 6: Final Report

- [x] 6.1 Update `dead-code-inventory.md` with final decisions.
- [x] 6.2 Add verification evidence.
- [x] 6.3 List follow-up items that were not safe to delete.
