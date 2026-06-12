/**
 * ADR-183 / ADR-363 Phase 1G — Grip mouse-event handler bodies.
 *
 * Extracted verbatim from `useUnifiedGripInteraction` to keep that hook under the
 * Google 500-line file limit (SOS N.7.1). These are pure functions driven by a
 * context object (refs + setters + reads) supplied by the hook; behaviour is
 * identical to the previous in-hook closures — the hook's `useCallback` wrappers
 * just forward to `runGripMouseDown` / `runGripMouseUp`.
 *
 * @see useUnifiedGripInteraction.ts — owner hook + state
 * @see wall-hot-grip-fsm.ts — hot-grip decision SSoT
 */
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import { unlockGripSnapPosition } from '../../systems/cursor/GripSnapStore';
import { gripStyleStore } from '../../stores/GripStyleStore';
import { findNearestGrip } from './grip-hit-testing';
import {
  resolveHotGripMouseDown, resolveHotGripMouseUp, isWallHotGripKind,
  hotGripOpForKind, initialHotGripStep, hotGripKindOf,
  type WallHotGripOp, type HotGripStep,
} from './wall-hot-grip-fsm';
import { BimRotateHotGripStore } from '../../bim/grips/bim-rotate-hotgrip-store';
import { commitDxfGripDragModeAware, type DxfCommitDeps, type OverlayCommitDeps } from './grip-commit-adapters';
import { commitHotGripCopy } from './grip-parametric-commits';
import { applyGripStepSnap } from '../../bim/grips/grip-step-quantize';
import { CtrlKeyTracker } from '../../keyboard/CtrlKeyTracker';
import {
  commitOverlayVertexDrag,
  commitOverlayEdgeMidpointDrag,
  commitOverlayBodyDrag,
} from './overlay-grip-commit-adapters';
import { GripModeStore } from '../../systems/grip/GripModeStore';
import { GripBasePointStore } from '../../systems/grip/GripBasePointStore';
import { GripAltMoveStore } from '../../systems/grip/GripAltMoveStore';
import { GripCopyModeStore } from '../../systems/grip/GripCopyModeStore';
import { GripReferenceStore } from '../../systems/grip/GripReferenceStore';
import { GripSessionUndoStore } from '../../systems/grip/GripSessionUndoStore';
import { GripHandoffStore } from '../../systems/grip/GripHandoffStore';
import { getGlobalCommandHistory } from '../../core/commands/CommandHistory';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import i18next from 'i18next';
import { setActiveDragGrip } from '../../systems/cursor/GripDragStore';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import type {
  UnifiedGripInfo,
  UnifiedGripPhase,
  UseUnifiedGripInteractionParams,
  SelectedGrip,
  DraggingVertexState,
  DraggingEdgeMidpointState,
  DraggingOverlayBodyState,
} from './unified-grip-types';
import { applyHotGripHint, advanceHotGripPick, commitRotateReference } from './grip-hotgrip-actions';

export interface GripMouseDownCtx {
  mouseDownInProgressRef: MutableRefObject<boolean>;
  activeGrip: UnifiedGripInfo | null;
  anchorRef: MutableRefObject<Point2D | null>;
  onToolChangeRef: MutableRefObject<UseUnifiedGripInteractionParams['onToolChange']>;
  resetToIdle: () => void;
  isGripMode: boolean;
  allGrips: UnifiedGripInfo[];
  phase: UnifiedGripPhase;
  effectiveTolerance: number;
  hoveredGrip: UnifiedGripInfo | null;
  selectedGrips: SelectedGrip[];
  setSelectedGrips: Dispatch<SetStateAction<SelectedGrip[]>>;
  setActiveGrip: Dispatch<SetStateAction<UnifiedGripInfo | null>>;
  setPhase: Dispatch<SetStateAction<UnifiedGripPhase>>;
  setCurrentWorldPos: Dispatch<SetStateAction<Point2D | null>>;
  hotGripOpRef: MutableRefObject<WallHotGripOp | null>;
  hotGripStepRef: MutableRefObject<HotGripStep>;
  hotGripAwaitingFirstReleaseRef: MutableRefObject<boolean>;
  hotGripMovedRef: MutableRefObject<boolean>;
  hotGripBaseRef: MutableRefObject<Point2D | null>;
  // ADR-363 Phase 1G.3 — rotate-reference (6-click) line points.
  hotGripRefStartRef: MutableRefObject<Point2D | null>;
  hotGripRefEndRef: MutableRefObject<Point2D | null>;
  hotGripAlignStartRef: MutableRefObject<Point2D | null>;
  warmTimerRef: MutableRefObject<ReturnType<typeof setTimeout> | null>;
  universalSelection: UseUnifiedGripInteractionParams['universalSelection'];
  setDraggingVertices: Dispatch<SetStateAction<DraggingVertexState[] | null>>;
  setDragPreviewPosition: Dispatch<SetStateAction<Point2D | null>>;
  overlayStoreRef: UseUnifiedGripInteractionParams['overlayStoreRef'];
  currentOverlays: UseUnifiedGripInteractionParams['currentOverlays'];
  setDraggingEdgeMidpoint: Dispatch<SetStateAction<DraggingEdgeMidpointState | null>>;
}

