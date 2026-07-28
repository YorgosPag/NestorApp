/**
 * ADR-724 Φ2 — Το **leaf hook** της πλευράς αγκύρωσης.
 *
 * ── ΠΟΙΟΣ ΕΠΙΤΡΕΠΕΤΑΙ ΝΑ ΤΟ ΚΑΛΕΣΕΙ ──
 *
 * Μόνο components που **επιτρέπεται να ξαναρενδάρουν** όταν αλλάζει η πλευρά: το ίδιο το
 * `WorkspaceSplitLayout` (πρέπει — αλλάζει σειρά παιδιών) και τα στοιχεία του μενού (πρέπει —
 * δείχνουν ποια πλευρά είναι ενεργή).
 *
 * ⛔ **ΟΧΙ** σε `CanvasSection` / `CanvasLayerStack` (ADR-040 CHECK 6C) και **ΟΧΙ** σε κανέναν
 * καταναλωτή του μονοπατιού απόδοσης. Ο καμβάς είναι σκόπιμα **αγνωστικός πλευράς**: μαθαίνει
 * τη μετακίνησή του μετρώντας το DOM (`anchorTransformOnResize`), όχι ρωτώντας το store — γι'
 * αυτό το `useViewportManager` χρησιμοποιεί το **imperative** `subscribeDockMode`, όχι αυτό εδώ.
 *
 * Η συχνότητα είναι ασήμαντη (ένα κλικ μενού), άρα το `useSyncExternalStore` δεν έχει το κόστος
 * που έχει για το πλάτος — το οποίο γι' αυτόν ακριβώς τον λόγο **δεν** έχει αντίστοιχο hook.
 */

'use client';

import { useSyncExternalStore } from 'react';
import { getDockMode, subscribeDockMode } from './workspace-dock-store';
import type { WorkspaceDockMode } from './workspace-dock-mode';

/**
 * Η τρέχουσα πλευρά αγκύρωσης, αντιδραστικά.
 *
 * Το `getDockMode` είναι SSR-safe (επιστρέφει την προεπιλογή χωρίς να αγγίξει `window`), οπότε
 * χρησιμεύει και ως server snapshot — καμία υδάτωση δεν αποκλίνει.
 */
export function useDockMode(): WorkspaceDockMode {
  return useSyncExternalStore(subscribeDockMode, getDockMode, getDockMode);
}
