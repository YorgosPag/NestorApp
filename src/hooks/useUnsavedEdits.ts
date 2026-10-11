'use client';
/**
 * @fileoverview **«Διαφέρει η φόρμα από αυτό που είναι αποθηκευμένο;»** — σύγκριση με το στιγμιότυπο αφετηρίας, και δήλωση.
 * @related ADR-912 §12.5 (ο ✕ του φύλλου κινητού ρωτά μόνο όταν υπάρχουν αλλαγές) · ADR-860 §Ε3β (`unsaved-work-registry`) ·
 *   `providers/DirtyFormProvider.tsx` (`useReportUnsavedEdits` — το κανάλι)
 * @module hooks/useUnsavedEdits
 *
 * 🔑 **Σύγκριση περιεχομένου, όχι «άγγιξε κάτι»**: όποιος γράψει ένα γράμμα και το σβήσει ΔΕΝ έχει αλλαγές, και δεν
 *   ρωτιέται αν θέλει να τις απορρίψει (Material: «επιβεβαίωση απόρριψης μόνο αν υπάρχουν αλλαγές»).
 * 🔑 `dequal` — η ίδια ισότητα με το `firestore-equality` (ADR-361): `Date` · Timestamp · `undefined`/`null` · σειρά κλειδιών.
 */
import { useMemo } from 'react';
import { dequal } from 'dequal';

import { useReportUnsavedEdits } from '@/providers/DirtyFormProvider';

/**
 * @param editing Εκτός επεξεργασίας η απάντηση είναι πάντα `false` (η φόρμα απλώς καθρεφτίζει την οντότητα).
 * @param current Ό,τι κρατά τώρα η φόρμα.
 * @param baseline Ό,τι θα κρατούσε αν δεν είχε αγγιχτεί (η **ίδια** συνάρτηση που τη γέμισε, πάνω στην αποθηκευμένη οντότητα).
 */
export function useUnsavedEdits<T>(editing: boolean, current: T, baseline: T): boolean {
  const dirty = useMemo(() => editing && !dequal(current, baseline), [editing, current, baseline]);
  useReportUnsavedEdits(dirty);
  return dirty;
}
