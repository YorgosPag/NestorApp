/**
 * Placement alignment guide — **canonical SSoT** (ADR-398 §3.20).
 *
 * Μια γραμμή-οδηγός ευθυγράμμισης (world segment, 2 σημεία) που εμφανίζεται κατά την τοποθέτηση δομικού
 * μέλους και ζωγραφίζεται ως dashed overlay (Revit alignment line). **Ο ΕΝΑΣ τύπος** που μοιράζονται:
 *   · οι column resolvers (`column-tangent-snap`/`column-face-snap`/`rect-cartesian-snap`/`column-beam-corner-snap`),
 *   · το framing (`beam-span-snap` — η νοητή ευθεία κέντρο→κέντρο, ADR-528),
 *   · το paint pipeline (`alignment-guide-paint`/`PreviewRenderer`) + ο `drawing-hover-handler`.
 *
 * Ζει στο `bim/framing` (neutral home — όπως ο `GhostFaceFrame` μετακινήθηκε εδώ, ADR-508) ώστε ΚΑΙ το
 * framing ΚΑΙ τα columns να το χρησιμοποιούν χωρίς εξάρτηση `bim/framing → bim/columns`. Το
 * `column-tangent-snap` το **re-export-άρει** (πίσω συμβατότητα — μηδέν αλλαγή στους importers του).
 *
 * @see ../columns/column-tangent-snap.ts — re-export alias (ιστορικός ορισμός μετακινήθηκε εδώ)
 * @see ../../canvas-v2/preview-canvas/alignment-guide-paint.ts — ο painter (consumer)
 */

import type { Point2D } from '../../rendering/types/Types';

/** Γραμμή-οδηγός ευθυγράμμισης (world segment, dashed overlay). 2 σημεία `a→b`. */
export interface PlacementAlignmentGuide {
  readonly a: Point2D;
  readonly b: Point2D;
}
