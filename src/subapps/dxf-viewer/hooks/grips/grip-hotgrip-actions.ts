/**
 * ADR-363 Phase 1G.3 — Wall hot-grip multi-step action helpers.
 *
 * Extracted from `grip-mouse-handlers.ts` (Google 500-line limit, SOS N.7.1).
 * These drive the per-step point recording + commit for the move (3-click) and
 * rotate-reference (6-click) hot-grip flows, plus the toolbar step hints. Pure
 * functions over a narrow ref/setter context, so the dispatch in
 * `grip-mouse-handlers.ts` stays focused on mouse-event routing.
 *
 * @see wall-hot-grip-fsm.ts — pure decision SSoT (advanceHotGripStep)
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 1G.3
 */
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';
import type { Point2D } from '../../rendering/types/Types';
import type { WallHotGripOp, HotGripStep } from './wall-hot-grip-fsm';
import { isReferenceFlowKey } from './wall-hot-grip-fsm';
import type { UnifiedGripInfo, UnifiedGripPhase, DxfCommitDeps } from './unified-grip-types';
import type { DirectDistanceEntry } from '../../text-engine/interaction/DirectDistanceEntry';
import { markSystemsDirty } from '../../rendering/core/UnifiedFrameScheduler';
import { BimRotateHotGripStore } from '../../bim/grips/bim-rotate-hotgrip-store';
// ADR-397 — arm the rotation snap targets (pivot ⊙ + entity grips) when the centre is picked.
import { getGlobalRotationSnapStore } from '../../bim/grips/rotation-snap-store';
// ADR-513 §rotation-ring — bridge that mounts the single-slice «Γωνία» ring while rotate-free is active.
import { RotationRingStore } from '../../systems/dynamic-input/rotation-ring-store';
import { commitDxfGripDragModeAware } from './grip-commit-adapters';
// ADR-397 Σ3 — typed-angle → world delta (pure SSoT, shared with the live preview).
import { rotateDeltaForAngleDeg } from './grip-projections';
import { GripModeStore } from '../../systems/grip/GripModeStore';
import { GripBasePointStore } from '../../systems/grip/GripBasePointStore';
import { setActiveDragGripAnchor } from '../../systems/cursor/GripDragStore';
import { toolHintOverrideStore } from '../toolHintOverrideStore';
import i18next from 'i18next';

/**
 * Narrow context for the hot-grip action helpers. Structurally satisfied by
 * `GripMouseUpCtx`, so callers pass that wider object directly (no import cycle).
 */
export interface HotGripActionCtx {
  hotGripOpRef: MutableRefObject<WallHotGripOp | null>;
  hotGripStepRef: MutableRefObject<HotGripStep>;
  hotGripBaseRef: MutableRefObject<Point2D | null>;
  hotGripRefStartRef: MutableRefObject<Point2D | null>;
  hotGripRefEndRef: MutableRefObject<Point2D | null>;
  hotGripAlignStartRef: MutableRefObject<Point2D | null>;
  /**
   * ADR-397 — FREE rotate baseline: the cursor world-point at the first move after
   * the centre is picked (at centre-pick the cursor sits ON the pivot, so the angle
   * is undefined). The sweep is measured relative to this point, so the rotation
   * starts at 0 with no jump. Null until that first move; reset on every new flow.
   */
  hotGripRotateBaseRef: MutableRefObject<Point2D | null>;
  anchorRef: MutableRefObject<Point2D | null>;
  setCurrentWorldPos: Dispatch<SetStateAction<Point2D | null>>;
  dxfCommitDeps: DxfCommitDeps;
  resetToIdle: () => void;
  /**
   * ADR-397 — world-space grips of the entity being rotated, captured at
   * centre-pick time to arm the rotation snap targets (pivot ⊙ + grips). Supplied
   * by the unified grip hook (which owns `allGrips`/`activeGrip`). Optional —
   * absent for non-rotate flows.
   */
  rotatingEntityGripsWorld?: () => ReadonlyArray<{ entityId: string; gripIndex: number; point: Point2D }>;
  /**
   * ADR-363 Slice G.6 — resolve the FREE-rotate reference baseline anchor for the
   * entity being rotated, given the just-picked pivot: `pivot + majorAxisUnit`
   * (toward the body), so the imaginary reference line starts PARALLEL to the
   * entity's longest axis (Giorgio «παράλληλη στον μεγαλύτερο άξονα»). Returns null
   * when the entity has no orientation → caller keeps the legacy first-move baseline.
   * Supplied by the unified grip hook (which can read the active entity).
   */
  resolveRotateBaselineAnchor?: (pivot: Point2D) => Point2D | null;
  /**
   * ADR-513 §rotation-ring — the FINALIZED angle to commit on a terminal click: ONLY the
   * «Δαχτυλίδι Εντολών» rotation ring's locked value (its own Enter → synthetic canvas click).
   * A KEYBOARD-typed angle is NOT passed here — it commits solely via the Enter key. Null →
   * cursor free rotate.
   */
  typedRotateDeg?: number | null;
  /**
   * ADR-397/513 (Giorgio 2026-07-06, επιλογή Β) — true while a KEYBOARD typed-angle entry is in
   * progress. A terminal click is then a no-op for the rotation — ONLY Enter finalizes the typed
   * angle. Without a typed entry a click commits the free cursor rotation (shipped behavior).
   */
  keyboardAngleEntryActive?: boolean;
}

