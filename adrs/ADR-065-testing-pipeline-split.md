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
| 2026-04-06 | useCentralizedMouseHandlers split: 1 file (988 lines) -> 4 files (all compliant) |
| 2026-04-06 | UnifiedFrameScheduler split: 1 file (973 lines) -> 4 files (all compliant) |
| 2026-04-06 | HitTester split: 1 file (960 lines) -> 4 files (all compliant) |
| 2026-04-06 | PreviewRenderer split: 1 file (958 lines) -> 3 files (all compliant) |
| 2026-04-06 | MemoryLeakDetector split: 1 file (1132 lines) -> 4 files (all compliant) |
| 2026-04-06 | BundleOptimizer split: 1 file (1061 lines) -> 4 files (all compliant) |
| 2026-04-06 | PerformanceComponents split: 1 file (1016 lines) -> 3 files (all compliant) |
| 2026-04-06 | OverpassApiService split: 1 file (977 lines) -> 3 files (all compliant) |
| 2026-04-06 | AdvancedCharts split: 1 file (973 lines) -> 3 files (all compliant) |
| 2026-04-06 | Phase 3 #13: FloorPlanControlPointPicker split: 1 file (863 lines) -> 3 files (497+167+281) |
| 2026-04-06 | Phase 3 #14: ThemeProvider split: 1 file (859 lines) -> 3 files (301+143+315) |
| 2026-04-06 | Phase 3 #15: AdminBoundariesCacheManager split: 1 file (859 lines) -> 3 files (472+89+172) |
| 2026-04-06 | Phase 3 #16: CitizenDrawingInterface split: 1 file (834 lines) -> 3 files (324+170+130) |
| 2026-04-06 | Phase 3 #17: PerformanceMonitor split: 1 file (791 lines) -> 3 files (277+126+187) |
| 2026-04-06 | Phase 3 #18: EnterprisePerformanceManager split: 1 file (810 lines) -> 3 files (320+38+152) |
| 2026-04-06 | Phase 4 #1: channel-reply-dispatcher split: 1 file (748 lines) -> 3 files (128+425+239) |
| 2026-04-06 | Phase 4 #2: email-inbound-service split: 1 file (724 lines) -> 2 files (432+337) |
| 2026-04-06 | Phase 4 #3: audit.ts split: 1 file (773 lines) -> 3 files (273+304+39 barrel) |
| 2026-04-06 | Phase 4 #4: ApiErrorHandler.ts split: 1 file (723 lines) -> 3 files (95+162+425) |
| 2026-04-06 | Phase 4 #5: EnterpriseUserPreferencesService split: 1 file (735 lines) -> 2 files (223+427) |
| 2026-04-06 | Phase 4 #6: OrganizationHierarchyService split: 1 file (736 lines) -> 2 files (331+307) |
| 2026-04-07 | Phase 4 #7: EnterprisePolygonStyleService split: 1 file (704 lines) -> 2 files (283+416) |
| 2026-04-07 | Phase 4 #8: EnterpriseLayerStyleService split: 1 file (701 lines) -> 2 files (250+492) |
| 2026-04-07 | Phase 4 #9: dxf-entity-converters split: 1 file (770 lines) -> 2 files (389+300) |
| 2026-04-07 | Phase 4 #10: dxf-entity-parser split: 1 file (756 lines) -> 3 files (156+257+227) |
| 2026-04-07 | Phase 4 #11: AccordionSection split: 1 file (755 lines) -> 3 files (118+188+301) |
| 2026-04-07 | Phase 4 #12: BaseEntityRenderer split: 1 file (732 lines) -> 2 files (471+344) — arc/angle + distance text helpers |
| 2026-04-07 | Phase 4 #13: useCanvasMouse split: 1 file (728 lines) -> 3 files (459+194+178) — types + drag handlers |
| 2026-04-07 | Phase 4 #14: migrationRegistry split: 1 file (725 lines) -> 2 files (441+189) — migration transformation helpers with shared applyToAllLevels |
| 2026-04-07 | Phase 4 #15: TextSettings split: 1 file (701 lines) -> 2 files (485+259) — icons, constants, sub-components, FactoryResetModal |
| 2026-04-07 | Phase 4 #16: hardcoded-values-migration split: 1 file (777 lines) -> 3 files (172+321+254) — types+data, operations, orchestrator |
| 2026-04-07 | Phase 4 #17: SecurityCompliance split: 1 file (766 lines) -> 3 files (187+117+412) — types, mock data, main class |
| 2026-04-07 | Phase 4 #18: AdminBoundariesPerformanceAnalytics split: 1 file (763 lines) -> 3 files (146+163+394) — types, calculators, main class |
| 2026-04-07 | Phase 4 #19: GeometrySimplificationEngine split: 1 file (742 lines) -> 2 files (172+331) — DP algorithm+LOD+types, main engine |
| 2026-04-07 | Phase 4 #20: invoice-pdf-template split: 1 file (709 lines) -> 3 files (166+344+99) — constants, section renderers, main render |
| 2026-04-07 | Phase 5 #1: AnalyticsBridge split: 1 file (696 lines) -> 3 files (118+136+446) — types, monitoring (DI), core class+hook |
| 2026-04-07 | Phase 5 #2: admin-guards split: 1 file (682 lines) -> 3 files (131+108+414) — types+constants, page auth, API auth+audit |
| 2026-04-07 | Phase 5 #3: EnterpriseTwoFactorService split: 1 file (678 lines) -> 2 files (254+446) — backup+sign-in helpers, main service |
| 2026-04-07 | Phase 5 #4: ContactNameResolver split: 1 file (656 lines) -> 3 files (144+168+308) — types+extractors, mapper, resolver class |
| 2026-04-07 | Phase 5 #5: EnterpriseFileSystemService split: 1 file (655 lines) -> 3 files (83+185+339) — types, fallback config, core service |
| 2026-04-07 | Phase 5 #6: ai-reply-generator split: 1 file (655 lines) -> 3 files (230+149+257) — prompts+types, OpenAI API layer, public functions |
| 2026-04-07 | Phase 5 #7: constraints/utils split: 1 file (696 lines) -> 3 files (156+228+250) — geometry, ortho+polar, application+validation |
| 2026-04-07 | Phase 5 #8: LayerCanvas split: 1 file (697 lines) -> 2 files (370+295) — hit test + rendering hooks extracted to layer-canvas-hooks.ts |
| 2026-04-07 | Phase 5 #9: bounds split: 1 file (689 lines) -> 2 files (352+347) — entity bounds + normalization extracted to bounds-entity.ts |
| 2026-04-07 | Phase 5 #10: geometry-rendering-utils split: 1 file (681 lines) -> 2 files (280+219) — pure math extracted to geometry-vector-utils.ts |
| 2026-04-07 | Phase 5 #11: DxfCanvas split: 1 file (675 lines) -> 2 files (330+223) — renderScene + RAF extracted to dxf-canvas-renderer.ts |
| 2026-04-07 | Phase 5 #12: RulersGridSystem split: 1 file (668 lines) -> 2 files (465+205) — state init + operations extracted to rulers-grid-state-init.ts |
| 2026-04-07 | Phase 5 #13: toolbars/utils split: 1 file (663 lines) -> 2 files (360+247) — runner+customization+hotkey+hooks extracted to toolbars-extended-utils.ts |
| 2026-04-07 | Phase 5 #14: FormatterRegistry split: 1 file (659 lines) -> 2 files (224+179) — unit-specific formatters extracted to formatter-unit-formats.ts |
| 2026-04-07 | Phase 5 #15: EntitiesSettings split: 1 file (656 lines) -> 2 files (461+185) — tool settings panel extracted to EntitiesToolSettings.tsx |
| 2026-04-07 | Phase 5 #16: guide-store split: 1 file (649 lines) -> 2 files (461+235) — group+batch ops as pure functions to guide-store-group-ops.ts |
| 2026-04-07 | Phase 5 #17: ProductTour split: 1 file (701 lines) -> 3 files (233+342+28) — SpotlightOverlay+TourTooltip to product-tour-overlay.tsx, constants to product-tour-constants.ts |
| 2026-04-07 | Phase 5 #18: ImageParser split: 1 file (649 lines) -> 2 files (298+208) — contact photo compression to image-parser-compression.ts |
| 2026-04-07 | Phase 5 #19: ProfessionalDrawingInterface split: 1 file (649 lines) -> 2 files (302+143) — monitoring dashboard to professional-drawing-dashboard.tsx |
| 2026-04-07 | Phase 5 #20: useMessageReactions split: 1 file (642 lines) -> 2 files (294+119) — types+helpers to message-reactions-types.ts |
| 2026-04-07 | Phase 6 #1: query-middleware split: 1 file (641 lines) -> 2 files (386+160) — types+errors to query-middleware-types.ts |
| 2026-04-07 | Phase 6 #2: firebaseAdmin split: 1 file (603 lines) -> 3 files (232+264+60) — credential chain + types extracted |
| 2026-04-07 | Phase 6 #3: pipeline-queue-service split: 1 file (598 lines) -> 2 files (447+183) — operator inbox to pipeline-queue-operator.ts |
| 2026-04-07 | Phase 6 #4: esco.service split: 1 file (595 lines) -> 2 files (430+236) — skills to esco-skill.service.ts |
| 2026-04-07 | Phase 6 #5: admin-update-contact-module split: 1 file (586 lines) -> 2 files (411+202) — helpers extracted |
| 2026-04-07 | Phase 6 #6: entity-linking audit.ts split: 1 file (581 lines) -> 2 files (476+102) — types to audit-types.ts |
| 2026-04-07 | Phase 6 #7: executor-shared split: 1 file (581 lines) -> 2 files (436+156) — types+constants to executor-shared-types.ts |
| 2026-04-07 | Phase 6 #8: analytics-service split: 1 file (574 lines) -> 2 files (471+79) — types to analytics-types.ts |
| 2026-04-07 | Phase 6 #9: RelationshipQueryBuilder split: 1 file (571 lines) -> 3 files (385+52+50) — types+factories extracted |
| 2026-04-07 | Phase 6 #10: platform-config split: 1 file (633 lines) -> 3 files (473+64+65) — icons+utils+types extracted |
| 2026-04-07 | Phase 7 #1: LinkedSpacesCard split: 1 file (601 lines) -> 2 files (371+168) — data fetching to useLinkedSpacesData hook |
| 2026-04-07 | Phase 7 #2: alert-service split: 1 file (616 lines) -> 2 files (339+301) — alert senders+builders to alert-senders.ts |
| 2026-04-07 | Phase 7 #3: aws-provider split: 1 file (575 lines) -> 2 files (364+239) — pricing tiers to aws-pricing-tiers.ts |
| 2026-04-07 | Phase 7 #4: TechnicalDrawingInterface split: 1 file (560 lines) -> 2 files (355+211) — alert config panel to TechnicalAlertConfigPanel.tsx |
| 2026-04-07 | **🏆 100% N.7.1 COMPLIANCE — ZERO non-exempt code files >500 lines across entire codebase** |

