/**
 * 🏢 ENTERPRISE: useCanvasClickHandler Hook
 *
 * @description Handles all canvas click logic with priority-based routing:
 * 1. Grip interaction (DXF entity grips)
 * 1.3. Rotation tool entity selection (awaiting-entity phase)
 * 1.5. Rotation tool click (base point or angle confirmation)
 * 1.6. Guide tool clicks (delegated to guide-click-handlers.ts)
 * 1.9. Angle entity measurement picking (delegated to entity-pick-handlers.ts)
 * 2. Circle TTT entity picking (delegated to entity-pick-handlers.ts)
 * 3. Line Perpendicular entity picking (delegated to entity-pick-handlers.ts)
 * 4. Line Parallel entity picking (delegated to entity-pick-handlers.ts)
 * 5. Overlay polygon drawing (draftPolygon)
 * 6. Unified drawing/measurement tools
 * 7. Move tool overlay body drag
 * 8. Empty canvas deselection
 *
 * EXTRACTED FROM: CanvasSection.tsx — ~260 lines of click routing logic
 * SPLIT: Types → canvas-click-types.ts, Guides → guide-click-handlers.ts,
 *        Entity picks → entity-pick-handlers.ts
 *
 * @see ADR-030: Universal Selection System
 * @see ADR-046: World Coordinate Click Pattern
 * @see ADR-147: Centralized Hit Tolerance
 */

'use client';

import { useCallback } from 'react';

import type { Point2D } from '../../rendering/types/Types';
import {
  isLineEntity, isPolylineEntity, isLWPolylineEntity,
  isArcEntity, isCircleEntity, isRectangleEntity, isRectEntity,
  isTextEntity, isMTextEntity, isEllipseEntity,
} from '../../types/entities';
import { pointToLineDistance } from '../../rendering/entities/shared/geometry-utils';
import { pointToArcDistance } from '../../utils/angle-entity-math';
import { isInteractiveTool } from '../../systems/tools/ToolStateManager';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import { dlog, dwarn } from '../../debug';

// ── Re-exports for backward compatibility ───────────────────────────────────
export type {
  ArcPickableEntity,
  LinePickableEntity,
  UseCanvasClickHandlerParams,
  UseCanvasClickHandlerReturn,
} from './canvas-click-types';

import type { UseCanvasClickHandlerParams, UseCanvasClickHandlerReturn } from './canvas-click-types';
import { handleGuideToolClick } from './guide-click-handlers';
import type { GuideClickContext } from './guide-click-handlers';
import {
  handleAngleEntityPick,
  handleCircleTTTPick,
  handleLinePerpendicularPick,
  handleLineParallelPick,
} from './entity-pick-handlers';
import type { EntityPickContext } from './entity-pick-handlers';

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
  } = params;

  const handleCanvasClick = useCallback((worldPoint: Point2D, shiftKey: boolean = false) => {
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
    if (activeTool === 'rotate' && !rotationIsActive) {
      if (handleRotationEntitySelection(worldPoint, params)) return;
      return; // Click on empty space during awaiting-entity → stay in phase
    }

    // PRIORITY 1.5: ADR-188 — Rotation tool click (base point or angle confirmation)
    if (rotationIsActive && handleRotationClick) {
      handleRotationClick(worldPoint);
      return;
    }

    // PRIORITY 1.6: ADR-189 — Construction guide tools
    const guideCtx: GuideClickContext = { worldPoint, shiftKey, transform, levelManager };
    if (handleGuideToolClick(guideCtx, params)) {
      return;
    }

    // PRIORITY 1.9-4: Entity picking tools (angle, circle-ttt, perpendicular, parallel)
    const entityCtx: EntityPickContext = { worldPoint, transform, levelManager };

    if (handleAngleEntityPick(entityCtx, angleEntityMeasurement, setSelectedEntityIds)) return;
    if (handleCircleTTTPick(entityCtx, circleTTT, activeTool)) return;
    if (handleLinePerpendicularPick(entityCtx, linePerpendicular, activeTool)) return;
    if (handleLineParallelPick(entityCtx, lineParallel, activeTool)) return;

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
    // Pass full params to delegated handlers
    params,
  ]);

  return { handleCanvasClick };
}

// ============================================================================
// ROTATION ENTITY SELECTION (PRIORITY 1.3)
// ============================================================================

/**
 * ADR-188: Rotation tool entity selection in awaiting-entity phase.
 * Checks scene entities + overlays for hit. Returns true if entity was selected.
 */
