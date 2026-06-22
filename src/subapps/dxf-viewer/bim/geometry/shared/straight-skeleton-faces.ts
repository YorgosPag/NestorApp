/**
 * Straight-skeleton face assembly (pure SSoT, generic comp-geometry).
 *
 * Δεύτερο μισό του straight-skeleton (ADR-417 Φ2): παίρνει τα **τόξα** που παράγει
 * η προσομοίωση κύματος (`straight-skeleton.ts`) + το αρχικό πολύγωνο και
 * συναρμολογεί, **ανά αρχική ακμή**, το κλειστό πολύγωνο της «όψης» της (το νερό
 * της στέγης). Καθαρά combinatorial: κάθε τόξο φέρει ετικέτα τις ΔΥΟ ακμές που
 * χωρίζει (`leftEdge`/`rightEdge`) — η όψη της ακμής `i` = η αρχική ακμή `i` + όλα
 * τα τόξα με ετικέτα `i`, συναρμολογημένα σε βρόχο με ταίριασμα άκρων.
 *
 * Γιατί χωριστό αρχείο: N.7.1 (500-line cap) + SRP (simulation ⟂ assembly).
 *
 * @see straight-skeleton.ts — η προσομοίωση που παράγει τα τόξα
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md
 */

import { isPolygonCCW } from './polygon-utils';

/** 2D σημείο (canvas units· z αγνοείται — η ανύψωση γίνεται downstream). */
export interface SkPoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Ένα εσωτερικό τόξο του skeleton — σύνορο μεταξύ δύο όψεων. `leftEdge`/`rightEdge`
 * = δείκτες αρχικών ακμών εκατέρωθεν· `fromReflex` = το τόξο ξεκινά από κοίλη
 * (reflex) κορυφή → υποψήφια **λούκι** (valley) στη στέγη.
 */
export interface SkeletonArc {
  readonly a: SkPoint;
  readonly b: SkPoint;
  readonly leftEdge: number;
  readonly rightEdge: number;
  readonly fromReflex: boolean;
}

/** Η συναρμολογημένη όψη μιας αρχικής ακμής (κλειστό 2D πολύγωνο, CCW). */
export interface SkeletonEdgeFace {
  readonly edgeIndex: number;
  readonly polygon: readonly SkPoint[];
}

/** Ένα τμήμα προς συναρμολόγηση (αρχική ακμή ή τόξο). */
interface Segment {
  readonly a: SkPoint;
  readonly b: SkPoint;
}

/** Κλειδί κορυφής (rounded σε πλέγμα `eps`) για ταίριασμα κοινών άκρων. */
function vertexKey(p: SkPoint, eps: number): string {
  return `${Math.round(p.x / eps)},${Math.round(p.y / eps)}`;
}

/** Διαγώνιος bbox — κλίμακα για το tolerance του ταιριάσματος. */
function bboxDiagonal(polygon: readonly SkPoint[]): number {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of polygon) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return Math.hypot(maxX - minX, maxY - minY) || 1;
}

/** Τα τμήματα που συνθέτουν την όψη της ακμής `i`: αρχική ακμή + τόξα με ετικέτα `i`. */
function segmentsForEdge(
  polygon: readonly SkPoint[],
  arcs: readonly SkeletonArc[],
  i: number,
): Segment[] {
  const n = polygon.length;
  const segs: Segment[] = [{ a: polygon[i], b: polygon[(i + 1) % n] }];
  for (const arc of arcs) {
    if (arc.leftEdge === i || arc.rightEdge === i) {
      // Μηδενικού μήκους τόξο (degenerate event) → αγνόησέ το.
      if (arc.a.x === arc.b.x && arc.a.y === arc.b.y) continue;
      segs.push({ a: arc.a, b: arc.b });
    }
  }
  return segs;
}

/**
 * Συναρμολογεί τα τμήματα σε **έναν** κλειστό βρόχο ξεκινώντας από την αρχική ακμή
 * (`polygon[i] → polygon[i+1]`) και ακολουθώντας κοινά άκρα. Επιστρέφει `null` αν
 * η περιήγηση σπάσει (degenerate skeleton) — ο caller κάνει graceful fallback.
 */
function walkLoop(
  segs: readonly Segment[],
  start: SkPoint,
  next: SkPoint,
  eps: number,
): SkPoint[] | null {
  // Adjacency: κλειδί κορυφής → λίστα (segIndex, άλλο άκρο).
  const adj = new Map<string, { seg: number; to: SkPoint }[]>();
  segs.forEach((s, idx) => {
    const ka = vertexKey(s.a, eps);
    const kb = vertexKey(s.b, eps);
    (adj.get(ka) ?? adj.set(ka, []).get(ka)!).push({ seg: idx, to: s.b });
    (adj.get(kb) ?? adj.set(kb, []).get(kb)!).push({ seg: idx, to: s.a });
  });

  const used = new Set<number>([0]); // seg 0 = αρχική ακμή (ήδη διανύθηκε)
  const ordered: SkPoint[] = [start, next];
  const startKey = vertexKey(start, eps);
  let current = next;
  const maxSteps = segs.length + 2;
  for (let step = 0; step < maxSteps; step++) {
    if (vertexKey(current, eps) === startKey) return ordered.slice(0, -1);
    const options = adj.get(vertexKey(current, eps)) ?? [];
    const pick = options.find((o) => !used.has(o.seg));
    if (!pick) return null;
    used.add(pick.seg);
    ordered.push(pick.to);
    current = pick.to;
  }
  return null;
}

/**
 * Συναρμολογεί την όψη **κάθε** αρχικής ακμής από τα skeleton τόξα. Pure. Όψεις
 * που αποτυγχάνουν να κλείσουν παραλείπονται (ο roof solver κάνει fallback). Όλες
 * οι όψεις επιστρέφονται σε CCW σειρά.
 */
export function assembleEdgeFaces(
  polygon: readonly SkPoint[],
  arcs: readonly SkeletonArc[],
): SkeletonEdgeFace[] {
  const n = polygon.length;
  if (n < 3) return [];
  const eps = Math.max(1e-7, 1e-5 * bboxDiagonal(polygon));
  const faces: SkeletonEdgeFace[] = [];
  for (let i = 0; i < n; i++) {
    const segs = segmentsForEdge(polygon, arcs, i);
    const loop = walkLoop(segs, polygon[i], polygon[(i + 1) % n], eps);
    if (!loop || loop.length < 3) continue;
    const poly3 = loop.map((p) => ({ x: p.x, y: p.y, z: 0 }));
    const polygonCcw = isPolygonCCW(poly3) ? loop : [...loop].reverse();
    faces.push({ edgeIndex: i, polygon: polygonCcw });
  }
  return faces;
}
