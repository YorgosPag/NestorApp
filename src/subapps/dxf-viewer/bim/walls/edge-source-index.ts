/**
 * ADR-929 §6.16 #8 · ADR-911 — **ευρετήριο «ακμή → υποψήφια τμήματα-πηγή»**, για όποιον ρωτά για **πολλές** ακμές πάνω στα
 * ίδια τμήματα (η πρόταση τοίχων: 4 ακμές × κάθε ορθογώνιο).
 *
 * 🔑 **Φίλτρο, όχι νέα σημασιολογία.** Δίνει **υπερσύνολο** των τμημάτων που μπορεί να απαντήσει το `edgeSourceSegments`
 * (`same-color-rects.ts`), **στην αρχική τους σειρά**· η ίδια συνάρτηση τριών σταδίων τρέχει πάνω του. Άρα το αποτέλεσμα είναι
 * ταυτόσημο με τη γραμμική σάρωση — αλλάζει μόνο το πόσα τμήματα κοιτάζονται (μετρημένο: 470 ms + 458 ms σε 1 584 ms της
 * παραλαβής, O(ορθογώνια × τμήματα)).
 * 🔑 **Γιατί αρκεί το κουτί της ακμής φουσκωμένο κατά `tol`.** Και τα τρία στάδια απαιτούν από το τμήμα ένα σημείο σε
 * απόσταση ≤ `tol` από την ακμή: (1) ταύτιση άκρων — τα άκρα του ≤ `tol` από τις κορυφές· (2) συγγραμμικό — και τα δύο άκρα
 * ≤ `tol` από την ευθεία **και** επικάλυψη στο [0, μήκος] ⇒ υπάρχει σημείο του που προβάλλεται μέσα στην ακμή, σε απόσταση ≤
 * `tol` (η απόσταση από ευθεία είναι κυρτή κατά μήκος του τμήματος)· (3) πλησιέστερο στο μέσο — απόσταση τμήματος ≤ `tol`.
 * Σε κάθε περίπτωση το κουτί του τμήματος τέμνει το κουτί της ακμής φουσκωμένο κατά `tol`· φουσκώνουμε κατά `2·tol` ώστε
 * καμία στρογγυλοποίηση να μη κόψει οριακή περίπτωση.
 * 🔑 **Το πλέγμα είναι το SSoT** `core/spatial` (`GridSpatialIndex` + πλευρά κελιού από το `resolveGridSize`, ADR-735) —
 * όχι νέος χειροποίητος κάδος (ADR-650 §M10e).
 *
 * PURE ως προς την είσοδο — zero React/store.
 *
 * @module subapps/dxf-viewer/bim/walls/edge-source-index
 * @see ./same-color-rects.ts (`edgeSourceSegments`, ο μοναδικός κριτής)
 * @see ../../core/spatial/GridSpatialIndex.ts
 */

import type { Point2D } from '../../rendering/types/Types';
import { spatialIndexFactory } from '../../core/spatial/SpatialIndexFactory';
import { resolveGridSize } from '../../core/spatial/grid-sizing';
import type { ISpatialIndex, SpatialBounds } from '../../core/spatial/ISpatialIndex';
import type { RegionLineSeg } from './wall-in-region';

/** Πόσες ανοχές φουσκώνει το κουτί της ερώτησης (≥ 1 αρκεί θεωρητικά· 2 για περιθώριο στρογγυλοποίησης). */
const QUERY_INFLATE_TOLS = 2;

function boxOf(a: Point2D, b: Point2D, pad: number): SpatialBounds {
  return {
    minX: Math.min(a.x, b.x) - pad,
    minY: Math.min(a.y, b.y) - pad,
    maxX: Math.max(a.x, b.x) + pad,
    maxY: Math.max(a.y, b.y) + pad,
  };
}

function unionOf(segments: readonly RegionLineSeg[], pad: number): SpatialBounds {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const s of segments) {
    minX = Math.min(minX, s.start.x, s.end.x);
    minY = Math.min(minY, s.start.y, s.end.y);
    maxX = Math.max(maxX, s.start.x, s.end.x);
    maxY = Math.max(maxY, s.start.y, s.end.y);
  }
  return { minX: minX - pad, minY: minY - pad, maxX: maxX + pad, maxY: maxY + pad };
}

const isFinitePoint = (p: Point2D): boolean => Number.isFinite(p.x) && Number.isFinite(p.y);

/** Τα τμήματα μιας σκηνής, ευρετηριασμένα για ερωτήσεις «ποια μπορεί να εξηγούν την ακμή a→b;». */
export class EdgeSourceIndex {
  private readonly grid: ISpatialIndex | null;

  /**
   * @param segments τα τμήματα· τα αποτελέσματα είναι **αυτά τα αντικείμενα**, στη σειρά τους
   * @param tol      η ανοχή κόμβων της ανίχνευσης (μονάδες σκηνής)· μη θετική ⇒ καμία ευρετηρίαση (γραμμική σάρωση)
   */
  constructor(
    readonly segments: readonly RegionLineSeg[],
    private readonly tol: number,
  ) {
    const indexable = tol > 0 && Number.isFinite(tol) && segments.length > 0 && segments.every((s) => isFinitePoint(s.start) && isFinitePoint(s.end));
    this.grid = indexable ? this.build() : null;
  }

  private build(): ISpatialIndex {
    // Τα όρια φουσκώνουν κατά tol ⇒ θετική έκταση ακόμη και για ένα μόνο τμήμα, και κανένα τμήμα «εκτός ορίων».
    const bounds = unionOf(this.segments, this.tol * QUERY_INFLATE_TOLS);
    const grid = spatialIndexFactory.createGrid(bounds, resolveGridSize(bounds, this.segments.length));
    this.segments.forEach((s, i) => grid.insert({ id: String(i), bounds: boxOf(s.start, s.end, 0), data: i }));
    return grid;
  }

  /**
   * Υπερσύνολο των τμημάτων που μπορεί να εξηγούν την ακμή a→b, **στην αρχική σειρά** (η σειρά είναι σημασιολογία: το
   * πλησιέστερο κερδίζει την ισοβαθμία με τη σειρά του). Χωρίς ευρετήριο ⇒ όλα.
   */
  candidates(a: Point2D, b: Point2D): readonly RegionLineSeg[] {
    if (this.grid === null || !isFinitePoint(a) || !isFinitePoint(b)) return this.segments;
    const hits = this.grid.queryBounds(boxOf(a, b, this.tol * QUERY_INFLATE_TOLS));
    const order: number[] = [];
    for (const h of hits) if (typeof h.data === 'number') order.push(h.data);
    order.sort((x, y) => x - y);
    return order.map((i) => this.segments[i]);
  }
}
