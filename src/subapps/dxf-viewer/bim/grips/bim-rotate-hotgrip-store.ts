/**
 * ADR-397 (was ADR-363 Phase 1G) — BIM rotate hot-grip commit context (module
 * singleton). Entity-agnostic: used by ANY BIM entity whose rotation handle runs
 * the 6-click AutoCAD ROTATE→Reference flow (wall, column, …).
 *
 * The flow rotates the entity around a user-picked centre, with the swept angle
 * measured from a reference arm, so there is no snap. The commit path
 * (`commit{Wall,Column}GripDrag` → `apply{Wall,Column}GripDrag`) needs both the
 * pivot (centre) and that reference anchor, but the generic grip-commit
 * dispatcher only forwards `(grip, delta)`. Rather than widen every commit
 * signature, the active hook publishes the rotate context here and the per-entity
 * commit reads it — the same store-bridge pattern as `GripBasePointStore` /
 * `ShiftKeyTracker`.
 *
 * Zero React / DOM deps. Cleared on commit / cancel / selection change.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-397-bim-grip-glyph-behavior-ssot.md §12 D2
 */

import type { Point2D } from '../../rendering/types/Types';

interface BimRotateHotGripContext {
  /** Rotation centre picked by the user (2nd click). */
  readonly pivot: Point2D | null;
  /** Reference arm: cursor at the start of tracking (delta anchor, avoids snap). */
  readonly anchor: Point2D | null;
}

let context: BimRotateHotGripContext = { pivot: null, anchor: null };

export const BimRotateHotGripStore = {
  set(pivot: Point2D, anchor: Point2D): void {
    context = { pivot, anchor };
  },
  clear(): void {
    if (context.pivot === null && context.anchor === null) return;
    context = { pivot: null, anchor: null };
  },
  getSnapshot(): BimRotateHotGripContext {
    return context;
  },
};
