/**
 * 🏢 ENTERPRISE: Canvas Click Handler Types
 *
 * @description All type definitions for the useCanvasClickHandler hook
 * and its extracted sub-modules (guide-click-handlers, entity-pick-handlers).
 *
 * EXTRACTED FROM: useCanvasClickHandler.ts — SRP split (ADR N.7.1)
 *
 * @see ADR-030: Universal Selection System
 * @see ADR-046: World Coordinate Click Pattern
 * @see ADR-189: Construction Guide System
 */

import type { MutableRefObject } from 'react';

import type { Point2D } from '../../rendering/types/Types';
import type { ViewTransform } from '../../rendering/types/Types';
import type { OverlayEditorMode, Overlay } from '../../overlays/types';
import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { UniversalSelectionHook } from '../../systems/selection/SelectionSystem';
import type { SelectedGrip } from '../grips/useGripSystem';
import type { Guide, ConstructionPoint } from '../../systems/guides/guide-types';
import type { GridAxis } from '../../ai-assistant/grid-types';
import type { CreateGuideCommand, DeleteGuideCommand, CreateDiagonalGuideCommand } from '../../systems/guides/guide-commands';
import type { AddConstructionPointCommand, DeleteConstructionPointCommand } from '../../systems/guides/construction-point-commands';

// ============================================================================
// ENTITY TYPES
// ============================================================================

/** ADR-189 §3.9/3.10: Arc or circle entity for entity-picking callbacks */
export interface ArcPickableEntity {
  center: Point2D;
  radius: number;
  startAngle: number;
  endAngle: number;
  isFullCircle: boolean;
}

/** ADR-189 §3.12: Line entity for entity-picking callbacks */
export interface LinePickableEntity {
  start: Point2D;
  end: Point2D;
}

// ============================================================================
// MINIMAL INTERFACES FOR DEPENDENCIES
// ============================================================================

/** Minimal interface for drawing handlers ref */
export interface DrawingHandlersLike {
  onDrawingPoint?: (point: Point2D) => void;
  drawingState?: { tempPoints?: Array<unknown> };
}

/** Minimal interface for special tool hooks */
export interface SpecialToolLike {
  isWaitingForSelection?: boolean;
  isActive?: boolean;
  currentStep?: number;
  onEntityClick: (entity: AnySceneEntity, point: Point2D) => boolean;
  onCanvasClick?: (point: Point2D) => void;
}

/** Minimal interface for angle entity measurement tool */
export interface AngleEntityToolLike {
  isActive: boolean;
  isWaitingForEntitySelection: boolean;
  currentStep: 0 | 1;
  onEntityClick: (entity: AnySceneEntity, point: Point2D) => boolean;
  acceptsEntityType: (entityType: string) => boolean;
}

/** Minimal interface for DXF grip interaction */
export interface DxfGripInteractionLike {
  handleGripClick: (worldPoint: Point2D) => boolean;
}

/** Minimal interface for level manager (read-only for click handling) */
export interface LevelManagerLike {
  currentLevelId: string | null;
  getLevelScene: (levelId: string) => SceneModel | null;
}

// ============================================================================
// HOOK PARAMS & RETURN
// ============================================================================

export interface UseCanvasClickHandlerParams {
  // ── Viewport / Transform ─────────────────────────────────────────────
  viewportReady: boolean;
  viewport: { width: number; height: number };
  transform: ViewTransform;

  // ── Tools ─────────────────────────────────────────────────────────────
  activeTool: string;
  overlayMode: OverlayEditorMode;
  circleTTT: SpecialToolLike;
  linePerpendicular: SpecialToolLike;
  lineParallel: SpecialToolLike;
  angleEntityMeasurement: AngleEntityToolLike;
  dxfGripInteraction: DxfGripInteractionLike;

  // ── ADR-188: Rotation tool ────────────────────────────────────────────
  /** Whether the rotation tool is active and collecting input */
  rotationIsActive?: boolean;
  /** Click handler for rotation state machine */
  handleRotationClick?: (worldPoint: Point2D) => void;

  // ── Level / Scene ─────────────────────────────────────────────────────
  levelManager: LevelManagerLike;

  // ── Overlay drawing ───────────────────────────────────────────────────
  draftPolygon: Array<[number, number]>;
  setDraftPolygon: React.Dispatch<React.SetStateAction<Array<[number, number]>>>;
  isSavingPolygon: boolean;
  setIsSavingPolygon: (val: boolean) => void;
  isNearFirstPoint: boolean;
  finishDrawingWithPolygonRef: MutableRefObject<(polygon: Array<[number, number]>) => Promise<boolean>>;

  // ── Refs (mutable, avoids stale closures) ─────────────────────────────
  drawingHandlersRef: MutableRefObject<DrawingHandlersLike | null>;
  entitySelectedOnMouseDownRef: MutableRefObject<boolean>;

