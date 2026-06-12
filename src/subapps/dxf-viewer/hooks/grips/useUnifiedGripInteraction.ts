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
import { lockGripSnapPosition, unlockGripSnapPosition } from '../../systems/cursor/GripSnapStore';
import { gripStyleStore } from '../../stores/GripStyleStore';
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
import type { WallHotGripOp, HotGripStep } from './wall-hot-grip-fsm';
import { WallRotateHotGripStore } from '../../bim/walls/wall-rotate-hotgrip-store';
// ADR-397 — rotation snap targets SSoT (arm on centre-pick, clear on reset).
import { getGlobalRotationSnapStore } from '../../bim/grips/rotation-snap-store';
import { runGripMouseDown, runGripMouseUp } from './grip-mouse-handlers';
import type { DxfCommitDeps, OverlayCommitDeps } from './grip-commit-adapters';
import { GripBasePointStore } from '../../systems/grip/GripBasePointStore';
import { GripAltMoveStore } from '../../systems/grip/GripAltMoveStore';
import { GripCopyModeStore } from '../../systems/grip/GripCopyModeStore';
import { GripReferenceStore } from '../../systems/grip/GripReferenceStore';
import { GripSessionUndoStore } from '../../systems/grip/GripSessionUndoStore';
import { getGlobalCommandHistory } from '../../core/commands/CommandHistory';
import { useGripSpacebarCycle } from './useGripSpacebarCycle';
import {
  buildDxfDragPreview,
  buildRotateReferencePreview,
  buildGripInteractionState,
  buildOverlayHoveredVertex,
  buildOverlayHoveredEdge,
  buildOverlayProjection,
  buildGripStateForStack,
} from './grip-projections';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import { useMoveEntities } from '../useMoveEntities';
import { useCommandHistory } from '../../core/commands';
import { useLevels } from '../../systems/levels';
import { clearActiveDragGrip } from '../../systems/cursor/GripDragStore';
// ADR-363 — crosshair snap-to-grid: publish the drag anchor so the cursor leaf
// (`mouse-handler-move`) can quantize the crosshair onto the step grid (F9+Q).
import { setGripStepAnchor, clearGripStepAnchor } from '../../systems/cursor/GripStepAnchorStore';
// ADR-040 Phase XXII.A — transform reads from SSoT (orchestrator-decoupling).
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
// Re-export types for consumers
export type { UseUnifiedGripInteractionParams, UseUnifiedGripInteractionReturn, DxfProjection };
export type { OverlayProjection } from './unified-grip-types';
const WARM_DELAY_MS = 1000;
const GRIP_HOVER_THROTTLE_MS = 100;
// ADR-363 Phase 1G — squared world-distance threshold above which the hot-grip
// cursor counts as "moved from the anchor". Tiny (essentially "moved at all"):
// any real cursor move dwarfs it, while an exact same-spot release stays below.
const HOT_GRIP_MOVE_EPS_SQ = 1e-12;
// ============================================================================
// HOOK
// ============================================================================
export function useUnifiedGripInteraction(
  params: UseUnifiedGripInteractionParams,
): UseUnifiedGripInteractionReturn {
  // ADR-040 XXII.A: `transform` param retained for signature compat; reads via SSoT.
  const {
    selectedEntityIds, dxfScene, transform: _transform,
    currentOverlays, universalSelection, overlayStore, overlayStoreRef,
    activeTool, gripSettings, executeCommand, movementDetectionThreshold,
    onToolChange,
  } = params;
  void _transform;
  // ── Commit deps ──
  const { moveEntities } = useMoveEntities();
  const { execute } = useCommandHistory();
  const { currentLevelId, getLevelScene, setLevelScene } = useLevels();
  const onToolChangeRef = useRef(onToolChange);
  onToolChangeRef.current = onToolChange;
  const dxfCommitDeps = useMemo<DxfCommitDeps>(
    () => ({
      moveEntities, execute, currentLevelId, getLevelScene, setLevelScene,
      onToolChange: (tool: string) => onToolChangeRef.current?.(tool),
    }),
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
  // ADR-363 Phase 1G — distinguishes the 1st-click release (arm, stay hot) from
  // the 2nd-click release (commit) while `phase === 'hotGrip'`.
  const hotGripAwaitingFirstReleaseRef = useRef(false);
  // ADR-363 Phase 1G — true once the cursor has moved away from the grip anchor
  // since arming. Gates the commit so a stray same-spot release (the 2nd fire of
  // the canvas+container mouseup pair) cannot resetToIdle and kill the hot move.
  const hotGripMovedRef = useRef(false);
  // ADR-363 Phase 1G — hot-grip context.
  //   op   = corner (2-click) | move (3-click) | rotate (6-click reference flow).
  //   step = which point the next deliberate click picks (see HotGripStep).
  //   base = the picked base point (move) / rotation centre (rotate).
  const hotGripOpRef = useRef<WallHotGripOp | null>(null);
  const hotGripStepRef = useRef<HotGripStep>('tracking');
  const hotGripBaseRef = useRef<Point2D | null>(null);
  // ADR-363 Phase 1G.3 — rotate-reference (6-click): the existing (reference) line
  // and the alignment line points. The wall spins by angle(align) − angle(ref).
  const hotGripRefStartRef = useRef<Point2D | null>(null);
  const hotGripRefEndRef = useRef<Point2D | null>(null);
  const hotGripAlignStartRef = useRef<Point2D | null>(null);
  // ── Overlay grip state (backward compat) ──
  const [selectedGrips, setSelectedGrips] = useState<SelectedGrip[]>([]);
  const [draggingVertices, setDraggingVertices] = useState<DraggingVertexState[] | null>(null);
  const [draggingEdgeMidpoint, setDraggingEdgeMidpoint] = useState<DraggingEdgeMidpointState | null>(null);
  const [draggingOverlayBody, setDraggingOverlayBody] = useState<DraggingOverlayBodyState | null>(null);
  const [dragPreviewPosition, setDragPreviewPosition] = useState<Point2D | null>(null);
  // ── Refs ──
  const gripHoverThrottleRef = useRef<GripHoverThrottle>({ lastCheckTime: 0, lastWorldPoint: null });
  const justFinishedDragRef = useRef(false);
  // Sync mutex: canvas onMouseUp + container onMouseUp both fire in the same
  // tick and would both pass the state check (setState is async, so closure
  // values are stale). Without a sync guard the second call commits again with
  // a wrong worldPos and teleports the vertex toward (0,0). See ADR-031.
  const mouseUpInProgressRef = useRef(false);
  // Same race exists on mouseDown — canvas and container both call
  // handleMouseDown. The container's call uses a stale `mouseWorldRef`, so it
  // typically resolves no nearGrip and would `setSelectedGrips([])`, clobbering
  // the correct selection set by the canvas's call (every other click).
  const mouseDownInProgressRef = useRef(false);
  const markDragFinished = useCallback(() => {
    justFinishedDragRef.current = true;
    setTimeout(() => { justFinishedDragRef.current = false; }, PANEL_LAYOUT.TIMING.DRAG_FINISH_RESET);
  }, []);
  const isGripMode = activeTool === 'select' || activeTool === 'layering';
  // ADR-349 Phase 1c-A: spacebar cycles grip-hot mode (Stretch → Move → Rotate → Scale → Mirror).
  useGripSpacebarCycle({ phase, activeTool });
  // ── Reset on selection change ──
  const entitySelectionKey = selectedEntityIds.join(',');
  const overlaySelectionKey = selectedOverlays.map((o) => o.id).join(',');
  useEffect(() => {
    setPhase('idle');
    setHoveredGrip(null);
    setActiveGrip(null);
    setCurrentWorldPos(null);
    anchorRef.current = null;
    clearGripStepAnchor();
    hotGripAwaitingFirstReleaseRef.current = false;
    hotGripMovedRef.current = false;
    hotGripOpRef.current = null;
    hotGripStepRef.current = 'tracking';
    hotGripBaseRef.current = null;
    hotGripRefStartRef.current = null;
    hotGripRefEndRef.current = null;
    hotGripAlignStartRef.current = null;
    WallRotateHotGripStore.clear();
    if (warmTimerRef.current) { clearTimeout(warmTimerRef.current); warmTimerRef.current = null; }
    // ADR-357 Phase 12 — selection change ends the grip-hot session: clear
    // all 4 grip-extras micro-leaf SSoT stores so the next session starts clean.
    GripBasePointStore.clear();
    GripCopyModeStore.clear();
    GripReferenceStore.clear();
    GripSessionUndoStore.clear();
  }, [entitySelectionKey, overlaySelectionKey]);
  // ADR-357 Phase 12 — keep `GripSessionUndoStore.currentSize` synced with the
  // global CommandHistory so the right-click `Undo` extra knows whether any
  // commands have been produced since the session began. Subscribed once for
  // the lifetime of the hook; the store itself stays inactive (sessionStartSize
  // === null) until `markSessionStart` is called on the first drag.
  useEffect(() => {
    const history = getGlobalCommandHistory();
    GripSessionUndoStore.reportHistorySize(history.size());
    const unsub = history.subscribe((event) => {
      GripSessionUndoStore.reportHistorySize(event.undoStackSize);
    });
    return unsub;
  }, []);
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
    clearGripStepAnchor();
    hotGripAwaitingFirstReleaseRef.current = false;
    hotGripMovedRef.current = false;
    hotGripOpRef.current = null;
    hotGripStepRef.current = 'tracking';
    hotGripBaseRef.current = null;
    hotGripRefStartRef.current = null;
    hotGripRefEndRef.current = null;
    hotGripAlignStartRef.current = null;
    WallRotateHotGripStore.clear();
    // ADR-397 — disarm the rotation snap targets (pivot ⊙ + grips) so the cursor
    // stops magnetising and the cyan grips revert once the rotation ends/cancels.
    getGlobalRotationSnapStore().clear();
    // ADR-363 Phase 1G.5 — disarm the Alt whole-entity move at the end of every
    // grip session so the next drag starts from its natural parametric behaviour.
    GripAltMoveStore.clear();
    // ADR-363 Phase 1G.3 — drop any hot-grip step hint so a finished/cancelled
    // flow does not leave a stale "click alignment point" prompt in the status bar.
    toolHintOverrideStore.setOverride(null);
    clearActiveDragGrip();
  }, []);
  // ── MOUSE MOVE ──
  const handleMouseMove = useCallback(
    (worldPos: Point2D, _screenPos: Point2D) => {
      if (!isGripMode || allGrips.length === 0) return;
      const now = performance.now();
      const throttle = gripHoverThrottleRef.current;
      // ADR-363 Phase 1G — hotGrip follows the cursor at full rate like dragging
      // (no hover throttle), so the rubber-band + ghost track smoothly.
      const isFollowing = phase === 'dragging' || phase === 'hotGrip';
      if (!isFollowing && now - throttle.lastCheckTime < GRIP_HOVER_THROTTLE_MS) return;
      if (!isFollowing) throttle.lastCheckTime = now;
      throttle.lastWorldPoint = worldPos;
      if (isFollowing && activeGrip) {
        setCurrentWorldPos(worldPos);
        // ADR-363 — publish the constant drag anchor (same one that feeds the ghost
        // via `buildDxfDragPreview`) so the cursor leaf can snap the crosshair onto
        // the step grid with the fresh world pos each frame (zero-lag, WYSIWYG).
        if (anchorRef.current) setGripStepAnchor(anchorRef.current);
        else clearGripStepAnchor();
        if (phase === 'hotGrip') {
          // ADR-363 Phase 1G.2/1G.3 — any pick step (waiting for a deliberate
          // click: base/centre/ref/align) marks "moved" on a real mousemove so the
          // next click advances/commits. The same-tick double mouseup (canvas+
          // container) produces NO mousemove, so its stray fire2 stays moved=false
          // → 'stay', and a single click can never burn two steps. The terminal
          // 'tracking' step (move/corner) uses the anchor-distance check below.
          if (hotGripStepRef.current !== 'tracking') {
            hotGripMovedRef.current = true;
          }
          // Tracking (move/corner): once the cursor leaves the anchor, mark moved
          // so the next deliberate click commits (a stray same-spot release stays hot).
          if (anchorRef.current) {
            const adx = worldPos.x - anchorRef.current.x;
            const ady = worldPos.y - anchorRef.current.y;
            if (adx * adx + ady * ady > HOT_GRIP_MOVE_EPS_SQ) hotGripMovedRef.current = true;
          }
        }
        if (activeGrip.source === 'overlay') setDragPreviewPosition(worldPos);
        return;
      }
      // ADR-040 XXII.A: live SSoT read — no stale-closure on rapid zoom.
      const nearGrip = findNearestGrip(worldPos, allGrips, effectiveTolerance, getImmediateTransform().scale);
      if (nearGrip) {
        if (!hoveredGrip || hoveredGrip.id !== nearGrip.id) {
          setHoveredGrip(nearGrip);
          if (gripStyleStore.get().snapToGrips) lockGripSnapPosition(nearGrip.position);
          setPhase('hovering');
          if (warmTimerRef.current) clearTimeout(warmTimerRef.current);
          warmTimerRef.current = setTimeout(() => { setPhase('warm'); warmTimerRef.current = null; }, WARM_DELAY_MS);
        }
      } else if (hoveredGrip && phase !== 'dragging') {
        setHoveredGrip(null);
        unlockGripSnapPosition();
        setPhase('idle');
        if (warmTimerRef.current) { clearTimeout(warmTimerRef.current); warmTimerRef.current = null; }
      }
    },
    // ADR-040 XXII.A: scale removed from deps — SSoT read at event time.
    [isGripMode, allGrips, phase, activeGrip, hoveredGrip, effectiveTolerance],
  );
  // ── MOUSE DOWN ──
  const handleMouseDown = useCallback(
    (worldPos: Point2D, isShift: boolean): boolean =>
      runGripMouseDown(worldPos, isShift, {
        mouseDownInProgressRef, activeGrip, anchorRef, onToolChangeRef, resetToIdle,
        isGripMode, allGrips, phase, effectiveTolerance, hoveredGrip, selectedGrips,
        setSelectedGrips, setActiveGrip, setPhase, setCurrentWorldPos,
        hotGripOpRef, hotGripStepRef, hotGripAwaitingFirstReleaseRef, hotGripMovedRef, hotGripBaseRef,
        hotGripRefStartRef, hotGripRefEndRef, hotGripAlignStartRef,
        warmTimerRef, universalSelection, setDraggingVertices, setDragPreviewPosition,
        overlayStoreRef, currentOverlays, setDraggingEdgeMidpoint,
      }),
    // ADR-040 XXII.A: scale removed from deps — SSoT read at event time.
    [isGripMode, allGrips, phase, activeGrip, hoveredGrip, effectiveTolerance, selectedGrips, universalSelection, overlayStoreRef, currentOverlays, resetToIdle],
  );
  // ── MOUSE UP ──
  const handleMouseUp = useCallback(
    (worldPos: Point2D): Promise<boolean> =>
      runGripMouseUp(worldPos, {
        mouseUpInProgressRef, phase, hotGripAwaitingFirstReleaseRef, hotGripStepRef,
        hotGripMovedRef, hotGripBaseRef, hotGripOpRef, activeGrip, anchorRef,
        hotGripRefStartRef, hotGripRefEndRef, hotGripAlignStartRef,
        dxfCommitDeps, overlayCommitDeps, resetToIdle, setCurrentWorldPos, markDragFinished,
        draggingVertices, setDraggingVertices, draggingEdgeMidpoint, setDraggingEdgeMidpoint,
        draggingOverlayBody, setDraggingOverlayBody, setSelectedGrips, setDragPreviewPosition,
        // ADR-397 — capture the rotating entity's grip world-points so the centre-pick
        // step can arm the rotation snap targets (pivot ⊙ + grips).
        rotatingEntityGripsWorld: () =>
          activeGrip?.source === 'dxf' && activeGrip.entityId
            ? allGrips
                .filter((g) => g.source === 'dxf' && g.entityId === activeGrip.entityId)
                .map((g) => ({ entityId: g.entityId!, gripIndex: g.gripIndex, point: g.position }))
            : [],
      }),
    [phase, activeGrip, allGrips, dxfCommitDeps, overlayCommitDeps, draggingVertices, draggingEdgeMidpoint, draggingOverlayBody, resetToIdle, markDragFinished],
  );
  // ── ESCAPE ──
  const handleEscape = useCallback((): boolean => {
    // ADR-363 Phase 1G — ESC / right-click also cancels an active corner hot-grip.
    if (phase === 'dragging' || phase === 'hotGrip') {
      setDraggingVertices(null); setDraggingEdgeMidpoint(null);
      setDraggingOverlayBody(null); setDragPreviewPosition(null);
      resetToIdle();
      return true;
    }
    return false;
  }, [phase, resetToIdle]);
  // ── PROJECTIONS (from grip-projections.ts) ──
  const dxfDragPreview = useMemo(
    () => {
      // ADR-363 Phase 1G.3 — wall-rotation uses the 6-click reference flow with its
      // own guide-line + rotating-ghost preview (built from the hot-grip refs).
      if (phase === 'hotGrip' && hotGripOpRef.current === 'rotate' && activeGrip?.source === 'dxf') {
        return buildRotateReferencePreview(
          activeGrip,
          hotGripStepRef.current,
          hotGripBaseRef.current,
          hotGripRefStartRef.current,
          hotGripRefEndRef.current,
          hotGripAlignStartRef.current,
          currentWorldPos,
        );
      }
      // ADR-363 Phase 1G.5 — Alt drag → whole-entity move ghost (base = grabbed grip).
      // The last flag marks a wall "move" hot-grip so ORTHO (F8) locks its ghost too.
      return buildDxfDragPreview(
        phase, activeGrip, anchorRef.current, currentWorldPos,
        GripAltMoveStore.getActive(),
        phase === 'hotGrip' && hotGripOpRef.current === 'move',
      );
    },
    [phase, activeGrip, currentWorldPos],
  );
  const gripInteractionState = useMemo(
    () => buildGripInteractionState(hoveredGrip, activeGrip, phase),
    [hoveredGrip, activeGrip, phase],
  );
  // ADR-363 Phase 1G — hotGrip counts as "following" so upstream snap applies to
  // the live rubber-band move and the lasso gate (`!isGripDragging`) stays closed.
  const isDxfFollowing = (phase === 'dragging' || phase === 'hotGrip') && activeGrip?.source === 'dxf';
  const dxfProjection = useMemo<DxfProjection>(() => ({
    gripInteractionState,
    isDraggingGrip: isDxfFollowing,
    isFollowingGrip: isDxfFollowing,
    handleGripMouseMove: (worldPos: Point2D, screenPos: Point2D) => {
      handleMouseMove(worldPos, screenPos);
      // Suppress upstream handlers (drawing preview, hover, etc.) for ANY active
      // grip drag, not only DXF — overlay grips also flow through DxfCanvas.
      return phase === 'dragging' || phase === 'hotGrip' || draggingVertices !== null || draggingEdgeMidpoint !== null || draggingOverlayBody !== null;
    },
    handleGripMouseDown: (worldPos: Point2D) => handleMouseDown(worldPos, false),
    handleGripMouseUp: (worldPos: Point2D) => {
      // Capture drag state BEFORE handleMouseUp resets it. Returning truthy here
      // tells the canvas mouse-up handler to skip onCanvasClick — otherwise the
      // active drawing tool (e.g. layering / polygon) registers a stray click
      // and creates a new polygon point while a vertex was being dragged.
      // ADR-363 Phase 1G — hotGrip release (arm + commit) must also suppress
      // onCanvasClick so the corner click-click move never deselects the wall.
      const wasDragging = phase === 'dragging' || phase === 'hotGrip' || draggingVertices !== null || draggingEdgeMidpoint !== null || draggingOverlayBody !== null;
      handleMouseUp(worldPos);
      return wasDragging;
    },
    handleGripClick: (_worldPos: Point2D) => false,
    handleGripEscape: handleEscape,
    handleGripRightClick: handleEscape,
    dragPreview: dxfDragPreview,
  }), [gripInteractionState, isDxfFollowing, phase, activeGrip, handleMouseMove, handleMouseDown, handleMouseUp, handleEscape, dxfDragPreview, draggingVertices, draggingEdgeMidpoint, draggingOverlayBody]);
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
    hoveredGrip, activeGrip, phase,
    dxfProjection, overlayProjection, gripStateForStack,
    selectedGrips, setSelectedGrips, setDragPreviewPosition,
    isDragging, gripHoverThrottleRef, justFinishedDragRef, markDragFinished,
    setDraggingOverlayBody, draggingOverlayBody, draggingVertices, draggingEdgeMidpoint,
  }), [
    handleMouseMove, handleMouseDown, handleMouseUp, handleEscape,
    hoveredGrip, activeGrip, phase,
    dxfProjection, overlayProjection, gripStateForStack,
    selectedGrips, isDragging, markDragFinished,
    draggingOverlayBody, draggingVertices, draggingEdgeMidpoint,
  ]);
}
