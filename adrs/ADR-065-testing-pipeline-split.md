# ADR-065: SRP Refactoring — Geo-Canvas Large File Splits

**Status**: IMPLEMENTED
**Date**: 2026-04-06
**Author**: Claude (Opus 4.6)
**Category**: Geo-Canvas / Code Quality

## Context

`TestingPipeline.ts` contained 1768 lines — 3.5x over the 500-line limit (ADR N.7.1). The file mixed type definitions, static config data, task implementations, and orchestration logic in a single monolith.

## Decision

Split into 4 files in `src/subapps/geo-canvas/automation/`:

| File | Content | Lines | Exempt? |
|------|---------|-------|---------|
| `testing-pipeline-types.ts` | 30+ interfaces, types | 429 | Yes (types-only) |
| `testing-pipeline-config.ts` | `createDefaultPipelineConfig()` factory | 347 | Yes (config/data) |
| `testing-pipeline-tasks.ts` | 11 task execution functions | 253 | No |
| `TestingPipeline.ts` | Main class: orchestration, quality gates, reporting, public API | 490 | No |

## Key Changes

- Types extracted to dedicated file with `export type *` re-export from main
- Config extracted as factory function (was private method)
- Task implementations extracted as standalone functions (were class methods)
- Main class delegates to imported functions via `executeTaskByType` dispatch

## Consumer Impact

Only 1 consumer: `src/subapps/geo-canvas/index.ts` — no import path changes needed (main file keeps same name, re-exports types).

## Changelog

| Date | Change |
|------|--------|
| 2026-04-06 | Initial split: TestingPipeline 1 file (1768 lines) -> 4 files (all compliant) |
| 2026-04-06 | DockerOrchestrator split: 1 file (1761 lines) -> 5 files (all compliant) |
| 2026-04-06 | TestSuite split: 1 file (1949 lines) -> 6 files (all compliant) |

## DockerOrchestrator Split

`DockerOrchestrator.ts` contained 1761 lines — 3.5x over the 500-line limit. Same pattern as TestingPipeline.

Split into 5 files in `src/subapps/geo-canvas/deployment/`:

| File | Content | Lines | Exempt? |
|------|---------|-------|---------|
| `docker-orchestrator-types.ts` | 30+ interfaces, types | 447 | Yes (types-only) |
| `docker-container-configs.ts` | 5 container config factories | 393 | No |
| `docker-infrastructure-configs.ts` | 11 service/ingress/configmap/secret factories | 329 | No |
| `docker-orchestrator-ops.ts` | Deployment, monitoring & utility functions | 246 | No |
| `DockerOrchestrator.ts` | Main class: singleton, orchestration, scaling, public API | 396 | No |

Consumer Impact: File not imported anywhere in codebase — zero risk.

## TestSuite Split

`TestSuite.ts` contained 1949 lines — 3.9x over the 500-line limit. **Actively used** by index.ts and testing-pipeline-tasks.ts.

Split into 6 files in `src/subapps/geo-canvas/testing/`:

| File | Content | Lines | Exempt? |
|------|---------|-------|---------|
| `test-suite-types.ts` | 12 interfaces/types | 157 | Yes (types-only) |
| `test-suite-phase2-3-tests.ts` | 8 transformation+mapping tests + helpers | 298 | No |
| `test-suite-phase4-5-tests.ts` | 8 database+alerts tests + helpers | 265 | No |
| `test-suite-phase6-7-e2e-tests.ts` | 14 UI+perf+integration+e2e tests + helpers | 407 | No |
| `test-suite-reporting.ts` | Report generation (console, CSV, HTML) | 201 | No |
| `TestSuite.ts` | Main class: singleton, registration, execution, public API | 333 | No |

Consumer Impact: Main file keeps same name and exports — zero import path changes needed.
