/**
 * ADR-654 — Raster image grip commit (move / rotation / corner resize).
 *
 * Η εικόνα (entourage sprite / furniture-plan sprite / σφραγίδα πινακίδας) είναι flat-params
 * entity: ΔΕΝ έχει `geometry` cache — το ορθογώνιο παράγεται στο render από
 * `position/width/height/rotation`. Άρα κάθε grip drag είναι ένα partial patch αυτών των
 * πεδίων, γραμμένο ατομικά μέσω του γενικού `UpdateEntityCommand` (undo/redo-safe,
 * idempotent) — ακριβώς όπως scale-bar / opening-info-tag.
 *
 * Και οι ΕΞΙ λαβές μοιράζονται `gripKind.on === 'image'`, οπότε το `PARAMETRIC_COMMIT_HANDLERS`
 * τις δρομολογεί εδώ με ΜΙΑ καταχώρηση· το kind (`image-move` | `-rotation` | `-corner-*`)
 * επιλέγει τον μετασχηματισμό μέσα στο `applyImageGripDrag` — το ΙΔΙΟ SSoT που τρέχει και το
 * live ghost, άρα preview ≡ commit εξ ορισμού.
 *
 * @see bim/image/image-grips.ts — `applyImageGripDrag`
 * @see hooks/grips/grip-parametric-dispatch.ts — PARAMETRIC_COMMIT_HANDLERS['image']
 */

import type { Point2D } from '../../rendering/types/Types';
import type { UnifiedGripInfo, DxfCommitDeps } from './unified-grip-types';
import { gripKindOf } from '../grip-kinds';
import { applyImageGripDrag, IMAGE_ROTATION_KIND } from '../../bim/image/image-grips';
import { commitParametricAnnotationGripDrag } from './grip-parametric-annotation-commit';

/**
 * ADR-654 — image grip commit. Παρακάμπτει το γενικό stretch/move path (η εικόνα δεν έχει
 * vertices) και δρομολογεί move/rotation/corner μέσω `applyImageGripDrag` → `UpdateEntityCommand`,
 * με τον shared `commitParametricAnnotationGripDrag` SSoT (ίδιος με scale-bar/opening-info-tag).
 */
export function commitImageGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  commitParametricAnnotationGripDrag(grip, delta, deps, {
    kind: gripKindOf(grip, 'image'),
    entityType: 'image',
    rotationKind: IMAGE_ROTATION_KIND,
    apply: applyImageGripDrag,
    label: 'Edit image',
  });
}
