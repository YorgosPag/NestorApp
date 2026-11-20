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
 *
 * 🔑 **Επιστρέφει ό,τι εφάρμοσε** (ADR-947 Φ1β): η **βάση σύγκρισης** για την προέλευση ανά είσοδο — όπως το main
 * component στο Figma, απέναντι στο οποίο φαίνεται κάθε παράκαμψη. `null` = ο υπολογιστής άνοιξε κενός.
 */

import { useEffect, useRef, useState } from 'react';

import type { ObjectiveValueDraft } from '@/lib/objective-value/objective-value-draft';
import { parseObjectiveValuePrefill, type ParsedObjectiveValuePrefill } from '@/lib/objective-value/objective-value-prefill';
import type { GeoPoint } from '@/types/geo/coordinates';

interface PrefillTargets {
  /** Συγχώνευση στο πρόχειρο. */
  readonly update: (patch: Partial<ObjectiveValueDraft>) => void;
  /** Η πινέζα — ίδια ετυμηγορία με το κλικ στον χάρτη, αλλά ο χάρτης πετά εκεί (`locate`, όχι `pick`). */
  readonly locate: (point: GeoPoint) => void;
}

/** Ό,τι εφαρμόστηκε (η βάση σύγκρισης) και πού γυρίζει ο επισκέπτης — `null` = ο υπολογιστής άνοιξε κενός. */
type AppliedObjectiveValuePrefill = Pick<ParsedObjectiveValuePrefill, 'draft' | 'back'>;

export function useObjectiveValuePrefill(
  update: PrefillTargets['update'],
  locate: PrefillTargets['locate'],
): AppliedObjectiveValuePrefill | null {
  const [applied, setApplied] = useState<AppliedObjectiveValuePrefill | null>(null);
  const targets = useRef<PrefillTargets>({ update, locate });
  targets.current = { update, locate };
  useEffect(() => {
    const prefill = parseObjectiveValuePrefill(window.location.search);
    if (prefill === null) return;
    targets.current.update(prefill.draft);
    setApplied({ draft: prefill.draft, back: prefill.back });
    if (prefill.point !== null) targets.current.locate(prefill.point);
  }, []);
  return applied;
}
