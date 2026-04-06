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
| 2026-04-06 | PerformanceProfiler split: 1 file (1663 lines) -> 5 files (all compliant) |
| 2026-04-06 | enterprise-id.service split: 1 file (1663 lines) -> 3 files (all compliant) |
| 2026-04-06 | AdministrativeBoundaryService split: 1 file (1634 lines) -> 4 files (all compliant) |
| 2026-04-06 | geometry-utils split: 1 file (1361 lines) -> 5 files (all compliant) |
| 2026-04-06 | LayerRenderer split: 1 file (1286 lines) -> 4 files (all compliant) |
| 2026-04-06 | EnterpriseTeamsService split: 1 file (1233 lines) -> 3 files (all compliant) |
| 2026-04-06 | CICDPipeline split: 1 file (1224 lines) -> 3 files (all compliant) |
| 2026-04-06 | GeoCanvasContent split: 1 file (1207 lines) -> 3 files (all compliant) |
| 2026-04-06 | DxfViewerContent split: 1 file (1182 lines) -> 3 files (all compliant) |
| 2026-04-06 | photo-upload.service split: 1 file (1083 lines) -> 3 files (all compliant) |
| 2026-04-06 | EnterpriseNotificationService split: 1 file (1023 lines) -> 3 files (all compliant) |
| 2026-04-06 | file-record.service split: 1 file (1002 lines) -> 3 files (all compliant) |
| 2026-04-06 | EnterpriseBusinessRulesService split: 1 file (996 lines) -> 3 files (all compliant) |
| 2026-04-06 | EnterpriseSecurityService split: 1 file (988 lines) -> 3 files (all compliant) |
| 2026-04-06 | email-queue-service split: 1 file (962 lines) -> 3 files (all compliant) |
| 2026-04-06 | LineSettings split: 1 file (992 lines) -> 4 files (all compliant) |

## LineSettings Split

`LineSettings.tsx` contained 992 lines — 2x over the 500-line limit. React component mixing SVG icons, context-aware hook selection, handler logic, 5 accordion sections, and factory reset modal in a single file.

Split into 4 files in `src/subapps/dxf-viewer/ui/components/dxf-settings/settings/core/`:

| File | Content | Lines | Exempt? |
|------|---------|-------|---------|
| `line-settings-icons.tsx` | 5 SVG icon components | 35 | Yes (presentational) |
| `useLineSettingsState.ts` | Custom hook: context selection, handlers, options, accordion state | 306 | No |
| `LineSettingsSections.tsx` | 5 accordion section components + FactoryResetModal + RangeWithNumber | 499 | No |
| `LineSettings.tsx` | Main orchestrator: header, enabled toggle, wrapper, section assembly | 144 | No |

Consumer Impact: 2 consumers (LinesTab.tsx, SubTabRenderer.tsx) — zero import path changes.

## email-queue-service Split

`email-queue-service.ts` contained 962 lines — 1.9x over the 500-line limit. Service mixing attachment serialization, worker claim/process logic, status updates, and monitoring stats.

Split into 3 files in `src/services/communications/inbound/`:

| File | Content | Lines |
|------|---------|-------|
| `email-queue-attachments.ts` | Serialize/deserialize attachments, deferred Mailgun fetch | 248 |
| `email-queue-worker.ts` | Claim, process, status updates, stale recovery | 412 |
| `email-queue-service.ts` | Enqueue (fast path), stats, monitoring + re-exports | 252 |

Consumer Impact: 1 consumer (barrel index) — zero import path changes (re-exports worker functions).

## EnterpriseSecurityService Split

`EnterpriseSecurityService.ts` contained 988 lines — 2x over the 500-line limit. Service mixing types/interfaces, fallback security data, and DB-driven role/policy management.

Split into 3 files in `src/services/security/`:

| File | Content | Lines | Exempt? |
|------|---------|-------|---------|
| `security-types.ts` | 7 interfaces, cache types | 209 | Yes (types-only) |
| `security-defaults.ts` | Default roles, email policies, country policies | 230 | Yes (config/data) |
| `EnterpriseSecurityService.ts` | Service class: cache, DB ops, validation | 397 | No |

Consumer Impact: 1 consumer (UserRoleContext.tsx) — zero import path changes.

## EnterpriseBusinessRulesService Split