## BaseEntityRenderer Split

`BaseEntityRenderer.ts` contained 732 lines — 1.5x over the 500-line limit. Abstract base class mixing core rendering framework, distance text positioning/rendering, and arc/angle geometry in a single file.

Split into 2 files in `src/subapps/dxf-viewer/rendering/entities/`:

| File | Content | Lines |
|------|---------|-------|
| `base-entity-rendering-helpers.ts` | `BaseRenderingContext` interface, 13 standalone functions for distance text + arc/angle rendering | 344 |
| `BaseEntityRenderer.ts` | Core class: constructor, grips, style/phase management, thin delegation wrappers | 471 |

**Pattern**: Delegation via `BaseRenderingContext` — helper functions receive `{ctx, transform, worldToScreen, phaseManager, applyAngleMeasurementTextStyle, applyDistanceTextStyle}` instead of `this`. Class methods become 1-line wrappers. 14 subclasses unchanged (still call `this.renderAngleAtVertex()` etc.).

## useCanvasMouse Split

`useCanvasMouse.ts` contained 728 lines — 1.5x over the 500-line limit. Hook mixing 10+ type definitions, mouse event handlers, and complex drag-end logic.

Split into 3 files in `src/subapps/dxf-viewer/hooks/canvas/`:

| File | Content | Lines |
|------|---------|-------|
| `canvas-mouse-types.ts` | 10 interfaces (VertexHoverInfo, DraggingVertexState, UseCanvasMouseProps, etc.) | 194 |
| `canvas-mouse-drag-handlers.ts` | 3 async drag-end handlers (vertex, edge-midpoint, overlay body) with `DragEndContext` | 178 |
| `useCanvasMouse.ts` | Hook: state, refs, mousemove/enter/leave handlers, thin mouseUp wrapper + re-exports | 459 |

