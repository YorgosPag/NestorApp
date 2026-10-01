'use client';

/**
 * @fileoverview **Ο υπολογιστής ανοίγει συμπληρωμένος από την αγγελία** — διαβάζει το ερώτημα της διεύθυνσης μία φορά,
 * στη φόρτωση (ADR-898 Φ3).
 * @related `lib/objective-value/objective-value-prefill.ts` (η ΜΙΑ δήλωση των παραμέτρων) · `ObjectiveValueContent.tsx`
 * @module components/objective-value/useObjectiveValuePrefill
 *
 * 🔑 **`window.location` μετά τη φόρτωση, όχι `useSearchParams`**: η σελίδα είναι στατική για την οργανική αναζήτηση
 * (ADR-898 §10.1)· το `useSearchParams` θα έριχνε την προαπόδοση σε απόδοση στον browser (CHECK 3.55). Η
 * προσυμπλήρωση είναι **ευκολία**, όχι περιεχόμενο που χρειάζεται η μηχανή αναζήτησης.
 *
 * 🔑 **Μία φορά**: μετά ο άνθρωπος είναι κάτοχος του προχείρου — μια επαναφορτωμένη τιμή δεν σβήνει ό,τι άλλαξε.
 */

import { useEffect, useRef } from 'react';

import type { ObjectiveValueDraft } from '@/lib/objective-value/objective-value-draft';
import { parseObjectiveValuePrefill } from '@/lib/objective-value/objective-value-prefill';
import type { GeoPoint } from '@/types/geo/coordinates';

interface PrefillTargets {
  /** Συγχώνευση στο πρόχειρο. */
  readonly update: (patch: Partial<ObjectiveValueDraft>) => void;
  /** Η πινέζα — ίδια διαδρομή με το κλικ στον χάρτη. */
  readonly pick: (point: GeoPoint) => void;
}

export function useObjectiveValuePrefill(update: PrefillTargets['update'], pick: PrefillTargets['pick']): void {
  const targets = useRef<PrefillTargets>({ update, pick });
  targets.current = { update, pick };
  useEffect(() => {
    const prefill = parseObjectiveValuePrefill(window.location.search);
    if (prefill === null) return;
    targets.current.update(prefill.draft);
    if (prefill.point !== null) targets.current.pick(prefill.point);
  }, []);
}
