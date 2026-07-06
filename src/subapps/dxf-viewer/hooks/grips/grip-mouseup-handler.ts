/**
 * ADR-183 / ADR-363 Phase 1G — Grip MOUSE-UP handler body.
 *
 * Split out of `grip-mouse-handlers.ts` to keep both that file and this one under
 * the Google 500-line limit (SOS N.7.1). Behaviour is identical — `runGripMouseUp`
 * was moved verbatim along with its mouse-up-only helpers (`applyGripArmClick`,
 * `ARM_CLICK_MAX_MOVE_PX`). The owner hook imports it from here.
 *
 * @see grip-mouse-handlers.ts — mouse-down handler + shared context types
 * @see useUnifiedGripInteraction.ts — owner hook + state
 * @see wall-hot-grip-fsm.ts — hot-grip decision SSoT
 */
import type { Point2D } from '../../rendering/types/Types';
import { resolveHotGripMouseUp } from './wall-hot-grip-fsm';
import { commitDxfGripDragModeAware, createSceneManagerAdapter } from './grip-commit-adapters';
// ADR-513 §grip-parity — πληκτρολογημένο Μήκος/Γωνία (Δαχτυλίδι) στην ΕΠΕΚΤΑΣΗ ΑΚΡΟΥ γραμμής.
import { resolveLineEndpointLockedDelta } from '../../systems/dynamic-input/grip-endpoint-lock';
import { resolveEndpointReshapePolarLock } from './grip-endpoint-polar-lock';
import { resolveActiveFootprintGripKind } from '../../systems/grip/footprint-reshape-anchors';
import { commitHotGripCopy } from './grip-parametric-commits';
import { applyGripStepSnap } from '../../bim/grips/grip-step-quantize';
import { applyMoveConstraints, applyResizeConstraints } from '../../bim/grips/grip-move-constraints';
import { CtrlKeyTracker } from '../../keyboard/CtrlKeyTracker';
import { ShiftKeyTracker } from '../../keyboard/ShiftKeyTracker';
// ADR-501 — armed-grip SSoT: click a cold grip → arm it orange (multi-grip move).
import { GripArmedStore } from '../../systems/grip/GripArmedStore';
import {
  commitOverlayVertexDrag,
  commitOverlayEdgeMidpointDrag,
  commitOverlayBodyDrag,
} from './overlay-grip-commit-adapters';
import { GripModeStore } from '../../systems/grip/GripModeStore';
import { GripBasePointStore } from '../../systems/grip/GripBasePointStore';
import { isActiveGripAltMove } from '../../systems/cursor/GripDragStore';
import { getImmediateTransform } from '../../systems/cursor/ImmediateTransformStore';
import type { UnifiedGripInfo, DxfCommitDeps } from './unified-grip-types';
import { advanceHotGripPick, commitRotateReference, commitFreeRotate } from './grip-hotgrip-actions';
import type { GripMouseUpCtx } from './grip-mouse-handlers.types';

// ADR-501 — click-vs-drag threshold (screen px). A press-release on a DXF grip that
// moves the cursor LESS than this counts as a CLICK → arm the grip (orange) for a
// multi-grip move; moving more is a real drag → the existing stretch/move commit.
const ARM_CLICK_MAX_MOVE_PX = 4;

/**
 * ADR-501 — apply a click on a (non-hot) DXF grip to the armed-grip selection:
 * Shift → toggle this grip in/out of the set; plain → make it the only armed grip.
 */
function applyGripArmClick(grip: UnifiedGripInfo): void {
  if (grip.entityId === undefined) return;
  const ref = { entityId: grip.entityId, gripIndex: grip.gripIndex };
  if (ShiftKeyTracker.getSnapshot()) GripArmedStore.toggle(ref);
  else GripArmedStore.setOnly(ref);
}