// ADR-363 Phase 1G.3 — i18n key for the toolbar hint shown during each hot-grip
// pick step, so the multi-click move (3) / rotate-reference (6) flow is self-
// explanatory. Returns null when no override is needed.
function hotGripHintKey(op: WallHotGripOp | null, step: HotGripStep): string | null {
  if (op === 'move' && step === 'await-base') return 'tool-hints:gripContextMenu.prompts.pickMoveBase';
  // ADR-363 Phase 1G.4 — during the live move, surface the Ctrl=copy affordance.
  if (op === 'move' && step === 'tracking') return 'tool-hints:gripContextMenu.prompts.moveOrCopy';
  if (op === 'rotate') {
    switch (step) {
      case 'await-base': return 'tool-hints:gripContextMenu.prompts.pickRotateCentre';
      // ADR-397 — free rotate: drag to spin, click to commit. «R» = reference flow.
      case 'rotate-free': return 'tool-hints:gripContextMenu.prompts.rotateFree';
      case 'await-ref-start': return 'tool-hints:gripContextMenu.prompts.pickRefLineStart';
      case 'await-ref-end': return 'tool-hints:gripContextMenu.prompts.pickRefLineEnd';
      case 'await-align-start': return 'tool-hints:gripContextMenu.prompts.pickAlignStart';
      case 'await-align-end': return 'tool-hints:gripContextMenu.prompts.pickAlignEnd';
    }
  }
  return null;
}

/** Push (or clear) the toolbar hint override for the current hot-grip step. */
export function applyHotGripHint(op: WallHotGripOp | null, step: HotGripStep): void {
  const key = hotGripHintKey(op, step);
  toolHintOverrideStore.setOverride(key ? i18next.t(key) : null);
}

/** Minimal ref/setter surface for {@link seedRotateFreeStep} (structurally met by both
 * the hot-grip up-ctx and the mouse-down ctx). */
export interface RotateFreeSeedRefs {
  hotGripStepRef: MutableRefObject<HotGripStep>;
  hotGripRotateBaseRef: MutableRefObject<Point2D | null>;
  anchorRef: MutableRefObject<Point2D | null>;
  setCurrentWorldPos: Dispatch<SetStateAction<Point2D | null>>;
}

/**
 * ADR-397 / ADR-561 EXT — SSoT that transitions the hot-grip into the terminal `rotate-free`
 * step about `pivot`. ONE source for the free-rotate seed, shared by:
 *   - the normal centre-pick (`advanceHotGripPick` rotate `await-base` branch), and
 *   - the Ctrl-endpoint gesture (`runGripMouseDown`), which pre-picks the pivot at the endpoint.
 *
 * Seeds the deterministic major-axis `baselineAnchor` (null → the first-move baseline takes
 * over) and arms the rotation snap targets (pivot ⊙ + the entity's grips → cyan magnetism).
 * The caller owns setting `hotGripBaseRef` (= pivot) + any fresh-entry state; this only seeds
 * the free-rotate step so the two entry points cannot drift.
 */
