/**
 * =============================================================================
 * ΜΟΡΦΟΛΟΓΙΑ ΔΥΑΔΙΚΟΥ ΠΛΕΓΜΑΤΟΣ ΜΕ ΕΥΚΛΕΙΔΕΙΟ ΔΙΣΚΟ (SSoT)
 * =============================================================================
 *
 * Διαστολή / διάβρωση / άνοιγμα μέσω του {@link squaredDistanceTransform}: κόστος O(κελιά) **ανεξάρτητα από την
 * ακτίνα** — ένα άνοιγμα πόρτας 0,9 m σε κάτοψη 0,0156 m/px είναι δίσκος ~29 px, που με σάρωση δίσκου θα κόστιζε
 * ~2.600 πράξεις ανά pixel.
 *
 * 🔑 **Έξω από την εικόνα**: η διάβρωση θεωρεί το εξωτερικό **γεμάτο** (αλλιώς ένας τοίχος στην άκρη της εικόνας θα
 * «έτρωγε» από την πλευρά του κάδρου). Η διαστολή δεν βλέπει τίποτα έξω.
 * ⚠️ **Κλείσιμο (closing) δεν υπάρχει εδώ επίτηδες**: για «σφράγισμα πορτών» είναι λάθος εργαλείο (δεν σφραγίζει
 * άνοιγμα σε λεπτό τοίχο) — βλ. `lib/spatial-tour/space-detect/space-region.ts`.
 *
 * @module lib/geometry/raster/morphology
 */

import { squaredDistanceTransform } from './distance-transform';

/** Κάθε κελί σε απόσταση **≤ ακτίνα** (κελιά) από γεμάτο κελί γίνεται γεμάτο. */
export function dilate(mask: Uint8Array, cols: number, rows: number, radius: number): Uint8Array {
  const out = new Uint8Array(cols * rows);
  if (radius <= 0) { out.set(mask); return out; }
  const d2 = squaredDistanceTransform(mask, cols, rows);
  const r2 = radius * radius;
  for (let i = 0; i < out.length; i++) out[i] = d2[i] <= r2 ? 1 : 0;
  return out;
}

/** Κάθε κελί μένει γεμάτο μόνο αν **κανένα** άδειο κελί της εικόνας δεν απέχει ≤ ακτίνα. */
export function erode(mask: Uint8Array, cols: number, rows: number, radius: number): Uint8Array {
  const out = new Uint8Array(cols * rows);
  if (radius <= 0) { out.set(mask); return out; }
  const empty = new Uint8Array(cols * rows);
  for (let i = 0; i < empty.length; i++) empty[i] = mask[i] === 1 ? 0 : 1;
  const d2 = squaredDistanceTransform(empty, cols, rows);
  const r2 = radius * radius;
  for (let i = 0; i < out.length; i++) out[i] = d2[i] > r2 ? 1 : 0;
  return out;
}

/** Άνοιγμα = διάβρωση ⇒ διαστολή: σβήνει γραμμές **λεπτότερες από 2 × ακτίνα** (κείμενα, διαστάσεις, έπιπλα). */
export function open(mask: Uint8Array, cols: number, rows: number, radius: number): Uint8Array {
  return dilate(erode(mask, cols, rows, radius), cols, rows, radius);
}
