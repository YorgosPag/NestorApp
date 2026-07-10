/**
 * ADR-632 Φ5 — Managed slab-opening lock / override (SSoT predicates).
 *
 * ΕΝΑ σημείο απόφασης για το «είναι αυτό το opening υπό διαχείριση του
 * `StairwellOpeningEngine`;» και «πώς το ξεκλειδώνει ο χρήστης;». Mirror του
 * `member-section-lock.ts` (ADR-503): ένας μικρός dispatcher/predicate module
 * που τον συμβουλεύονται ΟΛΑ τα chokepoints (grips / param-edit command /
 * delete path / ribbon), αντί για σκόρπιους `if (params.autoStairId)` ελέγχους.
 *
 * Τρεις καταστάσεις ενός `SlabOpeningEntity` (marker `params.autoStairId`):
 *   - **managed**  → `autoStairId` παρόν & `autoStairDetached !== true`:
 *                    ο engine το κατέχει· κλειδωμένο για χειροκίνητο edit/delete.
 *   - **detached** → `autoStairId` παρόν & `autoStairDetached === true`:
 *                    ο χρήστης έκανε Override → πλήρως χειροκίνητο, ο engine το
 *                    αγνοεί (αλλά το pair identity μένει ώστε να ΜΗΝ regenerate).
 *   - **manual**   → `autoStairId` απόν: κανονικό opening (ως σήμερα).
 *
 * WHY (Revit-grade): managed/derived element → locked για direct edit, με ρητό
 * "Edit"/"Reset" affordance· ΠΟΤΕ σιωπηλή απώλεια χειροκίνητων αλλαγών ούτε
 * σιωπηλή αναδημιουργία διπλού opening.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-632-stairwell-auto-opening-ssot.md §8
 * @see ../structural/sizing/member-section-lock.ts — το ADR-503 lock pattern που mirror-άρει
 */

import type { Entity } from '../../types/entities';
import { isSlabOpeningEntity } from '../../types/entities';
import type { SlabOpeningParams } from '../types/slab-opening-types';

/**
 * True ⇔ τα params ανήκουν σε **managed** auto-opening (engine-owned, locked).
 * Detached (`autoStairDetached === true`) → false: ο χρήστης το ξεκλείδωσε.
 */
export function isManagedOpeningParams(params: Readonly<SlabOpeningParams>): boolean {
  return params.autoStairId != null && params.autoStairDetached !== true;
}

/** True ⇔ το entity είναι slab-opening ΚΑΙ managed (locked). */
export function isManagedSlabOpening(entity: Readonly<Entity>): boolean {
  return isSlabOpeningEntity(entity) && isManagedOpeningParams(entity.params);
}

/**
 * True ⇔ το `next` patch είναι νόμιμη **Override/Reset** μετάβαση ενός managed
 * opening: το προηγούμενο ήταν managed και το νέο θέτει `autoStairDetached=true`
 * (ξεκλείδωμα). Ο μόνος επιτρεπτός μετασχηματισμός managed params (το
 * `UpdateSlabOpeningParamsCommand.validate` τον χρησιμοποιεί ως whitelist).
 */
export function isStairwellOverridePatch(
  prev: Readonly<SlabOpeningParams>,
  next: Readonly<SlabOpeningParams>,
): boolean {
  return isManagedOpeningParams(prev) && next.autoStairDetached === true;
}

/**
 * Χτίζει το **Override patch**: ξεκλειδώνει (`autoStairDetached: true`) και
 * προαιρετικά εφαρμόζει ταυτόχρονα τις αλλαγές που ζήτησε ο χρήστης (π.χ. αλλαγή
 * kind/fireRating την ώρα του unlock) — ένα command, μία undo εγγραφή. Κρατά το
 * `autoStairId` (pair identity → ο planner δεν regenerate διπλό opening).
 */
export function buildStairwellOverridePatch(
  params: Readonly<SlabOpeningParams>,
  changes: Partial<SlabOpeningParams> = {},
): SlabOpeningParams {
  return { ...params, ...changes, autoStairDetached: true };
}
