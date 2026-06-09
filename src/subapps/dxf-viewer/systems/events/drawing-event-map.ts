/**
 * Drawing Event Map — type-safe event payload definitions for the DXF Viewer EventBus.
 *
 * Extracted from EventBus.ts to keep that file <500 LOC (Google SRP, CLAUDE.md N.7.1).
 * Pure type module: zero runtime logic. EventBus.ts imports `DrawingEventMap` from here.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { AnySceneEntity, SceneModel } from '../../types/scene';
import type { GridGuide, GridGroup } from '../../ai-assistant/grid-types';
import type { OpeningKind } from '../../bim/types/opening-types';
import type { WallEntity, WallKind, WallCategory } from '../../bim/types/wall-types';
import type { OpeningUpdate } from '../../bim/walls/wall-split';

// Event type definitions - centralized and type-safe
export interface DrawingEventMap {
  'dynamic-input-coordinate-submit': {
    tool: string;
    coordinates: Point2D;
    secondPoint?: Point2D;
    length?: number;
    angle?: number;
    action: string;
  };
  'overlay:canvas-click': {
    point: Point2D;
  };
  'level-panel:tool-change': string; // tool name
  'drawing:tool-activated': {
    tool: string;
    previousTool: string;
  };
  'drawing:entity-created': {
    entity: AnySceneEntity;
    tool: string;
  };
  'drawing:cancelled': {
    tool: string;
  };
  // 🏢 ENTERPRISE (2026-01-27): Drawing completion event - ADR-040 Preview Canvas Integration
  // Pattern: Autodesk AutoCAD - Command completion notification
  // Emitted when a drawing operation completes (e.g., 2nd click on line/measure-distance)
  // Consumers (PreviewCanvas) listen to clear preview immediately
  // 🔧 FIX (2026-01-31): Added entity and updatedScene to avoid stale closure issue
  'drawing:complete': {
    tool: string;
    entityId: string;
    entity?: AnySceneEntity; // The created entity
    updatedScene?: SceneModel; // The updated scene with the new entity
    levelId?: string; // The level ID where entity was added
  };
  // 🔧 PHASE 3: Additional events from DxfViewerContent
  'dxf-zoom-changed': {
    transform: {
      scale: number;
      offsetX: number;
      offsetY: number;
    };
  };
  'level-panel:layering-activate': {
    levelId: string;
    source?: string; // 'overlay-click' | 'card' | undefined
  };
  'canvas-fit-to-view': {
    source?: string; // 'middle-double-click' | 'keyboard' | 'auto' | undefined
    viewport?: { width: number; height: number };
  };
  // ADR-394: Fit-to-view to the bounding box of the current selection (Z key).
  // Bounds are pre-computed by useKeyboardShortcuts at keypress time over the
  // selected DXF + BIM entities (calculateCombinedEntityBounds SSoT).
  'canvas-fit-to-view-selected': {
    bounds: { min: Point2D; max: Point2D };
  };
  'canvas-pan': {
    /** Pixel delta to apply to offsetX (positive = right) */
    dx: number;
    /** Pixel delta to apply to offsetY (positive = down) */
    dy: number;
  };
  'canvas:select-all': void;
  'overlay:polygon-update': {
    regionId: string;
    newVertices: Point2D[];
  };
  'dxf.highlightByIds': {
    mode: string;
    ids: string[];
  };
  // 🎯 POLYGON DRAWING EVENTS (2026-01-24): Communication between CanvasSection and DraggableOverlayToolbar
  'overlay:draft-polygon-update': {
    pointCount: number;
    canSave: boolean; // true if >= 3 points
  };
  'overlay:save-polygon': void; // Signal to save the current draft polygon
  'overlay:cancel-polygon': void; // Signal to cancel the current draft polygon
  // 🏢 ADR-258B: Auto-select new overlay after polygon save → opens Properties Panel
  'overlay:polygon-saved': { overlayId: string };
  // 🏢 ENTERPRISE: Polygon save error → centralized notification (replaces browser alert)
  'overlay:save-error': { reason: 'no-level-selected' | 'no-background-context' };
  // 🏢 ENTERPRISE (2026-01-26): Toolbar delete command - ADR-032
  'toolbar:delete': void; // Signal to delete selected grips/overlays with undo support

  // 🏢 ADR-189: Grid & Guide System events (activated when Grid System is implemented)
  'grid:guide-added': { guide: GridGuide };
  'grid:guide-removed': { guideId: string };
  'grid:guide-moved': { guideId: string; newOffset: number };
  'grid:guide-rotated': { guideId: string; angleDeg: number };
  'grid:all-guides-rotated': { angleDeg: number; pivot: { x: number; y: number } };
  'grid:guide-group-rotated': { guideIds: readonly string[]; angleDeg: number; pivot: { x: number; y: number } };
  'grid:guides-equalized': { guideIds: readonly string[]; spacing: number };
  'grid:polar-array-created': { center: { x: number; y: number }; count: number; angleIncrement: number };
  'grid:all-guides-scaled': { origin: { x: number; y: number }; scaleFactor: number };
  'grid:guides-mirrored': { axisGuideId: string; mirrorAxis: 'X' | 'Y'; createdCount: number };
  'grid:guide-from-entity': { entityType: string; createdCount: number };
  'grid:guides-batch-deleted': { count: number };
  'grid:guide-pattern-copied': { sourceCount: number; repetitions: number; offset: number };
  'grid:group-created': { group: GridGroup };
  'grid:snap-toggled': { enabled: boolean };
  // B35: Temporary guides removed on drawing completion
  'grid:temporary-guides-removed': { count: number };
  // B24: Guide offset from entity edge
  'grid:guide-offset-from-entity': { entityType: string; offset: number; createdCount: number };
  // B23: Structural preset grid applied
  'grid:preset-applied': { presetId: string; xCount: number; yCount: number };
  // 🏢 ADR-189 §4.13: Guide panel → canvas highlight communication
  'grid:guide-panel-highlight': { guideId: string | null };
  // 🏢 ADR-189 §4.13: Construction point panel → canvas highlight communication
  'grid:point-panel-highlight': { pointId: string | null };
  // B58: Anomaly detection completed
  'grid:anomaly-detected': { count: number; errors: number; warnings: number };
  // B89: Analytics computed
  'grid:analytics-computed': { totalGuides: number; densityScore: number; complexityScore: number };
  // B93/B95: Compliance check completed
  'grid:compliance-checked': { standard: string; passed: boolean; failCount: number };
  // B60: NLP command parsed
  'grid:nlp-parsed': { input: string; type: 'preset' | 'custom' | 'unknown'; confidence: number };
  // B88: IFC export completed
  'grid:ifc-exported': { axisCount: number; format: 'IFC4' };

  // 🏢 ADR-055: Entity Creation Event Bus Pattern (Enterprise Architecture)
  // Pattern: Autodesk/Bentley - Event-driven entity creation with Command History integration
  // useUnifiedDrawing emits this event - EntityCreationManager handles saving
  'entity:create-request': {
    entity: AnySceneEntity;
    toolType: string;
    requestId: string;
    targetLevelId?: string; // Optional - if not provided, uses currentLevelId
  };
  // Confirmation event after entity is successfully created
  'entity:created-confirmed': {
    entity: AnySceneEntity;
    levelId: string;
    commandId?: string; // For undo/redo tracking
  };
  // 🏢 ENTERPRISE (2026-01-31): Circle TTT completion event
  // Emitted when incircle is calculated from 3 selected lines
  'circle-ttt:completed': {
    circle: Record<string, unknown>;
    selectedLines: Array<{
      entityId: string;
      entityType: string;
      start: { x: number; y: number };
      end: { x: number; y: number };
      segmentIndex?: number;
    }>;
  };
  // 🏢 ENTERPRISE (2026-01-31): Line Perpendicular completion event - ADR-060
  // Emitted when perpendicular line is created from reference line
  'line-perpendicular:completed': {
    line: Record<string, unknown>;
    referenceEntity: {
      entityId: string;
      entityType: string;
      start: { x: number; y: number };
      end: { x: number; y: number };
      segmentIndex?: number;
    };
    throughPoint: { x: number; y: number };
  };
  // 🏢 ENTERPRISE (2026-01-31): Line Parallel completion event - ADR-060
  // Emitted when parallel line is created from reference line
  'line-parallel:completed': {
    line: Record<string, unknown>;
    referenceEntity: {
      entityId: string;
      entityType: string;
      start: { x: number; y: number };
      end: { x: number; y: number };
      segmentIndex?: number;
    };
    offsetPoint: { x: number; y: number };
  };
  // ADR-363 Phase 1E — BIM wall grip + delete events
  'bim:wall-params-updated': { wallId: string };
  'bim:wall-delete-requested': { wallId: string };
  // ADR-363 Phase 2 — BIM opening grip + delete events
  'bim:opening-params-updated': { openingId: string };
  'bim:opening-delete-requested': { openingId: string };
  // ADR-376 Phase B.1 — Renumber Openings dialog trigger
  'bim:opening-renumber-requested': Record<string, never>;
  // ADR-376 Phase C.2 — Opening Tag Style dialog trigger
  'bim:opening-tag-style-requested': Record<string, never>;
  // ADR-376 Phase C.3 — Opening Schedule PDF export trigger
  'bim:opening-schedule-pdf-requested': Record<string, never>;
  // ADR-396 Phase P6 — Thermal Envelope (ETICS) authoring dialog trigger
  'bim:thermal-envelope-requested': Record<string, never>;
  // ADR-363 Phase 3 — BIM slab params + delete events
  'bim:slab-params-updated': { slabId: string };
  'bim:slab-delete-requested': { slabId: string };
  // ADR-417 Φ1-part-2 — BIM roof (κεκλιμένη στέγη) params + delete events
  'bim:roof-params-updated': { roofId: string };
  'bim:roof-delete-requested': { roofId: string };
  // ADR-419 — BIM floor-finish covering (IfcCovering FLOORING) params + delete events
  'bim:floor-finish-params-updated': { floorFinishId: string };
  'bim:floor-finish-delete-requested': { id: string };
  // ADR-422 — BIM thermal space (IfcSpace) params + delete events
  'bim:thermal-space-params-updated': { thermalSpaceId: string };
  'bim:thermal-space-delete-requested': { id: string };
  // ADR-363 Phase 3.7 — BIM slab-opening params + delete events
  'bim:slab-opening-params-updated': { slabOpeningId: string };
  'bim:slab-opening-delete-requested': { slabOpeningId: string };
  // ADR-363 Phase 3.7b+ — multi-storey stack dialog trigger
  'bim:slab-opening-stack-requested': { opening: import('../../bim/types/slab-opening-types').SlabOpeningEntity };
  // ADR-363 Phase 4 — BIM column params + delete events
  'bim:column-params-updated': { columnId: string };
  'bim:column-delete-requested': { columnId: string };
  // ADR-406 — BIM MEP fixture params + delete events
  'bim:mep-fixture-params-updated': { fixtureId: string };
  'bim:mep-fixture-delete-requested': { fixtureId: string };
  // ADR-410 — BIM furniture params + delete events
  'bim:furniture-params-updated': { furnitureId: string };
  'bim:furniture-delete-requested': { furnitureId: string };
  // ADR-408 Φ3 — BIM electrical panel params + delete events
  'bim:electrical-panel-params-updated': { panelId: string };
  'bim:electrical-panel-delete-requested': { panelId: string };
  // ADR-408 Φ12 — BIM MEP manifold (plumbing) params + delete events
  'bim:mep-manifold-params-updated': { manifoldId: string };
  'bim:mep-manifold-delete-requested': { manifoldId: string };
  // ADR-408 Εύρος Β — BIM heating radiator params + delete events
  'bim:mep-radiator-params-updated': { radiatorId: string };
  'bim:mep-radiator-delete-requested': { radiatorId: string };
  // ADR-408 Εύρος Β #2 — BIM heating boiler params + delete events
  'bim:mep-boiler-params-updated': { boilerId: string };
  'bim:mep-boiler-delete-requested': { boilerId: string };
  // ADR-408 — BIM DHW water heater (θερμοσίφωνας / ΖΝΧ) params + delete + 3D placement events
  'bim:mep-water-heater-params-updated': { waterHeaterId: string };
  'bim:mep-water-heater-delete-requested': { waterHeaterId: string };
  'bim:place-mep-water-heater-3d': { point: Point2D };
  // ADR-408 Εύρος Β #3 — BIM underfloor heating loop params + delete events
  'bim:mep-underfloor-params-updated': { underfloorId: string };
  'bim:mep-underfloor-delete-requested': { underfloorId: string };
  // ADR-408 Φ8 — BIM MEP segment (duct/pipe) params + delete events
  'bim:mep-segment-params-updated': { segmentId: string };
  'bim:mep-segment-delete-requested': { segmentId: string };
  // ADR-408 — MEP system (electrical circuit) lifecycle + integrity events.
  'bim:mep-system-changed': { systemId: string };
  'bim:mep-system-member-missing': { systemId: string; entityId: string; connectorId: string };
  // ADR-408 Φ5 — circuit creation feedback (create-from-selection UI).
  'bim:mep-circuit-created': { memberCount: number };
  'bim:mep-circuit-create-failed': { reason: 'no-source' | 'multiple-sources' | 'no-members' };
  // ADR-408 Φ6 — circuit member-management feedback (properties panel).
  'bim:mep-circuit-members-added': { memberCount: number };
  'bim:mep-circuit-members-removed': { memberCount: number };
  'bim:mep-circuit-edit-failed': { reason: 'noActiveCircuit' | 'addFailed' | 'removeFailed' };
  // ADR-408 Φ10 — pipe-network auto-derivation feedback (whole-scene connectivity).
  'bim:mep-networks-derived': { networkCount: number };
  // ADR-408 Φ13 — plumbing pipe-network from-manifold-selection feedback.
  'bim:mep-network-created': { memberCount: number };
  'bim:mep-network-create-failed': { reason: 'no-source' | 'multiple-sources' | 'no-members' };
  'bim:mep-network-members-added': { memberCount: number };
  'bim:mep-network-members-removed': { memberCount: number };
  'bim:mep-network-edit-failed': { reason: 'noActiveNetwork' | 'addFailed' | 'removeFailed' };
  // ADR-426 Slice 2 — water-supply auto-design (Generate → review → accept) feedback.
  'bim:water-supply-generated': { networkCount: number; warningCount: number };
  'bim:water-supply-empty': { reason: 'no-fixtures' | 'no-source' };
  'bim:water-supply-committed': { networkCount: number; segmentCount: number };
  // ADR-427 Slice 2 — sanitary-drainage auto-design (Generate → review → accept) feedback.
  'bim:drainage-generated': { networkCount: number; warningCount: number };
  'bim:drainage-empty': { reason: 'no-fixtures' | 'no-collector' };
  'bim:drainage-committed': { networkCount: number; segmentCount: number };
  // ADR-428 Slice 2 — heating (hydronic) auto-design (Generate → review → accept) feedback.
  'bim:heating-generated': { networkCount: number; warningCount: number };
  'bim:heating-empty': { reason: 'no-terminals' | 'no-source' };
  'bim:heating-committed': { networkCount: number; segmentCount: number };
  // ADR-430 Slice 2 — electrical-strong auto-design (Generate → review → accept) feedback.
  'bim:electrical-generated': { circuitCount: number; skipped: number; warningCount: number };
  'bim:electrical-empty': { reason: 'no-terminals' | 'no-source' };
  'bim:electrical-committed': { circuitCount: number };
  // ADR-431 Slice 2 — electrical-weak (ασθενή) auto-design feedback.
  'bim:electrical-weak-generated': { channelCount: number; skipped: number; warningCount: number };
  'bim:electrical-weak-empty': { reason: 'no-terminals' | 'no-source' };
  'bim:electrical-weak-committed': { channelCount: number };
  // ADR-432 Slice 2 — HVAC (αερισμός) auto-design feedback (Generate → review → accept).
  'bim:hvac-generated': { networkCount: number; warningCount: number };
  'bim:hvac-empty': { reason: 'no-terminals' | 'no-source' };
  'bim:hvac-committed': { networkCount: number; segmentCount: number };
  // ADR-433 Slice 2 — fire-protection (πυρόσβεση) auto-design feedback (Generate → review → accept).
  'bim:fire-generated': { networkCount: number; warningCount: number };
  'bim:fire-empty': { reason: 'no-terminals' | 'no-source' };
  'bim:fire-committed': { networkCount: number; segmentCount: number };
  // ADR-434 Slice 2 — gas (φυσικό αέριο) auto-design feedback (Generate → review → accept).
  'bim:gas-generated': { networkCount: number; warningCount: number };
  'bim:gas-empty': { reason: 'no-terminals' | 'no-source' };
  'bim:gas-committed': { networkCount: number; segmentCount: number };
  // ADR-407 — BIM railing params + delete events
  'bim:railing-params-updated': { railingId: string };
  'bim:railing-delete-requested': { railingId: string };
  // ADR-412 Φ5 — a BIM family type's `typeParams` changed (edit or delete).
  // The optimistic store `setTypes` already re-flows geometry to in-scene
  // instances (useWallTypeReresolution); this event drives the all-floors BOQ
  // re-feed side-effect, which needs project/building context only the
  // persistence host holds. Fires on command execute/undo. `category` reserved
  // for non-wall family types (host handler scopes to 'wall' + 'slab' + 'roof').
  'bim:family-type-changed': { typeId: string; category: 'wall' | 'slab' | 'stair' | 'roof' | 'opening' };
  // ADR-403 — 3D column placement: the 3D viewport projected a click onto the
  // active floor plane and converted it to the active scene units. The 2D
  // `useColumnTool` listens and runs its existing `onCanvasClick(point)` commit
  // path (enterprise id + scene append + auto 3D-resync) — no logic duplicated.
  'bim:place-column-3d': { point: Point2D };
  // ADR-406 — 3D MEP fixture placement (mirror of bim:place-column-3d).
  'bim:place-mep-fixture-3d': { point: Point2D };
  // ADR-408 Φ3 — 3D electrical panel placement (mirror of bim:place-column-3d).
  'bim:place-electrical-panel-3d': { point: Point2D };
  // ADR-408 Φ12 — 3D plumbing manifold placement (mirror of bim:place-electrical-panel-3d).
  'bim:place-mep-manifold-3d': { point: Point2D };
  // ADR-408 Εύρος Β — 3D heating radiator placement (mirror of bim:place-mep-manifold-3d).
  'bim:place-mep-radiator-3d': { point: Point2D };
  // ADR-408 Εύρος Β #2 — 3D heating boiler placement (mirror of bim:place-mep-radiator-3d).
  'bim:place-mep-boiler-3d': { point: Point2D };
  // ADR-408 Φ8 — 3D MEP segment placement (2-click bridge; reserved for 3D tool).
  // The point carries an optional `z` (mm, floor-relative): the endpoint elevation
  // resolved at click time — a snapped connector's z (Φ-B1 connector-mate) or the
  // current centreline offset (Revit-style per-click elevation → sloped runs/risers).
  'bim:place-mep-segment-3d': { point: Point2D & { z?: number } };
  // ADR-407 — 3D railing placement (mirror of bim:place-column-3d).
  'bim:place-railing-3d': { point: Point2D };
  // ADR-410 — 3D furniture placement (mirror of bim:place-column-3d).
  'bim:place-furniture-3d': { point: Point2D };
  // ADR-401 — 3D manual attach pick-host: the 3D viewport raycast a structural
  // host (beam/slab) while a `*-attach-top/-base` tool is active. The 2D
  // `useWallAttachTool` listens and dispatches the existing Attach{Walls|Columns|
  // Stairs} command for the already-captured target(s) — no logic duplicated
  // (mirror of the `bim:place-column-3d` bridge).
  'bim:attach-host-picked-3d': { hostId: string };
  // ADR-363 «Δοκάρι από τοίχο» — 3D pick: the 3D viewport raycast a wall mesh
  // while the `beam-from-wall` tool is active. The 2D `useBeamTool` listens and
  // builds the beam on that wall's axis via its existing from-wall commit core
  // (`buildBeamFromWall` + `onBeamCreated` → auto-attaches the wall top, ADR-401
  // D) — no geometry/commit logic duplicated (mirror of `bim:place-column-3d`).
  'bim:beam-from-wall-picked-3d': { wallId: string };
  // ADR-363 Phase 5 — BIM beam params + delete events
  'bim:beam-params-updated': { beamId: string };
  'bim:beam-delete-requested': { beamId: string };
  // ADR-358 Phase 9C-3 — stair delete (Firestore cleanup on canvas Delete key)
  'bim:stair-delete-requested': { stairId: string };
  // ADR-390 — Symmetric undo/restore for BIM entity deletion.
  // Single generic event with type-discriminated payload — listeners type-guard
  // via `payload.entityType` + `isXType(snapshot)`. Emitted by
  // DeleteEntityCommand.undo() and DeleteMultipleEntitiesCommand.undo().
  'bim:entity-restore-requested': {
    // ADR-406 — 'mep-fixture' appended. ADR-407 — 'railing' appended. ADR-408 Φ3 — 'electrical-panel'. ADR-408 Φ8 — 'mep-segment'. ADR-410 — 'furniture'. ADR-408 Φ12 — 'mep-manifold'. ADR-408 Εύρος Β — 'mep-radiator'. ADR-408 Εύρος Β #2 — 'mep-boiler'. ADR-408 — 'mep-water-heater'.
    entityType: 'wall' | 'opening' | 'slab' | 'slab-opening' | 'column' | 'beam' | 'stair' | 'mep-fixture' | 'electrical-panel' | 'mep-manifold' | 'mep-radiator' | 'mep-boiler' | 'mep-water-heater' | 'mep-underfloor' | 'railing' | 'mep-segment' | 'furniture' | 'floor-finish' | 'roof' | 'thermal-space';
    entitySnapshot: AnySceneEntity;
    source: 'undo-delete' | 'redo-restore';
  };
  // ADR-363 Phase 5.5i+ — beam persisted → slabs re-compute BOQ deductions
  'bim:beam-persisted': { floorplanId: string };
  // ADR-395 G6 — opening persisted/deleted → host wall re-computes net BOQ area
  'bim:opening-persisted': { wallId: string };
  // ADR-395 G2 — slab-opening persisted/deleted → host slab re-computes net BOQ volume
  'bim:slab-opening-persisted': { slabId: string };
  // ADR-363 Phase X — Wall split committed: persist delete+create+opening patch
  'bim:wall-split-committed': {
    originalWallId: string;
    wall1: WallEntity;
    wall2: WallEntity;
    openingUpdates: readonly OpeningUpdate[];
  };
  // ADR-363 Phase 7B — BIM variant kind shortcuts (keyboard D / Wn)
  // ADR-363 Phase A — BIM wall category chords (We/Wi/Wp/Wf/Wt)
  'bim:set-opening-kind': { kind: OpeningKind };
  'bim:set-wall-kind': { kind: WallKind };
  'bim:set-wall-category': { category: WallCategory };
  // ADR-363 Phase 1K Mode C — «Τοίχος σε περιοχή» box-select: the marquee
  // (window/crossing) collected these line-entity ids. The wall tool detects
  // ALL enclosed rectangles among them and builds one filling wall per
  // rectangle. Carries only ids (the tool re-reads the live scene geometry).
  'bim:wall-region-box-select': { entityIds: string[] };
  // ADR-401 Phase C — a deleted structural host (beam/slab) left ≥1 `attached`
  // wall without its top support. The wall falls back to baseline geometry
  // automatically (resolveWallTopProfile.missingHostIds); this signal lets the
  // UI surface a non-blocking warning (Revit "Top Constraint no longer valid").
  'bim:wall-attach-host-missing': { wallIds: string[]; deletedHostIds: string[] };
  // ADR-401 Phase D — N walls auto-attached their top to a just-created
  // structural host (beam/slab over them). Lets the UI surface a non-blocking
  // info toast (Revit auto-attach feedback). Undoable via AttachWallsTopCommand.
  'bim:walls-auto-attached': { wallIds: string[]; hostId: string };
  // ADR-401 (γ) — N walls auto-attached their BASE to a just-created foundation
  // host (beam/slab below them). Undoable via AttachWallsBaseCommand.
  'bim:walls-auto-attached-base': { wallIds: string[]; hostId: string };
  // ADR-401 Phase E.1 — manual attach/detach of wall top/base to a structural
  // host (ribbon «Σύνδεση/Αποκόλληση Κορυφής/Βάσης»). Undoable. UI surfaces a
  // non-blocking info toast (Revit Attach/Detach feedback).
  'bim:walls-attached-manual': { side: 'top' | 'base'; wallIds: string[]; hostId: string };
  'bim:walls-detached': { side: 'top' | 'base'; wallIds: string[] };
  // ADR-363 «Τοίχος από περίγραμμα» — N filling walls built from selected faces;
  // `ignored` counts garbage shapes + validator-rejected legs. UI surfaces a
  // non-blocking Revit-style summary toast («Δημιουργήθηκαν N· αγνοήθηκαν X»).
  'bim:walls-from-perimeter': { built: number; ignored: number };
  // ADR-363 Φάση 3 «Τοιχίο από περίγραμμα» — N τοιχία (ColumnEntity) χτίστηκαν από
  // τις επιλεγμένες παρειές (ΕΝΑ ανά κλειστή περίμετρο)· `ignored` = validator-
  // rejected περιγράμματα. UI surfaces non-blocking summary toast.
  'bim:columns-from-perimeter': { built: number; ignored: number };
  // ADR-363 Φάση 3c «Κολώνα από περίγραμμα» — ΧΩΡΙΣ ένωση· αυτόματη ταξινόμηση ανά
  // αναλογία πλευρών: `columns` = κολώνες (aspect<4), `walls` = τοιχία (aspect≥4 ή
  // σύνθετα), `ignored` = validator-rejected. UI: ενημερωτικό breakdown toast.
  'bim:columns-discrete-from-perimeter': { columns: number; walls: number; ignored: number };
  // ADR-419 — region/perimeter pick απορρίφθηκε (Layer 4/5). `oversized` = το
  // ανιχνευμένο περίγραμμα είναι το εξωτερικό περίγραμμα του σχεδίου (πολύ μεγάλο
  // για δομικό μέλος)· `no-closed-loop` = δεν βρέθηκε κλειστό loop κοντά στο pick
  // (οι γραμμές δεν ενώνονται). UI: non-blocking warning toast (+ optional highlight
  // ασύνδετων άκρων μέσω dxf.highlightByIds). widthM/depthM = διαστάσεις σε μέτρα.
  'bim:region-perimeter-rejected': {
    reason: 'oversized' | 'no-closed-loop';
    widthM?: number;
    depthM?: number;
  };
  // ADR-401 Phase F.3 — column attach mirrors of the wall events above. N columns
  // auto-attached their top/base to a just-created structural host. Undoable via
  // AttachColumnsCommand. UI surfaces a non-blocking info toast (Revit parity).
  'bim:columns-auto-attached': { columnIds: string[]; hostId: string };
  'bim:columns-auto-attached-base': { columnIds: string[]; hostId: string };
  // ADR-401 Phase F.3 — manual attach/detach of column top/base (ribbon pick-host).
  'bim:columns-attached-manual': { side: 'top' | 'base'; columnIds: string[]; hostId: string };
  'bim:columns-detached': { side: 'top' | 'base'; columnIds: string[] };
  // ADR-363 Post-Creation Adjacency Merge — N γειτονικές κολόνες που σχηματίζουν
  // τοιχίο (Γ/Τ/Π) συγχωνεύτηκαν σε ΕΝΑ composite ColumnEntity (MergeColumnsCommand,
  // single undo). UI surfaces a non-blocking success toast (Revit «merge» feedback).
  'bim:columns-merged': { sourceIds: string[]; compositeId: string };
  // ADR-401 Phase G.3 — stair attach mirrors of the wall/column events above. N
  // stairs auto-attached their top/base to a just-created structural host (Revit
  // «Desired number of risers» re-step at render). Undoable via AttachStairsCommand.
  'bim:stairs-auto-attached': { stairIds: string[]; hostId: string };
  'bim:stairs-auto-attached-base': { stairIds: string[]; hostId: string };
  // ADR-401 Phase G.3 — manual attach/detach of stair top/base (ribbon pick-host).
  'bim:stairs-attached-manual': { side: 'top' | 'base'; stairIds: string[]; hostId: string };
  'bim:stairs-detached': { side: 'top' | 'base'; stairIds: string[] };
  // ADR-363 fix — multi-entity move dirty-flag propagation.
  // Carries the post-move entities directly so listeners never call
  // getLevelScene() (which returns stale React state at emit time).
  'bim:entities-moved': { movedEntities: ReadonlyArray<AnySceneEntity> };
  // ADR-396 P7 Part B — thermal envelope applied to a floor: per-element
  // `envelopeLayer`/`revealInsulation` written into the scene. Carries the
  // changed entities directly (same stale-state guard as `bim:entities-moved`)
  // so the existing persistence hooks (column/beam/slab via the shared moved
  // effect + opening via its own listener) save + audit + structural-BOQ them.
  'bim:envelope-applied': { entities: ReadonlyArray<AnySceneEntity> };
  // ADR-401 — N walls/columns/stairs had their structural attach binding changed
  // (auto-attach below a new host, manual attach/detach, detach-on-edit) by an
  // Attach/Detach command. Carries the post-change entities directly (same
  // stale-state guard as `bim:entities-moved`) so the shared persistence effect
  // (`useBimEntityMovedPersistEffect` for wall/column + the stair listener) saves +
  // audits them AND marks them dirty. WITHOUT this, a non-selected entity (the
  // common auto-attach case) never persists and the next Firestore snapshot's
  // diff-merge reverts the in-memory binding. Fires on execute/undo/redo.
  'bim:entities-attached': { entities: ReadonlyArray<AnySceneEntity> };
  /** ADR-369 Q8.2 — ribbon IFC button → open PsetEditorHost dialog. */
  'bim:pset-editor-open': { entityId: string; levelId: string; entityType: string };
  /** ADR-369 Q8.3 — ribbon IFC Export button → IfcExportHost downloads .ifc file. */
  'bim:ifc-export-requested': {
    /** Scope filter — if omitted, exports every building in project. */
    projectId?: string;
    buildingIds?: readonly string[];
    /** When true, include per-entity Property Sets in the IFC output. */
    includePsets?: boolean;
  };

  // Crop-window: marquee drawn by user → clip scene to that world-space rectangle
  'crop:marquee-rect': { xMin: number; yMin: number; xMax: number; yMax: number };
  // Polygon-crop: click-to-add-points polygon → clip scene
  'crop:polygon': { polygon: Array<[number, number]> };
  // Lasso-crop: freehand polygon drawn by user → clip scene
  'crop:lasso-polygon': { polygon: Array<[number, number]> };

  // ADR-374 — ZOOM Window tool: final world rect to fit-to-view, viewport for scale calc.
  'zoom-window:apply': {
    worldBounds: { min: { x: number; y: number }; max: { x: number; y: number } };
    viewport: { width: number; height: number };
  };
  // ADR-400 — Restore persisted viewport transform (pan+zoom) without bounds recalc.
  // Emitted by useAutoFitOnFileChange when a valid persisted transform is found on
  // first scene load. Consumed by useFitToView which applies it via setTransform.
  'canvas-restore-viewport': {
    transform: { scale: number; offsetX: number; offsetY: number };
  };
}
