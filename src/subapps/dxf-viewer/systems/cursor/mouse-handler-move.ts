/**
 * Mouse Move Handler — ADR-065 SRP split
 * Extracted from useCentralizedMouseHandlers.ts
 * Handles: position tracking, snap detection, hover highlighting, pan, drawing preview
 */

import { useCallback } from 'react';
import {
  CoordinateTransforms,
  getPointerSnapshotFromElement,
  getScreenPosFromEvent,
} from '../../rendering/core/CoordinateTransforms';
import { canvasEventBus, CANVAS_EVENTS } from '../../rendering/canvas/core/CanvasEventSystem';
import { isInDrawingMode } from '../tools/ToolStateManager';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import { setImmediatePosition } from './ImmediatePositionStore';
import { setImmediateSnap, clearImmediateSnap, setFullSnapResult } from './ImmediateSnapStore';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { dperf } from '../../debug';
import type { CentralizedMouseHandlersProps, MouseHandlerRefs, SnapManagerAPI, SnapResultItem, DEBUG_MOUSE_HANDLERS } from './mouse-handler-types';

interface MouseMoveHandlerDeps {
  props: CentralizedMouseHandlersProps;
  cursor: ReturnType<typeof import('./CursorSystem').useCursor>;
  refs: MouseHandlerRefs;
  snap: SnapManagerAPI;
  setSnapResults: (results: SnapResultItem[]) => void;
  applyPendingTransform: () => void;
  debugEnabled: boolean;
}

