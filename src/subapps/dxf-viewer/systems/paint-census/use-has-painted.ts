/**
 * ADR-775 §13 — η React ανάγνωση της {@link module:systems/paint-census/paint-census-store}.
 *
 * Ζει σε **ξεχωριστό** module από το store επίτηδες: το store το εισάγει ο βρόχος ζωγραφικής
 * (`dxf-canvas-renderer`), που δεν είναι React και δεν πρέπει να αποκτήσει εξάρτηση από React
 * για να μετρήσει έναν ακέραιο.
 *
 * @module systems/paint-census/use-has-painted
 */

'use client';

import { useSyncExternalStore } from 'react';
import { hasPainted, subscribeToFirstPaint, type PaintSurfaceId } from './paint-census-store';

/**
 * `true` μόλις η επιφάνεια ολοκληρώσει το **πρώτο** της καρέ.
 *
 * ⚠️ Δεν παραβιάζει τον θεμελιώδη κανόνα #1 του ADR-040 (καμία συνδρομή υψηλής συχνότητας έξω
 * από micro-leaf): η πηγή ειδοποιεί **μόνο** στη μετάβαση 0→1, οπότε το component
 * ξαναρενδάρει **μία φορά συνολικά** — όχι μία ανά καρέ.
 *
 * Στον server επιστρέφει `false`: εκεί δεν υπάρχει καμβάς, άρα «δεν ζωγράφισε» είναι η
 * **αλήθεια**, όχι placeholder.
 */
export function useHasPainted(surface: PaintSurfaceId): boolean {
  return useSyncExternalStore(
    subscribeToFirstPaint,
    () => hasPainted(surface),
    () => false,
  );
}
