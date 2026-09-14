/**
 * @fileoverview **ΤΑ ΔΥΟ ΑΤΟΜΑ ΤΟΥ ΣΥΝΟΡΟΥ ΑΝΑΓΝΩΣΗΣ** — κείμενο και δεσμός τόπου.
 * @related lib/agency/showcase-read.ts · lib/agency/showcase-read-locations.ts
 * @module lib/agency/showcase-read-primitives
 *
 * 🔴 **ΓΙΑΤΙ ΕΦΥΓΑΝ ΑΠΟ ΤΟ `showcase-read.ts`** (ADR-841 §7 Α21.16): το `showcase-read-geo`
 * κατέγραψε ρητά ότι ο `readPlace` *«έμεινε πίσω, επίτηδες — η μετακίνησή του θα γεννούσε
 * κύκλο αρχείων ή δεύτερο `text()`»*. Η κάρτα έφερε **δεύτερο καταναλωτή** και των δύο (κάθε
 * κατάστημα έχει δικό του τόπο). Η θεραπεία που αποφεύγει **και** τον κύκλο **και** το δίδυμο
 * είναι ένα leaf που εισάγουν και οι δύο — όχι ένα δεύτερο `text()`.
 */

import type { PlaceRef } from '@/types/geo/public-place';

/** Είναι μη-κενό κείμενο; — το σύνορο δέχεται `unknown`, όχι υποσχέσεις. */
export function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

/** `PlaceRef` ή `null` — το `landId` είναι το μόνο υποχρεωτικό (η γη κρατά τη θέση). */
export function readPlace(raw: unknown): PlaceRef | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const source = raw as Record<string, unknown>;
  const landId = text(source.landId);
  return landId === null ? null : { landId, buildingId: text(source.buildingId) };
}
