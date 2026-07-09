/**
 * ADR-583 Φ2.4 — Graphic scale-bar grip commit (move / rotation / length).
 *
 * A scale bar is a params-driven annotation: its `geometry` is DERIVED (never stored),
 * so every grip drag transforms the flat params (`position` / `angleRad` / `length`) and
 * writes them atomically via the generic `UpdateEntityCommand` — the SAME pure
 * `applyScaleBarGripDrag` SSoT the live ghost runs, so preview ≡ commit by identity.
 *
 * All THREE grips share `gripKind.on === 'scale-bar'`, so `PARAMETRIC_COMMIT_HANDLERS`
 * routes them here with ONE entry; the kind (`scale-bar-move` | `-rotation` | `-length`)
 * selects the transform inside `applyScaleBarGripDrag`.
 *
 * Split out of `grip-parametric-commits.ts` (N.7.1 file-size budget); re-exported from
 * there so the commit API stays one import.
 *
 * @see bim/scale-bar/scale-bar-grips.ts — `applyScaleBarGripDrag` (the shared drag SSoT)
 * @see hooks/grips/grip-parametric-dispatch.ts — PARAMETRIC_COMMIT_HANDLERS['scale-bar']
 * @see docs/centralized-systems/reference/adrs/ADR-583-annotation-symbol-library-north-arrow.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { UnifiedGripInfo, DxfCommitDeps } from './unified-grip-types';
import { gripKindOf } from '../grip-kinds';
import { applyScaleBarGripDrag, SCALE_BAR_ROTATION_KIND } from '../../bim/scale-bar/scale-bar-grips';
import { commitParametricAnnotationGripDrag } from './grip-parametric-annotation-commit';

/**
 * ADR-583 Φ2.4 — parametric scale-bar grip commit. Bypasses the generic stretch / move
 * path because the bar is params-driven (geometry recomputed at render). Routes the move /
 * rotation / length drag through `applyScaleBarGripDrag` → `UpdateEntityCommand` (a partial
 * flat-field patch) via the shared `commitParametricAnnotationGripDrag` SSoT. Idempotent +
 * undo/redo-safe.
 */
export function commitScaleBarGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  commitParametricAnnotationGripDrag(grip, delta, deps, {
    kind: gripKindOf(grip, 'scale-bar'),
    entityType: 'scale-bar',
    rotationKind: SCALE_BAR_ROTATION_KIND,
    apply: applyScaleBarGripDrag,
    label: 'Edit scale bar',
  });
}