export function seedRotateFreeStep(
  pivot: Point2D,
  baselineAnchor: Point2D | null,
  entityGripsWorld: ReadonlyArray<{ entityId: string; gripIndex: number; point: Point2D }>,
  refs: RotateFreeSeedRefs,
): void {
  refs.anchorRef.current = null;
  refs.hotGripStepRef.current = 'rotate-free';
  refs.hotGripRotateBaseRef.current = baselineAnchor;
  refs.setCurrentWorldPos(null);
  getGlobalRotationSnapStore().setTargets(pivot, entityGripsWorld);
  // ADR-513 §rotation-ring — rotate-free begins (ΕΝΑ σημείο εισόδου, κοινό για normal centre-pick
  // + Ctrl-endpoint) → σηματοδότησε τη συνεδρία ώστε ο `DynamicInputSubscriber` να mount-άρει το
  // single-slice «Γωνία» ring (μαζί με το `dynInput.on` gate). Idempotent.
  RotationRingStore.beginSession();
}

/**
 * Record the current pick step's point and advance one step. Move: await-base
 * declares the base (→ tracking). Rotate walks centre → reference line (2 pts) →
 * alignment line start. When the reference line is complete its direction fixes
 * the rotate anchor (`pivot + refDir`) + the commit-bridge store, so both the
 * live ghost and the commit sweep `angle(align) − angle(ref)` around the centre.
 */
export function advanceHotGripPick(worldPos: Point2D, ctx: HotGripActionCtx): void {
  const {
    hotGripOpRef, hotGripStepRef, hotGripBaseRef, anchorRef, setCurrentWorldPos,
    hotGripRefStartRef, hotGripRefEndRef, hotGripAlignStartRef,
  } = ctx;
  const op = hotGripOpRef.current;
  const step = hotGripStepRef.current;
  const p: Point2D = { x: worldPos.x, y: worldPos.y };
  if (step === 'await-base') {
    hotGripBaseRef.current = p;                       // base point / rotation centre
    if (op === 'move') {
      anchorRef.current = p;
      hotGripStepRef.current = 'tracking';
      setCurrentWorldPos(p);
      // ADR-398 — publish the move base so the column Body Corner Projection snap
      // can compute the proposed footprint (cursor − base = translation delta).
      setActiveDragGripAnchor(p);
    } else {
      // ADR-397 — rotate: the CENTRE is now locked → FREE rotate by default
      // (Revit/AutoCAD). The entity spins live with the cursor; «R» opts into the
      // 6-click reference flow. `rotate-free` is terminal (next click commits). The
      // deterministic major-axis baseline + snap-target arming are the shared SSoT
      // `seedRotateFreeStep` (also used by the Ctrl-endpoint gesture in mouse-down).
      seedRotateFreeStep(p, ctx.resolveRotateBaselineAnchor?.(p) ?? null, ctx.rotatingEntityGripsWorld?.() ?? [], ctx);
    }
  } else if (step === 'await-ref-start') {
    hotGripRefStartRef.current = p;
    hotGripStepRef.current = 'await-ref-end';
  } else if (step === 'await-ref-end') {
    hotGripRefEndRef.current = p;
    hotGripStepRef.current = 'await-align-start';
    const rs = hotGripRefStartRef.current;
    const pv = hotGripBaseRef.current;
    if (rs && pv) {
      const anchor: Point2D = { x: pv.x + (p.x - rs.x), y: pv.y + (p.y - rs.y) };
      anchorRef.current = anchor;
      BimRotateHotGripStore.set(pv, anchor);
    }
  } else if (step === 'await-align-start') {
    hotGripAlignStartRef.current = p;
    hotGripStepRef.current = 'await-align-end';
  }
  applyHotGripHint(op, hotGripStepRef.current);
}

/**
 * Finalize the 6-click reference rotate. `delta = alignDir − refDir` placed at the
 * centre so the generic commit's `currentPos = anchor + delta = pivot + alignDir`;
 * `rotateWall` (via `WallRotateHotGripStore.pivot`) then sweeps
 * `angle(align) − angle(ref)` around the centre.
 */