function handleRotationEntitySelection(
  worldPoint: Point2D,
  p: UseCanvasClickHandlerParams,
): boolean {
  const scene = p.levelManager.currentLevelId
    ? p.levelManager.getLevelScene(p.levelManager.currentLevelId)
    : null;

  if (scene?.entities) {
    const hitTolerance = TOLERANCE_CONFIG.SNAP_DEFAULT / p.transform.scale;

    for (const entity of scene.entities) {
      if (testEntityHit(worldPoint, entity, hitTolerance)) {
        p.setSelectedEntityIds([entity.id]);
        p.universalSelection.clearByType('dxf-entity');
        p.universalSelection.select(entity.id, 'dxf-entity');
        dlog('useCanvasClickHandler', 'Rotation entity selected:', entity.id);
        return true;
      }
    }
  }

  // Check overlays (colored layers)
  for (const overlay of p.currentOverlays) {
    if (!overlay.polygon || overlay.polygon.length < 3) continue;
    const vertices = overlay.polygon.map(([x, y]) => ({ x, y }));
    if (isPointInPolygon(worldPoint, vertices)) {
      p.setSelectedEntityIds([overlay.id]);
      p.universalSelection.clearByType('dxf-entity');
      p.universalSelection.clearByType('overlay');
      p.universalSelection.select(overlay.id, 'overlay');
      dlog('useCanvasClickHandler', 'Rotation overlay selected:', overlay.id);
      return true;
    }
  }

  return false;
}

// ============================================================================
// ENTITY HIT-TESTING (used by rotation selection)
// ============================================================================

/**
 * Tests if a world point hits any entity type. Returns true if hit.
 * Supports: LINE, ARC, CIRCLE, POLYLINE, LWPOLYLINE, RECTANGLE, ELLIPSE, TEXT, MTEXT.
 */
function testEntityHit(
  worldPoint: Point2D,
  entity: { type: string; id: string; [key: string]: unknown },
  hitTolerance: number,
): boolean {
  if (isLineEntity(entity)) {
    return pointToLineDistance(worldPoint, entity.start, entity.end) <= hitTolerance;
  }

  if (isArcEntity(entity)) {
    return pointToArcDistance(worldPoint, entity) <= hitTolerance;
  }

  if (isCircleEntity(entity)) {
    const dx = worldPoint.x - entity.center.x;
    const dy = worldPoint.y - entity.center.y;
    const distFromCenter = Math.sqrt(dx * dx + dy * dy);
    return Math.abs(distFromCenter - entity.radius) <= hitTolerance;
  }

  if (isPolylineEntity(entity)) {
    return testPolylineHit(worldPoint, entity.vertices, entity.closed, hitTolerance);
  }

  if (isLWPolylineEntity(entity)) {
    return testPolylineHit(worldPoint, entity.vertices, entity.closed, hitTolerance);
  }

  if (isRectangleEntity(entity) || isRectEntity(entity)) {
    const { x, y, width: w, height: h } = entity;
    const corners = [
      { x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h },
    ];
    for (let i = 0; i < 4; i++) {
      if (pointToLineDistance(worldPoint, corners[i], corners[(i + 1) % 4]) <= hitTolerance) {
        return true;
      }
    }
    return false;
  }

  if (isEllipseEntity(entity)) {
    const dx = worldPoint.x - entity.center.x;
    const dy = worldPoint.y - entity.center.y;
    const rx = entity.majorAxis;
    const ry = entity.minorAxis;
    const normalizedDist = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
    return Math.abs(normalizedDist - 1) <= hitTolerance / Math.min(rx, ry);
  }

  if (isTextEntity(entity)) {
    const height = entity.height ?? entity.fontSize ?? 2.5;
    const width = entity.text.length * height * 0.6;
    return worldPoint.x >= entity.position.x - hitTolerance &&
           worldPoint.x <= entity.position.x + width + hitTolerance &&
           worldPoint.y >= entity.position.y - height - hitTolerance &&
           worldPoint.y <= entity.position.y + hitTolerance;
  }

  if (isMTextEntity(entity)) {
    const height = entity.height ?? entity.fontSize ?? 2.5;
    const width = entity.width || (entity.text.length * height * 0.6);
    return worldPoint.x >= entity.position.x - hitTolerance &&
           worldPoint.x <= entity.position.x + width + hitTolerance &&
           worldPoint.y >= entity.position.y - height - hitTolerance &&
           worldPoint.y <= entity.position.y + hitTolerance;
  }

  return false;
}

/** Helper: Test if point hits a polyline (vertices + optional closed) */
function testPolylineHit(
  worldPoint: Point2D,
  vertices: ReadonlyArray<{ x: number; y: number }> | undefined,
  closed: boolean | undefined,
  hitTolerance: number,
): boolean {
  if (!vertices || vertices.length < 2) return false;

  for (let i = 0; i < vertices.length - 1; i++) {
    if (pointToLineDistance(worldPoint, vertices[i], vertices[i + 1]) <= hitTolerance) {
      return true;
    }
  }
  if (closed && vertices.length > 2) {
    if (pointToLineDistance(worldPoint, vertices[vertices.length - 1], vertices[0]) <= hitTolerance) {
      return true;
    }
  }
  return false;
}
