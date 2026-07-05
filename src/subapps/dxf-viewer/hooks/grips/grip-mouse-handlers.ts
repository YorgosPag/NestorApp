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
  type WallHotGripOp, type HotGripStep,
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
// ADR-561 EXT — `seedRotateFreeStep` is the SHARED free-rotate seed (also used by the normal
// centre-pick in `advanceHotGripPick`), so the Ctrl-endpoint entry cannot drift from it.
import { applyHotGripHint, seedRotateFreeStep } from './grip-hotgrip-actions';
// ADR-561 EXT (Ctrl-endpoint rotate-copy) — pure gesture resolver + the major-axis baseline SSoT.
import { resolveCtrlEndpointRotateCopy } from './ctrl-endpoint-rotate-copy';
// ADR-513 §grip-parity — plain-line endpoint → click-move-click hot-grip entry (Dynamic Input ON).
import { resolveLineEndpointHotGrip } from './line-endpoint-hotgrip';
import { cadToggleState } from '../../systems/constraints/cad-toggle-state';
import { CtrlKeyTracker } from '../../keyboard/CtrlKeyTracker';
import { resolveRotateReferenceAnchor } from '../../bim/grips/rotate-reference-axis';
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
// ADR-363/397/513 — HOT-GRIP SESSION ENTRY (SSoT)
// ============================================================================
/**
 * Enter the AutoCAD "hot grip" (click-move-click) session for `grip`: flip the phase,
 * reset ALL hot-grip refs to a clean slate, and clear the warm-hover timer. ONE source
 * for the entry boilerplate shared by every hot-grip trigger — the registry-driven
 * wall/column/line enter, the Ctrl-endpoint rotate-copy, and the ADR-513 line-endpoint
 * click-move-click — so a new trigger can never drift or forget a field (e.g. the
 * `BimRotateHotGripStore.clear()` that a hand-rolled copy silently omitted).
 *
 * The per-trigger tail (step seeding for rotate, `applyHotGripHint`, `setActiveDragGrip`
 * with the trigger's grip-kind fields, `markSessionStart`) stays at the call site — only
 * the identical reset boilerplate is centralized here.
 */
function beginHotGripSession(
  grip: UnifiedGripInfo,
  ctx: GripMouseDownCtx,
  cfg: {
    op: WallHotGripOp;
    awaitingFirstRelease: boolean;
    /** Rotation centre / base point stored in `hotGripBaseRef` (pivot for Ctrl-rotate, else null). */
    base: Point2D | null;
    /** Terminal anchor + live preview seed (grip position for corner/endpoint, null for move/rotate await-base). */
    anchor: Point2D | null;
    /** Initial hot-grip step; omit when a later seeder sets it (e.g. rotate-free via `seedRotateFreeStep`). */
    step?: HotGripStep;
  },
): void {
  const {
    setActiveGrip, setPhase, setCurrentWorldPos, anchorRef, warmTimerRef,
    hotGripOpRef, hotGripStepRef, hotGripAwaitingFirstReleaseRef, hotGripMovedRef,
    hotGripBaseRef, hotGripRefStartRef, hotGripRefEndRef, hotGripAlignStartRef, hotGripRotateBaseRef,
  } = ctx;
  setActiveGrip(grip);
  setPhase('hotGrip');
  unlockGripSnapPosition();
  hotGripOpRef.current = cfg.op;
  hotGripAwaitingFirstReleaseRef.current = cfg.awaitingFirstRelease;
  hotGripMovedRef.current = false;
  hotGripBaseRef.current = cfg.base;
  hotGripRefStartRef.current = null;
  hotGripRefEndRef.current = null;
  hotGripAlignStartRef.current = null;
  hotGripRotateBaseRef.current = null;
  BimRotateHotGripStore.clear();
  if (cfg.step !== undefined) hotGripStepRef.current = cfg.step;
  anchorRef.current = cfg.anchor;
  setCurrentWorldPos(cfg.anchor);
  if (warmTimerRef.current) { clearTimeout(warmTimerRef.current); warmTimerRef.current = null; }
}

