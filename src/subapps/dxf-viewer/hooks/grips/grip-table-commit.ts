/**
 * ADR-739 Φ.Γ — commit λαβής πίνακα (move / rotation / όριο στήλης).
 *
 * Ο πίνακας είναι παραμετρική σημείωση: η `geometry` του είναι **παράγωγη** (ποτέ
 * αποθηκευμένη), οπότε κάθε σύρσιμο λαβής μετασχηματίζει τις παραμέτρους
 * (`position` / `angleRad` / `model.columns[*].sizing`) και τις γράφει ατομικά μέσω του
 * γενικού `UpdateEntityCommand` — τρέχοντας **το ίδιο** καθαρό `applyTableGripDrag` που
 * τρέχει και το ζωντανό φάντασμα, ώστε «προεπισκόπηση ≡ commit» κατά ταυτότητα.
 *
 * Και οι τρεις λαβές μοιράζονται `gripKind.on === 'table'`, άρα το
 * `PARAMETRIC_COMMIT_HANDLERS` τις δρομολογεί εδώ με **μία** εγγραφή· το kind επιλέγει
 * τον μετασχηματισμό μέσα στο `applyTableGripDrag`.
 *
 * Καθρέφτης του `grip-opening-info-tag-commit.ts` — μηδέν νέα μηχανική (N.18).
 *
 * @see bim/table/table-entity-grips.ts — `applyTableGripDrag`
 * @see hooks/grips/grip-parametric-dispatch.ts — PARAMETRIC_COMMIT_HANDLERS['table']
 */

import type { Point2D } from '../../rendering/types/Types';
import type { UnifiedGripInfo, DxfCommitDeps } from './unified-grip-types';
import { gripKindOf } from '../grip-kinds';
import { applyTableGripDrag, TABLE_ROTATION_KIND } from '../../bim/table/table-entity-grips';
import { commitParametricAnnotationGripDrag } from './grip-parametric-annotation-commit';

/** Παραμετρικό commit λαβής πίνακα. Ταυτοδύναμο + ασφαλές σε undo/redo. */
export function commitTableGripDrag(
  grip: UnifiedGripInfo,
  delta: Point2D,
  deps: DxfCommitDeps,
): void {
  commitParametricAnnotationGripDrag(grip, delta, deps, {
    kind: gripKindOf(grip, 'table'),
    entityType: 'table',
    rotationKind: TABLE_ROTATION_KIND,
    apply: applyTableGripDrag,
    label: 'Edit table',
  });
}
