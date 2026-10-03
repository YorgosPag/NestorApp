/**
 * @fileoverview **ΤΟ ΚΛΕΙΔΙ ΜΟΝΑΔΑΣ** — «είναι αυτές οι δύο αναφορές η ΙΔΙΑ μονάδα;» · ADR-900 §8 #2 (2β.2).
 * @module lib/geo/place-unit-key.server
 *
 * Δύο βαθμίδες, όπως το UPRN (επίσημο αναγνωριστικό) απέναντι στη διεύθυνση (δηλωμένη):
 * - **`cadastral`** — ο κανονικός ΚΑΕΚ ιδιοκτησίας (UPRN-παιδί). Ισχυρό: το εγγυάται το Κτηματολόγιο.
 *   Μόνο αυτό θα γεννήσει δημόσια μονάδα (2β.4, απόφαση Giorgio Ε1).
 * - **`declared`** — κτίριο + στάθμη (`αριθμός:είδος`) + σκελετός του αριθμού μονάδας. Ασθενές: δήλωση.
 *
 * 🔑 Ο αριθμός μονάδας συγκρίνεται με τον **σκελετό UTS #39** (`lib/unicode/skeleton.ts`): «Α1» με ελληνικό
 * Α και «A1» με λατινικό είναι **ο ίδιος** αριθμός στο ίδιο κτίριο — αλλιώς η ίδια πόρτα θα γινόταν δύο
 * μονάδες. Ο σκελετός είναι κλειδί σύγκρισης, **ποτέ** κείμενο προς εμφάνιση (UTS #39) — γι' αυτό ζει
 * μόνο εδώ, στον server (ο πίνακας είναι ~80 KB).
 *
 * Χωρίς κτίριο, στάθμη **ή** αριθμό ⇒ `null`: **καμία ψευδο-μονάδα** (ένα «κτίριο Χ, 2ος όροφος» χωρίς
 * πόρτα είναι δύο ή τέσσερα διαμερίσματα, όχι ένα).
 */

import 'server-only';

import { skeleton } from '@/lib/unicode/skeleton';
import { floorRefKey } from '@/lib/floor/floor-ref';
import type { PlaceUnitRef } from './place-unit';

export type PlaceUnitKeyStrength = 'cadastral' | 'declared';

export interface PlaceUnitKey {
  readonly strength: PlaceUnitKeyStrength;
  readonly key: string;
}

export function placeUnitKey(ref: PlaceUnitRef): PlaceUnitKey | null {
  if (ref.kaek !== null) return { strength: 'cadastral', key: `kaek:${ref.kaek}` };
  if (ref.buildingId === null || ref.floor === null || ref.unitNumber === null) return null;
  return {
    strength: 'declared',
    key: `bld:${ref.buildingId}|fl:${floorRefKey(ref.floor)}|u:${skeleton(ref.unitNumber)}`,
  };
}
