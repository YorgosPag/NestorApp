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
import type { Point2D } from '../../rendering/types/Types';
import { unlockGripSnapPosition } from '../../systems/cursor/GripSnapStore';
import { gripStyleStore } from '../../stores/GripStyleStore';
import { findNearestGrip } from './grip-hit-testing';
import {
  resolveHotGripMouseDown, isWallHotGripKind,
  hotGripOpForKind, initialHotGripStep, hotGripKindOf,
} from './wall-hot-grip-fsm';
import { BimRotateHotGripStore } from '../../bim/grips/bim-rotate-hotgrip-store';
import { commitDxfGripDragModeAware, createSceneManagerAdapter, type DxfCommitDeps } from './grip-commit-adapters';
// ADR-363 §line local-ortho — αποτύπωση του άξονα λοξής γραμμής στην αρχή μετακίνησης μέσου/MOVE-cross.
import { isLineEntity, type Entity } from '../../types/entities';
import { setMoveOrthoAxis, clearMoveOrthoAxis } from '../../systems/grip/MoveOrthoAxisStore';
// ADR-397 Φ2 — directional move-by-value: classify the clicked MOVE arm, prompt for
// a distance (the rotation-angle PromptDialog SSoT), translate along that local axis.
import {
  resolveMoveGlyphZoneForGrip, directionForZone, isDirectionalZone,
} from '../../bim/grips/move-glyph-zones';
import { getPromptDialogStore } from '../../systems/prompt-dialog';
// ADR-501 — armed-grip SSoT: click a cold grip → arm it orange (multi-grip move).
import { GripArmedStore } from '../../systems/grip/GripArmedStore';
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
  SelectedGrip,
  DraggingVertexState,
} from './unified-grip-types';
import { applyHotGripHint } from './grip-hotgrip-actions';
import type { GripMouseDownCtx } from './grip-mouse-handlers.types';

// Ctx types live in `grip-mouse-handlers.types.ts` (file-size split). Re-export
// for callers (useUnifiedGripInteraction).
export type { GripMouseDownCtx, GripMouseUpCtx } from './grip-mouse-handlers.types';

// ============================================================================
// ADR-397 Φ2 — DIRECTIONAL MOVE-BY-VALUE
// ============================================================================
/**
 * Open the distance prompt (the shared rotation-angle `PromptDialog` SSoT) and, on
 * confirm, translate the entity by `distance × the clicked arm's world axis`. The
 * typed value is millimetres → canvas units via the grip's `moveGlyphMmScale`. The
 * move is committed through the SAME `commitDxfGripDragModeAware` the drag flow uses
 * — no new command. Cancel (`null`) / non-positive input → no-op.
 */
