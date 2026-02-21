/**
 * 🏢 ENTERPRISE: useCanvasClickHandler Hook
 *
 * @description Handles all canvas click logic with priority-based routing:
 * 1. Grip interaction (DXF entity grips)
 * 1.5. Rotation tool click
 * 1.8. Angle entity measurement picking (constraint, line-arc, two-arcs)
 * 2. Circle TTT entity picking
 * 3. Line Perpendicular entity picking
 * 4. Line Parallel entity picking
 * 5. Overlay polygon drawing (draftPolygon)
 * 6. Unified drawing/measurement tools
 * 7. Move tool overlay body drag
 * 8. Empty canvas deselection
 *
 * EXTRACTED FROM: CanvasSection.tsx — ~260 lines of click routing logic
 *
 * @see ADR-030: Universal Selection System
 * @see ADR-046: World Coordinate Click Pattern
 * @see ADR-147: Centralized Hit Tolerance
 */

'use client';

import { useCallback, type MutableRefObject } from 'react';

import type { Point2D } from '../../rendering/types/Types';
import type { ViewTransform } from '../../rendering/types/Types';
import type { OverlayEditorMode, Overlay } from '../../overlays/types';
import type { AnySceneEntity, SceneModel } from '../../types/entities';
import type { UniversalSelectionHook } from '../../systems/selection/SelectionSystem';
import type { SelectedGrip } from '../grips/useGripSystem';
import { isLineEntity, isPolylineEntity, isLWPolylineEntity, isArcEntity, isCircleEntity, isRectangleEntity, isRectEntity, isTextEntity, isMTextEntity, isEllipseEntity } from '../../types/entities';
import { pointToLineDistance } from '../../rendering/entities/shared/geometry-utils';
import { pointToArcDistance } from '../../utils/angle-entity-math';
import { isInteractiveTool } from '../../systems/tools/ToolStateManager';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import { dlog, dwarn } from '../../debug';
// ADR-189: Guide system imports
import type { Guide, ConstructionPoint } from '../../systems/guides/guide-types';
import { pointToSegmentDistance } from '../../systems/guides/guide-types';
import type { GridAxis } from '../../ai-assistant/grid-types';
import type { CreateGuideCommand, DeleteGuideCommand, CreateDiagonalGuideCommand } from '../../systems/guides/guide-commands';
import type { AddConstructionPointCommand, AddConstructionPointBatchCommand, DeleteConstructionPointCommand } from '../../systems/guides/construction-point-commands';

// ============================================================================
// TYPES
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

/** Minimal interface for drawing handlers ref */
interface DrawingHandlersLike {
  onDrawingPoint?: (point: Point2D) => void;
  drawingState?: { tempPoints?: Array<unknown> };
}

/** Minimal interface for special tool hooks */
interface SpecialToolLike {
  isWaitingForSelection?: boolean;
  isActive?: boolean;
  currentStep?: number;
  onEntityClick: (entity: AnySceneEntity, point: Point2D) => boolean;
  onCanvasClick?: (point: Point2D) => void;
}

/** Minimal interface for angle entity measurement tool */
interface AngleEntityToolLike {
  isActive: boolean;
  isWaitingForEntitySelection: boolean;
  currentStep: 0 | 1;
  onEntityClick: (entity: AnySceneEntity, point: Point2D) => boolean;
  acceptsEntityType: (entityType: string) => boolean;
}

/** Minimal interface for DXF grip interaction */
interface DxfGripInteractionLike {
  handleGripClick: (worldPoint: Point2D) => boolean;
}

/** Minimal interface for level manager (read-only for click handling) */
interface LevelManagerLike {
  currentLevelId: string | null;
  getLevelScene: (levelId: string) => SceneModel | null;
}

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
}

export interface UseCanvasClickHandlerReturn {
  handleCanvasClick: (worldPoint: Point2D) => void;
}

// ============================================================================
// HOOK
// ============================================================================

