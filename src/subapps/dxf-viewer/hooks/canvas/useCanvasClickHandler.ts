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
import { isLineEntity, isPolylineEntity, isArcEntity } from '../../types/entities';
import { pointToLineDistance } from '../../rendering/entities/shared/geometry-utils';
import { pointToArcDistance } from '../../utils/angle-entity-math';
import { isInteractiveTool } from '../../systems/tools/ToolStateManager';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import { dlog, dwarn } from '../../debug';
// ADR-189: Guide system imports
import type { Guide } from '../../systems/guides/guide-types';
import type { GridAxis } from '../../ai-assistant/grid-types';
import type { CreateGuideCommand, DeleteGuideCommand, CreateParallelGuideCommand } from '../../systems/guides/guide-commands';

// ============================================================================
// TYPES
// ============================================================================

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
  guideAddParallelGuide?: (refId: string, dist: number) => CreateParallelGuideCommand;
  guides?: readonly Guide[];
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
    guideAddGuide, guideRemoveGuide, guideAddParallelGuide, guides,
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
            setSelectedEntityIds([entity.id]);
            universalSelection.clearByType('dxf-entity');
            universalSelection.select(entity.id, 'dxf-entity');
            dlog('useCanvasClickHandler', 'Rotation entity selected:', entity.id);
            return;
          }
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
        const dist = guide.axis === 'X'
          ? Math.abs(worldPoint.x - guide.offset)
          : Math.abs(worldPoint.y - guide.offset);
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
    if (activeTool === 'guide-parallel' && guideAddParallelGuide && guides && guides.length > 0) {
      // ADR-189: Find nearest guide as reference — no distance limit
      // The click position determines the offset for the new parallel guide
      let nearestGuide: Guide | null = null;
      let nearestDist = Infinity;
      for (const guide of guides) {
        if (!guide.visible) continue;
        const dist = guide.axis === 'X'
          ? Math.abs(worldPoint.x - guide.offset)
          : Math.abs(worldPoint.y - guide.offset);
        if (dist < nearestDist) {
          nearestDist = dist;
          nearestGuide = guide;
        }
      }
      if (nearestGuide) {
        const offsetDistance = nearestGuide.axis === 'X'
          ? worldPoint.x - nearestGuide.offset
          : worldPoint.y - nearestGuide.offset;
        // MIN_OFFSET_DELTA check is in GuideStore.addGuideRaw — skip near-zero offsets
        if (Math.abs(offsetDistance) > 0.01) {
          guideAddParallelGuide(nearestGuide.id, offsetDistance);
          dlog('useCanvasClickHandler', 'Parallel guide created from', nearestGuide.id, 'offset', offsetDistance);
        } else {
          dlog('useCanvasClickHandler', 'Parallel offset too small — click further from the guide');
        }
      }
      return;
    }

    // PRIORITY 1.8: Angle entity measurement picking (constraint, line-arc, two-arcs)
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
            const accepted = angleEntityMeasurement.onEntityClick(entity as AnySceneEntity, worldPoint);
            if (accepted) {
              dlog('useCanvasClickHandler', 'AngleEntityMeasurement entity accepted:', entity.id);
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
    guideAddGuide, guideRemoveGuide, guideAddParallelGuide, guides,
  ]);

  return { handleCanvasClick };
}
