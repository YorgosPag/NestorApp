/**
 * ADR-183: Unified Grip System — useUnifiedGripInteraction
 *
 * Single hook that manages ALL grip interactions for both DXF entities and overlay polygons.
 * Replaces: useDxfGripInteraction + useGripSystem + useLayerCanvasMouseMove + useCanvasMouse (grip parts)
 *
 * State machine:
 *   idle ──[cursor near grip]──→ hovering (cold, start timer)
 *     ↑                              │
 *     │ [cursor leaves]              ↓ [timer expires]
 *     └──────────────────────── warm (orange)
 *                                    │
 *                             [mouseDown on grip]
 *                                    ↓
 *                              dragging (hot: red, follows cursor)
 *                                    │
 *                   ┌────────────────┼────────────────┐
 *                   ↓                ↓                 ↓
 *              [mouseUp]       [Escape]          [right-click]
 *              commit           cancel             cancel
 *                   │                │                 │
 *                   └────────────────┴─────────────────┘
 *                                    ↓
 *                                  idle
 *
 * Projections: ONE internal state → TWO backward-compatible outputs
 * - dxfProjection → DxfGripInteractionState + DxfGripDragPreview (for DxfCanvas)
 * - overlayProjection → VertexHoverInfo + EdgeHoverInfo + drag states (for LayerCanvas)
 *
 * @see unified-grip-types.ts — type definitions
 * @see grip-registry.ts — grip computation
 * @see grip-hit-testing.ts — proximity detection
 * @see grip-commit-adapters.ts — commit logic
 */

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { DxfScene } from '../../canvas-v2/dxf-canvas/dxf-types';
import type { Overlay } from '../../overlays/types';
import type { ICommand } from '../../core/commands/interfaces';
import type { useOverlayStore } from '../../overlays/overlay-store';
import type { UniversalSelectionHook } from '../../systems/selection';
import type { AnySceneEntity } from '../../types/scene';
import { GRIP_CONFIG } from '../useGripMovement';
import { PANEL_LAYOUT } from '../../config/panel-tokens';

