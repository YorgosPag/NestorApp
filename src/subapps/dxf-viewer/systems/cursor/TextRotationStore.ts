/**
 * TEXT ROTATION STORE — zero-React singleton (ADR-508 §text-parity, 2-click place→rotate).
 *
 * **SSoT** για το 2-click «θέση → κλίση» flow των annotation εργαλείων «Κείμενο» (`text`) /
 * «Πολυγραμμικό Κείμενο» (`mtext`): το 1ο κλικ ΚΛΕΙΔΩΝΕΙ το σημείο εισαγωγής και μπαίνουμε σε
 * «awaitingRotation». Όσο ο χρήστης κινεί τον κέρσορα, το φάντασμα-λέξη περιστρέφεται προς τον
 * κέρσορα και ο hover-overlay ζωγραφίζει τόξο φοράς + γωνία (ίδιοι SSoT painters με την κολόνα).
 * Το 2ο κλικ commit-άρει με αυτή τη γωνία → ανοίγει το πεδίο πληκτρολόγησης. `null` = εκτός rotation
 * phase (κανονική τοποθέτηση: φάντασμα στη θέση cursor + κυανές).
 *
 * ⚠️ Ξεχωριστό από το `PlacementRotationStore` (κολώνα/πέδιλο) **επίτηδες**: εκείνο σκανδαλίζει τον
 * ungated column-rotation painter (adaptive-step γωνία). Το κείμενο κουμπώνει με ΟΡΘΟ/Polar (F8/F10)
 * μέσω `getBimOrthoReference` → ο `previewPt` έρχεται ήδη snapped· ο δικός του overlay block ζωγραφίζει
 * τις ενδείξεις από τον `previewPt` (μηδέν διπλό τόξο, μηδέν σύγκρουση μοντέλων γωνίας).
 *
 * @see ../../hooks/drawing/bim-ortho-reference.ts — getBimOrthoReference('text') → origin (F8/F10 anchor)
 * @see ../../hooks/drawing/drawing-preview-generator.ts — generateTextPreview (rotation ghost)
 * @see ../../hooks/canvas/useTextCreationTool.ts — writer (1ο/2ο κλικ)
 */

import type { Point2D } from '../../rendering/types/Types';

let origin: Point2D | null = null;
let editing = false;

/** Write — 1ο κλικ: κλείδωσε το σημείο εισαγωγής, μπες σε rotation phase. */
export function setTextRotationOrigin(p: Readonly<Point2D>): void {
  origin = { x: p.x, y: p.y };
}

/** Read — imperatively στο preview draw (rotation ghost + overlays) + στο 2ο κλικ commit. */
export function getTextRotationOrigin(): Point2D | null {
  return origin;
}

/** Clear — μετά το 2ο κλικ / ESC / αλλαγή εργαλείου. */
export function clearTextRotationOrigin(): void {
  origin = null;
}

/**
 * ADR-508 §text-parity — flag «το πεδίο πληκτρολόγησης είναι ανοιχτό» (μετά το 2ο κλικ). Όσο είναι
 * true, το `generateTextPreview` επιστρέφει `null` ώστε να ΜΗΝ εμφανίζεται stray φάντασμα-λέξη στη
 * θέση cursor ενώ ο χρήστης γράφει (το TipTap overlay ζει σε screen-anchored div, όχι στον καμβά).
 */
export function setTextEditingActive(active: boolean): void {
  editing = active;
}

/** Read — imperatively στο `generateTextPreview` (κατάσταση: πεδίο ανοιχτό → κανένα ghost). */
export function isTextEditingActive(): boolean {
  return editing;
}
