/**
 * Click-action grip predicate (SSoT) — ADR-501 fix (Giorgio 2026-07-18).
 *
 * A handful of grips are NOT stretch/reshape handles but **click-toggle actions**
 * that must COMMIT on a plain zero-delta click (no drag):
 *   - `opening-rotation` — Revit «Flip Hand» (mirror the door swing side).
 *   - `opening-facing`   — Revit «Flip Facing» (swing to the other wall face).
 *   - `mep-manifold-outlet-add` / `-remove` — the Revit array ▲/▼ (±1 outlet).
 *
 * The grip mouse-up FSM (`grip-mouseup-handler`) otherwise treats a near-zero-delta
 * press-release as an ARM click (`applyGripArmClick`, orange multi-grip select) and
 * returns BEFORE the commit adapter runs — so these toggles never fired on a click
 * (the reported bug: an opening's rotation/flip marker «did nothing»). This predicate
 * lets the FSM route them to `commitDxfGripDragModeAware` instead, which already
 * dispatches each kind to its handler before its own zero-delta guard.
 *
 * SSoT: the concrete kind→handler dispatch lives in `grip-commit-adapters.ts`
 * (`commitDxfGripDragModeAware`); this file owns the single membership test the FSM
 * consults. Keep the two in sync — a new commit-on-click grip belongs in BOTH.
 */

import type { UnifiedGripInfo } from './unified-grip-types';
import { gripKindOf } from '../grip-kinds';

/**
 * True when a plain click on `grip` must EXECUTE its action (commit on zero delta)
 * rather than arm the grip for a multi-grip move.
 */
export function isClickActionGripKind(grip: UnifiedGripInfo): boolean {
  const opening = gripKindOf(grip, 'opening');
  if (opening === 'opening-rotation' || opening === 'opening-facing') return true;
  const mepManifold = gripKindOf(grip, 'mep-manifold');
  return mepManifold === 'mep-manifold-outlet-add' || mepManifold === 'mep-manifold-outlet-remove';
}
