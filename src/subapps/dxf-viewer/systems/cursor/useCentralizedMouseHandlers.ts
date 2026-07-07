/**
 * CENTRALIZED MOUSE HANDLERS
 * Professional CAD-style mouse handling using the CursorSystem.
 * ADR-065 SRP split: 988 lines -> 4 files (types, move, up, main)
 */

import { useCallback, useRef, useState } from 'react';
import { LassoStore } from './LassoStore';
import { ZoomWindowStore } from '../zoom-window/ZoomWindowStore';
import { useCursor } from './CursorSystem';
import { isPointInRulerArea } from './utils';
import {
  CoordinateTransforms,
  getPointerSnapshotFromElement,
  getScreenPosFromEvent,
  screenToWorldWithSnapshot,
} from '../../rendering/core/CoordinateTransforms';
import { canvasEventBus } from '../../rendering/canvas/core/CanvasEventSystem';
import { isInDrawingMode } from '../tools/ToolStateManager';
import { isRegionBoxSelectTool } from '../tools/region-tool-ids';
import { clamp } from '../../rendering/entities/shared/geometry-utils';
import { TOLERANCE_CONFIG } from '../../config/tolerance-config';
import { TRANSFORM_SCALE_LIMITS } from '../../config/transform-config';
import { computeWheelZoomFactor } from '../zoom/utils/calculations';
import { EventBus } from '../../systems/events';
import { useSnapContext } from '../../snapping/context/SnapContext';
import { useSnapManager } from '../../snapping/hooks/useSnapManager';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
// ADR-455 — on-canvas X/Y section-cut handle (transform-synced drag).
import { hitTestAxisCutGrip } from '../axis-cut/axis-cut-grip';
import { startAxisCutDrag, endAxisCutDrag } from '../axis-cut/axis-cut-drag-store';
// Body-drag (grab entity body → move; Ctrl+drag → copy).
import { EntityBodyDragStore } from '../drag/EntityBodyDragStore';
import { resolveBodyDragTarget } from '../drag/body-drag-target';
import { getHoveredEntity } from '../hover/HoverStore';
import { SelectedEntitiesStore } from '../selection/SelectedEntitiesStore';
import { CtrlKeyTracker } from '../../keyboard/CtrlKeyTracker';
// ADR-560 §big-player grip-guard — protect a selected object's grip zone from body-drag.
import { findNearestGrip } from '../../hooks/grips/grip-hit-testing';
import { AllGripsStore } from '../grip/AllGripsStore';

/**
 * ADR-560 §big-player grip-guard — pixel radius around a selected object's grip inside which a
 * press must NOT start a whole-object body-move (a bit wider than the grip PICK tolerance so a
 * near-miss when aiming at a boundary grip does not drag the whole entity — Figma/Revit parity).
 */
const BODY_DRAG_GRIP_GUARD_PX = 14;

// Re-export types for consumers
export type { SnapResultItem, ZoomConstraints, CentralizedMouseHandlersProps } from './mouse-handler-types';
import { DEBUG_MOUSE_HANDLERS } from './mouse-handler-types';
import type { CentralizedMouseHandlersProps, MouseHandlerRefs, SnapResultItem } from './mouse-handler-types';
import type { Point2D } from '../../rendering/types/Types';
import { useMouseMoveHandler } from './mouse-handler-move';
import { useMouseUpHandler } from './mouse-handler-up';

/**
 * @param options.exposeSnapResultsState  When true, snap detections are mirrored
 *   into a React `useState` (`snapResults`) so a consumer that renders from it
 *   (LayerCanvas) re-renders on snap change. DEFAULT false: the snap stream flows
 *   ONLY through `ImmediateSnapStore` (the SSoT — `setImmediateSnap`/
 *   `setFullSnapResult`, read by `SnapIndicatorSubscriber`). DxfCanvas never reads
 *   `snapResults`, so it opts out and stops re-rendering the heavy z-10 canvas
 *   leaf ~60fps while snapping. ADR-040 cursor-lag Φ9.
 */