// ============================================================================
// MOUSE DOWN
// ============================================================================
export function runGripMouseDown(worldPos: Point2D, isShift: boolean, ctx: GripMouseDownCtx): boolean {
  const {
    mouseDownInProgressRef, activeGrip, anchorRef, onToolChangeRef, resetToIdle,
    isGripMode, allGrips, phase, effectiveTolerance, hoveredGrip, selectedGrips,
    setSelectedGrips, setActiveGrip, setPhase, setCurrentWorldPos,
    // Only these two hot-grip refs are read directly in this function (Block A's `seedRotateFreeStep`);
    // the rest of the entry boilerplate is owned by `beginHotGripSession(grip, ctx, …)`.
    hotGripStepRef, hotGripRotateBaseRef,
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
    // ADR-561 EXT — Ctrl + press on a PLAIN endpoint / vertex (line / arc / polyline) →
    // ROTATE-COPY hinge about that point. This is the EXISTING free-rotate hot-grip flow
    // with the pivot pre-picked at the endpoint (skip the «pick centre» click) + the copy
    // flag (honoured at commit via CtrlKeyTracker). The pure resolver gates strictly on Ctrl
    // + a kind-less vertex grip, so without Ctrl the endpoint stays a normal stretch, and a
    // primitive rotation/move handle (grip 3/4) keeps its role. Runs BEFORE the standard
    // hot-grip enter check so the endpoint gesture wins; Alt (base-point move) takes priority.
    if (!altMove) {
      const gripEntity = nearGrip.entityId
        ? (createSceneManagerAdapter(dxfCommitDeps)?.getEntity(nearGrip.entityId) as unknown as Entity | null | undefined)
        : null;
      const rotateCopy = resolveCtrlEndpointRotateCopy(gripEntity, nearGrip, CtrlKeyTracker.getSnapshot());
      if (rotateCopy && gripEntity) {
        const { pivot, syntheticGrip } = rotateCopy;
        // Enter hot-grip (rotate) via the SSoT; the `rotate-free` step + rotateBase are seeded
        // just below by `seedRotateFreeStep` (so no `step` here). base = the grabbed endpoint = pivot.
        beginHotGripSession(syntheticGrip, ctx, { op: 'rotate', awaitingFirstRelease: true, base: pivot, anchor: null });
        // Transition to the terminal `rotate-free` step via the SHARED SSoT (same seed the
        // normal centre-pick runs): major-axis baseline + rotation snap targets (pivot ⊙ +
        // this entity's grips → cyan magnetism). The pivot is pre-picked at the endpoint.
        const entityGrips = allGrips
          .filter((g) => g.source === 'dxf' && g.entityId === nearGrip.entityId)
          .map((g) => ({ entityId: g.entityId!, gripIndex: g.gripIndex, point: g.position }));
        seedRotateFreeStep(pivot, resolveRotateReferenceAnchor(gripEntity, pivot), entityGrips, {
          hotGripStepRef, hotGripRotateBaseRef, anchorRef, setCurrentWorldPos,
        });
        applyHotGripHint('rotate', 'rotate-free');
        setActiveDragGrip({
          entityId: nearGrip.entityId!,
          gripKind: syntheticGrip.lineGripKind ?? syntheticGrip.arcGripKind ?? syntheticGrip.polylineGripKind ?? null,
          gripIndex: nearGrip.gripIndex,
          lineGripKind: syntheticGrip.lineGripKind ?? null,
        });
        GripSessionUndoStore.markSessionStart(getGlobalCommandHistory().size());
        return true;
      }
      // ADR-513 §grip-parity-hotgrip — plain-LINE endpoint → click-move-click hot-grip when
      // Dynamic Input is ON, working EXACTLY like the wall/line ring: the endpoint becomes the
      // point being placed, follows the cursor button-free, the «Δαχτυλίδι Εντολών» wedges are
      // clickable, and the terminal placement is a canvas click (or Enter → synthetic click) —
      // driven by the SAME `placementMode='canvas-click'` ring the wall uses (`DynamicInputSubscriber`).
      // Bespoke entry (the endpoint grip carries no kind → absent from HOT_GRIP_OP_REGISTRY):
      // op 'endpoint-stretch' shares the 'corner' shape (anchor = the grabbed endpoint, terminal
      // 'tracking' = 2-click). With Dynamic Input OFF the endpoint keeps its press-drag path below
      // (zero regression). Runs AFTER the Ctrl-endpoint rotate-copy so Ctrl still wins; Alt (base-
      // point move) took priority.
      if (cadToggleState.isDynInputOn() && resolveLineEndpointHotGrip(gripEntity, nearGrip)) {
        // Enter hot-grip via the SSoT. NO arm release: the canvas-click ring blocks ALL inside
        // events (incl. the grab-click release) exactly like the wall, so there is no release to
        // arm on — enter tracking directly (awaiting=false); the grab-click's own release resolves
        // to 'stay' (moved=false), and the FIRST moved click (wedge Enter → synthetic canvas click,
        // or a click outside the wheel) commits. Anchor = the grabbed endpoint (like a corner):
        // the ghost + commit measure the stretch from here. Mirrors the wall (1st click = a point,
        // no hot-grip arm).
        beginHotGripSession(nearGrip, ctx, {
          op: 'endpoint-stretch',
          awaitingFirstRelease: false,
          base: null,
          anchor: nearGrip.position,
          step: initialHotGripStep('endpoint-stretch'), // 'tracking' (terminal)
        });
        // ADR-513 §grip-parity — expose the endpoint (gripIndex 0/1, no lineGripKind) so
        // `isLineEndpointDragInfo` is true → `DynamicInputSubscriber` mounts the ring.
        setActiveDragGrip({
          entityId: nearGrip.entityId!,
          gripKind: null,
          gripIndex: nearGrip.gripIndex,
          lineGripKind: null,
        });
        GripSessionUndoStore.markSessionStart(getGlobalCommandHistory().size());
        return true;
      }
    }
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
      const initialStep = initialHotGripStep(op);
      // Enter hot-grip via the SSoT. Corner: the grip itself is the anchor (2-click flow). Move /
      // rotate: the base point / rotation centre is picked on the 2nd click → no anchor/preview yet.
      beginHotGripSession(nearGrip, ctx, {
        op,
        awaitingFirstRelease: true,
        base: null,
        anchor: op === 'corner' ? nearGrip.position : null,
        step: initialStep,
      });
      // ADR-363 Phase 1G.3 — prompt the first awaited pick (centre / base).
      applyHotGripHint(op, initialStep);
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
      // ADR-560 — blur-proof whole-entity Alt-move flag (baked here, survives the Alt→blur that
      // clears the live GripAltMoveStore), so the AutoAlign base-point tracking keeps running.
      altMove,
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