/**
 * ADR-513 §grip-parity — the length/angle-locked commit displacement for a plain-LINE
 * endpoint drag (grip 0/1), or `null` when no lock is active / not a line endpoint. Uses
 * the SAME `resolveLineEndpointLockedDelta` SSoT the ghost uses, relative to the endpoint's
 * ORIGINAL position (`grip.position`) — so the committed stretch matches the preview exactly.
 */
function resolveLineEndpointCommitLock(
  grip: UnifiedGripInfo, worldPos: Point2D, deps: DxfCommitDeps,
): Point2D | null {
  if (grip.entityId === undefined) return null;
  const entity = createSceneManagerAdapter(deps)?.getEntity(grip.entityId);
  if (!entity) return null;
  return resolveLineEndpointLockedDelta(entity, grip.gripIndex, grip.lineGripKind, grip.position, worldPos);
}

/**
 * ADR-357/513 §grip-polar — the POLAR angle-snapped commit displacement for an endpoint reshape
 * (line grip 0/1 OR an open polyline/lwpolyline endpoint), or `null` when POLAR is off / not an
 * endpoint / not snapped. Uses the SAME `resolveEndpointReshapePolarLock` SSoT the ghost uses
 * (relative to `grip.position`) → committed stretch == preview (WYSIWYG).
 */
function resolveEndpointReshapeCommitPolar(
  grip: UnifiedGripInfo, worldPos: Point2D, deps: DxfCommitDeps,
): Point2D | null {
  if (grip.entityId === undefined) return null;
  const entity = createSceneManagerAdapter(deps)?.getEntity(grip.entityId);
  if (!entity) return null;
  return resolveEndpointReshapePolarLock(
    entity, grip.gripIndex, grip.lineGripKind, grip.position, worldPos,
    // ADR-508 §grip-tracking — καθολικό POLAR commit για reshape λαβές πολυγωνικών BIM (WYSIWYG με preview).
    resolveActiveFootprintGripKind(grip),
  )?.delta ?? null;
}

/**
 * ADR-513 §grip-parity — the EXPLICIT-input endpoint reshape displacement: the typed Μήκος/Γωνία
 * LOCK wins, else the POLAR angle-snap, else `null`. ONE resolver so the press-drag AND the
 * click-move-click (hot-grip) endpoint commits honour the SAME «ρητή είσοδος = τελική γεωμετρία»
 * priority (and stay preview ≡ commit). `null` for corner/move/non-endpoint grips → caller falls
 * through to the ortho/step-constrained commit.
 */
function resolveEndpointCommitDelta(
  grip: UnifiedGripInfo, worldPos: Point2D, deps: DxfCommitDeps,
): Point2D | null {
  return resolveLineEndpointCommitLock(grip, worldPos, deps)
    ?? resolveEndpointReshapeCommitPolar(grip, worldPos, deps);
}

/**
 * Commit an endpoint reshape `delta` (lock/polar OR ortho/step constrained) and reset the grip
 * session. ONE shape shared by every endpoint/corner/move commit short-circuit so they cannot drift.
 */