`EnterpriseBusinessRulesService.ts` contained 996 lines — 2x over the 500-line limit. Service mixing types, default config factories, centralized data converters, and DB-driven business rules logic. Also contained 155 lines of commented-out dead code (removed).

Split into 3 files in `src/services/business/`:

| File | Content | Lines | Exempt? |
|------|---------|-------|---------|
| `business-rules-types.ts` | 6 interfaces, 3 raw data types, cache types | 199 | Yes (types-only) |
| `business-rules-defaults.ts` | Centralized data converters, default config factory | 138 | Yes (config/data) |
| `EnterpriseBusinessRulesService.ts` | Service class: cache, DB ops, validation | 374 | No |

Consumer Impact: 3 consumers — zero import path changes (re-exports types via `export type *`).

## file-record.service Split

`file-record.service.ts` contained 1002 lines — 2x over the 500-line limit. Production service mixing CRUD operations, trash lifecycle, entity linking, rename, and utility queries.

Split into 3 files in `src/services/`:

| File | Content | Lines |
|------|---------|-------|
| `file-record-lifecycle.ts` | Trash system (moveToTrash, restore, purge, hold) | 290 |
| `file-record-links.ts` | Entity linking, rename, description, findByHash | 246 |
| `file-record.service.ts` | Core class (create, finalize, read, query) + static delegates | 448 |

Consumer Impact: 12 consumers — zero import path changes. Class delegates static methods to extracted functions.

## EnterpriseNotificationService Split

`EnterpriseNotificationService.ts` contained 1023 lines — 2x over the 500-line limit. Production service mixing types/interfaces, static fallback data, and DB-driven configuration logic.

Split into 3 files in `src/services/notification/`:

| File | Content | Lines | Exempt? |
|------|---------|-------|---------|
| `notification-types.ts` | 8 interfaces, 2 type aliases | 194 | Yes (types-only) |
| `notification-defaults.ts` | Fallback priorities, channels, mappings, retry/rate/processing configs | 263 | Yes (config/data) |
| `EnterpriseNotificationService.ts` | Service class: DB operations, caching, helpers, singleton | 476 | No |

Consumer Impact: 1 consumer (NotificationDispatchEngine.ts) — zero import path changes (main file re-exports types via `export type *`).

## photo-upload.service Split

`photo-upload.service.ts` contained 1083 lines — 2.2x over the 500-line limit. Production service mixing legacy pipeline (retry/fallback), canonical pipeline, delete methods, types, and utilities.

Split into 3 files in `src/services/`:

| File | Content | Lines | Exempt? |
|------|---------|-------|---------|
| `photo-upload-types.ts` | Interfaces, loggers, utility functions | 124 | Yes (types/config) |
| `photo-upload-legacy-pipeline.ts` | Legacy upload with compression, retry, server fallback | 386 | No |
| `photo-upload.service.ts` | PhotoUploadService class: routing, canonical pipeline, delete methods | 462 | No |

Consumer Impact: 9 consumers — zero import path changes (main file re-exports types, class keeps same name).

## DxfViewerContent Split

`DxfViewerContent.tsx` contained 1182 lines — 2.4x over the 500-line limit. It's a monolith UI component mixing 17+ useEffect blocks, 9+ useCallback handlers, and JSX rendering.

Split into 3 files in `src/subapps/dxf-viewer/app/`:

| File | Content | Lines | Exempt? |
|------|---------|-------|---------|
| `useDxfViewerCallbacks.ts` | 9 useCallback/useMemo definitions + SVG origin indicator helper | 398 | No |
| `useDxfViewerEffects.ts` | 17 useEffect blocks (event bus, sync, init, keyboard shortcuts) | 409 | No |
| `DxfViewerContent.tsx` | Main orchestrator: hook calls, state init, JSX rendering | 400 | No |

Consumer Impact: Only 1 consumer (`DxfViewerApp.tsx`) — no import path changes needed (main file keeps same name, re-exports).

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

## PerformanceProfiler Split

`PerformanceProfiler.ts` contained 1663 lines — 3.3x over the 500-line limit. **Actively used** by index.ts and testing-pipeline-tasks.ts.

Split into 5 files in `src/subapps/geo-canvas/profiling/`:

