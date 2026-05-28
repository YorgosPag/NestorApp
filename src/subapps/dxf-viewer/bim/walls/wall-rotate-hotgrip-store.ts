/**
 * ADR-363 Phase 1G — Wall-rotation hot-grip commit context (module singleton).
 *
 * The 3-click `wall-rotation` hot-grip rotates the wall around a user-picked
 * centre, with the swept angle measured from a reference arm (the cursor at the
 * start of tracking) so there is no snap. The commit path
 * (`commitWallGripDrag` → `applyWallGripDrag`) needs both the pivot (centre) and
 * that reference anchor, but the generic grip-commit dispatcher only forwards
 * `(grip, delta)`. Rather than widen every commit signature, the active hook
 * publishes the rotate context here and `commitWallGripDrag` reads it — the same
 * store-bridge pattern already used by `GripBasePointStore` / `ShiftKeyTracker`
 * in the commit adapters.
 *
 * Zero React / DOM deps. Cleared on commit / cancel / selection change.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-363-bim-drawing-mode.md §6 Phase 1G
 */

import type { Point2D } from '../../rendering/types/Types';

interface WallRotateHotGripContext {
  /** Rotation centre picked by the user (2nd click). */
  readonly pivot: Point2D | null;
  /** Reference arm: cursor at the start of tracking (delta anchor, avoids snap). */
  readonly anchor: Point2D | null;
}

let context: WallRotateHotGripContext = { pivot: null, anchor: null };

export const WallRotateHotGripStore = {
  set(pivot: Point2D, anchor: Point2D): void {
    context = { pivot, anchor };
  },
  clear(): void {
    if (context.pivot === null && context.anchor === null) return;
    context = { pivot: null, anchor: null };
  },
  getSnapshot(): WallRotateHotGripContext {
    return context;
  },
};