async function runDirectionalMove(
  grip: UnifiedGripInfo,
  zone: 'x+' | 'x-' | 'y+' | 'y-',
  deps: DxfCommitDeps,
): Promise<void> {
  const frame = grip.moveGlyphFrame;
  if (!frame) return;
  const dir = directionForZone(zone, frame);
  if (!dir) return;
  const raw = await getPromptDialogStore().prompt({
    title: i18next.t('dxf-viewer-wizard:promptDialog.moveDistance'),
    label: i18next.t('dxf-viewer-wizard:promptDialog.moveDistanceLabel'),
    placeholder: i18next.t('dxf-viewer-wizard:promptDialog.distancePlaceholder'),
    inputType: 'number',
    unit: 'mm',
    validate: (v) => {
      const n = parseFloat(v);
      // Negatives allowed (AutoCAD direct-distance parity): the clicked arm is the
      // positive direction, a negative value moves the opposite way. Reject only
      // non-numeric / zero (no-op).
      return !Number.isFinite(n) || n === 0
        ? i18next.t('dxf-viewer-wizard:promptDialog.invalidNumber')
        : null;
    },
  });
  if (raw === null) return;
  const mm = parseFloat(raw);
  if (!Number.isFinite(mm) || mm === 0) return;
  // Signed: positive → along the clicked arm; negative → opposite direction.
  const canvas = mm * (grip.moveGlyphMmScale ?? 1);
  const delta: Point2D = { x: dir.x * canvas, y: dir.y * canvas };
  commitDxfGripDragModeAware(grip, delta, deps, GripModeStore.getSnapshot());
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
    hotGripRefStartRef, hotGripRefEndRef, hotGripAlignStartRef, hotGripRotateBaseRef,
    warmTimerRef, universalSelection, setDraggingVertices, setDragPreviewPosition,
    overlayStoreRef, currentOverlays, setDraggingEdgeMidpoint,
    dxfCommitDeps, gripSizePx, markDragFinished,
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
    // ADR-501 — a click that misses every grip (without Shift) clears the armed
    // selection, so the orange grips revert to cold (AutoCAD: click-away deselects).
    // The mousedown still falls through (return false) to lasso / entity selection.
    if (!isShift) GripArmedStore.clear();
    return false;
  }
  // DXF grip
  if (nearGrip.source === 'dxf') {
    // ADR-363 §line local-ortho — για λαβή ΟΛΙΚΗΣ μετακίνησης (`movesEntity`) απλής ΓΡΑΜΜΗΣ (μέσο grip 2
    // / MOVE-cross grip 4), αποτύπωσε τον ΤΟΠΙΚΟ άξονα `û` (start→end, normalized) ώστε το F8 ORTHO να
    // κλειδώνει κάθετα/παράλληλα στη λοξή γραμμή (MoveOrthoAxisStore, διαβάζεται από το move-constraint SSoT
    // ΚΑΙ στο preview ΚΑΙ στο commit → WYSIWYG). Μη-γραμμή / μη-move → clear (world H/V όπως πριν).
    const moveEnt = (nearGrip.movesEntity === true && nearGrip.entityId
      ? createSceneManagerAdapter(dxfCommitDeps)?.getEntity(nearGrip.entityId)
      : null) as unknown as Entity | null | undefined;
    if (moveEnt && isLineEntity(moveEnt)) {
      const dx = moveEnt.end.x - moveEnt.start.x;
      const dy = moveEnt.end.y - moveEnt.start.y;
      const len = Math.hypot(dx, dy);
      if (len > 1e-9) setMoveOrthoAxis({ x: dx / len, y: dy / len });
      else clearMoveOrthoAxis();
    } else {
      clearMoveOrthoAxis();
    }
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
      // ADR-397 Φ2 — MOVE glyph: a click on a directional ARM (not the centre disc)
      // opens a distance prompt and translates the entity along that local axis. A
      // click on the CENTRE falls through to the existing 3-click await-base flow.
      if (op === 'move' && nearGrip.moveGlyphFrame) {
        const zone = resolveMoveGlyphZoneForGrip({
          cursorWorld: worldPos,
          centerWorld: nearGrip.position,
          frame: nearGrip.moveGlyphFrame,
          gripSizePx,
          scale: getImmediateTransform().scale,
        });
        if (isDirectionalZone(zone)) {
          // Fire-and-forget: the prompt is async; the entity stays selected
          // (markDragFinished suppresses the trailing click) while the user types.
          void runDirectionalMove(nearGrip, zone, dxfCommitDeps);
          markDragFinished();
          return true;
        }
      }
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
      hotGripRotateBaseRef.current = null;
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
      setActiveDragGrip({
        entityId: nearGrip.entityId!,
        gripKind: hotGripKindOf(nearGrip) ?? null,
        // ADR-357/363 — line MOVE-cross (`line-move`) hot-grip: expose the kind + index so the
        // whole-line translate lights up the same Object-Snap-Tracking traces (anchor = base).
        gripIndex: nearGrip.gripIndex,
        lineGripKind: nearGrip.lineGripKind ?? null,
      });
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
      // ADR-562 Φ9.2 — expose the dim grip kind so the mouse handlers show the SAME
      // AutoAlign traces during a dimension grip drag as every other tool.
      dimGripKind: nearGrip.dimGripKind ?? null,
      // ADR-357/363 — line endpoint (0/1) / centre-move (2) press-drag: the index +
      // kind drive the alignment anchor (`getLineGripAlignmentAnchors`) so the moving
      // end / whole line tracks off the fixed end / base point ⊕ ambient neighbours.
      gripIndex: nearGrip.gripIndex,
      lineGripKind: nearGrip.lineGripKind ?? null,
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
