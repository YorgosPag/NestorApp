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
import type { UnifiedGripInfo, DxfCommitDeps } from './unified-grip-types';
import { BimRotateHotGripStore } from '../../bim/grips/bim-rotate-hotgrip-store';
// ADR-397 — arm the rotation snap targets (pivot ⊙ + entity grips) when the centre is picked.
import { getGlobalRotationSnapStore } from '../../bim/grips/rotation-snap-store';
import { commitDxfGripDragModeAware } from './grip-commit-adapters';
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
      anchorRef.current = null;
      hotGripStepRef.current = 'await-ref-start';
      setCurrentWorldPos(null);
      // ADR-397 — the rotation CENTRE is now locked. Arm the snap targets: the
      // pivot ⊙ and the entity's grips become snap candidates (cursor magnetism via
      // the existing snap pipeline) AND render cyan ('snappable'). Cleared on reset.
      getGlobalRotationSnapStore().setTargets(p, ctx.rotatingEntityGripsWorld?.() ?? []);
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
