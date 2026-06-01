/**
 * Unified Event Bus - Type-safe centralized event coordination
 * Replaces scattered window.addEventListener/CustomEvent patterns
 */

import { useCallback, useEffect, useRef } from 'react';
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
  // ADR-363 Phase 3.7 — BIM slab-opening params + delete events
  'bim:slab-opening-params-updated': { slabOpeningId: string };
  'bim:slab-opening-delete-requested': { slabOpeningId: string };
  // ADR-363 Phase 3.7b+ — multi-storey stack dialog trigger
  'bim:slab-opening-stack-requested': { opening: import('../../bim/types/slab-opening-types').SlabOpeningEntity };
  // ADR-363 Phase 4 — BIM column params + delete events
  'bim:column-params-updated': { columnId: string };
  'bim:column-delete-requested': { columnId: string };
  // ADR-403 — 3D column placement: the 3D viewport projected a click onto the
  // active floor plane and converted it to the active scene units. The 2D
  // `useColumnTool` listens and runs its existing `onCanvasClick(point)` commit
  // path (enterprise id + scene append + auto 3D-resync) — no logic duplicated.
  'bim:place-column-3d': { point: Point2D };
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
    entityType: 'wall' | 'opening' | 'slab' | 'slab-opening' | 'column' | 'beam' | 'stair';
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
  // ADR-401 Phase F.3 — column attach mirrors of the wall events above. N columns
  // auto-attached their top/base to a just-created structural host. Undoable via
  // AttachColumnsCommand. UI surfaces a non-blocking info toast (Revit parity).
  'bim:columns-auto-attached': { columnIds: string[]; hostId: string };
  'bim:columns-auto-attached-base': { columnIds: string[]; hostId: string };
  // ADR-401 Phase F.3 — manual attach/detach of column top/base (ribbon pick-host).
  'bim:columns-attached-manual': { side: 'top' | 'base'; columnIds: string[]; hostId: string };
  'bim:columns-detached': { side: 'top' | 'base'; columnIds: string[] };
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

export type DrawingEventType = keyof DrawingEventMap;
export type DrawingEventPayload<T extends DrawingEventType> = DrawingEventMap[T];

type EventHandler<T extends DrawingEventType> = (payload: DrawingEventPayload<T>) => void;

/**
 * Singleton Event Bus for centralized event coordination
 */
class EventBusCore {
  private static instance: EventBusCore;
  private handlers: Map<DrawingEventType, Set<EventHandler<DrawingEventType>>> = new Map();

  static getInstance(): EventBusCore {
    if (!EventBusCore.instance) {
      EventBusCore.instance = new EventBusCore();
    }
    return EventBusCore.instance;
  }

  private constructor() {}

  /**
   * Emit type-safe event
   */
  emit<T extends DrawingEventType>(
    eventType: T,
    payload: DrawingEventPayload<T>
  ): void {

    const eventHandlers = this.handlers.get(eventType);
    if (eventHandlers) {
      eventHandlers.forEach(handler => {
        try {
          handler(payload);
        } catch (error) {
          console.error(`❌ EventBus handler error for ${eventType}:`, error);
        }
      });
    }

  }

  /**
   * Subscribe to type-safe events
   */
  on<T extends DrawingEventType>(
    eventType: T,
    handler: EventHandler<T>
  ): () => void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }

    const eventHandlers = this.handlers.get(eventType)!;
    eventHandlers.add(handler as EventHandler<keyof DrawingEventMap>);

    // Return unsubscribe function
    return () => {
      eventHandlers.delete(handler as EventHandler<keyof DrawingEventMap>);
      if (eventHandlers.size === 0) {
        this.handlers.delete(eventType);
      }
    };
  }

  /**
   * Remove all handlers for event type
   */
  off<T extends DrawingEventType>(eventType: T): void {
    this.handlers.delete(eventType);

  }

  /**
   * Clear all event handlers
   */
  clear(): void {
    this.handlers.clear();

  }

  /**
   * Debug: List active event types
   */
  getActiveEvents(): DrawingEventType[] {
    return Array.from(this.handlers.keys());
  }
}

// Singleton instance
export const EventBus = EventBusCore.getInstance();

/**
 * React hook for type-safe event bus usage
 */
export function useEventBus() {
  const handlersRef = useRef<(() => void)[]>([]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      handlersRef.current.forEach(cleanup => cleanup());
      handlersRef.current = [];
    };
  }, []);

  const emit = useCallback(<T extends DrawingEventType>(
    eventType: T,
    payload: DrawingEventPayload<T>
  ) => {
    EventBus.emit(eventType, payload);
  }, []);

  const on = useCallback(<T extends DrawingEventType>(
    eventType: T,
    handler: EventHandler<T>
  ) => {
    const cleanup = EventBus.on(eventType, handler);
    handlersRef.current.push(cleanup);
    return cleanup;
  }, []);

  const off = useCallback(<T extends DrawingEventType>(eventType: T) => {
    EventBus.off(eventType);
  }, []);

  return { emit, on, off };
}
