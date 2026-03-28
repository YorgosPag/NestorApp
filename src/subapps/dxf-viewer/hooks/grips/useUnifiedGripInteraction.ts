/**
 * ADR-183: Unified Grip System — useUnifiedGripInteraction
 *
 * Single hook that manages ALL grip interactions for both DXF entities and overlay polygons.
 * State machine: idle → hovering → warm → dragging → commit/cancel → idle
 *
 * Split: unified-grip-types (types), grip-projections (projection builders).
 *
 * @see unified-grip-types.ts — type definitions
 * @see grip-projections.ts — backward-compatible projection builders
 * @see grip-registry.ts — grip computation
 * @see grip-hit-testing.ts — proximity detection
 * @see grip-commit-adapters.ts — commit logic
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { Overlay } from '../../overlays/types';
import { GRIP_CONFIG } from '../useGripMovement';
import { PANEL_LAYOUT } from '../../config/panel-tokens';

import type {
  UnifiedGripInfo,
  UnifiedGripPhase,
  UseUnifiedGripInteractionParams,
  UseUnifiedGripInteractionReturn,
  DxfProjection,
  SelectedGrip,
  DraggingVertexState,
  DraggingEdgeMidpointState,
  DraggingOverlayBodyState,
  GripHoverThrottle,
} from './unified-grip-types';

import { useGripRegistry } from './grip-registry';
import { findNearestGrip } from './grip-hit-testing';
import {
  commitDxfGripDrag,
  commitOverlayVertexDrag,
  commitOverlayEdgeMidpointDrag,
  commitOverlayBodyDrag,
  type DxfCommitDeps,
  type OverlayCommitDeps,
} from './grip-commit-adapters';

import {
  buildDxfDragPreview,
  buildGripInteractionState,
  buildOverlayHoveredVertex,
  buildOverlayHoveredEdge,
  buildOverlayProjection,
  buildGripStateForStack,
} from './grip-projections';

import { useMoveEntities } from '../useMoveEntities';
import { useCommandHistory } from '../../core/commands';
import { useLevels } from '../../systems/levels';

// Re-export types for consumers
export type { UseUnifiedGripInteractionParams, UseUnifiedGripInteractionReturn, DxfProjection };
export type { OverlayProjection } from './unified-grip-types';

const WARM_DELAY_MS = 1000;
const GRIP_HOVER_THROTTLE_MS = 100;

// ============================================================================
// HOOK
// ============================================================================

export function useUnifiedGripInteraction(
  params: UseUnifiedGripInteractionParams,
): UseUnifiedGripInteractionReturn {
  const {
    selectedEntityIds, dxfScene, transform,
    currentOverlays, universalSelection, overlayStore, overlayStoreRef,
    activeTool, gripSettings, executeCommand, movementDetectionThreshold,
  } = params;

  // ── Commit deps ──
  const { moveEntities } = useMoveEntities();
  const { execute } = useCommandHistory();
  const { currentLevelId, getLevelScene, setLevelScene } = useLevels();

  const dxfCommitDeps = useMemo<DxfCommitDeps>(
    () => ({ moveEntities, execute, currentLevelId, getLevelScene, setLevelScene }),
    [moveEntities, execute, currentLevelId, getLevelScene, setLevelScene],
  );

  const overlayCommitDeps = useMemo<OverlayCommitDeps>(
    () => ({ overlayStore, executeCommand, movementDetectionThreshold }),
    [overlayStore, executeCommand, movementDetectionThreshold],
  );

  // ── Selected overlays ──
  const selectedOverlays = useMemo(() => {
    const overlayIds = universalSelection.getIdsByType('overlay');
    return overlayIds
      .map((id) => currentOverlays.find((o) => o.id === id))
      .filter((o): o is Overlay => o !== undefined);
  }, [universalSelection, currentOverlays]);

  // ── Grip registry ──
  const allGrips = useGripRegistry({ dxfScene, selectedEntityIds, selectedOverlays });

  // ── Core state ──
  const [phase, setPhase] = useState<UnifiedGripPhase>('idle');
  const [hoveredGrip, setHoveredGrip] = useState<UnifiedGripInfo | null>(null);
  const [activeGrip, setActiveGrip] = useState<UnifiedGripInfo | null>(null);
  const [currentWorldPos, setCurrentWorldPos] = useState<Point2D | null>(null);
  const anchorRef = useRef<Point2D | null>(null);
  const warmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Overlay grip state (backward compat) ──
  const [selectedGrips, setSelectedGrips] = useState<SelectedGrip[]>([]);
  const [draggingVertices, setDraggingVertices] = useState<DraggingVertexState[] | null>(null);
  const [draggingEdgeMidpoint, setDraggingEdgeMidpoint] = useState<DraggingEdgeMidpointState | null>(null);
  const [draggingOverlayBody, setDraggingOverlayBody] = useState<DraggingOverlayBodyState | null>(null);
  const [dragPreviewPosition, setDragPreviewPosition] = useState<Point2D | null>(null);

  // ── Refs ──
  const gripHoverThrottleRef = useRef<GripHoverThrottle>({ lastCheckTime: 0, lastWorldPoint: null });
  const justFinishedDragRef = useRef(false);

  const markDragFinished = useCallback(() => {
    justFinishedDragRef.current = true;
    setTimeout(() => { justFinishedDragRef.current = false; }, PANEL_LAYOUT.TIMING.DRAG_FINISH_RESET);
  }, []);

  const isGripMode = activeTool === 'select' || activeTool === 'layering';

  // ── Reset on selection change ──
  const entitySelectionKey = selectedEntityIds.join(',');
  const overlaySelectionKey = selectedOverlays.map((o) => o.id).join(',');

  useEffect(() => {
    setPhase('idle');
    setHoveredGrip(null);
    setActiveGrip(null);
    setCurrentWorldPos(null);
    anchorRef.current = null;
    if (warmTimerRef.current) { clearTimeout(warmTimerRef.current); warmTimerRef.current = null; }
  }, [entitySelectionKey, overlaySelectionKey]);

  useEffect(() => () => { if (warmTimerRef.current) clearTimeout(warmTimerRef.current); }, []);

  // ── Hit tolerance ──
  const hitTolerancePx = (gripSettings.gripSize ?? 5) * (gripSettings.dpiScale ?? 1.0) + 2;
  const effectiveTolerance = Math.max(hitTolerancePx, GRIP_CONFIG.HIT_TOLERANCE);

  const resetToIdle = useCallback(() => {
    setPhase('idle');
    setActiveGrip(null);
    setHoveredGrip(null);
    setCurrentWorldPos(null);
    anchorRef.current = null;
  }, []);

  // ── MOUSE MOVE ──

  const handleMouseMove = useCallback(
    (worldPos: Point2D, _screenPos: Point2D) => {
      if (!isGripMode || allGrips.length === 0) return;

      const now = performance.now();
      const throttle = gripHoverThrottleRef.current;
      if (phase !== 'dragging' && now - throttle.lastCheckTime < GRIP_HOVER_THROTTLE_MS) return;
      if (phase !== 'dragging') throttle.lastCheckTime = now;
      throttle.lastWorldPoint = worldPos;

      if (phase === 'dragging' && activeGrip) {
        setCurrentWorldPos(worldPos);
        if (activeGrip.source === 'overlay') setDragPreviewPosition(worldPos);
        return;
      }

      const nearGrip = findNearestGrip(worldPos, allGrips, effectiveTolerance, transform.scale);
      if (nearGrip) {
        if (!hoveredGrip || hoveredGrip.id !== nearGrip.id) {
          setHoveredGrip(nearGrip);
          setPhase('hovering');
          if (warmTimerRef.current) clearTimeout(warmTimerRef.current);
          warmTimerRef.current = setTimeout(() => { setPhase('warm'); warmTimerRef.current = null; }, WARM_DELAY_MS);
        }
      } else if (hoveredGrip && phase !== 'dragging') {
        setHoveredGrip(null);
        setPhase('idle');
        if (warmTimerRef.current) { clearTimeout(warmTimerRef.current); warmTimerRef.current = null; }
      }
    },
    [isGripMode, allGrips, phase, activeGrip, hoveredGrip, effectiveTolerance, transform.scale],
  );

  // ── MOUSE DOWN ──

  const handleMouseDown = useCallback(
    (worldPos: Point2D, isShift: boolean): boolean => {
      if (!isGripMode || allGrips.length === 0 || phase === 'dragging') return false;

      const nearGrip = findNearestGrip(worldPos, allGrips, effectiveTolerance, transform.scale);
      if (!nearGrip) {
        if (!isShift && selectedGrips.length > 0) setSelectedGrips([]);
        return false;
      }

      // DXF grip
      if (nearGrip.source === 'dxf') {
        setActiveGrip(nearGrip);
        setPhase('dragging');
        anchorRef.current = nearGrip.position;
        setCurrentWorldPos(nearGrip.position);
        if (warmTimerRef.current) { clearTimeout(warmTimerRef.current); warmTimerRef.current = null; }
        return true;
      }

      // Overlay grip
      if (nearGrip.source === 'overlay') {
        if (!universalSelection.isSelected(nearGrip.overlayId!)) {
          if (!isShift && selectedGrips.length > 0) setSelectedGrips([]);
          return false;
        }

        // Vertex grip
        if (nearGrip.type === 'vertex') {
          const clickedGrip: SelectedGrip = { type: 'vertex', overlayId: nearGrip.overlayId!, index: nearGrip.gripIndex };
          const isAlreadySelected = selectedGrips.some(
            (g) => g.type === 'vertex' && g.overlayId === clickedGrip.overlayId && g.index === clickedGrip.index,
          );

          if (isShift) {
            if (isAlreadySelected) {
              setSelectedGrips(selectedGrips.filter(
                (g) => !(g.type === 'vertex' && g.overlayId === clickedGrip.overlayId && g.index === clickedGrip.index),
              ));
            } else {
              setSelectedGrips([...selectedGrips, clickedGrip]);
            }
            return true;
          }

          const gripsToMove = isAlreadySelected ? selectedGrips.filter((g) => g.type === 'vertex') : [clickedGrip];
          if (!isAlreadySelected) setSelectedGrips([clickedGrip]);

          if (gripsToMove.length > 0) {
            const store = overlayStoreRef.current;
            const draggingData: DraggingVertexState[] = gripsToMove.map((grip) => {
              const overlay = store.overlays[grip.overlayId];
              const originalPosition = overlay?.polygon?.[grip.index]
                ? { x: overlay.polygon[grip.index][0], y: overlay.polygon[grip.index][1] }
                : worldPos;
              return { overlayId: grip.overlayId, vertexIndex: grip.index, startPoint: worldPos, originalPosition };
            });
            setDraggingVertices(draggingData);
            setDragPreviewPosition(worldPos);
            setActiveGrip(nearGrip);
            setPhase('dragging');
            anchorRef.current = nearGrip.position;
            setCurrentWorldPos(nearGrip.position);
          }
          return true;
        }

        // Edge midpoint grip
        if (nearGrip.type === 'edge' && nearGrip.edgeInsertIndex !== undefined) {
          const edgeIndex = nearGrip.gripIndex - (currentOverlays.find((o) => o.id === nearGrip.overlayId)?.polygon?.length ?? 0);
          setSelectedGrips([{ type: 'edge-midpoint', overlayId: nearGrip.overlayId!, index: edgeIndex }]);
          setDraggingEdgeMidpoint({
            overlayId: nearGrip.overlayId!, edgeIndex, insertIndex: nearGrip.edgeInsertIndex,
            startPoint: worldPos, newVertexCreated: false,
          });
          setDragPreviewPosition(worldPos);
          setActiveGrip(nearGrip);
          setPhase('dragging');
          anchorRef.current = nearGrip.position;
          setCurrentWorldPos(nearGrip.position);
          if (warmTimerRef.current) { clearTimeout(warmTimerRef.current); warmTimerRef.current = null; }
          return true;
        }
      }
      return false;
    },
    [isGripMode, allGrips, phase, effectiveTolerance, transform.scale, selectedGrips, universalSelection, overlayStoreRef, currentOverlays],
  );

  // ── MOUSE UP ──

  const handleMouseUp = useCallback(
    async (worldPos: Point2D): Promise<boolean> => {
      if (phase === 'dragging' && activeGrip?.source === 'dxf' && anchorRef.current) {
        const delta: Point2D = { x: worldPos.x - anchorRef.current.x, y: worldPos.y - anchorRef.current.y };
        commitDxfGripDrag(activeGrip, delta, dxfCommitDeps);
        resetToIdle();
        return true;
      }

      if (draggingVertices && draggingVertices.length > 0) {
        const delta = { x: worldPos.x - draggingVertices[0].startPoint.x, y: worldPos.y - draggingVertices[0].startPoint.y };
        const vertexGrips: UnifiedGripInfo[] = draggingVertices.map((dv) => ({
          id: `overlay_${dv.overlayId}_v${dv.vertexIndex}`, source: 'overlay' as const,
          overlayId: dv.overlayId, gripIndex: dv.vertexIndex, type: 'vertex' as const,
          position: dv.originalPosition, movesEntity: false,
        }));
        await commitOverlayVertexDrag(vertexGrips, delta, overlayCommitDeps);
        setDraggingVertices(null); setDragPreviewPosition(null); markDragFinished(); resetToIdle();
        return true;
      }

      if (draggingEdgeMidpoint) {
        const edgeGrip: UnifiedGripInfo = {
          id: `overlay_${draggingEdgeMidpoint.overlayId}_e${draggingEdgeMidpoint.edgeIndex}`,
          source: 'overlay', overlayId: draggingEdgeMidpoint.overlayId,
          gripIndex: draggingEdgeMidpoint.edgeIndex, type: 'edge',
          position: worldPos, movesEntity: false, edgeInsertIndex: draggingEdgeMidpoint.insertIndex,
        };
        await commitOverlayEdgeMidpointDrag(edgeGrip, worldPos, draggingEdgeMidpoint.newVertexCreated, overlayCommitDeps);
        setDraggingEdgeMidpoint(null); setDragPreviewPosition(null); markDragFinished(); resetToIdle();
        return true;
      }

      if (draggingOverlayBody) {
        const delta = { x: worldPos.x - draggingOverlayBody.startPoint.x, y: worldPos.y - draggingOverlayBody.startPoint.y };
        await commitOverlayBodyDrag(draggingOverlayBody.overlayId, delta, overlayCommitDeps);
        setDraggingOverlayBody(null); setDragPreviewPosition(null); markDragFinished(); resetToIdle();
        return true;
      }

      return false;
    },
    [phase, activeGrip, dxfCommitDeps, overlayCommitDeps, draggingVertices, draggingEdgeMidpoint, draggingOverlayBody, resetToIdle, markDragFinished],
  );

  // ── ESCAPE ──

  const handleEscape = useCallback((): boolean => {
    if (phase === 'dragging') {
      setDraggingVertices(null); setDraggingEdgeMidpoint(null);
      setDraggingOverlayBody(null); setDragPreviewPosition(null);
      resetToIdle();
      return true;
    }
    return false;
  }, [phase, resetToIdle]);

  // ── PROJECTIONS (from grip-projections.ts) ──

  const dxfDragPreview = useMemo(
    () => buildDxfDragPreview(phase, activeGrip, anchorRef.current, currentWorldPos),
    [phase, activeGrip, currentWorldPos],
  );

  const gripInteractionState = useMemo(
    () => buildGripInteractionState(hoveredGrip, activeGrip, phase),
    [hoveredGrip, activeGrip, phase],
  );

  const dxfProjection = useMemo<DxfProjection>(() => ({
    gripInteractionState,
    isDraggingGrip: phase === 'dragging' && activeGrip?.source === 'dxf',
    isFollowingGrip: phase === 'dragging' && activeGrip?.source === 'dxf',
    handleGripMouseMove: (worldPos: Point2D, screenPos: Point2D) => {
      handleMouseMove(worldPos, screenPos);
      return phase === 'dragging' && activeGrip?.source === 'dxf';
    },
    handleGripMouseDown: (worldPos: Point2D) => handleMouseDown(worldPos, false),
    handleGripMouseUp: (worldPos: Point2D) => { handleMouseUp(worldPos); return phase === 'dragging' && activeGrip?.source === 'dxf'; },
    handleGripClick: (_worldPos: Point2D) => false,
    handleGripEscape: handleEscape,
    handleGripRightClick: handleEscape,
    dragPreview: dxfDragPreview,
  }), [gripInteractionState, phase, activeGrip, handleMouseMove, handleMouseDown, handleMouseUp, handleEscape, dxfDragPreview]);

  const overlayHoveredVertex = useMemo(() => buildOverlayHoveredVertex(hoveredGrip), [hoveredGrip]);
  const overlayHoveredEdge = useMemo(() => buildOverlayHoveredEdge(hoveredGrip, currentOverlays), [hoveredGrip, currentOverlays]);

  const draggingVertex: DraggingVertexState | null = draggingVertices?.[0] ?? null;
  const selectedGrip: SelectedGrip | null = selectedGrips[0] ?? null;

  const overlayProjection = useMemo(
    () => buildOverlayProjection(overlayHoveredVertex, overlayHoveredEdge, selectedGrips, selectedGrip, draggingVertex, draggingVertices, draggingEdgeMidpoint, draggingOverlayBody, dragPreviewPosition),
    [overlayHoveredVertex, overlayHoveredEdge, selectedGrips, selectedGrip, draggingVertex, draggingVertices, draggingEdgeMidpoint, draggingOverlayBody, dragPreviewPosition],
  );

  const gripStateForStack = useMemo(
    () => buildGripStateForStack(draggingVertex, draggingEdgeMidpoint, overlayHoveredVertex, overlayHoveredEdge, draggingOverlayBody, dragPreviewPosition),
    [draggingVertex, draggingEdgeMidpoint, overlayHoveredVertex, overlayHoveredEdge, draggingOverlayBody, dragPreviewPosition],
  );

  const isDragging = phase === 'dragging' || draggingVertices !== null || draggingEdgeMidpoint !== null || draggingOverlayBody !== null;

  // ── RETURN ──

  return useMemo(() => ({
    handleMouseMove, handleMouseDown, handleMouseUp, handleEscape,
    dxfProjection, overlayProjection, gripStateForStack,
    selectedGrips, setSelectedGrips, setDragPreviewPosition,
    isDragging, gripHoverThrottleRef, justFinishedDragRef, markDragFinished,
    setDraggingOverlayBody, draggingOverlayBody, draggingVertices, draggingEdgeMidpoint,
  }), [
    handleMouseMove, handleMouseDown, handleMouseUp, handleEscape,
    dxfProjection, overlayProjection, gripStateForStack,
    selectedGrips, isDragging, markDragFinished,
    draggingOverlayBody, draggingVertices, draggingEdgeMidpoint,
  ]);
}