export function commitRotateReference(worldPos: Point2D, grip: UnifiedGripInfo, ctx: HotGripActionCtx): void {
  const { hotGripRefStartRef, hotGripRefEndRef, hotGripAlignStartRef, dxfCommitDeps, resetToIdle } = ctx;
  const rs = hotGripRefStartRef.current;
  const re = hotGripRefEndRef.current;
  const as = hotGripAlignStartRef.current;
  if (!rs || !re || !as) { resetToIdle(); return; }
  const refDir = { x: re.x - rs.x, y: re.y - rs.y };
  const alignDir = { x: worldPos.x - as.x, y: worldPos.y - as.y };
  const delta: Point2D = { x: alignDir.x - refDir.x, y: alignDir.y - refDir.y };
  commitDxfGripDragModeAware(grip, delta, dxfCommitDeps, GripModeStore.getSnapshot());
  GripBasePointStore.clear();
  resetToIdle();
}

/**
 * ADR-397 — finalize a FREE rotate (Revit/AutoCAD default). The entity has been
 * spinning live since the centre was picked. `refDir = baseline − pivot` (the
 * cursor at the first move after the centre), `alignDir = cursor − pivot`; the
 * `delta = alignDir − refDir` is placed at the centre so the generic commit's
 * `currentPos = anchor + delta = pivot + alignDir` and `rotateWall` (via
 * `BimRotateHotGripStore.pivot`) sweeps `angle(align) − angle(ref)` = the cursor
 * sweep around the centre. Identical math to {@link commitRotateReference} — only
 * the reference/alignment SOURCE differs (cursor-derived vs the 6 picked points).
 *
 * No baseline (the cursor never left the centre) → zero sweep, just reset.
 */
export function commitFreeRotate(worldPos: Point2D, grip: UnifiedGripInfo, ctx: HotGripActionCtx): void {
  const { hotGripBaseRef, hotGripRotateBaseRef, dxfCommitDeps, resetToIdle } = ctx;
  const pivot = hotGripBaseRef.current;
  if (!pivot) { GripBasePointStore.clear(); resetToIdle(); return; }
  // ADR-397/513 (Giorgio 2026-07-06, επιλογή Β) — ΟΣΟ πληκτρολογείς γωνία με το ΠΛΗΚΤΡΟΛΟΓΙΟ
  // (`keyboardAngleEntryActive`), ένα terminal κλικ είναι **no-op** για την περιστροφή: ΜΟΝΟ το **Enter**
  // κλειδώνει την πληκτρολογημένη γωνία (→ `commitTypedRotate` στο `runHotGripKeyDown`). Το flow μένει σε
  // rotate-free (ESC/Backspace ακυρώνει/επαναφέρει). Το ΠΑΛΙΟ «κλικ == Enter» της Σ3 αφαιρέθηκε.
  if (ctx.keyboardAngleEntryActive) { console.log('[RD] → SUPPRESSED (πληκτρολογείς — μόνο Enter κλειδώνει)'); return; } // [RD]
  // ADR-513 §rotation-ring — το «Δαχτυλίδι Εντολών» έχει ΟΛΟΚΛΗΡΩΜΕΝΗ γωνία (popup Enter → synthetic
  // click)· εδώ το `typedRotateDeg` = ΜΟΝΟ η ring-locked τιμή → commit exact. ΧΩΡΙΣ typed/ring → cursor sweep.
  if (ctx.typedRotateDeg != null) {
    commitTypedRotate(grip, pivot, ctx.typedRotateDeg, dxfCommitDeps);
    resetToIdle();
    return;
  }
  // ADR-363 Slice G.7 — DETERMINISTIC axis baseline (toward the body), the SAME
  // source the live preview uses (`useUnifiedGripInteraction` → `resolveRotateReferenceAnchor`),
  // so commit ≡ preview. Falls back to the first-move baseline only when the entity
  // has no orientation. This makes the committed sweep align the entity's major axis
  // with the pivot→cursor reference line (Giorgio «οι δύο ευθείες να ταυτίζονται»).
  const baseline = ctx.resolveRotateBaselineAnchor?.(pivot) ?? hotGripRotateBaseRef.current;
  if (!baseline) { GripBasePointStore.clear(); resetToIdle(); return; }
  const refDir = { x: baseline.x - pivot.x, y: baseline.y - pivot.y };
  const alignDir = { x: worldPos.x - pivot.x, y: worldPos.y - pivot.y };
  const delta: Point2D = { x: alignDir.x - refDir.x, y: alignDir.y - refDir.y };
  BimRotateHotGripStore.set(pivot, { x: pivot.x + refDir.x, y: pivot.y + refDir.y });
  commitDxfGripDragModeAware(grip, delta, dxfCommitDeps, GripModeStore.getSnapshot());
  GripBasePointStore.clear();
  resetToIdle();
}