export function useCanvasClickHandler(params: UseCanvasClickHandlerParams): UseCanvasClickHandlerReturn {
  const {
    viewportReady, viewport, transform,
    activeTool, overlayMode,
    circleTTT, linePerpendicular, lineParallel, angleEntityMeasurement, dxfGripInteraction,
    rotationIsActive = false, handleRotationClick,
    levelManager,
    draftPolygon, setDraftPolygon, isSavingPolygon, setIsSavingPolygon,
    isNearFirstPoint, finishDrawingWithPolygonRef,
    drawingHandlersRef, entitySelectedOnMouseDownRef,
    universalSelection,
    hoveredVertexInfo, hoveredEdgeInfo, selectedGrip,
    setSelectedGrips, justFinishedDragRef,
    draggingOverlayBody, setSelectedEntityIds,
    currentOverlays, handleOverlayClick,
    // ADR-189: Guide handlers
    guideAddGuide, guideRemoveGuide, guides,
    parallelRefGuideId, onParallelRefSelected, onParallelSideChosen,
    // ADR-189 §3.3: Diagonal guide handlers
    guideAddDiagonalGuide,
    diagonalStep = 0, diagonalStartPoint, diagonalDirectionPoint,
    onDiagonalStartSet, onDiagonalDirectionSet, onDiagonalComplete,
    // ADR-189 §3.7-3.16: Construction snap point handlers
    cpAddPoint, cpDeletePoint, cpFindNearest,
    segmentsStep = 0, segmentsStartPoint, onSegmentsStartSet, onSegmentsComplete,
    distanceStep = 0, distanceStartPoint, onDistanceStartSet, onDistanceComplete,
    // ADR-189 §3.9/3.10/3.12: Arc guide entity picking
    onArcSegmentsPicked, onArcDistancePicked,
    arcLineStep = 0, onArcLineLinePicked, onArcLineArcPicked,
  } = params;

  const handleCanvasClick = useCallback((worldPoint: Point2D) => {
    // Block interactions until viewport is ready
    if (!viewportReady) {
      dwarn('useCanvasClickHandler', 'Click blocked: viewport not ready', viewport);
      return;
    }

    // PRIORITY 1: DXF entity grip interaction (ONLY in select mode — not during drawing)
    if (!isInteractiveTool(activeTool) && activeTool !== 'rotate' && dxfGripInteraction.handleGripClick(worldPoint)) {
      return;
    }

    // PRIORITY 1.3: ADR-188 — Rotation tool entity selection (awaiting-entity phase)
    // When rotation tool is active but NOT collecting geometric input (= awaiting-entity
    // phase), clicks select an entity. The rotation state machine then auto-transitions
    // to awaiting-base-point via its useEffect.
    if (activeTool === 'rotate' && !rotationIsActive) {
      const scene = levelManager.currentLevelId
        ? levelManager.getLevelScene(levelManager.currentLevelId)
        : null;

      if (scene?.entities) {
        const hitTolerance = TOLERANCE_CONFIG.SNAP_DEFAULT / transform.scale;

        for (const entity of scene.entities) {
          let isHit = false;

          if (isLineEntity(entity)) {
            isHit = pointToLineDistance(worldPoint, entity.start, entity.end) <= hitTolerance;
          } else if (isArcEntity(entity)) {
            isHit = pointToArcDistance(worldPoint, entity) <= hitTolerance;
          } else if (isCircleEntity(entity)) {
            // Circle hit-test: distance from point to circumference
            const dx = worldPoint.x - entity.center.x;
            const dy = worldPoint.y - entity.center.y;
            const distFromCenter = Math.sqrt(dx * dx + dy * dy);
            isHit = Math.abs(distFromCenter - entity.radius) <= hitTolerance;
          } else if (isPolylineEntity(entity)) {
            if (entity.vertices && entity.vertices.length >= 2) {
              for (let i = 0; i < entity.vertices.length - 1; i++) {
                if (pointToLineDistance(worldPoint, entity.vertices[i], entity.vertices[i + 1]) <= hitTolerance) {
                  isHit = true;
                  break;
                }
              }
              if (!isHit && entity.closed && entity.vertices.length > 2) {
                isHit = pointToLineDistance(worldPoint, entity.vertices[entity.vertices.length - 1], entity.vertices[0]) <= hitTolerance;
              }
            }
          } else if (isLWPolylineEntity(entity)) {
            // LWPolyline hit-test: same as polyline (vertices + closed)
            if (entity.vertices && entity.vertices.length >= 2) {
              for (let i = 0; i < entity.vertices.length - 1; i++) {
                if (pointToLineDistance(worldPoint, entity.vertices[i], entity.vertices[i + 1]) <= hitTolerance) {
                  isHit = true;
                  break;
                }
              }
              if (!isHit && entity.closed && entity.vertices.length > 2) {
                isHit = pointToLineDistance(worldPoint, entity.vertices[entity.vertices.length - 1], entity.vertices[0]) <= hitTolerance;
              }
            }
          } else if (isRectangleEntity(entity) || isRectEntity(entity)) {
            // Rectangle hit-test: check all 4 edges
            const x = entity.x;
            const y = entity.y;
            const w = entity.width;
            const h = entity.height;
            const corners = [
              { x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }
            ];
            for (let i = 0; i < 4; i++) {
              if (pointToLineDistance(worldPoint, corners[i], corners[(i + 1) % 4]) <= hitTolerance) {
                isHit = true;
                break;
              }
            }
          } else if (isEllipseEntity(entity)) {
            // Ellipse hit-test: approximate distance from circumference
            const dx = worldPoint.x - entity.center.x;
            const dy = worldPoint.y - entity.center.y;
            const rx = entity.majorAxis;
            const ry = entity.minorAxis;
            // Normalized distance: (dx/rx)^2 + (dy/ry)^2 ≈ 1 means on ellipse
            const normalizedDist = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
            isHit = Math.abs(normalizedDist - 1) <= hitTolerance / Math.min(rx, ry);
          } else if (isTextEntity(entity)) {
            // Text hit-test: bounding box around position
            const height = entity.height ?? entity.fontSize ?? 2.5;
            const width = entity.text.length * height * 0.6;
            isHit = worldPoint.x >= entity.position.x - hitTolerance &&
                    worldPoint.x <= entity.position.x + width + hitTolerance &&
                    worldPoint.y >= entity.position.y - height - hitTolerance &&
                    worldPoint.y <= entity.position.y + hitTolerance;
          } else if (isMTextEntity(entity)) {
            // MText hit-test: bounding box around position
            const height = entity.height ?? entity.fontSize ?? 2.5;
            const width = entity.width || (entity.text.length * height * 0.6);
            isHit = worldPoint.x >= entity.position.x - hitTolerance &&
                    worldPoint.x <= entity.position.x + width + hitTolerance &&
                    worldPoint.y >= entity.position.y - height - hitTolerance &&
                    worldPoint.y <= entity.position.y + hitTolerance;
          }

          if (isHit) {
            setSelectedEntityIds([entity.id]);
            universalSelection.clearByType('dxf-entity');
            universalSelection.select(entity.id, 'dxf-entity');
            dlog('useCanvasClickHandler', 'Rotation entity selected:', entity.id);
            return;
          }
        }
      }

      // Also check overlays (colored layers) — these are separate from scene entities
      for (const overlay of currentOverlays) {
        if (!overlay.polygon || overlay.polygon.length < 3) continue;
        const vertices = overlay.polygon.map(([x, y]) => ({ x, y }));
        if (isPointInPolygon(worldPoint, vertices)) {
          setSelectedEntityIds([overlay.id]);
          universalSelection.clearByType('dxf-entity');
          universalSelection.clearByType('overlay');
          universalSelection.select(overlay.id, 'overlay');
          dlog('useCanvasClickHandler', 'Rotation overlay selected:', overlay.id);
          return;
        }
      }

      // Click on empty space during awaiting-entity → do nothing (stay in phase)
      return;
    }

    // PRIORITY 1.5: ADR-188 — Rotation tool click (base point or angle confirmation)
    if (rotationIsActive && handleRotationClick) {
      handleRotationClick(worldPoint);
      return;
    }

    // PRIORITY 1.6: ADR-189 — Construction guide tools

    // ADR-189 §3.3: Diagonal (XZ) guide — 3-click state machine
    if (activeTool === 'guide-xz') {
      if (diagonalStep === 0 && onDiagonalStartSet) {
        // Step 0 → 1: Set start point
        onDiagonalStartSet(worldPoint);
        dlog('useCanvasClickHandler', 'Diagonal step 0: start set', worldPoint);
        return;
      }
      if (diagonalStep === 1 && onDiagonalDirectionSet) {
        // Step 1 → 2: Set direction point
        onDiagonalDirectionSet(worldPoint);
        dlog('useCanvasClickHandler', 'Diagonal step 1: direction set', worldPoint);
        return;
      }
      if (diagonalStep === 2 && diagonalStartPoint && diagonalDirectionPoint && guideAddDiagonalGuide) {
        // Step 2 → 0: Project click onto direction line → create guide → reset
        const dx = diagonalDirectionPoint.x - diagonalStartPoint.x;
        const dy = diagonalDirectionPoint.y - diagonalStartPoint.y;
        const lenSq = dx * dx + dy * dy;
        if (lenSq > 0) {
          const t = ((worldPoint.x - diagonalStartPoint.x) * dx + (worldPoint.y - diagonalStartPoint.y) * dy) / lenSq;
          const endPoint = { x: diagonalStartPoint.x + t * dx, y: diagonalStartPoint.y + t * dy };
          guideAddDiagonalGuide(diagonalStartPoint, endPoint);
          dlog('useCanvasClickHandler', 'Diagonal step 2: guide created', { start: diagonalStartPoint, end: endPoint });
        }
        onDiagonalComplete?.();
      }
      return;
    }

    if (activeTool === 'guide-x' && guideAddGuide) {
      guideAddGuide('X', worldPoint.x);
      dlog('useCanvasClickHandler', 'Guide X added at offset', worldPoint.x);
      return;
    }
    if (activeTool === 'guide-z' && guideAddGuide) {
      guideAddGuide('Y', worldPoint.y);
      dlog('useCanvasClickHandler', 'Guide Z added at offset', worldPoint.y);
      return;
    }
    if (activeTool === 'guide-delete' && guideRemoveGuide && guides && guides.length > 0) {
      // ADR-189: Find the nearest visible guide — generous tolerance (30px)
      const hitToleranceWorld = 30 / transform.scale;
      let nearestGuide: Guide | null = null;
      let nearestDist = hitToleranceWorld;
      for (const guide of guides) {
        if (!guide.visible) continue;
        let dist: number;
        if (guide.axis === 'XZ' && guide.startPoint && guide.endPoint) {
          dist = pointToSegmentDistance(worldPoint, guide.startPoint, guide.endPoint);
        } else {
          dist = guide.axis === 'X'
            ? Math.abs(worldPoint.x - guide.offset)
            : Math.abs(worldPoint.y - guide.offset);
        }
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestGuide = guide;
        }
      }
      if (nearestGuide) {
        guideRemoveGuide(nearestGuide.id);
        dlog('useCanvasClickHandler', 'Guide deleted:', nearestGuide.id);
      } else {
        dlog('useCanvasClickHandler', 'No guide within delete tolerance', {
          worldPoint, tolerance: hitToleranceWorld, guideCount: guides.length
        });
      }
      return;
    }
    if (activeTool === 'guide-parallel' && guides && guides.length > 0) {
      // ADR-189: Three-step parallel workflow
      // Step 1: Select reference guide (click near a guide)
      // Step 2: Choose side (click on desired side of guide → determines ± direction)
      // Step 3: Prompt dialog for distance (handled by CanvasSection)

      if (!parallelRefGuideId && onParallelRefSelected) {
        // Step 1: Find nearest guide to use as reference
        const hitToleranceWorld = 30 / transform.scale;
        let nearestGuide: Guide | null = null;
        let nearestDist = hitToleranceWorld;
        for (const guide of guides) {
          if (!guide.visible) continue;
          let dist: number;
          if (guide.axis === 'XZ' && guide.startPoint && guide.endPoint) {
            dist = pointToSegmentDistance(worldPoint, guide.startPoint, guide.endPoint);
          } else {
            dist = guide.axis === 'X'
              ? Math.abs(worldPoint.x - guide.offset)
              : Math.abs(worldPoint.y - guide.offset);
          }
          if (dist < nearestDist) {
            nearestDist = dist;
            nearestGuide = guide;
          }
        }
        if (nearestGuide) {
          onParallelRefSelected(nearestGuide.id);
          dlog('useCanvasClickHandler', 'Parallel step 1: reference selected', nearestGuide.id, nearestGuide.axis);
        }
        return;
      }

      if (parallelRefGuideId && onParallelSideChosen) {
        // Step 2: Determine which side of the reference guide the user clicked
        const refGuide = guides.find(g => g.id === parallelRefGuideId);
        if (refGuide) {
          let sign: 1 | -1;
          if (refGuide.axis === 'XZ' && refGuide.startPoint && refGuide.endPoint) {
            // Cross product: (click - start) × direction → sign indicates which side
            const dx = refGuide.endPoint.x - refGuide.startPoint.x;
            const dy = refGuide.endPoint.y - refGuide.startPoint.y;
            const cx = worldPoint.x - refGuide.startPoint.x;
            const cy = worldPoint.y - refGuide.startPoint.y;
            sign = (cx * dy - cy * dx) >= 0 ? 1 : -1;
          } else {
            sign = refGuide.axis === 'X'
              ? (worldPoint.x >= refGuide.offset ? 1 : -1)
              : (worldPoint.y >= refGuide.offset ? 1 : -1);
          }
          onParallelSideChosen(refGuide.id, sign);
          dlog('useCanvasClickHandler', 'Parallel step 2: side chosen', sign > 0 ? '+' : '-', refGuide.axis);
        }
        return;
      }
      return;
    }

    // PRIORITY 1.75: Perpendicular guide — click near guide → create perpendicular through click point
    if (activeTool === 'guide-perpendicular' && guides && guides.length > 0) {
      const hitToleranceWorld = 30 / transform.scale;
      let nearestGuide: Guide | null = null;
      let nearestDist = hitToleranceWorld;
      for (const guide of guides) {
        if (!guide.visible) continue;
        let dist: number;
        if (guide.axis === 'XZ' && guide.startPoint && guide.endPoint) {
          dist = pointToSegmentDistance(worldPoint, guide.startPoint, guide.endPoint);
        } else {
          dist = guide.axis === 'X'
            ? Math.abs(worldPoint.x - guide.offset)
            : Math.abs(worldPoint.y - guide.offset);
        }
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestGuide = guide;
        }
      }
      if (nearestGuide) {
        if (nearestGuide.axis === 'X' && guideAddGuide) {
          // Perpendicular to vertical → horizontal guide at click Y
          guideAddGuide('Y', worldPoint.y);
          dlog('useCanvasClickHandler', 'Perpendicular: X→Y at offset', worldPoint.y);
        } else if (nearestGuide.axis === 'Y' && guideAddGuide) {
          // Perpendicular to horizontal → vertical guide at click X
          guideAddGuide('X', worldPoint.x);
          dlog('useCanvasClickHandler', 'Perpendicular: Y→X at offset', worldPoint.x);
        } else if (nearestGuide.axis === 'XZ' && nearestGuide.startPoint && nearestGuide.endPoint && guideAddDiagonalGuide) {
          // Perpendicular to diagonal → diagonal perpendicular through projection point
          const dx = nearestGuide.endPoint.x - nearestGuide.startPoint.x;
          const dy = nearestGuide.endPoint.y - nearestGuide.startPoint.y;
          const lenSq = dx * dx + dy * dy;
          if (lenSq > 0) {
            const len = Math.sqrt(lenSq);
            // Project click onto reference to find base point
            const t = Math.max(0, Math.min(1,
              ((worldPoint.x - nearestGuide.startPoint.x) * dx + (worldPoint.y - nearestGuide.startPoint.y) * dy) / lenSq
            ));
            const base = {
              x: nearestGuide.startPoint.x + t * dx,
              y: nearestGuide.startPoint.y + t * dy,
            };
            // Perpendicular direction (normalized) × same length as reference
            const nx = -dy / len;
            const ny = dx / len;
            const halfLen = len / 2;
            const perpStart = { x: base.x - nx * halfLen, y: base.y - ny * halfLen };
            const perpEnd = { x: base.x + nx * halfLen, y: base.y + ny * halfLen };
            guideAddDiagonalGuide(perpStart, perpEnd);
            dlog('useCanvasClickHandler', 'Perpendicular: XZ diagonal through base', base);
          }
        }
      }
      return;
    }

    // PRIORITY 1.8: ADR-189 §3.15 — Add single construction point
    if (activeTool === 'guide-add-point' && cpAddPoint) {
      cpAddPoint(worldPoint);
      dlog('useCanvasClickHandler', 'Construction point added at', worldPoint);
      return;
    }

    // PRIORITY 1.82: ADR-189 §3.16 — Delete construction point
    if (activeTool === 'guide-delete-point' && cpDeletePoint && cpFindNearest) {
      const hitToleranceWorld = 30 / transform.scale;
      const nearest = cpFindNearest(worldPoint, hitToleranceWorld);
      if (nearest) {
        cpDeletePoint(nearest.id);
        dlog('useCanvasClickHandler', 'Construction point deleted:', nearest.id);
      }
      return;
    }

    // PRIORITY 1.84: ADR-189 §3.7 — Segment points (2-click + dialog)
    if (activeTool === 'guide-segments') {
      if (segmentsStep === 0 && onSegmentsStartSet) {
        onSegmentsStartSet(worldPoint);
        dlog('useCanvasClickHandler', 'Segments step 0: start set', worldPoint);
        return;
      }
      if (segmentsStep === 1 && segmentsStartPoint && onSegmentsComplete) {
        onSegmentsComplete(segmentsStartPoint, worldPoint);
        dlog('useCanvasClickHandler', 'Segments step 1: end set, opening dialog', worldPoint);
        return;
      }
      return;
    }

    // PRIORITY 1.86: ADR-189 §3.8 — Distance points (2-click + dialog)
    if (activeTool === 'guide-distance') {
      if (distanceStep === 0 && onDistanceStartSet) {
        onDistanceStartSet(worldPoint);
        dlog('useCanvasClickHandler', 'Distance step 0: start set', worldPoint);
        return;
      }
      if (distanceStep === 1 && distanceStartPoint && onDistanceComplete) {
        onDistanceComplete(distanceStartPoint, worldPoint);
        dlog('useCanvasClickHandler', 'Distance step 1: end set, opening dialog', worldPoint);
        return;
      }
      return;
    }

    // PRIORITY 1.88: ADR-189 §3.9 — Arc segment points (1-click entity pick)
    if (activeTool === 'guide-arc-segments' && onArcSegmentsPicked) {
      const scene = levelManager.currentLevelId
        ? levelManager.getLevelScene(levelManager.currentLevelId)
        : null;

      if (scene?.entities) {
        const hitTolerance = TOLERANCE_CONFIG.SNAP_DEFAULT / transform.scale;
        for (const entity of scene.entities) {
          if (isArcEntity(entity)) {
            if (pointToArcDistance(worldPoint, entity) <= hitTolerance) {
              onArcSegmentsPicked({
                center: entity.center, radius: entity.radius,
                startAngle: entity.startAngle, endAngle: entity.endAngle,
                isFullCircle: false,
              });
              return;
            }
          } else if (isCircleEntity(entity)) {
            const dx = worldPoint.x - entity.center.x;
            const dy = worldPoint.y - entity.center.y;
            if (Math.abs(Math.sqrt(dx * dx + dy * dy) - entity.radius) <= hitTolerance) {
              onArcSegmentsPicked({
                center: entity.center, radius: entity.radius,
                startAngle: 0, endAngle: 360,
                isFullCircle: true,
              });
              return;
            }
          }
        }
      }
      return;
    }

    // PRIORITY 1.89: ADR-189 §3.10 — Arc distance points (1-click entity pick)
    if (activeTool === 'guide-arc-distance' && onArcDistancePicked) {
      const scene = levelManager.currentLevelId
        ? levelManager.getLevelScene(levelManager.currentLevelId)
        : null;

      if (scene?.entities) {
        const hitTolerance = TOLERANCE_CONFIG.SNAP_DEFAULT / transform.scale;
        for (const entity of scene.entities) {
          if (isArcEntity(entity)) {
            if (pointToArcDistance(worldPoint, entity) <= hitTolerance) {
              onArcDistancePicked({
                center: entity.center, radius: entity.radius,
                startAngle: entity.startAngle, endAngle: entity.endAngle,
                isFullCircle: false,
              });
              return;
            }
          } else if (isCircleEntity(entity)) {
            const dx = worldPoint.x - entity.center.x;
            const dy = worldPoint.y - entity.center.y;
            if (Math.abs(Math.sqrt(dx * dx + dy * dy) - entity.radius) <= hitTolerance) {
              onArcDistancePicked({
                center: entity.center, radius: entity.radius,
                startAngle: 0, endAngle: 360,
                isFullCircle: true,
              });
              return;
            }
          }
        }
      }
      return;
    }

    // PRIORITY 1.895: ADR-189 §3.12 — Arc-Line intersection (2-click: line → arc)
    if (activeTool === 'guide-arc-line-intersect') {
      const scene = levelManager.currentLevelId
        ? levelManager.getLevelScene(levelManager.currentLevelId)
        : null;

      if (scene?.entities) {
        const hitTolerance = TOLERANCE_CONFIG.SNAP_DEFAULT / transform.scale;

        if (arcLineStep === 0 && onArcLineLinePicked) {
          // Step 0: Pick a line entity
          for (const entity of scene.entities) {
            if (isLineEntity(entity)) {
              if (pointToLineDistance(worldPoint, entity.start, entity.end) <= hitTolerance) {
                onArcLineLinePicked({ start: entity.start, end: entity.end });
                return;
              }
            }
          }
        } else if (arcLineStep === 1 && onArcLineArcPicked) {
          // Step 1: Pick an arc/circle entity
          for (const entity of scene.entities) {
            if (isArcEntity(entity)) {
              if (pointToArcDistance(worldPoint, entity) <= hitTolerance) {
                onArcLineArcPicked({
                  center: entity.center, radius: entity.radius,
                  startAngle: entity.startAngle, endAngle: entity.endAngle,
                  isFullCircle: false,
                });
                return;
              }
            } else if (isCircleEntity(entity)) {
              const dx = worldPoint.x - entity.center.x;
              const dy = worldPoint.y - entity.center.y;
              if (Math.abs(Math.sqrt(dx * dx + dy * dy) - entity.radius) <= hitTolerance) {
                onArcLineArcPicked({
                  center: entity.center, radius: entity.radius,
                  startAngle: 0, endAngle: 360,
                  isFullCircle: true,
                });
                return;
              }
            }
          }
        }
      }
      return;
    }

    // PRIORITY 1.9: Angle entity measurement picking (constraint, line-arc, two-arcs)
    if (angleEntityMeasurement.isActive && angleEntityMeasurement.isWaitingForEntitySelection) {
      const scene = levelManager.currentLevelId
        ? levelManager.getLevelScene(levelManager.currentLevelId)
        : null;

      if (scene?.entities) {
        const hitTolerance = TOLERANCE_CONFIG.SNAP_DEFAULT / transform.scale;

        for (const entity of scene.entities) {
          // Check if this entity type is accepted for the current step
          if (!angleEntityMeasurement.acceptsEntityType(entity.type)) continue;

          let isHit = false;

          if (isLineEntity(entity)) {
            isHit = pointToLineDistance(worldPoint, entity.start, entity.end) <= hitTolerance;
          } else if (isArcEntity(entity)) {
            isHit = pointToArcDistance(worldPoint, entity) <= hitTolerance;
          } else if (isPolylineEntity(entity)) {
            // Polyline segments count as lines
            if (entity.vertices && entity.vertices.length >= 2) {
              for (let i = 0; i < entity.vertices.length - 1; i++) {
                if (pointToLineDistance(worldPoint, entity.vertices[i], entity.vertices[i + 1]) <= hitTolerance) {
                  isHit = true;
                  break;
                }
              }
            }
          }

          if (isHit) {
            const stepBeforeClick = angleEntityMeasurement.currentStep;
            const accepted = angleEntityMeasurement.onEntityClick(entity as AnySceneEntity, worldPoint);
            if (accepted) {
              // Visual feedback: highlight first entity, clear after measurement created
              if (stepBeforeClick === 0) {
                setSelectedEntityIds([entity.id]);
              } else {
                setSelectedEntityIds([]);
              }
              dlog('useCanvasClickHandler', 'AngleEntityMeasurement entity accepted:', entity.id, 'step:', stepBeforeClick);
              return;
            }
          }
        }
        dlog('useCanvasClickHandler', 'AngleEntityMeasurement: No matching entity at click point');
      }
      return;
    }

    // PRIORITY 2: Circle TTT entity picking
    if (activeTool === 'circle-ttt' && circleTTT.isWaitingForSelection) {
      const scene = levelManager.currentLevelId
        ? levelManager.getLevelScene(levelManager.currentLevelId)
        : null;

      if (scene?.entities) {
        const hitTolerance = TOLERANCE_CONFIG.SNAP_DEFAULT / transform.scale;

        for (const entity of scene.entities) {
          if (isLineEntity(entity) || isPolylineEntity(entity)) {
            let isHit = false;

            if (isLineEntity(entity)) {
              isHit = pointToLineDistance(worldPoint, entity.start, entity.end) <= hitTolerance;
            } else if (isPolylineEntity(entity)) {
              if (entity.vertices && entity.vertices.length >= 2) {
                for (let i = 0; i < entity.vertices.length - 1; i++) {
                  if (pointToLineDistance(worldPoint, entity.vertices[i], entity.vertices[i + 1]) <= hitTolerance) {
                    isHit = true;
                    break;
                  }
                }
                if (!isHit && entity.closed && entity.vertices.length > 2) {
                  isHit = pointToLineDistance(worldPoint, entity.vertices[entity.vertices.length - 1], entity.vertices[0]) <= hitTolerance;
                }
              }
            }

            if (isHit) {
              const accepted = circleTTT.onEntityClick(entity as AnySceneEntity, worldPoint);
              if (accepted) {
                dlog('useCanvasClickHandler', 'Circle TTT entity accepted:', entity.id);
                return;
              }
            }
          }
        }
        dlog('useCanvasClickHandler', 'Circle TTT: No line/polyline found at click point');
      }
      return;
    }

    // PRIORITY 3: Line Perpendicular entity picking
    if (activeTool === 'line-perpendicular' && linePerpendicular.isActive) {
      if (linePerpendicular.currentStep === 0) {
        const scene = levelManager.currentLevelId
          ? levelManager.getLevelScene(levelManager.currentLevelId)
          : null;

        if (scene?.entities) {
          const hitTolerance = TOLERANCE_CONFIG.SNAP_DEFAULT / transform.scale;
          for (const entity of scene.entities) {
            if (isLineEntity(entity)) {
              if (pointToLineDistance(worldPoint, entity.start, entity.end) <= hitTolerance) {
                const accepted = linePerpendicular.onEntityClick(entity as AnySceneEntity, worldPoint);
                if (accepted) {
                  dlog('useCanvasClickHandler', 'LinePerpendicular entity accepted:', entity.id);
                  return;
                }
              }
            }
          }
          dlog('useCanvasClickHandler', 'LinePerpendicular: No line found at click point');
        }
        return;
      } else if (linePerpendicular.currentStep === 1) {
        linePerpendicular.onCanvasClick?.(worldPoint);
        return;
      }
    }

    // PRIORITY 4: Line Parallel entity picking
    if (activeTool === 'line-parallel' && lineParallel.isActive) {
      if (lineParallel.currentStep === 0) {
        const scene = levelManager.currentLevelId
          ? levelManager.getLevelScene(levelManager.currentLevelId)
          : null;

        if (scene?.entities) {
          const hitTolerance = TOLERANCE_CONFIG.SNAP_DEFAULT / transform.scale;
          for (const entity of scene.entities) {
            if (isLineEntity(entity)) {
              if (pointToLineDistance(worldPoint, entity.start, entity.end) <= hitTolerance) {
                const accepted = lineParallel.onEntityClick(entity as AnySceneEntity, worldPoint);
                if (accepted) {
                  dlog('useCanvasClickHandler', 'LineParallel entity accepted:', entity.id);
                  return;
                }
              }
            }
          }
          dlog('useCanvasClickHandler', 'LineParallel: No line found at click point');
        }
        return;
      } else if (lineParallel.currentStep === 1) {
        lineParallel.onCanvasClick?.(worldPoint);
        return;
      }
    }

    // PRIORITY 5: Overlay polygon drawing
    if (overlayMode === 'draw') {
      if (isSavingPolygon) return;

      // Auto-close: click near first point with 3+ points → save
      if (isNearFirstPoint && draftPolygon.length >= 3) {
        setIsSavingPolygon(true);
        finishDrawingWithPolygonRef.current(draftPolygon).then(success => {
          setIsSavingPolygon(false);
          if (success) setDraftPolygon([]);
        });
        return;
      }

      const worldPointArray: [number, number] = [worldPoint.x, worldPoint.y];
      setDraftPolygon(prev => [...prev, worldPointArray]);
      return;
    }

    // PRIORITY 6: Unified drawing/measurement tools
    if (isInteractiveTool(activeTool) && drawingHandlersRef.current) {
      drawingHandlersRef.current.onDrawingPoint?.(worldPoint);
      return;
    }

    // PRIORITY 7: Move tool — overlay body hit-test
    if (activeTool === 'move' && !draggingOverlayBody) {
      for (const overlay of currentOverlays) {
        if (!overlay.polygon || overlay.polygon.length < 3) continue;
        const vertices = overlay.polygon.map(([x, y]) => ({ x, y }));
        if (isPointInPolygon(worldPoint, vertices)) {
          handleOverlayClick(overlay.id, worldPoint);
          return;
        }
      }
    }

    // Move tool during drag — skip (drag-end handled by handleContainerMouseUp)
    if (activeTool === 'move' && draggingOverlayBody) {
      return;
    }

    // PRIORITY 8: Deselect on empty canvas click
    {
      const isClickOnGrip = hoveredVertexInfo !== null || hoveredEdgeInfo !== null;
      const hasSelectedGrip = selectedGrip !== null;
      const justFinishedDrag = justFinishedDragRef.current;

      if (!isClickOnGrip && !hasSelectedGrip && !justFinishedDrag && !entitySelectedOnMouseDownRef.current) {
        universalSelection.clearByType('overlay');
        universalSelection.clearByType('dxf-entity');
        setSelectedGrips([]);
        setSelectedEntityIds([]);
      }
      entitySelectedOnMouseDownRef.current = false;
    }
  }, [
    viewportReady, viewport, transform,
    activeTool, overlayMode,
    circleTTT, linePerpendicular, lineParallel, angleEntityMeasurement, dxfGripInteraction,
    rotationIsActive, handleRotationClick,
    levelManager,
    draftPolygon, isSavingPolygon, isNearFirstPoint,
    finishDrawingWithPolygonRef, drawingHandlersRef, entitySelectedOnMouseDownRef,
    universalSelection,
    hoveredVertexInfo, hoveredEdgeInfo, selectedGrip,
    setSelectedGrips, justFinishedDragRef,
    draggingOverlayBody, setSelectedEntityIds,
    currentOverlays, handleOverlayClick,
    setDraftPolygon, setIsSavingPolygon,
    // ADR-189
    guideAddGuide, guideRemoveGuide, guides,
    parallelRefGuideId, onParallelRefSelected, onParallelSideChosen,
    // ADR-189 construction points
    cpAddPoint, cpDeletePoint, cpFindNearest,
    segmentsStep, segmentsStartPoint, onSegmentsStartSet, onSegmentsComplete,
    distanceStep, distanceStartPoint, onDistanceStartSet, onDistanceComplete,
    // ADR-189 §3.9/3.10/3.12
    onArcSegmentsPicked, onArcDistancePicked,
    arcLineStep, onArcLineLinePicked, onArcLineArcPicked,
  ]);

  return { handleCanvasClick };
}