export function useMouseMoveHandler({
  props, cursor, refs, snap, setSnapResults, applyPendingTransform, debugEnabled,
}: MouseMoveHandlerDeps) {
  const {
    transform, viewport, activeTool, overlayMode, onMouseMove,
    onDrawingHover, onHoverEntity, onHoverOverlay, hitTestCallback,
    scene, colorLayers, isGripDragging = false, entityPickingActive = false,
  } = props;
  const { snapEnabled, findSnapPoint } = snap;

  return useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (debugEnabled) dperf('Performance', 'NATIVE_MOUSEMOVE');

    const pointerSnap = getPointerSnapshotFromElement(e.currentTarget as HTMLElement);
    if (!pointerSnap) return;

    const screenPos = getScreenPosFromEvent(e, pointerSnap);
    const freshViewport = pointerSnap.viewport;

    // Zero-latency crosshair (bypasses React)
    setImmediatePosition(screenPos);

    // Throttled React Context updates (~20fps)
    const CURSOR_UPDATE_THROTTLE_MS = PANEL_LAYOUT.TIMING.CURSOR_UPDATE_THROTTLE;
    const now = performance.now();

    if (now - refs.cursorThrottleRef.current.lastUpdateTime >= CURSOR_UPDATE_THROTTLE_MS) {
      refs.cursorThrottleRef.current.lastUpdateTime = now;
      cursor.updatePosition(screenPos);

      const worldPos = CoordinateTransforms.screenToWorld(screenPos, transform, freshViewport);
      cursor.updateWorldPosition(worldPos);

      if (freshViewport.width !== cursor.viewport.width || freshViewport.height !== cursor.viewport.height) {
        cursor.updateViewport(freshViewport);
      }

      canvasEventBus.emit(CANVAS_EVENTS.MOUSE_MOVE, { screenPos, worldPos, canvas: 'dxf' });
    }

    const worldPos = CoordinateTransforms.screenToWorld(screenPos, transform, freshViewport);

    if (debugEnabled) {
      console.log('[MouseHandlers] COORDS', {
        screenPos: `(${screenPos.x.toFixed(1)}, ${screenPos.y.toFixed(1)})`,
        worldPos: `(${worldPos.x.toFixed(2)}, ${worldPos.y.toFixed(2)})`,
        viewport: `${freshViewport.width}x${freshViewport.height}`,
        transform: `scale=${transform.scale.toFixed(2)}, offset=(${transform.offsetX.toFixed(1)}, ${transform.offsetY.toFixed(1)})`,
        activeTool,
        isDrawingMode: isInDrawingMode(activeTool, overlayMode),
      });
    }

    // Grip drag snap preview
    let moveWorldPos = worldPos;
    if (isGripDragging && snapEnabled && findSnapPoint) {
      const gripSnapResult = findSnapPoint(worldPos.x, worldPos.y);
      if (gripSnapResult && gripSnapResult.found && gripSnapResult.snappedPoint) {
        moveWorldPos = gripSnapResult.snappedPoint;
      }
    }

    onMouseMove?.(screenPos, moveWorldPos);

    // Drawing preview callback
    const inDrawingMode = isInDrawingMode(activeTool, overlayMode);
    if (debugEnabled) dperf('Performance', `MOUSEMOVE tool=${activeTool} drawing=${inDrawingMode} cb=${!!onDrawingHover}`);

    if (onDrawingHover && inDrawingMode) {
      if (debugEnabled) console.log('[MouseHandlers] CALLING onDrawingHover', { worldX: worldPos.x, worldY: worldPos.y });
      onDrawingHover(worldPos);
    }

    // Throttled snap detection (~60fps)
    const SNAP_THROTTLE_MS = PANEL_LAYOUT.TIMING.SNAP_DETECTION_THROTTLE;
    const snapThrottle = refs.snapThrottleRef.current;
    const snapNow = performance.now();

    if (snapEnabled && findSnapPoint) {
      snapThrottle.pendingWorldPos = worldPos;

      if (snapNow - snapThrottle.lastSnapTime >= SNAP_THROTTLE_MS) {
        snapThrottle.lastSnapTime = snapNow;

        try {
          const snapResult = findSnapPoint(worldPos.x, worldPos.y);

          if (snapResult && snapResult.found && snapResult.snappedPoint) {
            const sx = snapResult.snappedPoint.x;
            const sy = snapResult.snappedPoint.y;
            const snapMoved = Math.abs(sx - snapThrottle.lastSnapX) > 0.001
              || Math.abs(sy - snapThrottle.lastSnapY) > 0.001;

            if (snapMoved || !snapThrottle.lastSnapFound) {
              snapThrottle.lastSnapX = sx;
              snapThrottle.lastSnapY = sy;
              setSnapResults([{
                point: snapResult.snappedPoint,
                type: snapResult.activeMode || 'default',
                entityId: snapResult.snapPoint?.entityId || null,
                distance: snapResult.snapPoint?.distance || 0,
                priority: 0
              }]);
              setFullSnapResult(snapResult);
              setImmediateSnap({
                found: true,
                point: snapResult.snappedPoint,
                mode: snapResult.activeMode || 'endpoint',
                entityId: snapResult.snapPoint?.entityId,
              });
            }
            snapThrottle.lastSnapFound = true;
          } else {
            if (snapThrottle.lastSnapFound) {
              setSnapResults([]);
              setFullSnapResult(null);
              clearImmediateSnap();
              snapThrottle.lastSnapFound = false;
              snapThrottle.lastSnapX = NaN;
              snapThrottle.lastSnapY = NaN;
            }
          }
        } catch {
          if (snapThrottle.lastSnapFound) {
            setSnapResults([]);
            setFullSnapResult(null);
            clearImmediateSnap();
            snapThrottle.lastSnapFound = false;
            snapThrottle.lastSnapX = NaN;
            snapThrottle.lastSnapY = NaN;
          }
        }
      }
    } else {
      if (snapThrottle.lastSnapFound) {
        setSnapResults([]);
        setFullSnapResult(null);
        clearImmediateSnap();
        snapThrottle.lastSnapFound = false;
        snapThrottle.lastSnapX = NaN;
        snapThrottle.lastSnapY = NaN;
      }
    }

    // Unified hover highlighting — DXF entities > overlay priority
    if ((activeTool === 'select' || entityPickingActive) && !refs.panStateRef.current.isPanning && !cursor.isSelecting) {
      const HOVER_THROTTLE_MS = 32;
      const hoverNow = performance.now();
      if (hoverNow - refs.hoverThrottleRef.current >= HOVER_THROTTLE_MS) {
        refs.hoverThrottleRef.current = hoverNow;

        let hitEntityId: string | null = null;
        if (onHoverEntity && hitTestCallback) {
          hitEntityId = hitTestCallback(scene, screenPos, transform, freshViewport);
          onHoverEntity(hitEntityId);
        }

        if (onHoverOverlay && colorLayers && colorLayers.length > 0) {
          if (hitEntityId) {
            onHoverOverlay(null);
          } else {
            let hitOverlayId: string | null = null;
            for (let i = colorLayers.length - 1; i >= 0; i--) {
              const layer = colorLayers[i];
              if (!layer.visible || layer.polygons.length === 0) continue;
              for (const polygon of layer.polygons) {
                if (polygon.vertices.length >= 3 && isPointInPolygon(worldPos, polygon.vertices)) {
                  hitOverlayId = layer.id;
                  break;
                }
              }
              if (hitOverlayId) break;
            }
            onHoverOverlay(hitOverlayId);
          }
        }
      }
    }

    // Selection update
    if (cursor.isSelecting && activeTool !== 'pan') {
      cursor.updateSelection(screenPos);
    }

    // High-performance panning (rAF)
    const panState = refs.panStateRef.current;
    if (panState.isPanning && panState.lastMousePos) {
      const deltaX = screenPos.x - panState.lastMousePos.x;
      const deltaY = screenPos.y - panState.lastMousePos.y;

      panState.pendingTransform = {
        scale: transform.scale,
        offsetX: transform.offsetX + deltaX,
        offsetY: transform.offsetY - deltaY
      };

      panState.lastMousePos = screenPos;

      if (!panState.animationId) {
        panState.animationId = requestAnimationFrame(applyPendingTransform);
      }
    }
  }, [transform, viewport, onMouseMove, cursor, activeTool, overlayMode, applyPendingTransform, snapEnabled, findSnapPoint, onDrawingHover, onHoverEntity, onHoverOverlay, hitTestCallback, scene, colorLayers, isGripDragging, entityPickingActive, debugEnabled, refs, setSnapResults]);
}