export function useCentralizedMouseHandlers(
  props: CentralizedMouseHandlersProps,
  options?: { exposeSnapResultsState?: boolean },
) {
  const exposeSnapResultsState = options?.exposeSnapResultsState ?? false;
  const {
    scene, transform, viewport, activeTool, overlayMode,
    onTransformChange, onEntitySelect, hitTestCallback,
    colorLayers, canvasRef, onCanvasClick,
    isGripDragging = false, onGripMouseDown, onHoverEntity,
  } = props;

  const cursor = useCursor();

  // Canvas ref (fallback if not provided)
  const safeCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeCanvasRef = canvasRef || safeCanvasRef;

  // Snap system
  const { snapEnabled } = useSnapContext();

  // ADR-040 Φ10: removed the dead `overlaySnapEntities` useMemo (O(n) over all
  // overlay polygons on every colorLayers change) — it fed `useSnapManager`'s
  // `overlayEntities` arg, which is @deprecated/no-op (scene-init is owned by
  // `useGlobalSnapSceneSync`, ADR-040). `useSnapManager` reads only `scale`.
  const { findSnapPoint } = useSnapManager(activeCanvasRef, {
    scale: transform.scale,
  });

  // SSoT note (ADR-040 Φ9): every `setSnapResults` call in mouse-handler-move is
  // paired with a write to `ImmediateSnapStore` (setImmediateSnap/setFullSnapResult).
  // This React state is therefore a duplicate render-channel kept ONLY for the
  // LayerCanvas snap draw; gated behind `exposeSnapResultsState` so opted-out
  // consumers (DxfCanvas) never re-render on snap.
  const [snapResults, setSnapResultsState] = useState<SnapResultItem[]>([]);
  const setSnapResults = useCallback((results: SnapResultItem[]) => {
    if (exposeSnapResultsState) setSnapResultsState(results);
  }, [exposeSnapResultsState]);

  // Shared mutable refs
  const panStateRef = useRef<MouseHandlerRefs['panStateRef']['current']>({
    isPanning: false,
    lastMousePos: null,
    pendingTransform: null,
    animationId: null
  });

  const middleClickRef = useRef<{ lastClickTime: number; clickCount: number }>({
    lastClickTime: 0,
    clickCount: 0
  });

  // ADR-040 Φ12/3.2c — snapThrottleRef removed: snap throttle + dedup state (lastSnapX/Y/
  // Found) moved to the decoupled snap-scheduler in Φ11. The handler no longer holds any
  // snap state, so this ref became write-only dead state.
  const cursorThrottleRef = useRef<{ lastUpdateTime: number }>({ lastUpdateTime: 0 });
  const hoverThrottleRef = useRef<number>(0);
  const lassoDownRef = useRef<{ pos: Point2D | null; buttonHeld: boolean }>({ pos: null, buttonHeld: false });

  const refs: MouseHandlerRefs = { panStateRef, cursorThrottleRef, hoverThrottleRef, lassoDownRef };
  const snap = { snapEnabled, findSnapPoint };

  // Apply pending transform (rAF callback)
  const applyPendingTransform = useCallback(() => {
    const panState = panStateRef.current;
    if (panState.pendingTransform && onTransformChange) {
      onTransformChange(panState.pendingTransform);
      canvasEventBus.emitTransformChange(panState.pendingTransform, viewport, 'dxf-canvas');
      panState.pendingTransform = null;
    }
    panState.animationId = null;
  }, [onTransformChange, viewport]);

  // ===== MOUSE DOWN =====
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const pointerSnap = getPointerSnapshotFromElement(e.currentTarget as HTMLElement);
    if (!pointerSnap) return;

    const screenPos = getScreenPosFromEvent(e, pointerSnap);
    cursor.updatePosition(screenPos);
    cursor.setMouseDown(true, e.button);
    cursor.setActive(true);

    // Middle button double-click → Fit to View
    if (e.button === 1) {
      const now = Date.now();
      const timeSinceLastClick = now - middleClickRef.current.lastClickTime;
      const DOUBLE_CLICK_THRESHOLD = PANEL_LAYOUT.TIMING.DOUBLE_CLICK_MS;

      if (timeSinceLastClick < DOUBLE_CLICK_THRESHOLD) {
        EventBus.emit('canvas-fit-to-view', { source: 'middle-double-click' });
        middleClickRef.current.clickCount = 0;
        middleClickRef.current.lastClickTime = 0;
        e.preventDefault();
        return;
      } else {
        middleClickRef.current.clickCount = 1;
        middleClickRef.current.lastClickTime = now;
      }
    }

    // ADR-374 — ZOOM Window tool: arm drag rect, skip pan/lasso/grip entirely.
    if (activeTool === 'zoom-window' && e.button === 0) {
      ZoomWindowStore.start(screenPos);
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // ADR-455 — on-canvas section-cut handle: grab it BEFORE pan/select/grip claim the
    // gesture. Only an ACTIVE cut has a handle; the hit-test (screen space) returns its
    // axis. Claiming consumes the event so the drag moves the world cut position.
    if (e.button === 0 && !isInDrawingMode(activeTool, overlayMode)) {
      const hitAxis = hitTestAxisCutGrip(screenPos, transform, pointerSnap.viewport);
      if (hitAxis) {
        startAxisCutDrag(hitAxis);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
    }

    // Pan initialization
    const isToolInteractive = isInDrawingMode(activeTool, overlayMode);
    // button 1 = middle drag (AutoCAD standard), button 2 = right drag (BricsCAD style)
    const shouldStartPan = (e.button === 1) || (e.button === 2) || (activeTool === 'pan' && e.button === 0);

    if (shouldStartPan) {
      panStateRef.current.isPanning = true;
      panStateRef.current.lastMousePos = screenPos;
      panStateRef.current.pendingTransform = { ...transform };
      if (e.button !== 2) {
        // Middle button: prevent browser autoscroll. Pan tool: prevent text selection.
        // Right button: do NOT preventDefault — allows contextmenu on non-drag right clicks.
        e.preventDefault();
        e.stopPropagation();
      }
    }

    const worldPos = screenToWorldWithSnapshot(screenPos, transform, pointerSnap);
    cursor.updateWorldPosition(worldPos);

    // Grip drag-release (skip during drawing mode)
    if (e.button === 0 && !isToolInteractive && onGripMouseDown && onGripMouseDown(worldPos)) {
      return;
    }

    // Body-drag (grab an entity body → MOVE; Ctrl+drag → COPY). AutoCAD/Figma
    // gesture: pressing on an entity body in select mode drags it INSTEAD of
    // starting a lasso. Runs after the grip check (grips win) and before the
    // lasso arm. The `copy` flag is FROZEN from Ctrl at press time (releasing
    // Ctrl mid-drag does not change the committed gesture — mirror GripAltMove).
    if (e.button === 0 && !isGripDragging && activeTool === 'select' && !isToolInteractive) {
      const target = resolveBodyDragTarget({
        hoveredEntityId: getHoveredEntity(),
        isSelected: (id) => SelectedEntitiesStore.isSelected(id),
        selectedIds: SelectedEntitiesStore.getIds(),
      });
      if (target) {
        // ADR-560 §big-player grip-guard — a press AIMED at a selected object's grip must never
        // start a whole-object body-move. The grip pick at :199 already grabbed anything within
        // pick tolerance; this protects the slightly-wider aim ring so a near-miss on a boundary
        // grip resolves as select/no-op instead of dragging the whole hatch (Giorgio 2026-07-07).
        const nearGrip = findNearestGrip(worldPos, AllGripsStore.get(), BODY_DRAG_GRIP_GUARD_PX, transform.scale);
        if (nearGrip?.entityId && target.includes(nearGrip.entityId)) {
          lassoDownRef.current = { pos: null, buttonHeld: false };
          return;
        }
        EntityBodyDragStore.arm({
          anchor: worldPos,
          entityIds: target,
          copy: CtrlKeyTracker.getSnapshot(),
        });
        lassoDownRef.current = { pos: null, buttonHeld: false };
        return;
      }
    }

    // Lasso / box-select drag detection: record button-down position for the
    // move handler. Armed for left button + select tool (lasso) OR the
    // wall-in-region tool (ADR-363 Phase 1K Mode C — drag = rectangle marquee
    // collecting lines; a plain click without drag still falls through to the
    // tool's pick pipeline). Never during pan / grip drag.
    if (
      e.button === 0 &&
      !isGripDragging &&
      ((activeTool === 'select' && !isToolInteractive) || isRegionBoxSelectTool(activeTool))
    ) {
      lassoDownRef.current = { pos: screenPos, buttonHeld: true };
    }

  }, [transform, cursor, activeTool, overlayMode, isGripDragging, onGripMouseDown, lassoDownRef]);

  // ===== MOUSE MOVE (delegated) =====
  const handleMouseMove = useMouseMoveHandler({
    props, cursor, refs, snap, setSnapResults, applyPendingTransform,
    debugEnabled: DEBUG_MOUSE_HANDLERS,
  });

  // ===== MOUSE UP (delegated) =====
  const handleMouseUp = useMouseUpHandler({ props, cursor, refs, snap });

  // ===== MOUSE LEAVE =====
  const handleMouseLeave = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const screenPoint = { x: e.clientX, y: e.clientY };
    if (!isPointInRulerArea(screenPoint, e.currentTarget)) {
      cursor.setActive(false);
    }
    cursor.setMouseDown(false);
    onHoverEntity?.(null);

    // ADR-455 — abort a section-cut handle drag if the pointer leaves the canvas.
    endAxisCutDrag();

    // Cancel any in-progress lasso when pointer leaves canvas.
    lassoDownRef.current = { pos: null, buttonHeld: false };
    LassoStore.cancelLasso();

    // ADR-374 — cancel zoom-window drag if pointer leaves canvas mid-drag.
    ZoomWindowStore.cancel();

    const panState = panStateRef.current;
    if (panState.isPanning) {
      panState.isPanning = false;
      panState.lastMousePos = null;
      if (panState.animationId) {
        cancelAnimationFrame(panState.animationId);
        panState.animationId = null;
      }
    }
  }, [cursor, onHoverEntity, lassoDownRef]);

  // ===== WHEEL (zoom / horizontal pan) =====
  const handleWheel = useCallback((e: React.WheelEvent<HTMLCanvasElement>) => {
    const pointerSnap = getPointerSnapshotFromElement(e.currentTarget as HTMLElement);
    if (!pointerSnap) return;

    const zoomCenter = getScreenPosFromEvent(e, pointerSnap);
    const modifiers = { ctrlKey: e.ctrlKey || e.metaKey, shiftKey: e.shiftKey };

    // Normalize deltaMode → pixels ώστε η magnitude-aware συμπεριφορά να είναι ίδια σε κάθε browser/ποντίκι
    // (Chrome=pixels, Firefox μπορεί lines/pages). 16px/γραμμή, viewport.height/σελίδα (DOM standard).
    const deltaY = e.deltaMode === 1
      ? e.deltaY * 16
      : e.deltaMode === 2
        ? e.deltaY * (viewport.height || 800)
        : e.deltaY;

    // Shift+Wheel = Horizontal Pan (AutoCAD standard)
    if (modifiers.shiftKey) {
      e.preventDefault();
      const panSpeed = 2;
      const panDeltaX = deltaY * panSpeed;
      const newTransform = { ...transform, offsetX: transform.offsetX - panDeltaX };
      onTransformChange?.(newTransform);
      canvasEventBus.emitTransformChange(
        { scale: newTransform.scale, offsetX: newTransform.offsetX, offsetY: newTransform.offsetY },
        { width: viewport.width, height: viewport.height },
        'dxf-canvas'
      );
      return;
    }

    if (props.onWheelZoom) {
      props.onWheelZoom(deltaY, zoomCenter, undefined, modifiers);
    } else {
      // Fallback: AutoCAD-parity magnitude-aware factor (ΕΝΑΣ SSoT helper — ίδιο με το ZoomManager path)
      const zoomFactor = computeWheelZoomFactor(deltaY, modifiers.ctrlKey);
      const canvas = e.currentTarget;
      const rawTransform = CoordinateTransforms.calculateZoomTransform(
        transform, zoomFactor, zoomCenter,
        { width: canvas?.width || 0, height: canvas?.height || 0 }
      );
      const clampedScale = Math.max(
        TRANSFORM_SCALE_LIMITS.MIN_SCALE,
        Math.min(rawTransform.scale, TRANSFORM_SCALE_LIMITS.MAX_SCALE)
      );
      const newTransform = { ...rawTransform, scale: clampedScale };
      onTransformChange?.(newTransform);
      canvasEventBus.emitTransformChange(
        { scale: newTransform.scale, offsetX: newTransform.offsetX, offsetY: newTransform.offsetY },
        { width: canvas?.width || 0, height: canvas?.height || 0 },
        'dxf-canvas'
      );
    }
  }, [transform, onTransformChange, props.onWheelZoom, viewport]);

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handleMouseLeave,
    handleWheel,
    cursorState: cursor,
    snapResults,
  };
}
