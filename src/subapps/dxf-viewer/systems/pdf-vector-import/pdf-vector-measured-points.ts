/**
 * ADR-941 Φ2β (Δ18) — **τι μετρά** μια σχεδιασμένη διάσταση: οι κορυφές της γεωμετρίας στις οποίες «δείχνουν» οι δύο μύτες.
 * Καθαρό.
 *
 * 🔑 **ISO 129-1: η βοηθητική είναι κάθετη στη γραμμή διάστασης και περνά από το μετρούμενο σημείο.** Άρα το μετρούμενο
 *   σημείο κάθε μύτης είναι κορυφή της γεωμετρίας **πάνω στην κάθετη από τη μύτη** — είτε η βοηθητική είναι σχεδιασμένη
 *   (AutoCAD) είτε είναι μια κοντή παύλα στη μύτη (Τέκτων) είτε λείπει.
 * 🔑 **Οι δύο κορυφές στην ΙΔΙΑ μετατόπιση** (αλλιώς η `aligned` θα έγερνε) και, όταν γίνεται, **ακμή** της γεωμετρίας
 *   (η πλευρά που μετρά — η Φ2α το έβρισκε από το κείμενο, εδώ το λένε τα γραφικά).
 * 🔑 Καμία κορυφή ⇒ οι μύτες οι ίδιες, **χωρίς** συσχέτιση — η διάσταση υπάρχει, απλώς δεν ακολουθεί γεωμετρία. Ποτέ μαντεψιά.
 *
 * @module subapps/dxf-viewer/systems/pdf-vector-import/pdf-vector-measured-points
 */

import type { PdfVectorPolyline, PxPoint } from '../../pdf-background/services/pdf-vector-content';
import { alongOf, offsetFrom } from './pdf-vector-segments';

/** Μια κορυφή της εισαγωγής: πολυγραμμή και θέση της κορυφής μέσα της. */
export interface PdfVertexRef {
  readonly polylineIndex: number;
  readonly index: number;
}

/** Ένα άκρο μιας διάστασης: το σημείο, και η κορυφή της γεωμετρίας που το «κρατά» (ή `null`). */
export interface PdfMeasuredPoint {
  readonly point: PxPoint;
  readonly vertex: PdfVertexRef | null;
}

interface VertexHit extends PdfVertexRef {
  readonly point: PxPoint;
  readonly offset: number;
}

/** Οι κορυφές πάνω στην κάθετη από τη μύτη (σε ανοχή `tol`), με την προσημασμένη τους μετατόπιση. */
function verticesAcross(
  apex: PxPoint, dir: PxPoint, polylines: readonly PdfVectorPolyline[], excluded: ReadonlySet<number>, tol: number,
): VertexHit[] {
  const out: VertexHit[] = [];
  polylines.forEach((polyline, polylineIndex) => {
    if (excluded.has(polylineIndex)) return;
    polyline.points.forEach((point, index) => {
      if (Math.abs(alongOf(point, apex, dir)) <= tol) {
        out.push({ polylineIndex, index, point, offset: offsetFrom(point, apex, dir) });
      }
    });
  });
  return out;
}

/** Είναι οι δύο κορυφές τα άκρα μιας ακμής της ίδιας πολυγραμμής; */
function formsEdge(a: PdfVertexRef, b: PdfVertexRef, polylines: readonly PdfVectorPolyline[]): boolean {
  if (a.polylineIndex !== b.polylineIndex) return false;
  const polyline = polylines[a.polylineIndex];
  const n = polyline.points.length;
  const gap = Math.abs(a.index - b.index);
  return gap === 1 || (polyline.closed && n > 2 && gap === n - 1);
}

interface Pair {
  readonly a: VertexHit;
  readonly b: VertexHit;
  readonly edge: boolean;
}

/** Το καλύτερο ζεύγος: ίδια μετατόπιση· προτιμά ακμή, μετά τη μικρότερη απόσταση από τη γραμμή διάστασης. */
function bestPair(first: readonly VertexHit[], second: readonly VertexHit[], polylines: readonly PdfVectorPolyline[], tol: number): Pair | null {
  let best: Pair | null = null;
  for (const a of first) {
    for (const b of second) {
      if (Math.abs(a.offset - b.offset) > tol) continue;
      const pair = { a, b, edge: formsEdge(a, b, polylines) };
      const closer = !best || Math.abs(a.offset) < Math.abs(best.a.offset) - tol;
      const tieButEdge = !!best && Math.abs(Math.abs(a.offset) - Math.abs(best.a.offset)) <= tol && pair.edge && !best.edge;
      if (closer || tieButEdge) best = pair;
    }
  }
  return best;
}

const asMeasured = (hit: VertexHit): PdfMeasuredPoint => ({
  point: hit.point, vertex: { polylineIndex: hit.polylineIndex, index: hit.index },
});

/**
 * Τα δύο μετρούμενα σημεία των μυτών `apexes` της γραμμής διάστασης με διεύθυνση `dir`. Οι πολυγραμμές `excluded` (τα ίδια
 * τα γραφικά της διάστασης) δεν μετρούν ποτέ.
 */
export function measuredPointsOf(
  apexes: readonly [PxPoint, PxPoint], dir: PxPoint, polylines: readonly PdfVectorPolyline[], excluded: ReadonlySet<number>, tol: number,
): readonly [PdfMeasuredPoint, PdfMeasuredPoint] {
  const pair = bestPair(
    verticesAcross(apexes[0], dir, polylines, excluded, tol),
    verticesAcross(apexes[1], dir, polylines, excluded, tol),
    polylines, tol,
  );
  if (!pair) return [{ point: apexes[0], vertex: null }, { point: apexes[1], vertex: null }];
  return [asMeasured(pair.a), asMeasured(pair.b)];
}
