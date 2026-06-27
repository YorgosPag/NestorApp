/**
 * overlay-projector — SINGLE SOURCE OF TRUTH για την **προβολή** των placement overlays
 * (πολικό/καρτεσιανό πλέγμα, δυναμικές διαστάσεις, γραμμές-οδηγοί, ίχνη). ADR-544.
 *
 * Πριν, κάθε `*-paint` helper είχε **hard-coded** την 2D προβολή
 * (`CoordinateTransforms.worldToScreen(p, transform, viewport)`) → δεν μπορούσε να τρέξει στο 3D.
 * Τώρα δέχεται έτοιμο `OverlayProjector` (world/plan → screen px) — ΕΝΑΣ paint-κώδικας, δύο
 * καμβάδες: στο 2D ο projector τυλίγει το `worldToScreen` (ίδιο αποτέλεσμα με πριν)· στο 3D
 * τυλίγει το `makeGripPlanToCanvas` (κάμερα αντί transform — βλ. `bim-3d/.../placement-overlay-project`).
 *
 * Σύμβαση `Point2D` (όχι `| null`): σημείο πίσω από την κάμερα → off-canvas sentinel
 * (`GRIP_OFFSCREEN`), ΙΔΙΟ μοτίβο με τον grip projector (`makeGripPlanToCanvas`) — ο painter
 * ποτέ δεν χρειάζεται null-guard, απλά ζωγραφίζει εκτός οθόνης (αόρατο). Έτσι ο 2D κώδικας
 * μένει byte-identical (το 2D `worldToScreen` δεν επιστρέφει ποτέ sentinel).
 *
 * @see ../../bim-3d/placement/placement-overlay-project.ts — 3D camera projector (scene→planMm→px)
 * @see docs/centralized-systems/reference/adrs/ADR-544-unified-column-drawing-2d-3d-ssot.md
 */

import type { Point2D, ViewTransform } from '../../rendering/types/Types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';

type Viewport = { readonly width: number; readonly height: number };

/** world/plan Point2D → screen px. 3D επιστρέφει off-canvas sentinel για points πίσω από την κάμερα. */
export type OverlayProjector = (p: Point2D) => Point2D;

/**
 * 2D projector: τυλίγει το `CoordinateTransforms.worldToScreen` → ΙΔΙΟ αποτέλεσμα με τον παλιό
 * inline `toScreen`. Ο `PreviewRenderer` το χτίζει μία φορά ανά draw και το περνά στους painters.
 */
export function fromTransform(transform: ViewTransform, viewport: Viewport): OverlayProjector {
  return (p) => CoordinateTransforms.worldToScreen(p, transform, viewport);
}

/**
 * Τοπικός παράγοντας κλίμακας (screen px ανά 1 world/scene unit) κοντά στο `ref`. Παράγεται
 * αποκλειστικά από τον projector (αγνωστικός 2D/3D): στο 2D ισούται **ακριβώς** με
 * `transform.scale` (affine), στο 3D δίνει τη local γραμμικοποίηση της κάμερας. Χρησιμεύει σε
 * sizing που ζητούσε `transform.scale` (π.χ. arrows/arc radius των διαστάσεων).
 */
export function projectorScaleAt(project: OverlayProjector, ref: Point2D): number {
  const a = project(ref);
  const b = project({ x: ref.x + 1, y: ref.y });
  return Math.hypot(b.x - a.x, b.y - a.y) || 1e-6;
}
