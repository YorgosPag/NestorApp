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
import { isRegionBoxSelectTool } from '../tools/region-tool-ids';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import { setImmediatePosition } from './ImmediatePositionStore';
import { setColumnPolarShiftFractions } from './ColumnPolarStore';
import { setImmediateSnap, clearImmediateSnap, setFullSnapResult } from './ImmediateSnapStore';
import { getLockedGripWorldPos } from './GripSnapStore';
import { getGripStepAnchor } from './GripStepAnchorStore';
import { applyGripStepSnap, isGripStepActive } from '../../bim/grips/grip-step-quantize';
import { setSnapDrawingMode } from './SnapDrawingModeStore';
import { getGlobalGuideStore } from '../../systems/guides/guide-store';
import { projectPointOntoGuide, isGuideEditTool, GUIDE_HIT_TOLERANCE_PX } from '../../systems/guides/guide-types';
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
  isColumnCornerSnapGrip,
} from '../../bim/columns/column-corner-snap';
import type { ColumnGripKind } from '../../hooks/useGripMovement';
// ADR-040 Φ11: draw-snap (column-draw corner snap + columnToolBridgeStore) moved to the
// decoupled snap-scheduler; this handler only arms it.
import { requestSnapDetection, clearSnapDetection } from './snap-scheduler';
import { LassoStore } from './LassoStore';
import { ZoomWindowStore } from '../zoom-window/ZoomWindowStore';
// ADR-455 — on-canvas X/Y section-cut handle drag.
import { getAxisCutDragAxis } from '../axis-cut/axis-cut-drag-store';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';

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

    // ADR-455 — dragging the on-canvas section-cut handle: move the world cut position to
    // the cursor and short-circuit pan/snap/hover. The 2D overlay (fade + line + handle)
    // redraws via the bim-render-settings subscription, so it tracks the cursor live.
    const axisCutDrag = getAxisCutDragAxis();
    if (axisCutDrag) {
      const w = CoordinateTransforms.screenToWorld(screenPos, transform, freshViewport);
      useBimRenderSettingsStore
        .getState()
        .setAxisCutPosition(axisCutDrag, axisCutDrag === 'x' ? w.x : w.y);
      setImmediatePosition(screenPos);
      return;
    }

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
      const stepAnchor = getGripStepAnchor();
      if (gripWorldLock) {
        const gripScreenPos = CoordinateTransforms.worldToScreen(gripWorldLock, transform, freshViewport);
        setImmediatePosition(gripScreenPos);
      } else if (isGripDragging && stepAnchor && isGripStepActive()) {
        // ADR-363 — snap-to-grid crosshair (AutoCAD F9 parity). While a grip drag is
        // active and SNAP-MODE (F9) + Q are held, quantize the FRESH cursor delta
        // from the drag anchor with the SAME `applyGripStepSnap` the ghost uses, so
        // the crosshair "clicks" onto the step grid at the identical point as the
        // ghost (WYSIWYG, zero-lag). Disengaging F9/Q falls through to the raw cursor.
        const w = CoordinateTransforms.screenToWorld(screenPos, transform, freshViewport);
        const q = applyGripStepSnap({ x: w.x - stepAnchor.x, y: w.y - stepAnchor.y });
        const qWorld = { x: stepAnchor.x + q.x, y: stepAnchor.y + q.y };
        setImmediatePosition(CoordinateTransforms.worldToScreen(qWorld, transform, freshViewport));
      } else if (isGuideEditTool(activeTool)) {
        // ADR-189 — guide hover-lock: while a guide-edit tool is active, the moment a
        // guide is within highlight range the crosshair CENTRE locks onto its line
        // (Giorgio: «να κολλάει στο σώμα της γραμμής όταν έχει φωτιστεί»). Same
        // threshold as the highlight (GUIDE_HIT_TOLERANCE_PX) → φωτίζεται ⟺ κολλάει.
        const w = CoordinateTransforms.screenToWorld(screenPos, transform, freshViewport);
        const g = getGlobalGuideStore().findNearestGuide(w.x, w.y, GUIDE_HIT_TOLERANCE_PX / transform.scale);
        if (g) {
          setImmediatePosition(CoordinateTransforms.worldToScreen(projectPointOntoGuide(g, w), transform, freshViewport));
        } else {
          setImmediatePosition(screenPos);
        }
      } else {
        setImmediatePosition(screenPos);
      }
    });

    // ADR-040 Φ10: ONE screenToWorld per move (SSoT) — reused by the throttled
    // React-context update, the eventbus emit, snap, hover and drawing-hover below.
    const worldPos = withPerf('world-coord-calc', () =>
      CoordinateTransforms.screenToWorld(screenPos, transform, freshViewport),
    );

    // Throttled React Context updates (~20fps)
    const CURSOR_UPDATE_THROTTLE_MS = PANEL_LAYOUT.TIMING.CURSOR_UPDATE_THROTTLE;
    const now = performance.now();

    if (now - refs.cursorThrottleRef.current.lastUpdateTime >= CURSOR_UPDATE_THROTTLE_MS) {
      refs.cursorThrottleRef.current.lastUpdateTime = now;
      withPerf('cursor-update-pos', () => cursor.updatePosition(screenPos));
      withPerf('cursor-update-world', () => cursor.updateWorldPosition(worldPos));

      if (freshViewport.width !== cursor.viewport.width || freshViewport.height !== cursor.viewport.height) {
        withPerf('cursor-update-viewport', () => cursor.updateViewport(freshViewport));
      }

      withPerf('eventbus-emit', () =>
        canvasEventBus.emit(CANVAS_EVENTS.MOUSE_MOVE, { screenPos, worldPos, canvas: 'dxf' }),
      );
    }

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
    // ADR-189 — publish drawing mode for GuideSnapEngine: while drawing, guides snap
    // ONLY at intersections (✕), not along a single line (Giorgio). Set before the
    // throttled `findSnapPoint` below reads it via SnapDrawingModeStore.
    setSnapDrawingMode(inDrawingMode);
    if (debugEnabled) dperf('Performance', `MOUSEMOVE tool=${activeTool} drawing=${inDrawingMode} cb=${!!onDrawingHover}`);

    if (onDrawingHover && inDrawingMode) {
      // ADR-398 §3.13 — Polar Magnet Q1: Shift κρατιέται → δακτύλιοι σε κλάσματα ακτίνας (event-time,
      // zero React· ο ghost/commit το διαβάζει imperatively από το ColumnPolarStore).
      if (activeTool === 'column') setColumnPolarShiftFractions(e.shiftKey);
      if (debugEnabled) console.log('[MouseHandlers] CALLING onDrawingHover', { worldX: worldPos.x, worldY: worldPos.y });
      withPerf('drawing-hover-callback', () => onDrawingHover(worldPos));
    }

    // ADR-040 Φ11: draw-snap detection is DECOUPLED from this synchronous handler.
    // Arming the scheduler is cheap (store latest + flag); the heavy `findSnapPoint`
    // runs in the RAF slot (snap-scheduler, on the UnifiedFrameScheduler SSoT), so
    // the crosshair compositor frame is never blocked by snap work → cursor 1:1.
    // The scheduler keeps the ~30fps snap throttle + the corner-snap (ADR-398) logic.
    // Grip-drag snap stays SYNCHRONOUS above (it needs a 1:1 ghost).
    if (snapEnabled && findSnapPoint && !isGripDragging) {
      // ADR-398 §3.10 — το column face-snap υπολογίζεται πλέον σύγχρονα στο preview/commit από
      // τους pre-collected στόχους (`columnPreviewStore`)· ο scheduler δεν χρειάζεται entities.
      requestSnapDetection({ worldPos, activeTool, findSnapPoint, setSnapResults });
    } else if (!isGripDragging) {
      clearSnapDetection(setSnapResults);
    }

    // Unified hover highlighting — DXF entities > overlay priority
    // Suppress hover entirely while grip is hovered/dragged — only snap indicators show
    if (isGripDragging) {
      setHoveredEntity(null);
      setHoveredOverlay(null);
    } else if ((activeTool === 'select' || entityPickingActive) && !refs.panStateRef.current.isPanning && !cursor.isSelecting) {
      const hoverNow = performance.now();
      if (hoverNow - refs.hoverThrottleRef.current >= PANEL_LAYOUT.TIMING.HOVER_THROTTLE_MS) {
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
      isRegionBoxSelectTool(activeTool) &&
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
