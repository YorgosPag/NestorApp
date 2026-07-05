/**
 * GRIP COPY INTENT — SSoT predicate (ADR-357 Φ12 / ADR-560 / ADR-561 EXT).
 *
 * ONE named source of truth for «is the active grip gesture a COPY?». A grip drag/commit
 * clones the source (leaving the original in place) when EITHER:
 *   - the right-click «Copy» toggle is on (`GripCopyModeStore.enabled`, persistent), OR
 *   - Control / ⌘ is held live (`CtrlKeyTracker`, AutoCAD MOVE→COPY / ROTATE-Copy).
 *
 * Before this, the exact `GripCopyModeStore.getSnapshot().enabled || CtrlKeyTracker.getSnapshot()`
 * expression was copy-pasted across the move commit (`grip-commit-adapters`), the primitive
 * rotation commits (`grip-linear-commits` / `grip-primitive-rotate-commits`) and the
 * inverted-ghost gate (`CanvasLayerStack`). This module collapses all of them to one call so
 * the copy trigger can never drift between the paths (move ↔ rotate ↔ ghost).
 *
 * @see systems/grip/GripCopyModeStore.ts — the persistent «Copy» toggle
 * @see keyboard/CtrlKeyTracker.ts — the live Ctrl/⌘ modifier
 */

import { GripCopyModeStore } from './GripCopyModeStore';
import { CtrlKeyTracker } from '../../keyboard/CtrlKeyTracker';

/** True when the active grip gesture should CLONE the source (Copy toggle OR live Ctrl/⌘). */
export function isGripCopyIntent(): boolean {
  return GripCopyModeStore.getSnapshot().enabled || CtrlKeyTracker.getSnapshot();
}
