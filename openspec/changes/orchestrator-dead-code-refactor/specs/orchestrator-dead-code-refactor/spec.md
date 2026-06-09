# Delta for Orchestrator Dead Code Refactor

## ADDED Requirements

### Requirement: Evidence-Based Dead Code Inventory

The system SHALL provide a documented inventory of orchestrator-related dead-code candidates before deleting or refactoring files.

#### Scenario: Candidate discovery excludes generated/vendor paths

- **Given** the repository contains source, vendor, nested dependency, and runtime output folders
- **When** the inventory is generated
- **Then** it excludes `node_modules/`, nested `node_modules/`, `vendor/`, `runs/`, `dist/`, and other generated artifacts by default
- **And** it reports excluded scopes separately.

#### Scenario: Candidate has multiple evidence signals

- **Given** a file or folder is marked as deletion candidate
- **When** the candidate is classified
- **Then** the classification includes at least two independent evidence signals such as no imports, no exports, no package references, no tsconfig references, no script references, no docs references, or no tests.

#### Scenario: Candidate cannot be proven dead

- **Given** a candidate has dynamic usage, config usage, package export usage, or ambiguous documentation references
- **When** the inventory is reviewed
- **Then** it is classified as `needs-human-decision` or `keep`
- **And** it is not deleted automatically.

### Requirement: Safe Cleanup Approval Gate

The system SHALL require human approval before deleting files, folders, or changing orchestration structure.

#### Scenario: Low-risk empty folder deletion

- **Given** an empty folder is not referenced by package manifests, tsconfig paths, scripts, docs, tests, or config files
- **When** the cleanup plan proposes deletion
- **Then** the plan lists the folder, evidence, and rollback path
- **And** deletion waits for human approval.

#### Scenario: Runtime behavior refactor

- **Given** `packages/kernel/src/orchestrator/index.ts` is split or refactored
- **When** the implementation changes module boundaries
- **Then** exported functions used by `apps/cli/src/index.ts` remain compatible
- **And** behavior changes are either absent or explicitly documented and approved.

### Requirement: Orchestrator Regression Protection

The system SHALL prove that cleanup does not regress simple orchestration, provider status reporting, agentic planning gates, or provider contracts.

#### Scenario: Existing TypeScript blocker

- **Given** TypeScript 6 rejects deprecated `baseUrl` without `ignoreDeprecations`
- **When** verification runs
- **Then** the verifier either fixes the config in a separate approved task or documents the blocker as pre-existing
- **And** does not treat failed type analysis as evidence of dead code.

#### Scenario: CLI smoke commands

- **Given** cleanup has been applied
- **When** smoke verification runs
- **Then** `pnpm gru status` and `pnpm gru doctor` still execute
- **And** failures caused by missing external providers are reported as availability states, not crashes.

#### Scenario: Unit and integration tests

- **Given** cleanup has been applied
- **When** test suites run
- **Then** router, provider-status, delegates, adapters, gates, and persona tests remain green or pre-existing unrelated failures are documented.

### Requirement: Cleanup Report

The system SHALL produce a final cleanup report after apply/verify.

#### Scenario: Report lists outcomes

- **Given** the cleanup/refactor is complete
- **When** the report is written
- **Then** it lists deleted candidates, retained candidates, unresolved candidates, test evidence, typecheck evidence, and follow-up work.
