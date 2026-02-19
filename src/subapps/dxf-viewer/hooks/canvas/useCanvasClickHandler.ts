/**
 * 🏢 ENTERPRISE: useCanvasClickHandler Hook
 *
 * @description Handles all canvas click logic with priority-based routing:
 * 1. Grip interaction (DXF entity grips)
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
import { isLineEntity, isPolylineEntity } from '../../types/entities';
import { pointToLineDistance } from '../../rendering/entities/shared/geometry-utils';
import { isInteractiveTool } from '../../systems/tools/ToolStateManager';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import { dlog, dwarn } from '../../debug';

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
    circleTTT, linePerpendicular, lineParallel, dxfGripInteraction,
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

    // PRIORITY 1.5: ADR-188 — Rotation tool click (base point or angle confirmation)
    if (rotationIsActive && handleRotationClick) {
      handleRotationClick(worldPoint);
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
    circleTTT, linePerpendicular, lineParallel, dxfGripInteraction,
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
  ]);

  return { handleCanvasClick };
}
