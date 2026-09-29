/**
 * @fileoverview **ΟΙ ΛΕΞΕΙΣ ΤΩΝ ΣΧΗΜΑΤΩΝ ΧΩΡΩΝ ΣΤΟΝ ΕΠΕΞΕΡΓΑΣΤΗ** — αρνήσεις του γραφέα σχημάτων + μηνύματα επιτυχίας
 * (ADR-884 Φ2στ-γ Γ3γ-1 · §4.14 · AIP-193 λεξιλόγιο ανά λειτουργία).
 * @related `../spatial-tour-labels.ts` (`TOUR_REFUSAL_KEY` — όλες οι άλλες αρνήσεις· **διαμέριση**, όχι αντίγραφο) ·
 *   `lib/spatial-tour/tour-refusal-vocabulary.ts` (`TOUR_SHAPE_REFUSALS`)
 * @module components/spatial-tour/editor/tour-shape-labels
 *
 * 🔑 **Χωριστό αρχείο, χωριστά σύμβολα** (CHECK 3.34): ο γεννήτορας του slice ακολουθεί **σύμβολα** — στον ενιαίο πίνακα αυτές
 *   οι λέξεις ταξίδευαν στις σελίδες ρυθμίσεων/φωτογράφου, όπου δεν φτάνουν ποτέ. Εδώ τις ζητά **μόνο** ο επεξεργαστής.
 * ⛔ Κάθε κλειδί ολόγραφο με `spatial-tour:` (βλ. `spatial-tour-labels.ts`).
 */

import type { TourShapeRefusal } from '@/lib/spatial-tour/tour-refusal-vocabulary';

export const TOUR_SHAPE_REFUSAL_KEY: Readonly<Record<TourShapeRefusal, string>> = {
  'space-invalid': 'spatial-tour:refusal.spaceInvalid',
  'space-outside-plan': 'spatial-tour:refusal.spaceOutsidePlan',
  'space-overlap': 'spatial-tour:refusal.spaceOverlap',
  'space-absent': 'spatial-tour:refusal.spaceAbsent',
  'area-invalid': 'spatial-tour:refusal.areaInvalid',
  'separation-invalid': 'spatial-tour:refusal.separationInvalid',
  'separation-absent': 'spatial-tour:refusal.separationAbsent',
};

/** Τα μηνύματα επιτυχίας των εντολών σχημάτων (`space/unspace/separate/unseparate`). */
export const TOUR_SHAPE_KEYS = {
  spaceApproved: 'spatial-tour:editor.spaceApproved',
  spaceRemoved: 'spatial-tour:editor.spaceRemoved',
  separationSaved: 'spatial-tour:editor.separationSaved',
  separationRemoved: 'spatial-tour:editor.separationRemoved',
} as const;