Consumer Impact: All types re-exported from main file — zero import path changes.

## migrationRegistry Split

`migrationRegistry.ts` contained 725 lines — 1.5x over the 500-line limit. Registry mixing migration entries with 7 property transformation helper functions sharing identical structure.

Split into 2 files in `src/subapps/dxf-viewer/settings/io/`:

| File | Content | Lines |
|------|---------|-------|
| `migration-helpers.ts` | 7 exported helpers (fix/revert Line/Text/Grip + renameField) with shared `applyToAllLevels` DRY utility | 189 |
| `migrationRegistry.ts` | Migration entries (v1→v5), migrateToVersion, needsMigration, rollback, validate | 441 |

**Bonus**: Introduced `applyToAllLevels()` shared utility — eliminated ~130 lines of duplicated `Object.fromEntries(Object.entries(...).map(...))` pattern across 6 functions.

## TextSettings Split

`TextSettings.tsx` contained 701 lines — 1.4x over the 500-line limit. Component mixing SVG icons, font constants, 2 sub-components (TextStyleButtons, ScriptStyleButtons), and a factory reset modal.

Split into 2 files in `src/subapps/dxf-viewer/ui/components/dxf-settings/settings/core/`:

| File | Content | Lines |
|------|---------|-------|
| `text-settings-helpers.tsx` | 4 SVG icons, FREE_FONTS/FONT_SIZE_OPTIONS constants, TextStyleButtons, ScriptStyleButtons, FactoryResetModal | 259 |
| `TextSettings.tsx` | Main component: hooks, handlers, 4 accordion sections, conditional wrapper | 485 |

