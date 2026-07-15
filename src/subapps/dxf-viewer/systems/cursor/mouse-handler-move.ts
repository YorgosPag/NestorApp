/**
 * Mouse Move Handler — ADR-065 SRP split
 * Extracted from useCentralizedMouseHandlers.ts
 * Handles: position tracking, snap detection, hover highlighting, pan, drawing preview
 */

import { useCallback, useRef } from 'react';
import {
  CoordinateTransforms,
  getPointerSnapshotFromElement,
  getScreenPosFromEvent,
} from '../../rendering/core/CoordinateTransforms';
import { canvasEventBus, CANVAS_EVENTS } from '../../rendering/canvas/core/CanvasEventSystem';
import { isInDrawingMode } from '../tools/ToolStateManager';
import { isRectMarqueeDragTool } from '../tools/region-tool-ids';
import { isPointInPolygon } from '../../utils/geometry/GeometryUtils';
import { setImmediatePosition, setRealtimeWorldCursor } from './ImmediatePositionStore';
import { setColumnPolarShiftFractions } from './ColumnPolarStore';
import { resolveGripDragSnap, publishGripSnap, clearGripSnap } from './grip-drag-snap-resolver';
import { getLockedGripWorldPos } from './GripSnapStore';
import { getGripStepAnchor } from './GripStepAnchorStore';
import { applyPointStepSnap, isGripStepActive } from '../../bim/grips/grip-step-quantize';
import { setSnapDrawingMode } from './SnapDrawingModeStore';
import { getGlobalGuideStore } from '../../systems/guides/guide-store';
import { projectPointOntoGuide, isGuideEditTool, GUIDE_HIT_TOLERANCE_PX } from '../../systems/guides/guide-types';
import { setHoveredEntity, setHoveredOverlay } from '../hover/HoverStore';
// ADR-659 — overlap «⧉ N» badge: count the stack under the cursor at hover time.
// Uses the LIVE registry hit-testing instance (fed by the render loop's updateScene),
// the SAME one the top-1 `hitTestCallback` uses — NOT the zombie exported singleton.
import { serviceRegistry } from '../../services/ServiceRegistry';
import { buildCandidatesFromHits } from '../selection/SelectionCyclingStore';
import { setOverlapBadge, clearOverlapBadge } from '../selection/OverlapBadgeStore';
// ADR-358 Q19 Φ3c — per-tread hover pre-highlight while a stair is sole-selected
// (component mode). Shares the Φ3b click-into gate; clears itself otherwise.
import { updateStairSubElementHover2D } from '../../bim/stairs/stair-sub-element-hover-2d';
import { setStairSubElementHover } from '../../bim/stairs/stair-sub-element-selection-store';
import { withPerf, perfTick } from './mouse-handler-perf';
import { PANEL_LAYOUT } from '../../config/panel-tokens';
import { dperf } from '../../debug';
import type { CentralizedMouseHandlersProps, MouseHandlerRefs, SnapManagerAPI, SnapResultItem, DEBUG_MOUSE_HANDLERS } from './mouse-handler-types';
import { getActiveDragGrip, isActiveGripAltMove } from './GripDragStore';
import type { Entity } from '../../types/entities';
// ADR-562 Φ9.2 / ADR-357 — grip-drag AutoAlign tracking SSoT (extracted for N.7.1 size budget).
// ADR-560 — body-drag reuses the SAME SSoT via applyBodyDragAlignmentTracking.
import { applyGripDragAlignmentTracking, applyBodyDragAlignmentTracking } from './grip-drag-alignment-tracking';
// ADR-560 §OSNAP-priority — clear stale AutoAlign traces όταν το OSNAP νικάει (κουμπώνει σε σημείο).
import { clearGripAlignmentTracking } from './GripAlignmentTrackingStore';
import { EntityBodyDragStore } from '../drag/EntityBodyDragStore';
// ADR-040 Φ11: draw-snap (column-draw corner snap + columnToolBridgeStore) moved to the
// decoupled snap-scheduler; this handler only arms it.
import { requestSnapDetection, clearSnapDetection } from './snap-scheduler';
import { LassoStore } from './LassoStore';
import { ZoomWindowStore } from '../zoom-window/ZoomWindowStore';
// ADR-455 — on-canvas X/Y section-cut handle drag.
import { getAxisCutDragAxis } from '../axis-cut/axis-cut-drag-store';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';
// 🏢 ADR-516: per-frame coalescing of the heavy drawing-hover (preview+draw) so it
// caps at ~60fps regardless of mouse Hz. Crosshair stays instant (compositor, above);
// leading-edge apply means the ghost has ZERO added lag, only the rapid burst coalesces.
import { DXF_TIMING } from '../../config/dxf-timing';
import { createRafCoalescedThrottle } from '../../hooks/raf-coalesced-throttle';

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

  // 🏢 ADR-516: stable per-frame coalescer for the drawing-hover preview (see import note).
  const drawHoverThrottleRef = useRef(createRafCoalescedThrottle(DXF_TIMING.frame.THROTTLE_60));

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
        // active and SNAP-MODE (F9) + Q are held, quantize the FRESH cursor point onto
        // the step grid relative to the drag anchor via the SAME `applyPointStepSnap`
        // SSoT the drawing ghost uses, so the crosshair "clicks" onto the identical
        // grid point as the ghost (WYSIWYG, zero-lag). F9/Q off → identity → raw cursor.
        const w = CoordinateTransforms.screenToWorld(screenPos, transform, freshViewport);
        const qWorld = applyPointStepSnap(w, stepAnchor);
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
    // ADR-560 §OSNAP-priority — αν το OSNAP (ή wall-face/column-corner snap) κουμπώσει σε
    // χαρακτηριστικό σημείο, ΝΙΚΑΕΙ το AutoAlign: το φάντασμα κουμπώνει εκεί, χωρίς να πεταχτεί σε
    // νοητό άξονα ευθυγράμμισης (Giorgio 2026-07-04 «να έλκομαι μόνο από τα κοντινά σημεία»).
    let osnapFound = false;
    if (isGripDragging && snapEnabled && findSnapPoint) {
      // ADR-560 §grip-OSNAP-unified — ΜΙΑ πηγή αλήθειας για τοίχο/κολόνα/δοκό/θεμέλιο. Ο κοινός
      // resolver κάνει corner-source dispatch (wall face / member footprint) + τον ΙΔΙΟ priority
      // resolver με το draw path (ορατή γωνία > ορατό cursor > σιωπηλό grid). Δέχεται ΜΟΝΟ ορατές
      // έλξεις· σιωπηλό grid → null → νικάει το AutoAlign παρακάτω (ADR-560 θ/ι root cause). Ίδια
      // κλήση με το commit (mouse-handler-up) → preview===commit εξ ορισμού.
      const gripSnap = resolveGripDragSnap(
        scene?.entities as unknown as readonly Entity[] | null | undefined,
        getActiveDragGrip(),
        worldPos,
        findSnapPoint,
        isActiveGripAltMove(),
      );
      if (gripSnap) {
        moveWorldPos = gripSnap.moveWorldPos;
        osnapFound = true;
        publishGripSnap(gripSnap.snapResult, setSnapResults);
      } else {
        clearGripSnap(setSnapResults);
      }
    }

    // ADR-562 Φ9.2 / ADR-357 — AutoAlign traces while dragging a DIMENSION or plain-LINE grip.
    // Runs AFTER the OSNAP + face/corner snaps and publishes the tracking result for the ghost
    // paint — ONE resolve, WYSIWYG. SSoT brain extracted to grip-drag-alignment-tracking.
    // ADR-560 §OSNAP-priority (Giorgio 2026-07-04) — ΠΑΡΑΚΑΜΠΤΕΤΑΙ όταν το OSNAP κούμπωσε: η έλξη σε
    // χαρακτηριστικό σημείο (άκρο/μέσο/κέντρο) νικάει, το φάντασμα ΔΕΝ πετάγεται σε άξονα ευθυγράμμισης.
    // Καθαρίζουμε το store ώστε κανένας consumer (dim-grip paint) να μη δείξει stale ίχνη.
    if (osnapFound) {
      clearGripAlignmentTracking();
    } else if (isGripDragging) {
      moveWorldPos = applyGripDragAlignmentTracking(moveWorldPos, scene, transform.scale);
    } else if (EntityBodyDragStore.getActive()) {
      // ADR-560 — body-drag (grab body → move/copy): SAME AutoAlign SSoT, base-point tracking.
      // Overrides the effective world (→ ghost delta) + publishes the traces for the ghost paint.
      moveWorldPos = applyBodyDragAlignmentTracking(moveWorldPos, scene, transform.scale);
    }

    // 🚀 ADR-040 cursor-lag Φ12 — publish the FINAL effective world (snapped +
    // face-corner-adjusted) to the realtime SSoT EVERY frame (60fps, synchronous).
    // Every ghost preview reads this imperatively + redraws via a RAF-coalesced
    // throttle, so it stays locked to the compositor crosshair (same value, same
    // clock) — no React-state / 20fps-throttle desync. Must run before onMouseMove.
    setRealtimeWorldCursor(moveWorldPos);
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
      // zero React· ο ghost/commit το διαβάζει imperatively από το ColumnPolarStore). Stays SYNC.
      if (activeTool === 'column') setColumnPolarShiftFractions(e.shiftKey);
      if (debugEnabled) console.log('[MouseHandlers] CALLING onDrawingHover', { worldX: worldPos.x, worldY: worldPos.y });
      // 🏢 ADR-516: coalesce the heavy preview+draw to ≤1 per animation frame. Leading-edge
      // ⇒ the first move paints instantly (no added lag); a rapid burst flushes the LATEST
      // worldPos on the next frame. Caps CPU when the mouse fires faster than 60fps.
      drawHoverThrottleRef.current.run(() => {
        withPerf('drawing-hover-callback', () => onDrawingHover(worldPos));
      });
    } else {
      // Left drawing mode (or no hover handler) — drop any pending trailing frame.
      drawHoverThrottleRef.current.cancel();
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
      setStairSubElementHover(null);
      clearOverlapBadge(); // ADR-659 — no overlap badge while a grip is being manipulated.
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
          // ADR-659 — overlap badge: count the full stack ONLY when the top-1 hit found an
          // entity (zero extra hit-test over empty space); throttled by the enclosing gate.
          if (hitEntityId) {
            const allHits = serviceRegistry.get('hit-testing').hitTestAll(screenPos, transform, freshViewport);
            setOverlapBadge(buildCandidatesFromHits(allHits).length, e.clientX, e.clientY);
          } else {
            clearOverlapBadge();
          }
          // ADR-358 Q19 Φ3c — resolve the per-tread pre-highlight (no-op unless the
          // hovered entity is the sole-selected stair; skip-if-unchanged inside).
          updateStairSubElementHover2D(hitEntityId, worldPos, scene?.entities as readonly Entity[] | undefined);
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

    // ADR-363 Phase 1K Mode C — rectangle drag-marquee (`isRectMarqueeDragTool`:
    // wall/column region box-select ΚΑΙ `crop-window` «Περικοπή Περιοχής»): a
    // button-held drag past threshold arms a RECTANGLE marquee (window/crossing),
    // NOT a lasso. `startSelection` → `isSelecting=true` → το preview πλαίσιο
    // ζωγραφίζεται· στο mouseUp `processMarqueeSelection` κάνει το routing (region
    // box-select vs `crop:marquee-rect`). A plain click (no drag) leaves
    // `isSelecting` false → falls through to the tool's pick pipeline (Mode A/B).
    // Mutually exclusive with an in-progress selection.
    const REGION_BOX_ACTIVATE_PX = 5;
    const regionDown = refs.lassoDownRef.current;
    if (
      regionDown.buttonHeld && regionDown.pos &&
      isRectMarqueeDragTool(activeTool) &&
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