function commitEndpointReshapeDelta(
  grip: UnifiedGripInfo, delta: Point2D, deps: DxfCommitDeps, resetToIdle: () => void,
): void {
  commitDxfGripDragModeAware(grip, delta, deps, GripModeStore.getSnapshot());
  GripBasePointStore.clear();
  resetToIdle();
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
        // ADR-397 — free rotate (default) vs the opt-in 6-click reference flow.
        if (hotGripStepRef.current === 'rotate-free') {
          commitFreeRotate(worldPos, activeGrip, ctx);
        } else {
          commitRotateReference(worldPos, activeGrip, ctx);
        }
        return true;
      }
      // move / corner / endpoint-stretch — needs an anchor (base point / grip position).
      if (!anchorRef.current) return true;
      // ADR-513 §grip-parity-hotgrip — πληκτρολογημένο Μήκος/Γωνία (lock) ή POLAR angle-snap στην
      // ΕΠΕΚΤΑΣΗ ΑΚΡΟΥ μέσω click-move-click (op 'endpoint-stretch'). ΙΔΙΟΣ SSoT resolver + commit με
      // το press-drag branch → preview ≡ commit. `null` για corner/move hot-grips (μη-line-endpoint)
      // → πέφτει στα ortho/step constraints παρακάτω (δεν αγγίζει τα υπόλοιπα hot-grips).
      const endpointHotDelta = resolveEndpointCommitDelta(activeGrip, worldPos, dxfCommitDeps);
      if (endpointHotDelta) {
        commitEndpointReshapeDelta(activeGrip, endpointHotDelta, dxfCommitDeps, resetToIdle);
        return true;
      }
      const effectiveAnchor = GripBasePointStore.getSnapshot().overrideAnchor ?? anchorRef.current;
      // ORTHO (F8) locks BOTH a "move" hot-grip AND a corner reshape to the H/V axis
      // (AutoCAD/Revit parity). SNAP-MODE (F9) step then quantizes (both no-op when OFF).
      const rawDelta = { x: worldPos.x - effectiveAnchor.x, y: worldPos.y - effectiveAnchor.y };
      const delta: Point2D = hotOp === 'move' ? applyMoveConstraints(rawDelta) : applyResizeConstraints(rawDelta);
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
      // ADR-513 §grip-parity — ΕΠΕΚΤΑΣΗ ΑΚΡΟΥ γραμμής (press-drag): πληκτρολογημένο Μήκος/Γωνία (lock)
      // ή POLAR angle-snap. Ρητή είσοδος χρήστη = τελική γεωμετρία: νικά ΚΑΙ το arm-click shortcut (ώστε
      // ένα κλείδωμα με ελάχιστη κίνηση να κάνει commit, όχι arm) ΚΑΙ τα ortho/step constraints. ΙΔΙΟΣ
      // SSoT resolver + commit με το hot-grip branch → preview ≡ commit· `null` → arm-click/constraints κάτω.
      const endpointDelta = resolveEndpointCommitDelta(activeGrip, worldPos, dxfCommitDeps);
      if (endpointDelta) {
        commitEndpointReshapeDelta(activeGrip, endpointDelta, dxfCommitDeps, resetToIdle);
        return true;
      }
      // ADR-501 — click-vs-drag: a press-release that barely moved the cursor is a
      // CLICK, not a drag → arm the grip (orange) for a multi-grip move instead of
      // committing a (near-)zero-delta stretch. Alt-move (whole-entity base-point
      // move) keeps its drag intent and is excluded. Real drags (moved ≥ threshold)
      // fall through to the existing commit below.
      const clickDelta = { x: worldPos.x - effectiveAnchor.x, y: worldPos.y - effectiveAnchor.y };
      const movedPx = Math.hypot(clickDelta.x, clickDelta.y) * getImmediateTransform().scale;
      if (movedPx < ARM_CLICK_MAX_MOVE_PX && !isActiveGripAltMove()) {
        applyGripArmClick(activeGrip);
        GripBasePointStore.clear();
        markDragFinished();
        resetToIdle();
        return true;
      }
      // ORTHO (F8) locks the displacement to the H/V axis for BOTH a whole-entity
      // translate (a `movesEntity` grip or an Alt move-from-base-point → +Shift fine)
      // AND a parametric resize grip (corner/edge/vertex reshape → no Shift fine),
      // AutoCAD/Revit parity. SNAP-MODE (F9) step then quantizes (all no-op when OFF).
      const rawDelta = { x: worldPos.x - effectiveAnchor.x, y: worldPos.y - effectiveAnchor.y };
      const movesWhole = activeGrip.movesEntity === true || isActiveGripAltMove();
      const delta: Point2D = movesWhole ? applyMoveConstraints(rawDelta) : applyResizeConstraints(rawDelta);
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
      // DEFER (ADR-363): ORTHO (F8) for overlay-body move is intentionally not applied
      // here — its live ghost is drawn in the polygon renderer (ADR-040 leaf), so
      // axis-locking only the commit would break WYSIWYG. Overlays stay free until the
      // ghost is locked in the same pass. SNAP-MODE step still applies.
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