// ============================================================================
// ADR-397 — rotate-free KEYBOARD (Σ2 «R» → reference · Σ3 typed angle)
// ============================================================================

/** Narrow ref context for the rotate-free key handlers (no setters/commit). */
export interface RotateFreeKeyCtx {
  hotGripStepRef: MutableRefObject<HotGripStep>;
  hotGripRotateBaseRef: MutableRefObject<Point2D | null>;
  hotGripRefStartRef: MutableRefObject<Point2D | null>;
  hotGripRefEndRef: MutableRefObject<Point2D | null>;
  hotGripAlignStartRef: MutableRefObject<Point2D | null>;
}

/**
 * ADR-397 Σ2 — «R» during free rotate: leave the live cursor sweep and jump to the
 * 6-click AutoCAD ROTATE→Reference flow, starting at `await-ref-start`. Drops the
 * free baseline + clears the reference/alignment slots so the user picks them fresh.
 * The centre (`hotGripBaseRef`) and armed snap targets stay — only the angle SOURCE
 * changes. Pure ref mutation; the caller resets `moved` + repaints + re-hints.
 */
export function enterReferenceFromFree(ctx: RotateFreeKeyCtx): void {
  ctx.hotGripStepRef.current = 'await-ref-start';
  ctx.hotGripRotateBaseRef.current = null;
  ctx.hotGripRefStartRef.current = null;
  ctx.hotGripRefEndRef.current = null;
  ctx.hotGripAlignStartRef.current = null;
  // ADR-513 §rotation-ring — «R» εγκαταλείπει το rotate-free για το 6-click reference flow → η
  // συνεδρία του single-slice ring λήγει (ξε-mount + καθάρισμα τυχόν πληκτρολογημένης γωνίας).
  RotationRingStore.endSession();
  applyHotGripHint('rotate', 'await-ref-start');
}

/**
 * ADR-397 Σ3 — commit a FREE rotate at an EXACT typed angle (signed deg, +CCW). Uses
 * the same `BimRotateHotGripStore` + generic commit as the cursor free rotate, with a
 * unit East reference (`rotateDeltaForAngleDeg`) so the sweep is precisely `angleDeg`.
 * The caller resets afterwards. Reuses `commitDxfGripDragModeAware` — no new command.
 */
export function commitTypedRotate(
  grip: UnifiedGripInfo,
  pivot: Point2D,
  angleDeg: number,
  deps: DxfCommitDeps,
): void {
  console.log('[RD] ⚠️ commitTypedRotate FIRED', { angleDeg }); // [RD]
  BimRotateHotGripStore.set(pivot, { x: pivot.x + 1, y: pivot.y });
  commitDxfGripDragModeAware(grip, rotateDeltaForAngleDeg(angleDeg), deps, GripModeStore.getSnapshot());
  GripBasePointStore.clear();
}

/** Full ref/setter context for {@link runHotGripKeyDown} (rotate-free key routing). */
export interface HotGripKeyDownCtx extends RotateFreeKeyCtx {
  hotGripOpRef: MutableRefObject<WallHotGripOp | null>;
  hotGripBaseRef: MutableRefObject<Point2D | null>;
  hotGripMovedRef: MutableRefObject<boolean>;
  rotateDdeRef: MutableRefObject<DirectDistanceEntry>;
  activeGrip: UnifiedGripInfo | null;
  dxfCommitDeps: DxfCommitDeps;
  resetToIdle: () => void;
  setCurrentWorldPos: Dispatch<SetStateAction<Point2D | null>>;
  setTypedRotate: Dispatch<SetStateAction<{ buffer: string; deg: number | null } | null>>;
}

