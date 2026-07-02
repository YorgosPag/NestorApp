/**
 * PLACEMENT TRACKING ANCHOR STORE — zero-React singleton (ADR-363 §wall-ortho-tracking).
 *
 * **Object Snap Tracking (AutoCAD OTRACK)** για το ΠΡΩΤΟ σημείο ενός placement tool: όταν ο κέρσορας
 * «αγγίζει» (osnap) μια υφιστάμενη οντότητα (π.χ. κέντρο/γωνία κολόνας), το σημείο αυτό «κλειδώνεται»
 * ως αναφορά. Καθώς ο χρήστης απομακρύνεται, το ΟΡΘΟ(F8)/βήμα-Q(F9+Q)/POLAR(F10) κλειδώνουν ΩΣ ΠΡΟΣ
 * αυτό — έτσι π.χ. η αρχή ενός τοίχου μπαίνει ακριβώς οριζόντια/κάθετα ή σε βήμα από τη διπλανή κολόνα,
 * παρότι ο τοίχος δεν έχει «προηγούμενο σημείο» στο 1ο κλικ (Giorgio 2026-07-02, «η κολόνα που αγγίζω»).
 *
 * Sticky: ενημερώνεται σε ΚΑΘΕ osnap-πάνω-σε-οντότητα (ΟΧΙ grid — αλλιώς θα κλείδωνε στο πλέγμα αντί
 * στην οντότητα) και κρατά την τελευταία τιμή όσο ο κέρσορας είναι σε ελεύθερο χώρο. Καθαρίζει on
 * activate/deactivate του tool. `null` = καμία αναφορά (καμία osnap σε οντότητα ακόμα) → ΟΡΘΟ/Q no-op.
 *
 * Single-writer (`drawing-hover-handler` on osnap), reader (`getBimOrthoReference` awaitingStart).
 * Zero React/DOM (ADR-040). Αδελφό του `ColumnPlacementAnchorStore` (εκεί η αναφορά = προηγούμενη
 * κολόνα· εδώ = hover-acquired οντότητα).
 *
 * @see ../../hooks/drawing/bim-ortho-reference.ts — reader (getBimOrthoReference 'wall' awaitingStart)
 * @see ../../hooks/drawing/drawing-hover-handler.ts — writer (acquire on osnap)
 */

import type { Point2D } from '../../rendering/types/Types';

let anchor: Point2D | null = null;

/** Write — osnap πάνω σε οντότητα: «κλείδωσε» το σημείο ως tracking αναφορά (OTRACK acquire). */
export function setPlacementTrackingAnchor(point: Readonly<Point2D>): void {
  anchor = { x: point.x, y: point.y };
}

/** Read — imperatively στο awaitingStart (1ο σημείο) ως ΟΡΘΟ/Q reference. */
export function getPlacementTrackingAnchor(): Point2D | null {
  return anchor;
}

/** Clear — on activate/deactivate του tool (fresh tracking session). */
export function clearPlacementTrackingAnchor(): void {
  anchor = null;
}
