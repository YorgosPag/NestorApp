/**
 * Drawing Event Map — type-safe event payload definitions for the DXF Viewer EventBus.
 *
 * Extracted from EventBus.ts to keep that file <500 LOC (Google SRP, CLAUDE.md N.7.1).
 * Pure type module: zero runtime logic. EventBus.ts imports `DrawingEventMap` from here.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { AnySceneEntity, SceneModel } from '../../types/scene';
import type { GridGuide, GridGroup } from '../../ai-assistant/grid-types';
import type { MepAutoDesignEventMap } from './drawing-event-map-mep-autodesign';
import type { BimEventMap } from './drawing-event-map-bim';

// Event type definitions - centralized and type-safe.
// MEP auto-design feedback events live in `MepAutoDesignEventMap` (SRP split, N.7.1).
// BIM entity events (params/delete, grid-generation, attach, 3D placement, IFC) live
// in `BimEventMap` (SRP split, N.7.1).
export interface DrawingEventMap extends MepAutoDesignEventMap, BimEventMap {
  // ADR-466 — Entity clipboard (Revit Ctrl+C / Ctrl+V, cross-floor paste-in-place).
  // Emitted by the keyboard-shortcut → onAction pipeline; consumed by
  // useEntityClipboard (so the shortcut SSoT stays the single binding source).
  'clipboard:copy-requested': Record<string, never>;
  'clipboard:paste-requested': Record<string, never>;
  // Entity Body-Drag (grab body → move; Ctrl+drag → copy). Emitted by the canvas
  // mouseup when a body-drag session committed with a non-trivial displacement;
  // consumed by useEntityBodyDragCommit (which owns executeCommand + levelManager).
  'entity-body-drag:commit': {
    entityIds: string[];
    delta: Point2D;
    copy: boolean;
  };
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

  // 🏢 ADR-362 Phase K — DIMBREAK / DIMSPACE ribbon requests (selection-driven).
  // `useDimensionModify` host subscribes + runs the undoable command.
  'dim:break-requested': { entityIds: readonly string[] };
  'dim:space-requested': { entityIds: readonly string[] };

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
  // ADR-453 — Open the Print/Export («Εκτύπωση») dialog (PrintHost listens).
  // Emitted by the ribbon Output → «Εκτύπωση» action via wrappedHandleAction.
  'dxf:print-dialog-requested': Record<string, never>;
  // ADR-505 — Open the Export («Εξαγωγή») dialog (ExportHost listens).
  // Emitted by the ribbon Output → «Εξαγωγή» action via wrappedHandleAction.
  'dxf:export-dialog-requested': Record<string, never>;
  // ADR-526 — Open the native file picker for Tekton .tek import (DxfViewerDialogs
  // listens). Emitted by the ribbon Insert → «Εισαγωγή Τέκτονα» action.
  'dxf:import-tek-requested': Record<string, never>;
  // ADR-400 — Restore persisted viewport transform (pan+zoom) without bounds recalc.
  // Emitted by the useViewportAutoFit SSoT controller (ADR-399) when a valid persisted
  // transform is found on first scene load. Consumed by useFitToView via setTransform.
  'canvas-restore-viewport': {
    transform: { scale: number; offsetX: number; offsetY: number };
  };
}
