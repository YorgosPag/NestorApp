/**
 * bim-edge-colors — η ΜΟΝΑΔΙΚΗ πηγή για το χρώμα των 3Δ ακμών ανά ορατό background (ADR-689 Φ3).
 *
 * ## Γιατί υπάρχει (SSoT audit 2026-07-24, N.0.2)
 *
 * Το ίδιο near-black `#1a1a1a` ήταν γραμμένο **τρεις** φορές σε τρία αρχεία:
 *   - `bim-3d-edge-overlay-builder.ts` ως `DEFAULT_EDGE_COLOR` (fallback του builder),
 *   - `bim-three-edges.ts` ως `BIM_3D_EDGE_COLOR` (uniform silhouette, ADR-375 v2.22),
 *   - `imported-mesh-wireframe.ts` ως `WIRE_COLOR_LIGHT_BG` (Φ2, γραμμένο σε hex αριθμό).
 * Μια αλλαγή απόχρωσης θα έπρεπε να γίνει σε τρία σημεία — κλασικό copy-paste χρέος. Ενοποιήθηκε
 * εδώ· τα τρία σημεία πλέον **διαβάζουν** από εδώ.
 *
 * ## Η λογική (ADR-446 §2)
 *
 * Σε **ανοιχτό** (environment) background οι ακμές είναι σχεδόν μαύρες — το uniform silhouette που
 * κρατά το Revit «Shaded with Edges». Σε **σκούρο** («σαν 2Δ») background αντιστρέφονται σε ανοιχτό
 * γκρι, ώστε να διαβάζονται όπως το άσπρο-σε-μαύρο του AutoCAD.
 *
 * @see ./bim-3d-edge-overlay-builder — ο fat-line edge overlay των δομικών
 * @see ../converters/bim-three-edges — ο uniform silhouette των δομικών
 * @see ../wireframe/attach-mesh-wireframe — το GPU wireframe των πλεγμάτων
 */

import type { BackgroundMode } from '../../config/bim-visual-style';

/** Χρώμα ακμής σε ΑΝΟΙΧΤΟ (environment) background — σχεδόν μαύρο, Revit uniform silhouette. */
export const BIM_EDGE_COLOR_LIGHT_BG = '#1a1a1a';

/** Χρώμα ακμής σε ΣΚΟΥΡΟ («σαν 2Δ») background — ανοιχτό γκρι, όπως το AutoCAD white-on-dark. */
export const BIM_EDGE_COLOR_DARK_BG = '#d0d0d0';

/** Το χρώμα ακμής που ταιριάζει στο τρέχον ορατό background. */
export function resolveEdgeColorForBackground(mode: BackgroundMode): string {
  return mode === 'dark' ? BIM_EDGE_COLOR_DARK_BG : BIM_EDGE_COLOR_LIGHT_BG;
}
