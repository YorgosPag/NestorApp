/**
 * ADR-512 (Tekton .TEK export) — γεωμετρικές μετατροπές (pure SSoT).
 *
 * Ο Τέκτων δουλεύει σε **μέτρα**. Οι BIM συντεταγμένες (start/end/position) ζουν σε
 * **scene units** (canvas)· οι διαστάσεις (thickness/height) σε **mm**. ΟΛΕΣ οι
 * μετατροπές scene→μέτρα γίνονται μέσω του SSoT `sceneUnitsToMeters` (scene-units.ts)
 * — μηδέν re-impl (ίδιο που χρησιμοποιούν οι bim-3d converters).
 *
 * xmatrix DECODED (δείγμα τοίχου (0,0)→(5,0) πάχος 0.25 → x00=5,x11=0.25,rest=0):
 *   (x00,x10) = E−S            (διάνυσμα μήκους)
 *   (x01,x11) = n̂ · thickness   (n̂ = μοναδιαίο κάθετο)
 *   (x20,x21) = σημείο εκκίνησης (γωνία/παρειά)
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
    x00: dx,
    x01: nx * thicknessM,
    x10: dy,
    x11: ny * thicknessM,
    x20: sx - nx * half, // centerline → παρειά
    x21: sy - ny * half,
  };
}