/**
 * ADR-397 Σ2/Σ3 — window-level key handler for the live FREE rotate
 * (`phase==='hotGrip'`, op rotate, step rotate-free). «R» → 6-click reference flow;
 * digits/-/. buffer a signed typed angle (DirectDistanceEntry SSoT); Enter commits it
 * exactly; Backspace edits the buffer. Returns true when the key is consumed so the
 * canvas keyboard hook can `preventDefault` + block globals. Refs read at call time.
 *
 * NB: ESC is NOT handled here — it routes through the escape-bus SSoT at
 * `ESC_PRIORITY.HOT_GRIP_OP` so an active grip op owns ESC over every other handler.
 *
 * Extracted from `useUnifiedGripInteraction` to keep that hook under the Google
 * 500-line file limit (SOS N.7.1); behaviour is byte-for-byte identical.
 */
export function runHotGripKeyDown(key: string, phase: UnifiedGripPhase, ctx: HotGripKeyDownCtx): boolean {
  console.log('[RD] KEY→runHotGripKeyDown', { key, phase, op: ctx.hotGripOpRef.current, step: ctx.hotGripStepRef.current }); // [RD]
  if (phase !== 'hotGrip' || ctx.hotGripOpRef.current !== 'rotate') return false;
  if (ctx.hotGripStepRef.current !== 'rotate-free') return false;
  // «R» → opt into the 6-click reference flow (drop any typed angle).
  if (isReferenceFlowKey(key)) {
    enterReferenceFromFree(ctx);
    ctx.hotGripMovedRef.current = false;     // require a fresh move before the 1st ref pick
    ctx.setCurrentWorldPos(null);            // drop the free-rotate ghost until ref picked
    ctx.rotateDdeRef.current.reset();
    ctx.setTypedRotate(null);
    markSystemsDirty(['dxf-canvas']);        // repaint: hint switch + ghost cleared
    return true;
  }
  const dde = ctx.rotateDdeRef.current;
  // Enter → commit the typed angle (exact). Swallowed even when empty so a stray
  // Enter never reaches the drawing-finish path while the entity is spinning.
  if (key === 'Enter') {
    const { value } = dde.snapshot();
    if (value != null && ctx.hotGripBaseRef.current && ctx.activeGrip?.source === 'dxf') {
      commitTypedRotate(ctx.activeGrip, ctx.hotGripBaseRef.current, value, ctx.dxfCommitDeps);
      ctx.resetToIdle();                     // clears refs + typed buffer
    }
    return true;
  }
  // Digit alphabet (0-9 / - / . / ,) → buffer the signed angle (DirectDistanceEntry SSoT).
  // ADR-397/513 (Giorgio 2026-07-06) — δέξου ΚΑΙ κόμμα ΚΑΙ τελεία ως δεκαδικό (ελληνική/ευρωπαϊκή
  // σύμβαση: 45,5 ≡ 45.5). Κανονικοποίησε «,» → «.» ώστε το DDE buffer να μένει έγκυρο για `Number()`.
  if (/^[\d.,-]$/.test(key)) {
    const decimalKey = key === ',' ? '.' : key;
    if (dde.snapshot().status !== 'buffering') dde.begin();
    dde.pressKey(decimalKey);                // rejects illegal keystrokes internally
    const s = dde.snapshot();
    ctx.setTypedRotate({ buffer: s.buffer, deg: s.value });
    console.log('[RD] digit buffered (PREVIEW only)', { key, decimalKey, buffer: s.buffer, deg: s.value }); // [RD]
    markSystemsDirty(['dxf-canvas']);
    return true;
  }
  // Backspace → edit the buffer (swallowed during rotate so it never smart-deletes).
  if (key === 'Backspace') {
    if (dde.snapshot().status === 'buffering') {
      dde.pressKey('Backspace');
      const s = dde.snapshot();
      ctx.setTypedRotate({ buffer: s.buffer, deg: s.value });
      markSystemsDirty(['dxf-canvas']);
    }
    return true;
  }
  return false;
}
