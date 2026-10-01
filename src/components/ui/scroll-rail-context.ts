'use client';

/**
 * @fileoverview Ο κόμβος της λωρίδας για τα παιδιά της — και η μία συνέπεια που τον χρειάζεται.
 * @related ADR-896 §7Α.6 · `scroll-rail.tsx`
 * @module components/ui/scroll-rail-context
 *
 * 🔴 **ΤΟ ΟΡΦΑΝΟ ΑΝΑΔΥΟΜΕΝΟ** (μετρημένο ζωντανά, `/search/results`): τσιπ με ανοιχτό αναδυόμενο,
 * 5 κλικ οριζόντιου τροχού στη λωρίδα ⇒ το κουμπί στο x=−34 (έξω από το κάδρο, κάτω από τη μάσκα),
 * και το αναδυόμενο **ορατό**, κολλημένο στην άκρη της οθόνης, χωρίς άγκυρα.
 *
 * Γιατί όχι `hideWhenDetached` του Radix: με προεπιλεγμένο όριο κρίνει μόνο το viewport, άρα δεν
 * βλέπει το κόψιμο από τη λωρίδα· με `collisionBoundary` = λωρίδα (ύψος ~36px) θα χαλούσε και το
 * flip/shift του ίδιου του αναδυόμενου. ⇒ Η κύλιση της λωρίδας από τον άνθρωπο **κλείνει** το
 * αναδυόμενο — όπως το πάτημα ◀ ▶ ή το σύρσιμο αφής, που είναι ήδη `pointerdown` έξω από αυτό.
 */

import { createContext, useContext, useEffect, useRef } from 'react';

/** Η λωρίδα που κυλά — `null` έξω από `ScrollRail` (πάνελ, φύλλο): εκεί το hook δεν κάνει τίποτα. */
export const ScrollRailContext = createContext<HTMLElement | null>(null);

/**
 * Κλείνει ένα ανοιχτό αναδυόμενο όταν ο άνθρωπος κυλά **οριζόντια** τη λωρίδα που το φιλοξενεί
 * (trackpad, Shift+τροχός).
 *
 * ⚠️ **`wheel`, ΟΧΙ `scroll`**: η λωρίδα κυλά και μόνη της — αποκαλύπτει το τσιπ αμέσως μετά το
 * κλικ που ανοίγει το αναδυόμενο. Ένα `scroll` θα το έκλεινε τη στιγμή που ανοίγει. Ο κατακόρυφος
 * τροχός χωρίς Shift δεν κυλά τη λωρίδα (κυλά τη σελίδα), άρα δεν μετρά.
 */
export function useDismissOnRailScroll(open: boolean, onDismiss: () => void): void {
  const rail = useContext(ScrollRailContext);
  const dismiss = useRef(onDismiss);

  useEffect(() => {
    dismiss.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!open || rail === null) return undefined;
    const onWheel = (event: WheelEvent) => {
      if (event.deltaX !== 0 || event.shiftKey) dismiss.current();
    };
    rail.addEventListener('wheel', onWheel, { passive: true });
    return () => rail.removeEventListener('wheel', onWheel);
  }, [open, rail]);
}
