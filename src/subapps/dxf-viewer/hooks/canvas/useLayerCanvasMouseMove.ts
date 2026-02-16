'use client';

/**
 * 🏢 ENTERPRISE: useLayerCanvasMouseMove Hook
 *
 * @description Handles mouse move events on the LayerCanvas for grip hover detection,
 * position tracking, drag preview updates, and parent callback delegation.
 * @see CanvasSection decomposition — step #7
 *
 * Responsibilities:
 * - Throttled grip hover detection (100ms in grip mode, full-rate in drawing mode)
 * - Mouse position updates (CSS + World coordinates)
 * - Vertex priority → Edge fallback hover detection on selected overlays
 * - Drag preview position updates
 * - Parent callback delegation (for cursor-centered zoom)
 *
 * Pattern: Single Responsibility Principle
 * Extracted from: CanvasSection.tsx (inline LayerCanvas.onMouseMove callback)
 */

import { useCallback } from 'react';
import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import type { Overlay } from '../../overlays/types';
import type { VertexHoverInfo, EdgeHoverInfo, GripHoverThrottle } from './useCanvasMouse';
import type { UniversalSelectionHook } from '../../systems/selection/SelectionSystem';
import { squaredDistance } from '../../rendering/entities/shared/geometry-rendering-utils';
import { findOverlayEdgeForGrip } from '../../utils/entity-conversion';

// ============================================================================
// TYPES & INTERFACES
// ============================================================================

export interface UseLayerCanvasMouseMoveParams {
  /** Current active tool (grip mode = 'select' | 'layering') */
  activeTool: string;

  /** Current view transform (scale used for tolerance calculation) */
  transform: ViewTransform;

  /** Update CSS-space mouse position (from useCanvasMouse) */
  updateMouseCss: (point: Point2D) => void;
  /** Update world-space mouse position (from useCanvasMouse) */
  updateMouseWorld: (point: Point2D) => void;

  /** Current vertex hover state (from useGripSystem) */
  hoveredVertexInfo: VertexHoverInfo | null;
  /** Set vertex hover state (from useGripSystem) */
  setHoveredVertexInfo: (info: VertexHoverInfo | null) => void;
  /** Current edge hover state (from useGripSystem) */
  hoveredEdgeInfo: EdgeHoverInfo | null;
  /** Set edge hover state (from useGripSystem) */
  setHoveredEdgeInfo: (info: EdgeHoverInfo | null) => void;

  /** Dragging vertex state — only null-checked (from useGripSystem) */
  draggingVertex: unknown;
  /** Dragging edge midpoint state — only null-checked (from useGripSystem) */
  draggingEdgeMidpoint: unknown;
  /** Dragging overlay body state — only null-checked (from useGripSystem) */
  draggingOverlayBody: unknown;
  /** Set drag preview position (from useGripSystem) */
  setDragPreviewPosition: (point: Point2D | null) => void;

  /** Throttle ref for grip hover performance (from useGripSystem) */
  gripHoverThrottleRef: React.MutableRefObject<GripHoverThrottle>;

  /** Universal selection system (for getting selected overlay IDs) */
  universalSelection: UniversalSelectionHook;
  /** Current overlays array (for finding overlays by ID) */
  currentOverlays: Overlay[];

  /** Grip settings (only gripSize + dpiScale used for tolerance calculation) */
  gripSettings: { gripSize?: number; dpiScale?: number };

  /** Parent callback for cursor-centered zoom */
  onParentMouseMove?: (worldPoint: Point2D, event: React.MouseEvent) => void;
}

export interface UseLayerCanvasMouseMoveReturn {
  /** Callback to pass to LayerCanvas.onMouseMove */
  handleLayerCanvasMouseMove: (screenPoint: Point2D, worldPoint: Point2D) => void;
}

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

