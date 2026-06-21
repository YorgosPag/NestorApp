/**
 * ADR-512 (Tekton .TEK export) — γεωμετρικές μετατροπές (pure SSoT).
 *
 * Ο Τέκτων δουλεύει σε **μέτρα**. Οι BIM συντεταγμένες (start/end/position) ζουν σε
 * **scene units** (canvas)· οι διαστάσεις (thickness/height) σε **mm**. ΟΛΕΣ οι
 * μετατροπές scene→μέτρα γίνονται μέσω του SSoT `sceneUnitsToMeters` (scene-units.ts)
 * — μηδέν re-impl (ίδιο που χρησιμοποιούν οι bim-3d converters).
 *
 * xmatrix DECODED + CALIBRATED (browser-verified σε λοξούς τοίχους 2026-06-21).
 * Ο Τέκτων διαβάζει τον πίνακα **column-major**: ο point (u,v) του μοναδιαίου κελιού →
 *   X = x00·u + x10·v + x20,  Y = x01·u + x11·v + x21
 * άρα ο **άξονας μήκους** (u) = (x00,x01) και ο **άξονας πάχους** (v) = (x10,x11):
 *   (x00,x01) = E−S            (διάνυσμα μήκους)
 *   (x10,x11) = n̂ · thickness   (n̂ = μοναδιαίο κάθετο)
 *   (x20,x21) = σημείο εκκίνησης (γωνία/παρειά)
 * ΠΡΟΣΟΧΗ: το δείγμα ήταν οριζόντιο (x01=x10=0 → degenerate)· οι λοξοί τοίχοι έδειξαν
 * ότι χρειάζεται transpose (αλλιώς ο Τέκτων ζωγραφίζει ΡΟΜΒΟ αντί ορθογωνίου).
 */

import { sceneUnitsToMeters } from '../../../utils/scene-units';
import type { TekXMatrix } from './tek-types';

/** mm → μέτρα. Reuse του SSoT (sceneUnitsToMeters('mm') = 0.001) αντί magic /1000. */
export const MM_TO_M = sceneUnitsToMeters('mm');

/** mm → μέτρα (διαστάσεις params αποθηκεύονται σε mm). */
export function mmToMeters(mm: number): number {
  return mm * MM_TO_M;
}

/**
 * xmatrix τοίχου από centerline άκρα (ΜΕΤΡΑ) + πάχος (ΜΕΤΡΑ). Το origin μετατοπίζεται
 * −n̂·(t/2) ώστε το δικό μας centerline να αντιστοιχεί στην παρειά-αναφορά του Τέκτονα
 * (το πρόσημο επιβεβαιώνεται στο 1ο browser round-trip).
 */
export function buildWallXMatrix(
  sx: number, sy: number, ex: number, ey: number, thicknessM: number,
): TekXMatrix {
  const dx = ex - sx;
  const dy = ey - sy;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len; // μοναδιαίο κάθετο
  const ny = dx / len;
  const half = thicknessM / 2;
  return {
    // column-major: άξονας μήκους = (x00,x01) = E−S· άξονας πάχους = (x10,x11) = n̂·t.
    x00: dx,
    x01: dy,
    x10: nx * thicknessM,
    x11: ny * thicknessM,
    x20: sx - nx * half, // centerline → παρειά
    x21: sy - ny * half,
  };
}
