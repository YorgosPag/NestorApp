/**
 * ADR-612 — Opening Info Tag grip commit (move / rotation / size).
 *
 * An opening-info-tag is a params-driven annotation: its `geometry` is DERIVED
 * (never stored), so every grip drag transforms the flat params (`position` /
 * `angleRad` / `widthMm`) and writes them atomically via the generic
 * `UpdateEntityCommand` — the SAME pure `applyOpeningInfoTagGripDrag` SSoT the
 * live ghost runs, so preview ≡ commit by identity.
 *
 * All THREE grips share `gripKind.on === 'opening-info-tag'`, so
 * `PARAMETRIC_COMMIT_HANDLERS` routes them here with ONE entry; the kind
 * (`opening-info-tag-move` | `-rotation` | `-size`) selects the transform inside
 * `applyOpeningInfoTagGripDrag`.
 *
 * Mirror of `grip-scale-bar-commit.ts`; re-exported from
 * `grip-parametric-commits.ts` so the commit API stays one import.
 *
 * @see bim/opening-info-tag/opening-info-tag-grips.ts — `applyOpeningInfoTagGripDrag`
 * @see hooks/grips/grip-parametric-dispatch.ts — PARAMETRIC_COMMIT_HANDLERS['opening-info-tag']
 * @see docs/centralized-systems/reference/adrs/ADR-612-opening-info-tag.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { UnifiedGripInfo, DxfCommitDeps } from './unified-grip-types';
import { gripKindOf } from '../grip-kinds';
import {
  applyOpeningInfoTagGripDrag,
  OPENING_INFO_TAG_ROTATION_KIND,
} from '../../bim/opening-info-tag/opening-info-tag-grips';
import { commitParametricAnnotationGripDrag } from './grip-parametric-annotation-commit';

/**
 * ADR-612 — parametric opening-info-tag grip commit. Bypasses the generic stretch /
 * move path because the tag is params-driven (geometry recomputed at render). Routes
 * the move / rotation / size drag through `applyOpeningInfoTagGripDrag` →
 * `UpdateEntityCommand` (a partial flat-field patch) via the shared
 * `commitParametricAnnotationGripDrag` SSoT. Idempotent + undo/redo-safe.
 */
export function commitOpeningInfoTagGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  commitParametricAnnotationGripDrag(grip, delta, deps, {
    kind: gripKindOf(grip, 'opening-info-tag'),
    entityType: 'opening-info-tag',
    rotationKind: OPENING_INFO_TAG_ROTATION_KIND,
    apply: applyOpeningInfoTagGripDrag,
    label: 'Edit opening info tag',
  });
}
