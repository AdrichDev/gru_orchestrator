# Acceptance Criteria — Orchestrator Dead Code Refactor

- [ ] Dead-code inventory exists and excludes generated/vendor scopes.
- [ ] Every deletion candidate has at least two independent evidence signals.
- [ ] Human approval is recorded before any deletion/refactor batch.
- [ ] Empty legacy folders are either deleted with approval or kept with rationale.
- [ ] `apps/cli/src/index.ts` continues to consume stable orchestration exports.
- [ ] Provider delegation and agentic orchestration contracts remain behavior-compatible.
- [ ] `pnpm test` evidence is recorded.
- [ ] `pnpm exec tsc --noEmit` evidence is recorded; TS6 `baseUrl` blocker is handled honestly.
- [ ] CLI smoke evidence is recorded for `pnpm gru status` or `pnpm gru doctor`.
- [ ] Final report lists deleted, retained, unresolved, and follow-up candidates.