export function useLayerCanvasMouseMove(
  params: UseLayerCanvasMouseMoveParams
): UseLayerCanvasMouseMoveReturn {
  const {
    activeTool,
    transform,
    updateMouseCss,
    updateMouseWorld,
    hoveredVertexInfo,
    setHoveredVertexInfo,
    hoveredEdgeInfo,
    setHoveredEdgeInfo,
    draggingVertex,
    draggingEdgeMidpoint,
    draggingOverlayBody,
    setDragPreviewPosition,
    gripHoverThrottleRef,
    universalSelection,
    currentOverlays,
    gripSettings,
    onParentMouseMove,
  } = params;

  const handleLayerCanvasMouseMove = useCallback(
    (screenPoint: Point2D, worldPointFromHandler: Point2D) => {
      // 🚀 PERFORMANCE (2026-01-27): ENTERPRISE OPTIMIZATION
      // Reduced unnecessary work in mousemove handler to achieve <16ms per frame

      // 🚀 EARLY RETURN: Skip all grip-related work if not in select/layering mode
      const isGripMode = activeTool === 'select' || activeTool === 'layering';

      // 🚀 THROTTLED: Mouse position updates (was causing re-renders on every move)
      const now = performance.now();
      const throttle = gripHoverThrottleRef.current;

      // 🚀 PERFORMANCE (2026-01-27): Increase throttle from 33ms to 100ms (10fps)
      // Grip hover detection doesn't need 30fps - 10fps is smooth enough for visual feedback.
      // IMPORTANT: Apply this throttle ONLY in grip modes; drawing tools need full-rate hover updates
      // for smooth preview rendering (line/rectangle/circle rubber-band feedback).
      const GRIP_HOVER_THROTTLE_MS = 100;
      const shouldThrottleGripWork =
        isGripMode && (now - throttle.lastCheckTime < GRIP_HOVER_THROTTLE_MS);

      if (shouldThrottleGripWork) {
        // 🚀 PERFORMANCE (2026-01-27): During drag, use RAF-throttled preview update
        // Instead of setState on every mousemove, we use a ref + RAF for smooth animation
        return; // Skip all other work until throttle period passes
      }

      if (isGripMode) {
        throttle.lastCheckTime = now;
      }

      // Now do the throttled work
      updateMouseCss(screenPoint);
      // 🏢 FIX (2026-02-15): Use pre-calculated worldPoint from useCentralizedMouseHandlers
      // BEFORE: Recalculated via containerRef (different element rect → Y-offset mismatch)
      // AFTER: Use worldPoint computed from the SAME element that produced screenPoint (SSoT)
      const worldPoint = worldPointFromHandler;
      updateMouseWorld(worldPoint);
      throttle.lastWorldPoint = worldPoint;

      // 🚀 PERFORMANCE: Skip grip detection entirely if not in grip mode
      if (!isGripMode) {
        // Clear any stale hover state (only if needed)
        if (hoveredEdgeInfo || hoveredVertexInfo) {
          setHoveredEdgeInfo(null);
          setHoveredVertexInfo(null);
        }
      } else {
        // 🏢 ENTERPRISE (2026-01-25): Grip hover detection for selected overlays
        const selectedOverlayIds = universalSelection.getIdsByType('overlay');

        // 🚀 EARLY RETURN: Skip if no overlays selected
        if (selectedOverlayIds.length === 0) {
          if (hoveredEdgeInfo || hoveredVertexInfo) {
            setHoveredEdgeInfo(null);
            setHoveredVertexInfo(null);
          }
        } else {
          const selectedOverlays = selectedOverlayIds
            .map(id => currentOverlays.find(o => o.id === id))
            .filter((o): o is Overlay => o !== undefined);

          // 🎯 CENTRALIZED: Tolerance from grip settings
          const gripTolerancePx = (gripSettings.gripSize ?? 5) * (gripSettings.dpiScale ?? 1.0) + 2;
          const gripToleranceWorld = gripTolerancePx / transform.scale;

          // Check grips on ALL selected overlays
          let foundVertexInfo: { overlayId: string; vertexIndex: number } | null = null;
          let foundEdgeInfo: { overlayId: string; edgeIndex: number } | null = null;

          outerLoop:
          for (const overlay of selectedOverlays) {
            if (!overlay?.polygon) continue;

            // 1. Check vertex grips first (higher priority)
            for (let i = 0; i < overlay.polygon.length; i++) {
              const vertex = overlay.polygon[i];
              // 🏢 ADR-157: Use centralized squaredDistance (ADR-109)
              const distSq = squaredDistance(worldPoint, { x: vertex[0], y: vertex[1] });
              const toleranceSq = gripToleranceWorld * gripToleranceWorld;

              if (distSq < toleranceSq) {
                foundVertexInfo = { overlayId: overlay.id, vertexIndex: i };
                break outerLoop;
              }
            }

            // 2. If no vertex hover, check edge midpoints
            const edgeInfo = findOverlayEdgeForGrip(worldPoint, overlay.polygon, gripToleranceWorld);
            if (edgeInfo) {
              foundEdgeInfo = { overlayId: overlay.id, edgeIndex: edgeInfo.edgeIndex };
              break;
            }
          }

          // 🚀 PERFORMANCE: Only setState if value actually changed
          if (foundVertexInfo) {
            if (!hoveredVertexInfo ||
                hoveredVertexInfo.overlayId !== foundVertexInfo.overlayId ||
                hoveredVertexInfo.vertexIndex !== foundVertexInfo.vertexIndex) {
              setHoveredVertexInfo(foundVertexInfo);
            }
            if (hoveredEdgeInfo) setHoveredEdgeInfo(null);
          } else if (foundEdgeInfo) {
            if (!hoveredEdgeInfo ||
                hoveredEdgeInfo.overlayId !== foundEdgeInfo.overlayId ||
                hoveredEdgeInfo.edgeIndex !== foundEdgeInfo.edgeIndex) {
              setHoveredEdgeInfo(foundEdgeInfo);
            }
            if (hoveredVertexInfo) setHoveredVertexInfo(null);
          } else {
            // Clear hover only if something was previously set
            if (hoveredEdgeInfo) setHoveredEdgeInfo(null);
            if (hoveredVertexInfo) setHoveredVertexInfo(null);
          }
        }
      }

      // 🏢 ENTERPRISE: Drag preview update (already throttled by above check)
      // 🏢 ENTERPRISE (2027-01-27): Add overlay body drag support - Unified Toolbar Integration
      if (draggingVertex || draggingEdgeMidpoint || draggingOverlayBody) {
        setDragPreviewPosition(worldPoint);
      }

      // ✅ ΔΙΟΡΘΩΣΗ: Καλώ και το props.onMouseMove για cursor-centered zoom
      if (onParentMouseMove) {
        // 🎯 TYPE-SAFE: Create proper mock event (event not available in this context)
        const mockEvent = {
          clientX: screenPoint.x,
          clientY: screenPoint.y,
          preventDefault: () => {},
          stopPropagation: () => {}
        } as React.MouseEvent;
        onParentMouseMove(worldPoint, mockEvent);
      }
    },
    [
      activeTool,
      transform.scale,
      updateMouseCss,
      updateMouseWorld,
      hoveredVertexInfo,
      setHoveredVertexInfo,
      hoveredEdgeInfo,
      setHoveredEdgeInfo,
      draggingVertex,
      draggingEdgeMidpoint,
      draggingOverlayBody,
      setDragPreviewPosition,
      gripHoverThrottleRef,
      universalSelection,
      currentOverlays,
      gripSettings,
      onParentMouseMove,
    ]
  );

  return { handleLayerCanvasMouseMove };
}
