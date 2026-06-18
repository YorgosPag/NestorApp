/**
 * ADR-436 Slice 1 / ADR-484 — thin foundation insertion SSoT πάνω από το
 * `appendEntityToScene`, ώστε ο foundation DRAW tool
 * (`useFoundationTool.onFoundationCreated`) και κάθε μελλοντικό COPY path να
 * μοιράζονται ΜΙΑ insertion routine.
 *
 * **ADR-484 — Revit-canonical level assignment:** τα foundation elements (πέδιλα/
 * πεδιλοδοκοί/συνδετήριες) ζουν ΠΑΝΤΑ στον όροφο «Θεμελίωση» του κτιρίου — όπως
 * στη Revit όλα τα Structural Foundations ανήκουν στο foundation/structural plan.
 * Όταν ο ενεργός όροφος ΔΕΝ είναι ο foundation level (`foundationLevelStore.target
 * ≠ null`), το πέδιλο **δρομολογείται** στον foundation level μέσω του υπάρχοντος
 * `foundation-cross-level-writer` SSoT (Firestore foundation scope + foundation
 * scene + store), αντί να «κολλήσει» στον ενεργό υπέργειο όροφο. Τα υψόμετρα είναι
 * ήδη kind-default (foundation datum, `defaultFoundationTopElevationMm`) → σωστά
 * χωρίς προσαρμογή. Όταν ο ενεργός ΕΙΝΑΙ ο foundation level (ή single-level /
 * degenerate scope), ισχύει το κανονικό active-scene append.
 *
 * @see bim/scene/append-entity-to-scene.ts — generic SSoT
 * @see ./foundation-cross-level-writer.ts — cross-level write SSoT
 * @see ../../state/foundation-level-store.ts — foundation-level target
 * @see docs/centralized-systems/reference/adrs/ADR-484-cross-level-foundation-properties.md
 */
import { appendEntityToScene, type SceneAppendAccessor } from '../scene/append-entity-to-scene';
import {
  createFoundationCrossLevelWriter,
  type FoundationWriteScope,
} from './foundation-cross-level-writer';
import { useFoundationLevelStore } from '../../state/foundation-level-store';
import type { FoundationEntity } from '../types/foundation-types';

/**
 * Append `foundationEntity` στον σωστό όροφο:
 *  - ενεργός = foundation level / single-level → active scene append + broadcast
 *    `drawing:entity-created` (tool: 'foundation').
 *  - ενεργός ≠ foundation level → redirect στον foundation level (cross-level writer).
 * No-op when there is no active level / scene (active path).
 */
export function addFoundationToScene(
  foundationEntity: FoundationEntity,
  accessor: SceneAppendAccessor,
  scope: FoundationWriteScope,
): void {
  // ADR-484 — Revit-canonical: redirect στον foundation level όταν ο ενεργός διαφέρει.
  const target = useFoundationLevelStore.getState().target;
  if (target) {
    const writer = createFoundationCrossLevelWriter(scope, target, accessor);
    if (writer) {
      writer.create(foundationEntity);
      return;
    }
  }
  // Ενεργός = foundation level (ή single-level / degenerate scope) → κανονικό append.
  appendEntityToScene(accessor, foundationEntity, 'foundation');
}
