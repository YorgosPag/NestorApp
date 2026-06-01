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
import { getLockedGripWorldPos } from './GripSnapStore';
import { setHoveredEntity, setHoveredOverlay } from '../hover/HoverStore';
import { withPerf, perfTick } from './mouse-handler-perf';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { dperf } from '../../debug';
import type { CentralizedMouseHandlersProps, MouseHandlerRefs, SnapManagerAPI, SnapResultItem, DEBUG_MOUSE_HANDLERS } from './mouse-handler-types';
import { getActiveDragGrip } from './GripDragStore';
import { findWallFaceCornerSnap } from './wall-face-corner-snap';
import { isWallEntity, isColumnEntity } from '../../types/entities';
import {
  findColumnGripCornerSnap,
  findColumnDrawCornerSnap,
  isColumnCornerSnapGrip,
} from '../../bim/columns/column-corner-snap';
import type { ColumnGripKind } from '../../hooks/useGripMovement';
import { columnToolBridgeStore } from '../../ui/ribbon/hooks/bridge/column-tool-bridge-store';
import { LassoStore } from './LassoStore';
import { ZoomWindowStore } from '../zoom-window/ZoomWindowStore';

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

    const pointerSnap = withPerf('coord-calc-snapshot', () =>
      getPointerSnapshotFromElement(e.currentTarget as HTMLElement),
    );
    if (!pointerSnap) return;

    const screenPos = withPerf('coord-calc-screen', () => getScreenPosFromEvent(e, pointerSnap));
    const freshViewport = pointerSnap.viewport;

    // ADR-374 — ZOOM Window: update rubber-band rect, keep crosshair live, skip snap/hover/pan/lasso.
    if (activeTool === 'zoom-window' && ZoomWindowStore.isActive()) {
      ZoomWindowStore.update(screenPos);
      setImmediatePosition(screenPos);
      return;
    }

    // Zero-latency crosshair (bypasses React)
    // If hovering over a grip, lock crosshair to grip center (world→screen)
    withPerf('set-immediate-position', () => {
      const gripWorldLock = getLockedGripWorldPos();
      if (gripWorldLock) {
        const gripScreenPos = CoordinateTransforms.worldToScreen(gripWorldLock, transform, freshViewport);
        setImmediatePosition(gripScreenPos);
      } else {
        setImmediatePosition(screenPos);
      }
    });

    // Throttled React Context updates (~20fps)
    const CURSOR_UPDATE_THROTTLE_MS = PANEL_LAYOUT.TIMING.CURSOR_UPDATE_THROTTLE;
    const now = performance.now();

    if (now - refs.cursorThrottleRef.current.lastUpdateTime >= CURSOR_UPDATE_THROTTLE_MS) {
      refs.cursorThrottleRef.current.lastUpdateTime = now;
      withPerf('cursor-update-pos', () => cursor.updatePosition(screenPos));

      const throttledWorldPos = withPerf('cursor-screen-to-world', () =>
        CoordinateTransforms.screenToWorld(screenPos, transform, freshViewport),
      );
      withPerf('cursor-update-world', () => cursor.updateWorldPosition(throttledWorldPos));

      if (freshViewport.width !== cursor.viewport.width || freshViewport.height !== cursor.viewport.height) {
        withPerf('cursor-update-viewport', () => cursor.updateViewport(freshViewport));
      }

      withPerf('eventbus-emit', () =>
        canvasEventBus.emit(CANVAS_EVENTS.MOUSE_MOVE, { screenPos, worldPos: throttledWorldPos, canvas: 'dxf' }),
      );
    }

    const worldPos = withPerf('world-coord-calc', () =>
      CoordinateTransforms.screenToWorld(screenPos, transform, freshViewport),
    );

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
        // Propagate to SnapIndicatorOverlay — grip drag bypasses the throttled block below
        setSnapResults([{
          point: gripSnapResult.snappedPoint,
          type: gripSnapResult.activeMode || 'default',
          entityId: gripSnapResult.snapPoint?.entityId || null,
          distance: gripSnapResult.snapPoint?.distance || 0,
          priority: 0,
        }]);
        setFullSnapResult(gripSnapResult);
        setImmediateSnap({
          found: true,
          point: gripSnapResult.snappedPoint,
          mode: gripSnapResult.activeMode || 'endpoint',
          entityId: gripSnapResult.snapPoint?.entityId,
        });
      } else {
        // No snap near cursor during grip drag — clear indicator
        setSnapResults([]);
        setFullSnapResult(null);
        clearImmediateSnap();
      }

      // ADR-371 extension — Wall Face Corner Projection Snap (Revit-style)
      // If dragging a wall endpoint grip, check whether a face corner (axis ± halfThickness)
      // snaps to a nearby BIM corner. If so, override moveWorldPos to the adjusted axis pos
      // so the face corner aligns exactly with the target corner.
      const activeDragGrip = getActiveDragGrip();
      if (
        activeDragGrip &&
        scene &&
        (activeDragGrip.gripKind === 'wall-start' || activeDragGrip.gripKind === 'wall-end')
      ) {
        const draggedEntity = scene.entities?.find(e => e.id === activeDragGrip.entityId) as unknown as import('../../types/entities').Entity | undefined;
        if (draggedEntity && isWallEntity(draggedEntity)) {
          const faceSnap = findWallFaceCornerSnap(
            draggedEntity,
            activeDragGrip.gripKind as 'wall-start' | 'wall-end',
            worldPos,
            findSnapPoint!,
          );
          if (faceSnap) {
            moveWorldPos = faceSnap.adjustedAxisPos;
            setSnapResults([{
              point: faceSnap.snapResult.snappedPoint!,
              type: faceSnap.snapResult.activeMode || 'default',
              entityId: faceSnap.snapResult.snapPoint?.entityId || null,
              distance: faceSnap.snapResult.snapPoint?.distance || 0,
              priority: 0,
            }]);
            setFullSnapResult(faceSnap.snapResult);
            setImmediateSnap({
              found: true,
              point: faceSnap.snapResult.snappedPoint!,
              mode: faceSnap.snapResult.activeMode || 'endpoint',
              entityId: faceSnap.snapResult.snapPoint?.entityId,
            });
          }
        }
      }

      // ADR-398 — Column Body Corner Projection Snap (move + resize). The dragged
      // column's own footprint corners project onto nearby targets so a corner
      // snaps exactly, mirroring the wall face-corner projection above. The drag
      // anchor (move base / resize handle) rides on GripDragStore.
      if (
        activeDragGrip &&
        activeDragGrip.dragAnchor &&
        scene &&
        isColumnCornerSnapGrip(activeDragGrip.gripKind)
      ) {
        const draggedColumn = scene.entities?.find(en => en.id === activeDragGrip.entityId) as unknown as import('../../types/entities').Entity | undefined;
        if (draggedColumn && isColumnEntity(draggedColumn)) {
          const cornerSnap = findColumnGripCornerSnap(
            draggedColumn,
            activeDragGrip.gripKind as ColumnGripKind,
            activeDragGrip.dragAnchor,
            worldPos,
            findSnapPoint!,
          );
          if (cornerSnap) {
            moveWorldPos = cornerSnap.adjustedCursorPos;
            setSnapResults([{
              point: cornerSnap.snapResult.snappedPoint!,
              type: cornerSnap.snapResult.activeMode || 'default',
              entityId: cornerSnap.snapResult.snapPoint?.entityId || null,
              distance: cornerSnap.snapResult.snapPoint?.distance || 0,
              priority: 0,
            }]);
            setFullSnapResult(cornerSnap.snapResult);
            setImmediateSnap({
              found: true,
              point: cornerSnap.snapResult.snappedPoint!,
              mode: cornerSnap.snapResult.activeMode || 'endpoint',
              entityId: cornerSnap.snapResult.snapPoint?.entityId,
            });
          }
        }
      }
    }

    onMouseMove?.(screenPos, moveWorldPos);

    // Drawing preview callback
    const inDrawingMode = isInDrawingMode(activeTool, overlayMode);
    if (debugEnabled) dperf('Performance', `MOUSEMOVE tool=${activeTool} drawing=${inDrawingMode} cb=${!!onDrawingHover}`);

    if (onDrawingHover && inDrawingMode) {
      if (debugEnabled) console.log('[MouseHandlers] CALLING onDrawingHover', { worldX: worldPos.x, worldY: worldPos.y });
      withPerf('drawing-hover-callback', () => onDrawingHover(worldPos));
    }

    // Throttled snap detection (~60fps)
    const SNAP_THROTTLE_MS = PANEL_LAYOUT.TIMING.SNAP_DETECTION_THROTTLE;
    const snapThrottle = refs.snapThrottleRef.current;
    const snapNow = performance.now();

    if (snapEnabled && findSnapPoint && !isGripDragging) {
      snapThrottle.pendingWorldPos = worldPos;

      if (snapNow - snapThrottle.lastSnapTime >= SNAP_THROTTLE_MS) {
        snapThrottle.lastSnapTime = snapNow;

        try {
          // ADR-398 — Column draw: project the would-be column's corners; a
          // corner match wins over the plain center-cursor snap. The indicator
          // shows the target corner; the ghost anchor (ImmediateSnap.point) is
          // shifted to `adjustedCursorPos` so the corner lands on the target.
          const colHandle = activeTool === 'column' ? columnToolBridgeStore.get() : null;
          const drawCorner = colHandle?.isActive
            ? findColumnDrawCornerSnap(
                worldPos,
                { ...colHandle.overrides, kind: colHandle.kind, anchor: colHandle.anchor },
                colHandle.getSceneUnits(),
                findSnapPoint,
              )
            : null;

          const snapResult = drawCorner
            ? drawCorner.snapResult
            : withPerf('snap-find', () => findSnapPoint(worldPos.x, worldPos.y));

          if (snapResult && snapResult.found && snapResult.snappedPoint) {
            const sx = snapResult.snappedPoint.x;
            const sy = snapResult.snappedPoint.y;
            const snapMoved = Math.abs(sx - snapThrottle.lastSnapX) > 0.001
              || Math.abs(sy - snapThrottle.lastSnapY) > 0.001;

            if (snapMoved || !snapThrottle.lastSnapFound) {
              snapThrottle.lastSnapX = sx;
              snapThrottle.lastSnapY = sy;
              withPerf('snap-results-set', () => {
                setSnapResults([{
                  point: snapResult.snappedPoint!,
                  type: snapResult.activeMode || 'default',
                  entityId: snapResult.snapPoint?.entityId || null,
                  distance: snapResult.snapPoint?.distance || 0,
                  priority: 0,
                }]);
                setFullSnapResult(snapResult);
                setImmediateSnap({
                  found: true,
                  // ADR-398 — ghost anchor follows the corner-aligned cursor.
                  point: drawCorner ? drawCorner.adjustedCursorPos : snapResult.snappedPoint!,
                  mode: snapResult.activeMode || 'endpoint',
                  entityId: snapResult.snapPoint?.entityId,
                });
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
    } else if (!isGripDragging) {
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
    // Suppress hover entirely while grip is hovered/dragged — only snap indicators show
    if (isGripDragging) {
      setHoveredEntity(null);
      setHoveredOverlay(null);
    } else if ((activeTool === 'select' || entityPickingActive) && !refs.panStateRef.current.isPanning && !cursor.isSelecting) {
      const HOVER_THROTTLE_MS = 50;
      const hoverNow = performance.now();
      if (hoverNow - refs.hoverThrottleRef.current >= HOVER_THROTTLE_MS) {
        refs.hoverThrottleRef.current = hoverNow;

        let hitEntityId: string | null = null;
        if (hitTestCallback) {
          hitEntityId = withPerf('hit-test-entity', () =>
            hitTestCallback(scene, screenPos, transform, freshViewport),
          );
          // Write to HoverStore (zero-React-state update). Backward-compat callback kept.
          setHoveredEntity(hitEntityId);
          if (onHoverEntity) {
            withPerf('hover-entity-callback', () => onHoverEntity(hitEntityId));
          }
        }

        if (colorLayers && colorLayers.length > 0) {
          if (hitEntityId) {
            // Entity wins — clear overlay hover.
            setHoveredOverlay(null);
            if (onHoverOverlay) {
              withPerf('hover-overlay-callback', () => onHoverOverlay(null));
            }
          } else {
            const hitOverlayId = withPerf('hit-test-overlay', () => {
              for (let i = colorLayers.length - 1; i >= 0; i--) {
                const layer = colorLayers[i];
                if (!layer.visible || layer.polygons.length === 0) continue;
                for (const polygon of layer.polygons) {
                  if (polygon.vertices.length >= 3 && isPointInPolygon(worldPos, polygon.vertices)) {
                    return layer.id;
                  }
                }
              }
              return null;
            });
            // Write to HoverStore. Backward-compat callback kept.
            setHoveredOverlay(hitOverlayId);
            if (onHoverOverlay) {
              withPerf('hover-overlay-callback', () => onHoverOverlay(hitOverlayId));
            }
          }
        }
      }
    }

    // ADR-363 Phase 1K Mode C — wall-in-region box-select: a button-held drag past
    // threshold arms a RECTANGLE marquee (window/crossing), NOT a lasso. A plain
    // click (no drag) leaves `isSelecting` false → falls through to the tool's
    // pick pipeline (Mode A/B). Mutually exclusive with an in-progress selection.
    const REGION_BOX_ACTIVATE_PX = 5;
    const regionDown = refs.lassoDownRef.current;
    if (
      regionDown.buttonHeld && regionDown.pos &&
      (activeTool === 'wall-in-region' ||
        activeTool === 'wall-from-perimeter' ||
        activeTool === 'column-from-perimeter' ||
        activeTool === 'column-discrete-from-perimeter') &&
      !cursor.isSelecting
    ) {
      const rdx = screenPos.x - regionDown.pos.x;
      const rdy = screenPos.y - regionDown.pos.y;
      if (Math.sqrt(rdx * rdx + rdy * rdy) >= REGION_BOX_ACTIVATE_PX) {
        cursor.startSelection(regionDown.pos);
      }
    }

    // Lasso detection: if button held + dragged > threshold → activate / extend lasso.
    // Mutually exclusive with two-click marquee (cursor.isSelecting guard).
    const LASSO_ACTIVATE_PX = 5;
    const lassoDown = refs.lassoDownRef.current;
    if (lassoDown.buttonHeld && lassoDown.pos && activeTool === 'select' && !cursor.isSelecting) {
      if (!LassoStore.getIsLasso()) {
        const dx = screenPos.x - lassoDown.pos.x;
        const dy = screenPos.y - lassoDown.pos.y;
        if (Math.sqrt(dx * dx + dy * dy) >= LASSO_ACTIVATE_PX) {
          LassoStore.startLasso(lassoDown.pos);
          LassoStore.appendPoint(screenPos);
        }
      } else {
        withPerf('lasso-append', () => LassoStore.appendPoint(screenPos));
      }
    }

    // Selection update (two-click marquee mode)
    if (cursor.isSelecting && activeTool !== 'pan') {
      withPerf('selection-update', () => cursor.updateSelection(screenPos));
    }

    // High-performance panning (rAF)
    const panState = refs.panStateRef.current;
    if (panState.isPanning && panState.lastMousePos) {
      withPerf('pan-pending', () => {
        const deltaX = screenPos.x - panState.lastMousePos!.x;
        const deltaY = screenPos.y - panState.lastMousePos!.y;

        panState.pendingTransform = {
          scale: transform.scale,
          offsetX: transform.offsetX + deltaX,
          offsetY: transform.offsetY - deltaY,
        };

        panState.lastMousePos = screenPos;

        if (!panState.animationId) {
          panState.animationId = requestAnimationFrame(applyPendingTransform);
        }
      });
    }

    perfTick();
  }, [transform, viewport, onMouseMove, cursor, activeTool, overlayMode, applyPendingTransform, snapEnabled, findSnapPoint, onDrawingHover, onHoverEntity, onHoverOverlay, hitTestCallback, scene, colorLayers, isGripDragging, entityPickingActive, debugEnabled, refs, setSnapResults]);
}
