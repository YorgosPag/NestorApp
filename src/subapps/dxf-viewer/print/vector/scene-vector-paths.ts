/**
 * ADR-608 — κοινά path primitives του vector PDF emitter (SSoT).
 *
 * **Γιατί ξεχωριστό αρχείο:** τα ίδια «world → paper → `pdf.lines`» βήματα τα χρειάζονται **και**
 * ο `scene-vector-emitter` (γραμμές / πολυγραμμές / τόξα / διαστάσεις) **και** ο
 * `scene-hatch-emitter` (όρια, faces, γραμμές μοτίβου). Αντιγραφή = sibling clone (N.18)·
 * import από τον έναν emitter στον άλλον = **κύκλος**. Εδώ ζουν μία φορά, χωρίς εξαρτήσεις.
 *
 * Όλες οι συναρτήσεις είναι **καθαρές ως προς τη γεωμετρία** και μεταλλάσσουν μόνο το path/draw
 * state του `pdf` — μηδέν γνώση οντοτήτων, χρωμάτων ή policy.
 *
 * @module subapps/dxf-viewer/print/vector/scene-vector-paths
 * @see docs/centralized-systems/reference/adrs/ADR-608-vector-pdf-export.md
 */

import type { jsPDF } from 'jspdf';
import type { Point2D } from '../../rendering/types/Types';

/** Ένα polyline σε μορφή `pdf.lines`: σημείο εκκίνησης + **σχετικά** deltas. */
export interface PolylineDeltas {
  readonly x0: number;
  readonly y0: number;
  readonly segments: number[][];
}

/** Map world vertices → paper, then to `pdf.lines` relative segments. `null` if <2 pts. */
export function polylineDeltas(
  verts: readonly Point2D[], toPaper: (p: Point2D) => Point2D,
): PolylineDeltas | null {
  if (verts.length < 2) return null;
  const first = toPaper(verts[0]);
  const segments: number[][] = [];
  let prev = first;
  for (let i = 1; i < verts.length; i += 1) {
    const cur = toPaper(verts[i]);
    segments.push([cur.x - prev.x, cur.y - prev.y]);
    prev = cur;
  }
  return { x0: first.x, y0: first.y, segments };
}

/** Stroke a single world-space segment. */
export function strokeSegment(
  pdf: jsPDF, a: Point2D, b: Point2D, toPaper: (p: Point2D) => Point2D,
): void {
  const pa = toPaper(a);
  const pb = toPaper(b);
  pdf.line(pa.x, pa.y, pb.x, pb.y);
}

/** Stroke a world-space polyline via relative `pdf.lines` deltas (optionally closed). */
export function strokePolyline(
  pdf: jsPDF, verts: readonly Point2D[], closed: boolean, toPaper: (p: Point2D) => Point2D,
): void {
  const deltas = polylineDeltas(verts, toPaper);
  if (!deltas) return;
  pdf.lines(deltas.segments, deltas.x0, deltas.y0, [1, 1], 'S', closed);
}

/** Fill a world-space polygon (closed) via `pdf.lines` with the 'F' style. */
export function fillPolygon(
  pdf: jsPDF, verts: readonly Point2D[], toPaper: (p: Point2D) => Point2D,
): void {
  const deltas = polylineDeltas(verts, toPaper);
  if (!deltas) return;
  pdf.lines(deltas.segments, deltas.x0, deltas.y0, [1, 1], 'F', true);
}
