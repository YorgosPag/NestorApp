/**
 * ADR-513 §grip-parity — DISPLACEMENT (Model A) typed-length lock για λαβή **ΜΕΤΑΚΙΝΗΣΗΣ ΟΛΟΚΛΗΡΗΣ
 * ΟΝΤΟΤΗΤΑΣ** (`movesEntity: true`) — το 5ο σκαλί της σκάλας κλειδωμάτων.
 *
 * ΤΟ ΚΕΝΟ ΠΟΥ ΚΛΕΙΝΕΙ (Giorgio 2026-07-18): ο move-σταυρός κάθε οντότητας (γραμμή/κύκλος/τόξο/
 * πολυγραμμή/κείμενο/hatch/GROUP/BLOCK/τοίχος/κολόνα/…) έδειχνε κόκκινη λαβή + λάστιχο, αλλά **δεν
 * δεχόταν πληκτρολογημένη τιμή** — καμία από τις 4 προϋπάρχουσες βαθμίδες δεν έπιανε `movesEntity:
 * true` (το `vertex-reshape-lock` το απορρίπτει ΡΗΤΑ). Άρα «κλικ στη λαβή → πληκτρολογώ 500 → Enter»
 * ήταν νεκρό ακριβώς στη ροή που ο χρήστης θεωρεί την πιο βασική.
 *
 * ΣΗΜΑΣΙΟΛΟΓΙΑ — καθαρή μετατόπιση: κατεύθυνση από ORTHO/POLAR σχετικά με το σημείο-βάσης, μέγεθος =
 * η τιμή. «Πιάνω τη λαβή, ORTHO κλειδώνει οριζόντια, γράφω 500» → όλη η οντότητα μετακινείται κατά
 * 500. Ταυτόσημη σημασιολογία με το εργαλείο «Μετακίνηση» του Ribbon → ίδιο νοητικό μοντέλο.
 *
 * Ο πυρήνας των μαθηματικών είναι ΚΟΙΝΟΣ με το `vertex-reshape-lock` (`displacement-lock-core.ts`)·
 * εδώ ζει ΜΟΝΟ το eligibility. Καλείται από ΚΑΙ ΤΑ ΔΥΟ seams (ghost `grip-ghost-locked-delta` +
 * commit `grip-mouseup-handler`) → preview ≡ commit εξ ορισμού.
 *
 * ΠΕΡΙΣΤΡΟΦΗ ΕΞΑΙΡΕΙΤΑΙ: όταν υπάρχει `rotatePivot` η ρητή είσοδος είναι ΓΩΝΙΑ (δικό της ring,
 * §rotation-ring), όχι μήκος μετατόπισης — δύο διαφορετικές σημασιολογίες, μηδέν επικάλυψη.
 *
 * @see ./displacement-lock-core.ts — ο κοινός πυρήνας ORTHO/POLAR → typed length
 * @see ./vertex-reshape-lock.ts — ο αδελφός καταναλωτής (κορυφή/πλευρά αντί ολόκληρης οντότητας)
 */

import type { Point2D } from '../../rendering/types/Types';
import { resolveDisplacementLockedDelta } from './displacement-lock-core';

/** Ελάχιστη όψη λαβής που χρειάζεται ο resolver — δίνεται από το ghost (`dp`) και το commit (`grip`). */
export interface MoveDisplacementGripLike {
  /** `true` ⇒ η λαβή μετακινεί ΟΛΗ την οντότητα (move-σταυρός / Alt-move / body-drag). */
  readonly movesEntity?: boolean;
  /** `true` ⇒ περιστροφή σε εξέλιξη — η ρητή είσοδος είναι γωνία, όχι μήκος. */
  readonly isRotation: boolean;
}

/**
 * Το κλειδωμένο delta μετατόπισης για λαβή μετακίνησης ολόκληρης οντότητας, ΣΧΕΤΙΚΑ με το σημείο
 * βάσης (`anchorPos` = η αρχική θέση της λαβής ή το override base point). `null` όταν δεν υπάρχει
 * ενεργό κλείδωμα ή η λαβή δεν μετακινεί οντότητα → ο καλών κρατά το ORTHO/βήμα-constrained delta.
 */
export function resolveMoveDisplacementLockedDelta(
  grip: MoveDisplacementGripLike,
  anchorPos: Readonly<Point2D>,
  cursorWorld: Readonly<Point2D>,
): Point2D | null {
  if (grip.movesEntity !== true || grip.isRotation) return null;
  return resolveDisplacementLockedDelta(anchorPos, cursorWorld);
}