export interface GripMouseUpCtx {
  mouseUpInProgressRef: MutableRefObject<boolean>;
  phase: UnifiedGripPhase;
  hotGripAwaitingFirstReleaseRef: MutableRefObject<boolean>;
  hotGripStepRef: MutableRefObject<HotGripStep>;
  hotGripMovedRef: MutableRefObject<boolean>;
  hotGripBaseRef: MutableRefObject<Point2D | null>;
  hotGripOpRef: MutableRefObject<WallHotGripOp | null>;
  // ADR-363 Phase 1G.3 — rotate-reference (6-click) line points.
  hotGripRefStartRef: MutableRefObject<Point2D | null>;
  hotGripRefEndRef: MutableRefObject<Point2D | null>;
  hotGripAlignStartRef: MutableRefObject<Point2D | null>;
  activeGrip: UnifiedGripInfo | null;
  anchorRef: MutableRefObject<Point2D | null>;
  dxfCommitDeps: DxfCommitDeps;
  overlayCommitDeps: OverlayCommitDeps;
  resetToIdle: () => void;
  setCurrentWorldPos: Dispatch<SetStateAction<Point2D | null>>;
  markDragFinished: () => void;
  draggingVertices: DraggingVertexState[] | null;
  setDraggingVertices: Dispatch<SetStateAction<DraggingVertexState[] | null>>;
  draggingEdgeMidpoint: DraggingEdgeMidpointState | null;
  setDraggingEdgeMidpoint: Dispatch<SetStateAction<DraggingEdgeMidpointState | null>>;
  draggingOverlayBody: DraggingOverlayBodyState | null;
  setDraggingOverlayBody: Dispatch<SetStateAction<DraggingOverlayBodyState | null>>;
  setSelectedGrips: Dispatch<SetStateAction<SelectedGrip[]>>;
  setDragPreviewPosition: Dispatch<SetStateAction<Point2D | null>>;
  // ADR-397 — rotating entity's grip world-points provider, consumed by
  // advanceHotGripPick to arm the rotation snap targets at centre-pick.
  rotatingEntityGripsWorld?: () => ReadonlyArray<{ entityId: string; gripIndex: number; point: Point2D }>;
}