import type {
  UnifiedGripInfo,
  UnifiedGripPhase,
  DxfGripInteractionState,
  DxfGripDragPreview,
  VertexHoverInfo,
  EdgeHoverInfo,
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

import { useMoveEntities } from '../useMoveEntities';
import { useCommandHistory } from '../../core/commands';
import { useLevels } from '../../systems/levels';

// ============================================================================
// CONSTANTS
// ============================================================================

/** Time (ms) before a hovered grip transitions to warm (orange) */
const WARM_DELAY_MS = 1000;

/** Throttle interval for grip hover detection (100ms = 10fps — sufficient for visual feedback) */
const GRIP_HOVER_THROTTLE_MS = 100;

// ============================================================================
// TYPES
// ============================================================================

export interface UseUnifiedGripInteractionParams {
  // DXF inputs
  selectedEntityIds: string[];
  dxfScene: DxfScene | null;
  transform: ViewTransform;

  // Overlay inputs
  currentOverlays: Overlay[];
  universalSelection: UniversalSelectionHook;
  overlayStore: ReturnType<typeof useOverlayStore>;
  overlayStoreRef: React.MutableRefObject<ReturnType<typeof useOverlayStore>>;

  // Tools / settings
  activeTool: string;
  gripSettings: { gripSize?: number; dpiScale?: number };

  // Command execution
  executeCommand: (command: ICommand) => void;
  movementDetectionThreshold: number;
}

/** DXF projection — backward-compatible with UseDxfGripInteractionReturn */
export interface DxfProjection {
  gripInteractionState: DxfGripInteractionState;
  isDraggingGrip: boolean;
  isFollowingGrip: boolean;
  handleGripMouseMove: (worldPos: Point2D, screenPos: Point2D) => boolean;
  handleGripMouseDown: (worldPos: Point2D) => boolean;
  handleGripMouseUp: (worldPos: Point2D) => boolean;
  handleGripClick: (worldPos: Point2D) => boolean;
  handleGripEscape: () => boolean;
  handleGripRightClick: () => boolean;
  dragPreview: DxfGripDragPreview | null;
}

/** Overlay projection — backward-compatible with useGripSystem + useLayerCanvasMouseMove */
export interface OverlayProjection {
  hoveredVertexInfo: VertexHoverInfo | null;
  hoveredEdgeInfo: EdgeHoverInfo | null;
  selectedGrips: SelectedGrip[];
  selectedGrip: SelectedGrip | null;
  draggingVertex: DraggingVertexState | null;
  draggingVertices: DraggingVertexState[] | null;
  draggingEdgeMidpoint: DraggingEdgeMidpointState | null;
  draggingOverlayBody: DraggingOverlayBodyState | null;
  dragPreviewPosition: Point2D | null;
}

export interface UseUnifiedGripInteractionReturn {
  /** Unified mouse move handler — call this from DxfCanvas.onMouseMove */
  handleMouseMove: (worldPos: Point2D, screenPos: Point2D) => void;
  /** Unified mouse down handler */
  handleMouseDown: (worldPos: Point2D, isShift: boolean) => boolean;
  /** Unified mouse up handler */
  handleMouseUp: (worldPos: Point2D) => Promise<boolean>;
  /** Cancel current drag */
  handleEscape: () => boolean;
  /** DXF backward-compatible projection */
  dxfProjection: DxfProjection;
  /** Overlay backward-compatible projection */
  overlayProjection: OverlayProjection;
  /** Grip state for CanvasLayerStack gripState prop */
  gripStateForStack: {
    draggingVertex: DraggingVertexState | null;
    draggingEdgeMidpoint: DraggingEdgeMidpointState | null;
    hoveredVertexInfo: VertexHoverInfo | null;
    hoveredEdgeInfo: EdgeHoverInfo | null;
    draggingOverlayBody: DraggingOverlayBodyState | null;
    dragPreviewPosition: Point2D | null;
  };
  /** Selected grips for hooks that need it */
  selectedGrips: SelectedGrip[];
  setSelectedGrips: React.Dispatch<React.SetStateAction<SelectedGrip[]>>;
  /** Drag preview position for container handler */
  setDragPreviewPosition: React.Dispatch<React.SetStateAction<Point2D | null>>;
  /** Is any grip being dragged (for cursor/UI) */
  isDragging: boolean;
  /** Overlay grip hover throttle ref (for container handler) */
  gripHoverThrottleRef: React.MutableRefObject<GripHoverThrottle>;
  /** Just finished drag ref (for click prevention) */
  justFinishedDragRef: React.MutableRefObject<boolean>;
  /** Mark drag finished (for container mouseUp) */
  markDragFinished: () => void;
  /** Overlay body drag setter (for overlay interaction hook) */
  setDraggingOverlayBody: React.Dispatch<React.SetStateAction<DraggingOverlayBodyState | null>>;
  /** Dragging overlay body state (for container drag preview) */
  draggingOverlayBody: DraggingOverlayBodyState | null;
  /** Dragging vertices state (for container drag preview) */
  draggingVertices: DraggingVertexState[] | null;
  /** Dragging edge midpoint state (for container drag preview) */
  draggingEdgeMidpoint: DraggingEdgeMidpointState | null;
}

// ============================================================================
// HOOK
// ============================================================================

export function useUnifiedGripInteraction(
  params: UseUnifiedGripInteractionParams,
): UseUnifiedGripInteractionReturn {
  const {
    selectedEntityIds,
    dxfScene,
    transform,
    currentOverlays,
    universalSelection,
    overlayStore,
    overlayStoreRef,
    activeTool,
    gripSettings,
    executeCommand,
    movementDetectionThreshold,
  } = params;

  // ----- DXF commit deps -----
  const { moveEntities } = useMoveEntities();
  const { execute } = useCommandHistory();
  const { currentLevelId, getLevelScene, setLevelScene } = useLevels();

  const dxfCommitDeps = useMemo<DxfCommitDeps>(() => ({
    moveEntities,
    execute,
    currentLevelId,
    getLevelScene,
    setLevelScene,
  }), [moveEntities, execute, currentLevelId, getLevelScene, setLevelScene]);

  const overlayCommitDeps = useMemo<OverlayCommitDeps>(() => ({
    overlayStore,
    executeCommand,
    movementDetectionThreshold,
  }), [overlayStore, executeCommand, movementDetectionThreshold]);

  // ----- Resolve selected overlays -----
  const selectedOverlays = useMemo(() => {
    const overlayIds = universalSelection.getIdsByType('overlay');
    return overlayIds
      .map(id => currentOverlays.find(o => o.id === id))
      .filter((o): o is Overlay => o !== undefined);
  }, [universalSelection, currentOverlays]);

  // ----- Grip registry -----
  const allGrips = useGripRegistry({
    dxfScene,
    selectedEntityIds,
    selectedOverlays,
  });

  // ----- Core state -----
  const [phase, setPhase] = useState<UnifiedGripPhase>('idle');
  const [hoveredGrip, setHoveredGrip] = useState<UnifiedGripInfo | null>(null);
  const [activeGrip, setActiveGrip] = useState<UnifiedGripInfo | null>(null);
  const [currentWorldPos, setCurrentWorldPos] = useState<Point2D | null>(null);
  const anchorRef = useRef<Point2D | null>(null);
  const warmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ----- Overlay grip state (for backward compatibility) -----
  const [selectedGrips, setSelectedGrips] = useState<SelectedGrip[]>([]);
  const [draggingVertices, setDraggingVertices] = useState<DraggingVertexState[] | null>(null);
  const [draggingEdgeMidpoint, setDraggingEdgeMidpoint] = useState<DraggingEdgeMidpointState | null>(null);
  const [draggingOverlayBody, setDraggingOverlayBody] = useState<DraggingOverlayBodyState | null>(null);
  const [dragPreviewPosition, setDragPreviewPosition] = useState<Point2D | null>(null);

  // ----- Refs -----
  const gripHoverThrottleRef = useRef<GripHoverThrottle>({
    lastCheckTime: 0,
    lastWorldPoint: null,
  });
  const justFinishedDragRef = useRef(false);

  // ----- Helpers -----
  const markDragFinished = useCallback(() => {
    justFinishedDragRef.current = true;
    setTimeout(() => { justFinishedDragRef.current = false; }, PANEL_LAYOUT.TIMING.DRAG_FINISH_RESET);
  }, []);

  const isGripMode = activeTool === 'select' || activeTool === 'layering';

  // ----- Reset when selection changes -----
  useEffect(() => {
    setPhase('idle');
    setHoveredGrip(null);
    setActiveGrip(null);
    setCurrentWorldPos(null);
    anchorRef.current = null;
    if (warmTimerRef.current) {
      clearTimeout(warmTimerRef.current);
      warmTimerRef.current = null;
    }
  }, [selectedEntityIds, selectedOverlays]);

  // ----- Cleanup timer on unmount -----
  useEffect(() => {
    return () => {
      if (warmTimerRef.current) clearTimeout(warmTimerRef.current);
    };
  }, []);

  // ----- Hit tolerance -----
  const hitTolerancePx = (gripSettings.gripSize ?? 5) * (gripSettings.dpiScale ?? 1.0) + 2;
  // Use the larger of grip settings tolerance and GRIP_CONFIG.HIT_TOLERANCE
  const effectiveTolerance = Math.max(hitTolerancePx, GRIP_CONFIG.HIT_TOLERANCE);

  const resetToIdle = useCallback(() => {
    setPhase('idle');
    setActiveGrip(null);
    setHoveredGrip(null);
    setCurrentWorldPos(null);
    anchorRef.current = null;
  }, []);

  // ============================================================================
  // MOUSE MOVE
  // ============================================================================

  const handleMouseMove = useCallback(
    (worldPos: Point2D, _screenPos: Point2D) => {
      if (!isGripMode || allGrips.length === 0) return;

      // Throttle hover detection
      const now = performance.now();
      const throttle = gripHoverThrottleRef.current;
      if (phase !== 'dragging' && now - throttle.lastCheckTime < GRIP_HOVER_THROTTLE_MS) {
        return;
      }
      if (phase !== 'dragging') {
        throttle.lastCheckTime = now;
      }
      throttle.lastWorldPoint = worldPos;

      // During dragging: update current position for drag preview
      if (phase === 'dragging' && activeGrip) {
        setCurrentWorldPos(worldPos);
        // Also update drag preview for overlay grips
        if (activeGrip.source === 'overlay') {
          setDragPreviewPosition(worldPos);
        }
        return;
      }

      // Detect hover
      const nearGrip = findNearestGrip(worldPos, allGrips, effectiveTolerance, transform.scale);

      if (nearGrip) {
        if (!hoveredGrip || hoveredGrip.id !== nearGrip.id) {
          setHoveredGrip(nearGrip);
          setPhase('hovering');

          if (warmTimerRef.current) clearTimeout(warmTimerRef.current);
          warmTimerRef.current = setTimeout(() => {
            setPhase('warm');
            warmTimerRef.current = null;
          }, WARM_DELAY_MS);
        }
      } else if (hoveredGrip && phase !== 'dragging') {
        setHoveredGrip(null);
        setPhase('idle');
        if (warmTimerRef.current) {
          clearTimeout(warmTimerRef.current);
          warmTimerRef.current = null;
        }
      }
    },
    [isGripMode, allGrips, phase, activeGrip, hoveredGrip, effectiveTolerance, transform.scale],
  );

  // ============================================================================
  // MOUSE DOWN
  // ============================================================================

  const handleMouseDown = useCallback(
    (worldPos: Point2D, isShift: boolean): boolean => {
      if (!isGripMode || allGrips.length === 0) return false;
      if (phase === 'dragging') return false;

      const nearGrip = findNearestGrip(worldPos, allGrips, effectiveTolerance, transform.scale);
      if (!nearGrip) {
        // Clear overlay grip selection when clicking empty space
        if (!isShift && selectedGrips.length > 0) {
          setSelectedGrips([]);
        }
        return false;
      }

      // --- DXF GRIP ---
      if (nearGrip.source === 'dxf') {
        setActiveGrip(nearGrip);
        setPhase('dragging');
        anchorRef.current = worldPos;
        setCurrentWorldPos(worldPos);

        if (warmTimerRef.current) {
          clearTimeout(warmTimerRef.current);
          warmTimerRef.current = null;
        }
        return true;
      }

      // --- OVERLAY GRIP ---
      if (nearGrip.source === 'overlay') {
        // Check if the overlay is selected
        if (!universalSelection.isSelected(nearGrip.overlayId!)) {
          if (!isShift && selectedGrips.length > 0) {
            setSelectedGrips([]);
          }
          return false;
        }

        // Vertex grip
        if (nearGrip.type === 'vertex') {
          const clickedGrip: SelectedGrip = {
            type: 'vertex',
            overlayId: nearGrip.overlayId!,
            index: nearGrip.gripIndex,
          };

          const isGripAlreadySelected = selectedGrips.some(
            g => g.type === 'vertex' && g.overlayId === clickedGrip.overlayId && g.index === clickedGrip.index
          );

          if (isShift) {
            // Toggle selection — NO drag on Shift+Click
            if (isGripAlreadySelected) {
              setSelectedGrips(selectedGrips.filter(
                g => !(g.type === 'vertex' && g.overlayId === clickedGrip.overlayId && g.index === clickedGrip.index)
              ));
            } else {
              setSelectedGrips([...selectedGrips, clickedGrip]);
            }
            return true;
          }

          // Regular click — start drag
          const gripsToMove = isGripAlreadySelected
            ? selectedGrips.filter(g => g.type === 'vertex')
            : [clickedGrip];

          if (!isGripAlreadySelected) {
            setSelectedGrips([clickedGrip]);
          }

          // Start overlay vertex drag
          if (gripsToMove.length > 0) {
            const store = overlayStoreRef.current;
            const draggingData: DraggingVertexState[] = gripsToMove.map(grip => {
              const overlay = store.overlays[grip.overlayId];
              const originalPosition = overlay?.polygon?.[grip.index]
                ? { x: overlay.polygon[grip.index][0], y: overlay.polygon[grip.index][1] }
                : worldPos;
              return {
                overlayId: grip.overlayId,
                vertexIndex: grip.index,
                startPoint: worldPos,
                originalPosition,
              };
            });
            setDraggingVertices(draggingData);
            setDragPreviewPosition(worldPos);

            // Also set unified state
            setActiveGrip(nearGrip);
            setPhase('dragging');
            anchorRef.current = worldPos;
            setCurrentWorldPos(worldPos);
          }
          return true;
        }

        // Edge midpoint grip
        if (nearGrip.type === 'edge' && nearGrip.edgeInsertIndex !== undefined) {
          const edgeIndex = nearGrip.gripIndex - (
            // Edge grips are offset past vertex grips in the registry
            currentOverlays.find(o => o.id === nearGrip.overlayId)?.polygon?.length ?? 0
          );

          const clickedGrip: SelectedGrip = {
            type: 'edge-midpoint',
            overlayId: nearGrip.overlayId!,
            index: edgeIndex,
          };
          setSelectedGrips([clickedGrip]);
          setDraggingEdgeMidpoint({
            overlayId: nearGrip.overlayId!,
            edgeIndex,
            insertIndex: nearGrip.edgeInsertIndex,
            startPoint: worldPos,
            newVertexCreated: false,
          });
          setDragPreviewPosition(worldPos);

          setActiveGrip(nearGrip);
          setPhase('dragging');
          anchorRef.current = worldPos;
          setCurrentWorldPos(worldPos);

          if (warmTimerRef.current) {
            clearTimeout(warmTimerRef.current);
            warmTimerRef.current = null;
          }
          return true;
        }
      }

      return false;
    },
    [
      isGripMode, allGrips, phase, effectiveTolerance, transform.scale,
      selectedGrips, universalSelection, overlayStoreRef, currentOverlays,
    ],
  );

  // ============================================================================
  // MOUSE UP
  // ============================================================================

  const handleMouseUp = useCallback(
    async (worldPos: Point2D): Promise<boolean> => {
      // --- DXF GRIP COMMIT ---
      if (phase === 'dragging' && activeGrip?.source === 'dxf' && anchorRef.current) {
        const delta: Point2D = {
          x: worldPos.x - anchorRef.current.x,
          y: worldPos.y - anchorRef.current.y,
        };
        commitDxfGripDrag(activeGrip, delta, dxfCommitDeps);
        resetToIdle();
        return true;
      }

      // --- OVERLAY VERTEX COMMIT ---
      if (draggingVertices && draggingVertices.length > 0) {
        const delta = {
          x: worldPos.x - draggingVertices[0].startPoint.x,
          y: worldPos.y - draggingVertices[0].startPoint.y,
        };

        // Build UnifiedGripInfo[] for the commit adapter
        const vertexGrips: UnifiedGripInfo[] = draggingVertices.map(dv => ({
          id: `overlay_${dv.overlayId}_v${dv.vertexIndex}`,
          source: 'overlay' as const,
          overlayId: dv.overlayId,
          gripIndex: dv.vertexIndex,
          type: 'vertex' as const,
          position: dv.originalPosition,
          movesEntity: false,
        }));

        await commitOverlayVertexDrag(vertexGrips, delta, overlayCommitDeps);
        setDraggingVertices(null);
        setDragPreviewPosition(null);
        markDragFinished();
        resetToIdle();
        return true;
      }

      // --- OVERLAY EDGE MIDPOINT COMMIT ---
      if (draggingEdgeMidpoint) {
        const edgeGrip: UnifiedGripInfo = {
          id: `overlay_${draggingEdgeMidpoint.overlayId}_e${draggingEdgeMidpoint.edgeIndex}`,
          source: 'overlay',
          overlayId: draggingEdgeMidpoint.overlayId,
          gripIndex: draggingEdgeMidpoint.edgeIndex,
          type: 'edge',
          position: worldPos,
          movesEntity: false,
          edgeInsertIndex: draggingEdgeMidpoint.insertIndex,
        };

        await commitOverlayEdgeMidpointDrag(
          edgeGrip,
          worldPos,
          draggingEdgeMidpoint.newVertexCreated,
          overlayCommitDeps,
        );
        setDraggingEdgeMidpoint(null);
        setDragPreviewPosition(null);
        markDragFinished();
        resetToIdle();
        return true;
      }

      // --- OVERLAY BODY COMMIT ---
      if (draggingOverlayBody) {
        const delta = {
          x: worldPos.x - draggingOverlayBody.startPoint.x,
          y: worldPos.y - draggingOverlayBody.startPoint.y,
        };

        await commitOverlayBodyDrag(
          draggingOverlayBody.overlayId,
          delta,
          overlayCommitDeps,
        );
        setDraggingOverlayBody(null);
        setDragPreviewPosition(null);
        markDragFinished();
        resetToIdle();
        return true;
      }

      return false;
    },
    [
      phase, activeGrip, dxfCommitDeps, overlayCommitDeps,
      draggingVertices, draggingEdgeMidpoint, draggingOverlayBody,
      resetToIdle, markDragFinished,
    ],
  );

  // ============================================================================
  // ESCAPE
  // ============================================================================

  const handleEscape = useCallback((): boolean => {
    if (phase === 'dragging') {
      setDraggingVertices(null);
      setDraggingEdgeMidpoint(null);
      setDraggingOverlayBody(null);
      setDragPreviewPosition(null);
      resetToIdle();
      return true;
    }
    return false;
  }, [phase, resetToIdle]);

  // ============================================================================
  // DXF PROJECTION (backward-compatible with UseDxfGripInteractionReturn)
  // ============================================================================

  const dxfDragPreview = useMemo<DxfGripDragPreview | null>(() => {
    if (phase !== 'dragging' || !activeGrip || activeGrip.source !== 'dxf' || !anchorRef.current || !currentWorldPos) {
      return null;
    }
    return {
      entityId: activeGrip.entityId!,
      gripIndex: activeGrip.gripIndex,
      delta: {
        x: currentWorldPos.x - anchorRef.current.x,
        y: currentWorldPos.y - anchorRef.current.y,
      },
      movesEntity: activeGrip.movesEntity,
      edgeVertexIndices: activeGrip.edgeVertexIndices,
    };
  }, [phase, activeGrip, currentWorldPos]);

  const gripInteractionState = useMemo<DxfGripInteractionState>(() => {
    const state: DxfGripInteractionState = {};

    if (hoveredGrip?.source === 'dxf' && (phase === 'hovering' || phase === 'warm')) {
      state.hoveredGrip = {
        entityId: hoveredGrip.entityId!,
        gripIndex: hoveredGrip.gripIndex,
      };
    }
    if (activeGrip?.source === 'dxf' && phase === 'dragging') {
      state.activeGrip = {
        entityId: activeGrip.entityId!,
        gripIndex: activeGrip.gripIndex,
      };
    }
    return state;
  }, [hoveredGrip, activeGrip, phase]);

  const dxfProjection = useMemo<DxfProjection>(() => ({
    gripInteractionState,
    isDraggingGrip: phase === 'dragging' && activeGrip?.source === 'dxf',
    isFollowingGrip: phase === 'dragging' && activeGrip?.source === 'dxf',
    handleGripMouseMove: (worldPos: Point2D, screenPos: Point2D) => {
      handleMouseMove(worldPos, screenPos);
      return phase === 'dragging' && activeGrip?.source === 'dxf';
    },
    handleGripMouseDown: (worldPos: Point2D) => handleMouseDown(worldPos, false),
    handleGripMouseUp: (worldPos: Point2D) => {
      handleMouseUp(worldPos);
      return phase === 'dragging' && activeGrip?.source === 'dxf';
    },
    handleGripClick: (_worldPos: Point2D) => false, // No-op in drag-release model
    handleGripEscape: handleEscape,
    handleGripRightClick: handleEscape,
    dragPreview: dxfDragPreview,
  }), [gripInteractionState, phase, activeGrip, handleMouseMove, handleMouseDown, handleMouseUp, handleEscape, dxfDragPreview]);

  // ============================================================================
  // OVERLAY PROJECTION (backward-compatible with useGripSystem + useLayerCanvasMouseMove)
  // ============================================================================

  const overlayHoveredVertex = useMemo<VertexHoverInfo | null>(() => {
    if (!hoveredGrip || hoveredGrip.source !== 'overlay' || hoveredGrip.type !== 'vertex') return null;
    return {
      overlayId: hoveredGrip.overlayId!,
      vertexIndex: hoveredGrip.gripIndex,
    };
  }, [hoveredGrip]);

  const overlayHoveredEdge = useMemo<EdgeHoverInfo | null>(() => {
    if (!hoveredGrip || hoveredGrip.source !== 'overlay' || hoveredGrip.type !== 'edge') return null;
    // Edge grips are offset by polygon.length in the registry, compute the actual edge index
    const overlay = currentOverlays.find(o => o.id === hoveredGrip.overlayId);
    const polygonLen = overlay?.polygon?.length ?? 0;
    const edgeIndex = hoveredGrip.gripIndex - polygonLen;
    if (edgeIndex < 0) return null;
    return {
      overlayId: hoveredGrip.overlayId!,
      edgeIndex,
    };
  }, [hoveredGrip, currentOverlays]);

  const draggingVertex: DraggingVertexState | null = draggingVertices && draggingVertices.length > 0
    ? draggingVertices[0]
    : null;

  const selectedGrip: SelectedGrip | null = selectedGrips.length > 0 ? selectedGrips[0] : null;

  const overlayProjection = useMemo<OverlayProjection>(() => ({
    hoveredVertexInfo: overlayHoveredVertex,
    hoveredEdgeInfo: overlayHoveredEdge,
    selectedGrips,
    selectedGrip,
    draggingVertex,
    draggingVertices,
    draggingEdgeMidpoint,
    draggingOverlayBody,
    dragPreviewPosition,
  }), [
    overlayHoveredVertex, overlayHoveredEdge,
    selectedGrips, selectedGrip,
    draggingVertex, draggingVertices,
    draggingEdgeMidpoint, draggingOverlayBody,
    dragPreviewPosition,
  ]);

  // ============================================================================
  // GRIP STATE FOR STACK (backward-compatible with CanvasLayerStack.gripState)
  // ============================================================================

  const gripStateForStack = useMemo(() => ({
    draggingVertex,
    draggingEdgeMidpoint,
    hoveredVertexInfo: overlayHoveredVertex,
    hoveredEdgeInfo: overlayHoveredEdge,
    draggingOverlayBody,
    dragPreviewPosition,
  }), [draggingVertex, draggingEdgeMidpoint, overlayHoveredVertex, overlayHoveredEdge, draggingOverlayBody, dragPreviewPosition]);

  const isDragging = phase === 'dragging' || draggingVertices !== null || draggingEdgeMidpoint !== null || draggingOverlayBody !== null;

  // ============================================================================
  // RETURN
  // ============================================================================

  return useMemo(() => ({
    handleMouseMove,
    handleMouseDown,
    handleMouseUp,
    handleEscape,
    dxfProjection,
    overlayProjection,
    gripStateForStack,
    selectedGrips,
    setSelectedGrips,
    setDragPreviewPosition,
    isDragging,
    gripHoverThrottleRef,
    justFinishedDragRef,
    markDragFinished,
    setDraggingOverlayBody,
    draggingOverlayBody,
    draggingVertices,
    draggingEdgeMidpoint,
  }), [
    handleMouseMove, handleMouseDown, handleMouseUp, handleEscape,
    dxfProjection, overlayProjection, gripStateForStack,
    selectedGrips, isDragging, markDragFinished,
    draggingOverlayBody, draggingVertices, draggingEdgeMidpoint,
  ]);
}