  // ── Selection / Grips ─────────────────────────────────────────────────
  universalSelection: UniversalSelectionHook;
  hoveredVertexInfo: unknown;
  hoveredEdgeInfo: unknown;
  selectedGrip: SelectedGrip | null;
  selectedGrips: SelectedGrip[];
  setSelectedGrips: (grips: SelectedGrip[]) => void;
  justFinishedDragRef: MutableRefObject<boolean>;
  draggingOverlayBody: unknown;
  setSelectedEntityIds: (ids: string[]) => void;

  // ── Overlay handlers ──────────────────────────────────────────────────
  currentOverlays: Overlay[];
  handleOverlayClick: (overlayId: string, point: Point2D) => void;

  // ── ADR-189: Construction guide handlers ────────────────────────────
  guideAddGuide?: (axis: GridAxis, offset: number) => CreateGuideCommand;
  guideRemoveGuide?: (guideId: string) => DeleteGuideCommand;
  guides?: readonly Guide[];
  /** Currently selected reference guide for parallel creation (null = step 1) */
  parallelRefGuideId?: string | null;
  /** Step 1 callback: user clicked near a guide → select as reference */
  onParallelRefSelected?: (refGuideId: string) => void;
  /** Step 2 callback: user clicked on a side → determines direction + opens dialog */
  onParallelSideChosen?: (refGuideId: string, sign: 1 | -1) => void;

  // ── ADR-189 §3.3: Diagonal guide 3-click workflow ────────────────────
  guideAddDiagonalGuide?: (startPoint: Point2D, endPoint: Point2D) => CreateDiagonalGuideCommand;
  /** Current step of the diagonal workflow (0=start, 1=direction, 2=end) */
  diagonalStep?: 0 | 1 | 2;
  /** Start point (set after step 0) */
  diagonalStartPoint?: Point2D | null;
  /** Direction point (set after step 1) */
  diagonalDirectionPoint?: Point2D | null;
  /** Step 0 callback: set the start point */
  onDiagonalStartSet?: (point: Point2D) => void;
  /** Step 1 callback: set the direction point */
  onDiagonalDirectionSet?: (point: Point2D) => void;
  /** Step 2 callback: set the end point + create guide + reset */
  onDiagonalComplete?: () => void;

  // ── ADR-189 §3.7-3.16: Construction snap point tools ──────────────────
  /** Add a single construction point */
  cpAddPoint?: (point: Point2D, label?: string | null) => AddConstructionPointCommand;
  /** Delete a construction point by ID */
  cpDeletePoint?: (pointId: string) => DeleteConstructionPointCommand;
  /** Find nearest construction point to a world position */
  cpFindNearest?: (worldPoint: Point2D, maxDistance: number) => ConstructionPoint | null;
  /** Current step for segments tool (0=start, 1=end) */
  segmentsStep?: 0 | 1;
  /** Start point for segments tool (set after step 0) */
  segmentsStartPoint?: Point2D | null;
  /** Step 0 callback: set segments start point */
  onSegmentsStartSet?: (point: Point2D) => void;
  /** Step 1 callback: end point set → triggers dialog */
  onSegmentsComplete?: (start: Point2D, end: Point2D) => void;
  /** Current step for distance tool (0=start, 1=end) */
  distanceStep?: 0 | 1;
  /** Start point for distance tool (set after step 0) */
  distanceStartPoint?: Point2D | null;
  /** Step 0 callback: set distance start point */
  onDistanceStartSet?: (point: Point2D) => void;
  /** Step 1 callback: end point set → triggers dialog */
  onDistanceComplete?: (start: Point2D, end: Point2D) => void;

  // ── ADR-189 §3.9, §3.10, §3.12: Arc guide entity picking ────────────
  /** §3.9 callback: user picked an arc/circle → triggers segment dialog */
  onArcSegmentsPicked?: (entity: ArcPickableEntity) => void;
  /** §3.10 callback: user picked an arc/circle → triggers distance dialog */
  onArcDistancePicked?: (entity: ArcPickableEntity) => void;
  /** §3.12 arc-line intersect: current step (0=pick line, 1=pick arc) */
  arcLineStep?: 0 | 1;
  /** §3.12 callback: user picked a line entity (step 0) */
  onArcLineLinePicked?: (entity: LinePickableEntity) => void;
  /** §3.12 callback: user picked an arc/circle entity (step 1) */
  onArcLineArcPicked?: (entity: ArcPickableEntity) => void;

  // ── ADR-189 §3.11: Circle-Circle intersection entity picking ──────────
  /** §3.11 circle-circle intersect: current step (0=pick first, 1=pick second) */
  circleIntersectStep?: 0 | 1;
  /** §3.11 callback: user picked the first arc/circle entity (step 0) */
  onCircleIntersectFirstPicked?: (entity: ArcPickableEntity) => void;
  /** §3.11 callback: user picked the second arc/circle entity (step 1) */
  onCircleIntersectSecondPicked?: (entity: ArcPickableEntity) => void;