| File | Content | Lines | Exempt? |
|------|---------|-------|---------|
| `performance-profiler-types.ts` | 20+ interfaces/types (browser APIs, metrics, analysis, config) | 366 | Yes (types-only) |
| `performance-profiler-collectors.ts` | Metric initializers, entry processors, browser/session metadata | 414 | No |
| `performance-profiler-analysis.ts` | Bottleneck detection, recommendations, scoring, trends | 220 | No |
| `performance-profiler-reporting.ts` | Export formats (Chrome DevTools, Flame Graph) + HTML report | 171 | No |
| `PerformanceProfiler.ts` | Main class: singleton, session mgmt, monitoring loops, trace, public API | 400 | No |

Consumer Impact: Main file keeps same name and re-exports all types — zero import path changes needed.

## enterprise-id.service Split

`enterprise-id.service.ts` contained 1663 lines — 3.3x over the 500-line limit. **Most consumed file in codebase** (165 consumers).

Split into 3 files in `src/services/`:

| File | Content | Lines | Exempt? |
|------|---------|-------|---------|
| `enterprise-id-prefixes.ts` | ENTERPRISE_ID_PREFIXES const + types/interfaces | 199 | Yes (config/data) |
| `enterprise-id-convenience.ts` | 100+ convenience export functions (named generators) | 170 | No |
| `enterprise-id.service.ts` | EnterpriseIdService class (compact 1-line generators) + singleton + re-exports | 349 | No |

Key refactoring: 90+ verbose generator methods (5-7 lines each with JSDoc) compressed to 1-line compact format using `P` alias for `ENTERPRISE_ID_PREFIXES`.

Consumer Impact: Main file re-exports all names from prefixes + convenience — **zero consumer changes** across 165 files.

## AdministrativeBoundaryService Split

`AdministrativeBoundaryService.ts` contained 1634 lines — 3.3x over the 500-line limit. **2 consumers** (SpatialQueryService, useAdministrativeBoundaries).

Split into 4 files in `src/subapps/geo-canvas/services/administrative-boundaries/`:

| File | Content | Lines | Exempt? |
|------|---------|-------|---------|
| `admin-boundary-utils.ts` | Search normalization, type detection, geometry ops, fuzzy matching | 234 | No |
| `admin-boundary-suggestions.ts` | Suggestion engine: basic, enhanced, postal, location-based | 320 | No |
| `admin-boundary-filters.ts` | Advanced filters, spatial filtering, scoring, TTL, simplification stats | 196 | No |
| `AdministrativeBoundaryService.ts` | Main class: search orchestration, boundary cache, simplification | 356 | No |

Key refactoring: 7 identical boundary-fetch-cache patterns extracted to single `getCachedBoundary<T>()` generic helper (DRY).

Consumer Impact: Main file keeps same name and exports — **zero consumer changes**.

## geometry-utils Split

`geometry-utils.ts` contained 1361 lines — 2.7x over the 500-line limit. **94 consumers** — most consumed file in dxf-viewer shared utilities.

Split into 5 files in `src/subapps/dxf-viewer/rendering/entities/shared/`:

| File | Content | Lines | Exempt? |
|------|---------|-------|---------|
| `geometry-angle-utils.ts` | Angle conversion, normalization, constants (RIGHT_ANGLE, ARROW_ANGLE), text rotation utilities | 278 | No |
| `geometry-circle-utils.ts` | 5 circle constructors (best-fit, 3-point, chord-sagitta, 2P+radius, TTT) + line intersection | 442 | No |
| `geometry-arc-utils.ts` | 5 arc functions (3-point, center-start-end, arc length, angle-between) | 165 | No |
| `geometry-polyline-utils.ts` | Polyline/polygon calculations (length, perimeter, area, centroid, Ramer-Douglas-Peucker) | 194 | No |
| `geometry-utils.ts` | Core: distance, nearest point, bounding box, line construction (perp/parallel), clamp, lerp + re-exports ALL | 346 | No |

Key design decisions:
- `lineIntersectionExtended` moved to circle-utils (only consumer: `circleTangentTo3Lines`)
- `simplifyPolyline` uses local `pointToSegmentDistance` helper to avoid circular dependency with main
- `angleBetweenPoints` uses inline `Math.max(-1, Math.min(1, ...))` instead of importing `clamp` to avoid circular dependency

Consumer Impact: Main file re-exports everything via `export * from './geometry-*-utils'` — **zero consumer changes** across 94 files.

