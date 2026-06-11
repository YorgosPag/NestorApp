/**
 * ADR-441 Slice 6 — Reconciling «Εσχάρα από κάναβο» (signature-set diff).
 *
 * Pure diff ανάμεσα στο **target** (πλήρης σωστή εσχάρα για τον τρέχοντα κάναβο,
 * `buildStripGridFromGuides`) και τις **existing** grid-managed λωρίδες στη σκηνή.
 * Επιστρέφει το minimal delta ώστε ο orchestrator να το εκτελέσει ως ΕΝΑ atomic
 * reconcile (Revit/Tekla managed regeneration), χωρίς διπλούς και χωρίς stale
 * corner-fill, διατηρώντας ids στις αμετάβλητες.
 *
 * Ταυτότητα = `gridStripSignature` (grid key + rounded geometry):
 *  - target signature ∉ existing → **create** (νέο φάτνωμα ή αλλαγμένη γεωμετρία).
 *  - existing signature ∉ target → **delete** (split-obsolete whole, ή πρώην
 *    περιμετρική με corner-fill που έγινε εσωτερική).
 *  - signature και στα δύο → αμετάβλητη (κρατά id, μηδέν write).
 *
 * Μη grid-managed λωρίδες (`gridStripSignature === null`: legacy ορφανές χωρίς
 * bindings, χειροκίνητες) **ΠΟΤΕ** δεν μπαίνουν στο `toDelete` — μένουν ανέγγιχτες.
 *
 * @see ./foundation-grid-segments.ts — gridStripSignature (identity)
 * @see ./foundation-from-grid.ts — target builder
 * @see docs/centralized-systems/reference/adrs/ADR-441-foundation-strip-grid-auto-design.md §10
 */

import type { FoundationEntity } from '../types/foundation-types';
import { gridStripSignature } from './foundation-grid-segments';

export interface GridReconcileResult {
  /** target λωρίδες που λείπουν από τη σκηνή → δημιουργία. */
  readonly toCreate: readonly FoundationEntity[];
  /** existing grid-managed λωρίδες εκτός target → διαγραφή. */
  readonly toDelete: readonly FoundationEntity[];
  /** Πλήθος λωρίδων αμετάβλητων (signature σε target & existing). */
  readonly unchanged: number;
}

/** Map signature → entity για grid-managed λωρίδες (αγνοεί null signatures). */
function signatureMap(
  strips: readonly FoundationEntity[],
): Map<string, FoundationEntity> {
  const map = new Map<string, FoundationEntity>();
  for (const s of strips) {
    const sig = gridStripSignature(s);
    if (sig !== null) map.set(sig, s);
  }
  return map;
}

/**
 * Υπολόγισε το reconcile delta. `existing` μπορεί να περιέχει non-grid λωρίδες —
 * φιλτράρονται εδώ (μόνο όσες έχουν signature θεωρούνται grid-managed).
 */
export function reconcileGridStrips(
  target: readonly FoundationEntity[],
  existing: readonly FoundationEntity[],
): GridReconcileResult {
  const targetBySig = signatureMap(target);
  const existingBySig = signatureMap(existing);

  const toCreate: FoundationEntity[] = [];
  for (const [sig, entity] of targetBySig) {
    if (!existingBySig.has(sig)) toCreate.push(entity);
  }

  const toDelete: FoundationEntity[] = [];
  for (const [sig, entity] of existingBySig) {
    if (!targetBySig.has(sig)) toDelete.push(entity);
  }

  const unchanged = targetBySig.size - toCreate.length;
  return { toCreate, toDelete, unchanged };
}