Consumer Impact: Zero — all extracted items are internal to TextSettings.

## useCentralizedMouseHandlers Split

`useCentralizedMouseHandlers.ts` contained 988 lines — 2x over the 500-line limit. Single hook mixing types/interfaces, mouse move tracking (snap detection, hover, pan), mouse up processing (grip release, marquee selection, point-click pipeline), and wheel zoom.

Split into 4 files in `src/subapps/dxf-viewer/systems/cursor/`:

| File | Content | Lines |
|------|---------|-------|
| `mouse-handler-types.ts` | Interfaces, types (SnapResultItem, ZoomConstraints, Props, Refs, SnapAPI) | 84 |
| `mouse-handler-move.ts` | handleMouseMove factory: position tracking, snap detection, hover, pan | 235 |
| `mouse-handler-up.ts` | handleMouseUp factory: grip release, drawing clicks, marquee, point-click | 258 |
| `useCentralizedMouseHandlers.ts` | Main hook: setup, mouseDown, mouseLeave, wheel, orchestration | 262 |

Consumer Impact: 2 consumers (DxfCanvas.tsx, LayerCanvas.tsx) — zero import path changes (re-exports types).

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

## Phase 6 Splits (2026-04-07) — HIGH PRIORITY #1–#10

### #1 query-middleware.ts (641→386+160)
Split: types/errors → `query-middleware-types.ts`. 1 consumer (re-exports errors). Zero risk.

### #2 firebaseAdmin.ts (603→232+264+60)
Split: credential chain → `firebaseAdmin-credentials.ts`, types/errors → `firebaseAdmin-types.ts`. 50+ consumers, all use named exports — backward compatible via re-exports.

### #3 pipeline-queue-service.ts (598→447+183)
Split: operator inbox ops → `pipeline-queue-operator.ts`. Re-exported from main. All consumers unchanged.

### #4 esco.service.ts (595→430+236)
Split: skill search → `esco-skill.service.ts` (new `EscoSkillService` class). Main `EscoService` delegates via static methods. All consumers unchanged.

### #5 admin-update-contact-module.ts (586→411+202)
Split: field detection, value extraction, contact name parsing → `admin-update-contact-helpers.ts`. Internal module, zero external consumers.

### #6 entity-linking/utils/audit.ts (581→476+102)
Split: types/config → `audit-types.ts`. Re-exported from main. All consumers unchanged.

### #7 executor-shared.ts (581→436+156)
Split: types/constants/whitelists → `executor-shared-types.ts`. Re-exported from main. All consumers unchanged.

### #8 analytics-service.ts (574→471+79)
Split: interfaces → `analytics-types.ts`. Re-exported from main. All consumers unchanged.

### #9 RelationshipQueryBuilder.ts (571→385+52+50)
Split: types → `relationship-query-types.ts`, factory functions → `relationship-query-factories.ts`. Re-exported from main.

### #10 platform-config.tsx (633→473+64+65)
Split: SVG icons → `platform-icons.tsx`, utility functions → `platform-utils.ts`, types → `platform-config-types.ts`. Re-exported from main.

---

## Phase 7 — FINAL 4 files >500 lines (2026-04-07)

**Result: 100% N.7.1 compliance — ZERO non-exempt code files >500 lines**

### #1 LinkedSpacesCard.tsx (601→371+168)
Split: data fetching effects (parking/storage/occupied) → `useLinkedSpacesData.ts` hook. Component uses hook for data loading.

### #2 alert-service.ts (616→339+301)
Split: alert sender functions + description builders → `alert-senders.ts`. AlertService class delegates to extracted functions via dependency injection.

### #3 aws-provider.ts (575→364+239)
Split: pricing tier data (EC2/S3/Network/RDS) → `aws-pricing-tiers.ts`. Provider imports pricing functions.

### #4 TechnicalDrawingInterface.tsx (560→355+211)
Split: automated alerts configuration panel → `TechnicalAlertConfigPanel.tsx`. Parent passes config via props.