  // ── Two-step perpendicular guide placement ──────────────────────────
  /** Selected reference guide for perpendicular (null = step 0: select guide) */
  perpRefGuideId?: string | null;
  /** Step 0 callback: user clicked near a guide → select as perpendicular reference */
  onPerpRefSelected?: (guideId: string) => void;
  /** Step 1 callback: perpendicular placed → reset */
  onPerpPlaced?: () => void;

  // ── Guide rect-center tool ─────────────────────────────────────────
  /** Callback: place construction point at center of enclosing guide rectangle */
  onRectCenterPlace?: (center: Point2D) => void;

  // ── Guide line-midpoint + circle-center tools ─────────────────────
  /** Callback: place construction point at midpoint of a line entity */
  onLineMidpointPlace?: (midpoint: Point2D) => void;
  /** Callback: place construction point at center of a circle/arc entity */
  onCircleCenterPlace?: (center: Point2D) => void;

  // ── ADR-189 B2: Grid generation tool ──────────────────────────────
  /** Callback: user clicked grid origin → opens spacing dialog */
  onGridOriginSet?: (origin: Point2D) => void;

  // ── ADR-189 B28: Guide rotation tool ───────────────────────────────
  /** Currently selected reference guide for rotation (null = step 0) */
  rotateRefGuideId?: string | null;
  /** Step 0 callback: user clicked near guide → select as rotation reference */
  onRotateRefSelected?: (guideId: string) => void;
  /** Step 1 callback: user set pivot → opens angle dialog */
  onRotatePivotSet?: (guideId: string, pivot: Point2D) => void;

  // ── ADR-189 B30: Rotate all guides tool ──────────────────────────
  /** Step 0 callback: user clicked pivot → opens angle dialog for all guides */
  onRotateAllPivotSet?: (pivot: Point2D) => void;

  // ── ADR-189 B29: Rotate guide group tool ─────────────────────────
  /** Set of currently selected guide IDs for group rotation */
  rotateGroupSelectedIds?: ReadonlySet<string>;
  /** Toggle a guide in/out of the group selection */
  onRotateGroupToggle?: (guideId: string) => void;
  /** Set pivot for group rotation (fires when clicking empty space with ≥1 selected) */
  onRotateGroupPivotSet?: (guideIds: readonly string[], pivot: Point2D) => void;

  // ── ADR-189 B33: Equalize guide spacing tool ──────────────────────
  /** Set of currently selected guide IDs for equalization */
  equalizeSelectedIds?: ReadonlySet<string>;
  /** Toggle a guide in/out of the equalize selection */
  onEqualizeToggle?: (guideId: string) => void;
  /** Apply equalization (fires when clicking empty space with ≥3 same-axis selected) */
  onEqualizeApply?: (guideIds: readonly string[]) => void;

  // ── ADR-189 B31: Polar array tool ──────────────────────
  /** Set center point for polar array (opens PromptDialog for count) */
  onPolarArrayCenterSet?: (center: Point2D) => void;

  // ── ADR-189 B32: Scale grid tool ──────────────────────
  /** Set scale origin point (opens PromptDialog for scale factor) */
  onScaleOriginSet?: (origin: Point2D) => void;

  // ── ADR-189 B16: Guide at angle tool ──────────────────
  /** Set origin point for guide-at-angle (opens PromptDialog for angle) */
  onGuideAngleOriginSet?: (origin: Point2D) => void;

  // ── ADR-189 B19: Mirror guides tool ──────────────────
  /** Click on X/Y guide → mirror all others across it */
  onMirrorAxisSelected?: (axisGuideId: string) => void;

  // ── ADR-189 B8: Guide from entity tool ────────────────
  /** Callback: entity picked → create guide(s) from it */
  onGuideFromEntity?: (entityType: 'LINE' | 'CIRCLE' | 'ARC' | 'POLYLINE', params: {
    lineStart?: Point2D; lineEnd?: Point2D;
    center?: Point2D; radius?: number;
    clickPoint?: Point2D;
  }) => void;

  // ── ADR-189 B24: Guide offset from entity tool ──────────
  /** Callback: entity picked → prompt offset → create offset guides */
  onGuideOffsetFromEntity?: (entityType: 'LINE' | 'CIRCLE' | 'ARC' | 'POLYLINE', params: {
    lineStart?: Point2D; lineEnd?: Point2D;
    center?: Point2D; radius?: number;
    clickPoint?: Point2D;
  }) => void;

  // ── ADR-189 B14: Guide multi-select tool ──────────────
  /** Toggle guide selection (shift = add to selection) */
  onGuideSelectToggle?: (guideId: string, addToSelection: boolean) => void;
  /** Deselect all guides (click on empty space) */
  onGuideDeselectAll?: () => void;
}

export interface UseCanvasClickHandlerReturn {
  handleCanvasClick: (worldPoint: Point2D, shiftKey?: boolean) => void;
}