// ============================================================================
// MOUSE DOWN
// ============================================================================
export function runGripMouseDown(worldPos: Point2D, isShift: boolean, ctx: GripMouseDownCtx): boolean {
  const {
    mouseDownInProgressRef, activeGrip, anchorRef, onToolChangeRef, resetToIdle,
    isGripMode, allGrips, phase, effectiveTolerance, hoveredGrip, selectedGrips,
    setSelectedGrips, setActiveGrip, setPhase, setCurrentWorldPos,
    hotGripOpRef, hotGripStepRef, hotGripAwaitingFirstReleaseRef, hotGripMovedRef, hotGripBaseRef,
    hotGripRefStartRef, hotGripRefEndRef, hotGripAlignStartRef,
    warmTimerRef, universalSelection, setDraggingVertices, setDragPreviewPosition,
    overlayStoreRef, currentOverlays, setDraggingEdgeMidpoint,
  } = ctx;
  if (mouseDownInProgressRef.current) return false;
  // ADR-357 Phase 12 — pick-mode interception: BasePoint and Reference picks
  // run DURING an active drag (phase === 'dragging') and must be consumed
  // BEFORE the normal grip-drag mouse-down logic short-circuits via the
  // `phase === 'dragging'` early-return below.
  if (GripBasePointStore.getSnapshot().pickPhase === 'awaiting-click') {
    GripBasePointStore.setOverrideAnchor(worldPos);
    // Drop the override-pick prompt and restore the active mode hint.
    const modeLabel = i18next.t(`tool-hints:gripMode.${GripModeStore.getSnapshot()}`);
    toolHintOverrideStore.setOverride(
      i18next.t('tool-hints:gripMode.cycleHint', { mode: modeLabel }),
    );
    return true;
  }
  const refSnap = GripReferenceStore.getSnapshot();
  if (refSnap.phase === 'pick-first') {
    GripReferenceStore.setRefStart(worldPos);
    toolHintOverrideStore.setOverride(
      i18next.t('tool-hints:gripContextMenu.prompts.pickRefEnd'),
    );
    return true;
  }
  if (refSnap.phase === 'pick-second') {
    GripReferenceStore.setRefEnd(worldPos);
    // Second click completes the reference pick — fire the mode handoff
    // straight away so the downstream tool (Scale or Rotate) takes over
    // with `refStart` / `refEnd` (and optionally `copyMode`) pre-loaded.
    const after = GripReferenceStore.getSnapshot();
    const mode = after.mode;
    if ((mode === 'scale' || mode === 'rotate') && after.refStart && after.refEnd) {
      const anchor = GripBasePointStore.getSnapshot().overrideAnchor
        ?? activeGrip?.position
        ?? anchorRef.current
        ?? worldPos;
      GripHandoffStore.set(mode, anchor, {
        refStart: after.refStart,
        refEnd: after.refEnd,
        copyMode: GripCopyModeStore.getSnapshot().enabled || undefined,
      });
      onToolChangeRef.current?.(mode);
    }
    GripReferenceStore.clear();
    GripBasePointStore.clear();
    resetToIdle();
    return true;
  }
  // ADR-363 Phase 1G — 2nd click of a corner hot-grip: consume the mousedown
  // so lasso/selection do not arm; the commit fires on the matching mouseup.
  if (isGripMode && resolveHotGripMouseDown(phase, hotGripKindOf(activeGrip)) === 'consume') {
    return true;
  }
  if (!isGripMode || allGrips.length === 0 || phase === 'dragging') return false;
  mouseDownInProgressRef.current = true;
  // The handler is fully synchronous, so a microtask is enough to release
  // the mutex once the current event tick (canvas + bubbled container)
  // has finished dispatching.
  Promise.resolve().then(() => { mouseDownInProgressRef.current = false; });
  // ADR-040 XXII.A: live SSoT read.
  const hitGrip = findNearestGrip(worldPos, allGrips, effectiveTolerance, getImmediateTransform().scale);
  // ADR-363 Phase 1G — forgiving hot-grip entry: if the click just missed the
  // handle but a wall hot-grip (corner / move / rotation glyph) is currently
  // highlighted (hovered/warm), treat it as the hit so the click still grabs it
  // (AutoCAD-like: "it's blue → click grabs it", even with a slightly off click).
  const nearGrip = hitGrip
    ?? (hoveredGrip?.source === 'dxf' && isWallHotGripKind(hotGripKindOf(hoveredGrip)) ? hoveredGrip : null);
  if (!nearGrip) {
    if (!isShift && selectedGrips.length > 0) setSelectedGrips([]);
    return false;
  }
  // DXF grip
  if (nearGrip.source === 'dxf') {
    // ADR-363 Phase 1G.5 — Alt held at press → «move-from-characteristic-point».
    // The grabbed grip (corner / endpoint / midpoint / thickness) becomes the
    // base point of a WHOLE-entity move: skip the hot-grip click-click flow and
    // route the gesture through the plain press-drag `dragging` path so the
    // ghost + commit translate the entire entity. Arm the SSoT the live ghost
    // (buildDxfDragPreview) and the commit (commitDxfGripDragModeAware) read.
    const altMove = GripAltMoveStore.wasAltAtMouseDown();
    // ADR-363 Phase 1G — wall corner grips use the AutoCAD hot-grip (click-
    // click) flow instead of press-drag-release: 1st click enters `hotGrip`,
    // cursor moves live, 2nd click (mouseup) commits. All other wall grips
    // fall through to the standard `dragging` path below. Alt bypasses this so
    // the corner becomes a base-point move handle.
    if (!altMove && resolveHotGripMouseDown(phase, hotGripKindOf(nearGrip)) === 'enter') {
      const op = hotGripOpForKind(hotGripKindOf(nearGrip))!; // non-null: 'enter' ⇒ hot kind
      setActiveGrip(nearGrip);
      setPhase('hotGrip');
      unlockGripSnapPosition();
      hotGripOpRef.current = op;
      const initialStep = initialHotGripStep(op);
      hotGripStepRef.current = initialStep;
      hotGripAwaitingFirstReleaseRef.current = true;
      hotGripMovedRef.current = false;
      hotGripBaseRef.current = null;
      hotGripRefStartRef.current = null;
      hotGripRefEndRef.current = null;
      hotGripAlignStartRef.current = null;
      BimRotateHotGripStore.clear();
      if (op === 'corner') {
        // Corner: the grip itself is the anchor (2-click flow).
        anchorRef.current = nearGrip.position;
        setCurrentWorldPos(nearGrip.position);
      } else {
        // Move / rotate: the base point / rotation centre is picked on the
        // 2nd click — no anchor or preview yet (await-base step).
        anchorRef.current = null;
        setCurrentWorldPos(null);
      }
      // ADR-363 Phase 1G.3 — prompt the first awaited pick (centre / base).
      applyHotGripHint(op, initialStep);
      if (warmTimerRef.current) { clearTimeout(warmTimerRef.current); warmTimerRef.current = null; }
      setActiveDragGrip({ entityId: nearGrip.entityId!, gripKind: hotGripKindOf(nearGrip) ?? null });
      GripSessionUndoStore.markSessionStart(getGlobalCommandHistory().size());
      return true;
    }
    setActiveGrip(nearGrip);
    setPhase('dragging');
    unlockGripSnapPosition();
    anchorRef.current = nearGrip.position;
    setCurrentWorldPos(nearGrip.position);
    // ADR-363 Phase 1G.5 — arm the whole-entity move for this drag (Alt at press).
    // The anchor is the grabbed grip position → base point of the move.
    if (altMove) GripAltMoveStore.arm();
    if (warmTimerRef.current) { clearTimeout(warmTimerRef.current); warmTimerRef.current = null; }
    // ADR-371 extension — expose active grip to mouse handlers for face corner projection snap.
    // ADR-398 — also publish the column grip kind + the resize/drag anchor (grip
    // position) so the column Body Corner Projection snap can run on press-drag.
    setActiveDragGrip({
      entityId: nearGrip.entityId!,
      gripKind: nearGrip.wallGripKind ?? nearGrip.columnGripKind ?? null,
      dragAnchor: nearGrip.position,
    });
    // ADR-357 Phase 12 — mark the start of the grip-hot session so the
    // right-click `Undo` extra can bound the global CommandHistory to
    // commands produced during this session. Idempotent (no-op if already armed).
    GripSessionUndoStore.markSessionStart(getGlobalCommandHistory().size());
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
      if (isShift && gripStyleStore.get().multiGripEdit) {
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
        unlockGripSnapPosition();
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
      unlockGripSnapPosition();
      anchorRef.current = nearGrip.position;
      setCurrentWorldPos(nearGrip.position);
      if (warmTimerRef.current) { clearTimeout(warmTimerRef.current); warmTimerRef.current = null; }
      return true;
    }
  }
  return false;
}

