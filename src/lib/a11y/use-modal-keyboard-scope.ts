'use client';

/**
 * ADR-711 — React binding του keyboard scope SSoT.
 *
 * Λεπτό επίτηδες: όλη η λογική ζει στο {@link pushModalKeyboardScope}. Εδώ μόνο η
 * σύνδεση με τον κύκλο ζωής ενός component, ώστε τα τρία Radix primitives (dialog,
 * alert-dialog, sheet) να μην αντιγράφουν το ίδιο effect (N.18 — sibling clone).
 */

import { useEffect } from 'react';
import { pushModalKeyboardScope } from './keyboard-scope';

/**
 * Δηλώνει ότι όσο ζει αυτό το component, ένα modal layer κατέχει το πληκτρολόγιο.
 *
 * @param active `false` για να μείνει ανενεργό χωρίς να σπάσει ο κανόνας των hooks.
 */
export function useModalKeyboardScope(active: boolean = true): void {
  useEffect(() => {
    if (!active) return undefined;
    return pushModalKeyboardScope();
  }, [active]);
}

/**
 * Component-μορφή του ίδιου hook, για χρήση **μέσα** στο υποδέντρο του Radix
 * `Content`.
 *
 * ⚠️ ΤΟ ΛΕΠΤΟ ΣΗΜΕΙΟ — ΜΗΝ ΤΟ ΑΝΕΒΑΣΕΙΣ ΣΤΟ `DialogContent`: η συνάρτηση του
 * `DialogContent` εκτελείται σε **κάθε** render του γονέα, ακόμη και με `open={false}`
 * (ο γονέας κρατά το element στα children του και το Radix Portal/Presence αποφασίζει
 * αν θα αποδοθεί). Hook εκεί θα κρατούσε το scope μόνιμα πατημένο και θα σκότωνε τους
 * global accelerators για πάντα. Μέσα στο `Content` το υποδέντρο υπάρχει **μόνο όταν
 * είναι ανοιχτό**, άρα mount = ανοιχτό, unmount = κλειστό.
 */
export function ModalKeyboardScope(): null {
  useModalKeyboardScope(true);
  return null;
}
