/**
 * COLUMN PLACEMENT ANCHOR STORE — zero-React singleton (ADR-363 §column-ortho).
 *
 * **Το σημείο αναφοράς ORTHO(F8)/POLAR(F10)/step(F9+Q) για την τοποθέτηση κολόνας** = η **προηγούμενη
 * τοποθετημένη κολόνα** (το κέντρο της). Ο τοίχος/δοκάρι έχουν φυσικό anchor (startPoint) στο FSM τους·
 * η κολόνα είναι single-point placement, οπότε δεν είχε κανένα directional reference → το F8/F10/Q
 * «δεν άκουγαν» (Giorgio 2026-07-02). Εδώ κρατάμε το κέντρο της τελευταίας κολόνας ώστε το επόμενο
 * ghost να κλειδώνει οριζόντια/κάθετα (ΟΡΘΟ) ή σε βήμα (Q) ΩΣ ΠΡΟΣ αυτήν — ακριβώς όπως ο τοίχος
 * κλειδώνει ως προς το startPoint (AutoCAD relative-to-last-point).
 *
 * Single-writer (`useColumnTool.commitColumnAt` μετά από κάθε επιτυχή τοποθέτηση), multi-reader
 * (preview `drawing-hover-handler` μέσω `getBimOrthoReference('column')` + commit `mouse-handler-up`
 * μέσω `applyBimDrawingConstraint('column', …)`) → preview ≡ commit. Καθαρίζει on activate/deactivate
 * του εργαλείου (η πρώτη κολόνα κάθε συνεδρίας δεν έχει αναφορά). Zero React/DOM (ADR-040).
 *
 * @see ../../hooks/drawing/bim-ortho-reference.ts — reader (getBimOrthoReference 'column' case)
 * @see ../../hooks/drawing/useColumnTool.ts — writer (commitColumnAt)
 * @see ./PlacementRotationStore.ts — αδελφό lock (rotation phase· μηδενίζει το ortho ref όσο ενεργό)
 */

import type { Point2D } from '../../rendering/types/Types';

let anchor: Point2D | null = null;

/** Write — μετά από επιτυχή τοποθέτηση κολόνας: κράτα το κέντρο της ως ortho/step αναφορά. */
export function setColumnPlacementAnchor(point: Readonly<Point2D>): void {
  anchor = { x: point.x, y: point.y };
}

/** Read — imperatively στο preview + commit (ortho/step reference της επόμενης κολόνας). */
export function getColumnPlacementAnchor(): Point2D | null {
  return anchor;
}

/** Clear — on activate/deactivate του εργαλείου (fresh start· η 1η κολόνα δεν έχει αναφορά). */
export function clearColumnPlacementAnchor(): void {
  anchor = null;
}
