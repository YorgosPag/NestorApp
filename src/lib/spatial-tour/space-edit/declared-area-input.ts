/**
 * @fileoverview **ΤΟ ΔΗΛΩΜΕΝΟ ΕΜΒΑΔΟΝ ΟΠΩΣ ΤΟ ΓΡΑΦΕΙ Ο ΑΝΘΡΩΠΟΣ** — κείμενο + πηγή ⇒ δήλωση, ή ο λόγος που δεν είναι ακόμη
 * (ADR-884 Φ2στ-γ Γ3γ-2β · §12 Δ8.4 · Δ8.6). Καθαρό.
 * @related `lib/number/locale-number.ts` (`parseLocaleNumber` — «12,40» και «12.40») · `lib/spatial-tour/tour-space-edit.ts` (ο
 *   γραφέας: ίδια όρια, `area-invalid`) · `constants/spatial-tour-vocabulary.ts`
 * @module lib/spatial-tour/space-edit/declared-area-input
 *
 * 🔑 **Τα ΙΔΙΑ όρια με τον γραφέα** (> 0, ≤ {@link TOUR_DECLARED_AREA_MAX_M2}) — η φόρμα δεν δέχεται ποτέ τιμή που θα
 *   απέρριπτε ο διακομιστής, και το λέει **πριν** το κουμπί.
 * 🔑 **Πηγή υποχρεωτική** (Δ8.6): «28,40 τ.μ.» χωρίς «από μελέτη/μέτρηση/δήλωση» δεν δημοσιεύεται.
 */

import { TOUR_DECLARED_AREA_MAX_M2, type TourDeclaredAreaSource } from '@/constants/spatial-tour-vocabulary';
import { parseLocaleNumber } from '@/lib/number/locale-number';

export type DeclaredAreaInput =
  | { readonly kind: 'none' }
  | { readonly kind: 'ok'; readonly value: { readonly areaM2: number; readonly source: TourDeclaredAreaSource } }
  | { readonly kind: 'invalid' }
  | { readonly kind: 'source-missing'; readonly areaM2: number };

/** Κενό ⇒ καμία δήλωση · άκυρο/εκτός ορίων ⇒ `invalid` · χωρίς πηγή ⇒ `source-missing` · αλλιώς η δήλωση. */
export function readDeclaredArea(text: string, source: TourDeclaredAreaSource | null): DeclaredAreaInput {
  if (text.trim() === '') return { kind: 'none' };
  const areaM2 = parseLocaleNumber(text);
  if (areaM2 === null || !(areaM2 > 0) || areaM2 > TOUR_DECLARED_AREA_MAX_M2) return { kind: 'invalid' };
  return source === null ? { kind: 'source-missing', areaM2 } : { kind: 'ok', value: { areaM2, source } };
}
