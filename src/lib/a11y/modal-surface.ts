/**
 * ADR-711 · ADR-241 · ADR-912 §12.16 — **Η επιφάνεια που, όσο είναι ανοιχτή, ΕΙΝΑΙ η σελίδα.**
 *
 * Ό,τι καλύπτει όλη την οθόνη (πλήρης οθόνη, φύλλο λεπτομερειών του κινητού) υπόσχεται τρία πράγματα: τα από κάτω
 * **δεν απαντούν** (focus, κλικ, αναγνώστης οθόνης), **δεν κυλούν**, και το focus **είναι μέσα**. Μέχρι 2026-10-17 το
 * έκανε μόνο η πλήρης οθόνη· το φύλλο του κινητού απλώς **σκέπαζε** — και η κάτω μπάρα της σελίδας φάνηκε πάνω από
 * τον θεατή αρχείου μόλις άλλαξε μια στρώση z (στιγμιότυπο Giorgio 23:08). Google Drive / iOS: ο θεατής είναι modal,
 * η σελίδα από κάτω **δεν υπάρχει** για τον χρήστη. Ζει εδώ μία φορά, ώστε κάθε τέτοια επιφάνεια να ρωτά το ίδιο.
 *
 * Framework-free: μόνο DOM, SSR-safe.
 */

import { inertOutside } from './inert-outside';

let scrollLocks = 0;

/** Κλείδωμα κύλισης του `body` με μέτρηση αναφορών — δύο επιφάνειες δεν ξεκλειδώνουν η μία την άλλη. */
export function lockBodyScroll(): () => void {
  if (typeof document === 'undefined') return () => undefined;
  scrollLocks += 1;
  document.body.classList.add('overflow-hidden');
  let released = false;
  return () => {
    if (released) return;
    released = true;
    scrollLocks = Math.max(0, scrollLocks - 1);
    if (scrollLocks === 0) document.body.classList.remove('overflow-hidden');
  };
}

/**
 * Κάνει την `surface` τη μόνη ζωντανή περιοχή: αδράνεια έξω (`inertOutside`), κλείδωμα κύλισης, focus μέσα.
 * ⚠️ Η `surface` χρειάζεται `tabIndex={-1}` για να πάρει focus όταν δεν έχει δικό της εστιάσιμο στοιχείο.
 *
 * @returns αποδέσμευση — ιδempotent· **δεν** επιστρέφει το focus (το αποφασίζει ο καλών: `focus-return`).
 */
export function enterModalSurface(surface: HTMLElement): () => void {
  const releaseInert = inertOutside([surface]);
  const releaseScroll = lockBodyScroll();
  if (!surface.contains(document.activeElement)) surface.focus({ preventScroll: true });
  return () => {
    releaseInert();
    releaseScroll();
  };
}