// ============================================================================
// MOUSE UP
// ============================================================================
export async function runGripMouseUp(worldPos: Point2D, ctx: GripMouseUpCtx): Promise<boolean> {
  const {
    mouseUpInProgressRef, phase, hotGripAwaitingFirstReleaseRef, hotGripStepRef,
    hotGripMovedRef, hotGripOpRef, activeGrip, anchorRef,
    dxfCommitDeps, overlayCommitDeps, resetToIdle, markDragFinished,
    draggingVertices, setDraggingVertices, draggingEdgeMidpoint, setDraggingEdgeMidpoint,
    draggingOverlayBody, setDraggingOverlayBody, setSelectedGrips, setDragPreviewPosition,
  } = ctx;
  if (mouseUpInProgressRef.current) return false;
  mouseUpInProgressRef.current = true;
  try {
    // ADR-363 Phase 1G — wall hot-grip release. 1st-click release arms (stays hot);
    // subsequent deliberate (moved) clicks advance the pick steps; the terminal
    // step's click commits. mouseup snap is already applied upstream
    // (mouse-handler-up), so each picked point is snapped (vs the un-snapped down).
    const hotOp = hotGripOpRef.current;
    const hotUp = resolveHotGripMouseUp(
      hotOp, phase, hotGripAwaitingFirstReleaseRef.current, hotGripStepRef.current, hotGripMovedRef.current,
    );
    if (hotUp !== 'none' && activeGrip?.source === 'dxf') {
      if (hotUp === 'arm') {
        // 1st-click release — arm the move, stay hot. Re-baseline the move flag
        // so the cursor must leave the anchor before the next click counts.
        hotGripAwaitingFirstReleaseRef.current = false;
        hotGripMovedRef.current = false;
        return true;
      }
      if (hotUp === 'stay') {
        // Stray same-spot release (e.g. 2nd fire of the canvas+container mouseup
        // pair) — keep hot, do NOT advance/commit, so the flow survives the click.
        return true;
      }
      if (hotUp === 'advance') {
        // Deliberate click on a non-terminal step — record its point + step on.
        advanceHotGripPick(worldPos, ctx);
        hotGripMovedRef.current = false;
        return true;
      }
      // commit (terminal step).
      if (hotOp === 'rotate') {
        commitRotateReference(worldPos, activeGrip, ctx);
        return true;
      }
      // move / corner — needs an anchor (base point / grip position).
      if (!anchorRef.current) return true;
      const effectiveAnchor = GripBasePointStore.getSnapshot().overrideAnchor ?? anchorRef.current;
      // SNAP-MODE (F9) — quantize displacement to the user step (no-op when OFF).
      const delta: Point2D = applyGripStepSnap({ x: worldPos.x - effectiveAnchor.x, y: worldPos.y - effectiveAnchor.y });
      // ADR-363 Phase 1G.4 + ADR-397 — Ctrl (or ⌘) held at the terminal click of
      // a MOVE hot-grip copies the entity (AutoCAD MOVE→COPY) instead of
      // translating it. Dispatched entity-agnostically (wall-midpoint /
      // column-center) via `commitHotGripCopy`; falls through to the move commit
      // when the kind has no copy path. Single copy — the flow resets afterwards.
      const copied =
        hotOp === 'move' && CtrlKeyTracker.getSnapshot() &&
        commitHotGripCopy(activeGrip, delta, dxfCommitDeps);
      if (!copied) {
        commitDxfGripDragModeAware(activeGrip, delta, dxfCommitDeps, GripModeStore.getSnapshot());
      }
      GripBasePointStore.clear();
      resetToIdle();
      return true;
    }
    if (phase === 'dragging' && activeGrip?.source === 'dxf' && anchorRef.current) {
      // ADR-357 Phase 12 — honor the `Base Point` override: when the user
      // re-anchored the drag through the right-click menu, the displacement
      // is measured from the user-picked anchor instead of `grip.position`.
      const effectiveAnchor = GripBasePointStore.getSnapshot().overrideAnchor ?? anchorRef.current;
      // SNAP-MODE (F9) — quantize displacement to the user step (no-op when OFF).
      const delta: Point2D = applyGripStepSnap({ x: worldPos.x - effectiveAnchor.x, y: worldPos.y - effectiveAnchor.y });
      commitDxfGripDragModeAware(activeGrip, delta, dxfCommitDeps, GripModeStore.getSnapshot());
      // The override is a per-drag modifier — clear it at commit so the
      // next drag starts from the natural grip anchor.
      GripBasePointStore.clear();
      resetToIdle();
      return true;
    }
    if (draggingVertices && draggingVertices.length > 0) {
      const delta = applyGripStepSnap({ x: worldPos.x - draggingVertices[0].startPoint.x, y: worldPos.y - draggingVertices[0].startPoint.y });
      const vertexGrips: UnifiedGripInfo[] = draggingVertices.map((dv) => ({
        id: `overlay_${dv.overlayId}_v${dv.vertexIndex}`, source: 'overlay' as const,
        overlayId: dv.overlayId, gripIndex: dv.vertexIndex, type: 'vertex' as const,
        position: dv.originalPosition, movesEntity: false,
      }));
      await commitOverlayVertexDrag(vertexGrips, delta, overlayCommitDeps);
      // Clear selection so the dragged grip drops out of the 'hot' visual
      // state on release — otherwise the renderer keeps painting it red
      // because `isSelected` maps to the hot color in layer-polygon-renderer.
      setSelectedGrips([]);
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
      setSelectedGrips([]);
      setDraggingEdgeMidpoint(null); setDragPreviewPosition(null); markDragFinished(); resetToIdle();
      return true;
    }
    if (draggingOverlayBody) {
      const delta = applyGripStepSnap({ x: worldPos.x - draggingOverlayBody.startPoint.x, y: worldPos.y - draggingOverlayBody.startPoint.y });
      await commitOverlayBodyDrag(draggingOverlayBody.overlayId, delta, overlayCommitDeps);
      setSelectedGrips([]);
      setDraggingOverlayBody(null); setDragPreviewPosition(null); markDragFinished(); resetToIdle();
      return true;
    }
    return false;
  } finally {
    mouseUpInProgressRef.current = false;
  }
}