## LayerRenderer Split

`LayerRenderer.ts` contained 1286 lines — 2.6x over the 500-line limit. **1 consumer** (LayerCanvas.tsx).

Split into 4 files in `src/subapps/dxf-viewer/canvas-v2/layer-canvas/`:

| File | Content | Lines | Exempt? |
|------|---------|-------|---------|
| `layer-polygon-renderer.ts` | Polygon shape rendering + vertex grips + edge midpoint grips + draft partial | 398 | No |
| `layer-grid-ruler-renderer.ts` | Grid rendering + deprecated ruler rendering (horizontal + vertical) | 263 | No |
| `layer-ui-settings.ts` | UI settings map factory for centralized rendering system | 103 | No |
| `LayerRenderer.ts` | Main class: constructor, render orchestration, hitTest, delegates to modules | 414 | No |

Key design decisions:
- Private class methods extracted as standalone exported functions receiving `ctx` + params
- `renderPolygonToCanvas` uses `PolygonRenderParams` interface to avoid 8+ individual arguments
- Grip rendering split into `renderVertexGrips` and `renderEdgeMidpointGrips` private helpers within polygon module
- `worldToScreenFn` passed as callback to avoid circular dependency with main class

Consumer Impact: Main file keeps same class name and public API — **zero consumer changes**.

## EnterpriseTeamsService Split

`EnterpriseTeamsService.ts` contained 1233 lines — 2.5x over the 500-line limit. **1 consumer** (crm/teams/page.tsx).

Split into 3 files in `src/services/teams/`:

| File | Content | Lines | Exempt? |
|------|---------|-------|---------|
| `enterprise-teams-types.ts` | 15+ interfaces, 6 type aliases (GDPR, multi-tenant, RBAC) | 317 | Yes (types-only) |
| `enterprise-teams-defaults.ts` | 10 fallback/default factory functions (teams, members, positions, orgChart, config, permissions, display, compliance, features) | 289 | Yes (config/data) |
| `EnterpriseTeamsService.ts` | Main class: singleton, Firebase connection, CRUD ops, multi-level cache, re-exports | 473 | No |

Key refactoring: 10 private methods converted to standalone exported factory functions with `create*` naming convention. Main class delegates to imported functions. `baseTeam` DRY pattern eliminates repeated team object boilerplate.

Consumer Impact: Main file re-exports all from types + defaults — **zero consumer changes**.

## CICDPipeline Split

`CICDPipeline.ts` contained 1224 lines — 2.4x over the 500-line limit. **0 consumers** (not imported anywhere).

Split into 3 files in `src/subapps/geo-canvas/automation/`:

| File | Content | Lines | Exempt? |
|------|---------|-------|---------|
| `cicd-pipeline-types.ts` | 30+ interfaces, PipelineStatus type alias | 338 | Yes (types-only) |
| `cicd-pipeline-config.ts` | `createDefaultPipelineConfiguration()` factory — 7 stages, security, monitoring, deployment | 213 | Yes (config/data) |
| `CICDPipeline.ts` | Main class: singleton, pipeline execution, deployment, monitoring, rollback | 388 | No |

Key refactoring: 400-line `getDefaultPipelineConfiguration()` private method extracted as standalone factory. Config data compacted with inline object literals.

Consumer Impact: No consumers — **zero risk**.

## GeoCanvasContent Split

`GeoCanvasContent.tsx` contained 1207 lines — 2.4x over the 500-line limit. **1 consumer** (GeoCanvasApp.tsx). React UI component.

Split into 3 files in `src/subapps/geo-canvas/app/`:

| File | Content | Lines | Exempt? |
|------|---------|-------|---------|
| `useBoundaryLayers.ts` | Custom hook: boundary layer state + 8 handlers + types | 230 | No |
| `GeoCanvasPanels.tsx` | `SystemStatusPanel` + `FoundationView` sub-components | 202 | No |
| `GeoCanvasContent.tsx` | Main component: hooks orchestration, map layout, mobile sheets | 325 | No |

Key refactoring: 8 boundary handlers + state extracted to custom hook `useBoundaryLayers(mapRef)`. Sidebar content and foundation view extracted as presentational components. DRY `syncAdministrativeBoundaries` helper eliminates 4x duplicate sync code.

Consumer Impact: Main file keeps same named export + default export — **zero consumer changes**.
