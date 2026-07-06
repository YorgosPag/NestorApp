/**
 * Roof eave PLAN geometry primitives (ADR-417) — pure, THREE-free.
 *
 * Ό,τι αφορά το **plan** δαχτυλίδι του γείσου: τομή ευθειών, τεμαχισμός της
 * περιμέτρου στους κορφιάδες/hips, και το mitered **εξωτερικό δαχτυλίδι**
 * (`roofEaveOuterRing`). Εξαγμένο από το `roof-eave-detail.ts` (SRP + όριο 500γρ.).
 *
 * SSoT: το εξωτερικό δαχτυλίδι καταναλώνεται ΚΑΙ από τον 2D/3D builder γείσου
 * (`buildRoofEaveDetail`) ΚΑΙ από τις **έλξεις** στο γείσο (`GeometricCalculations`,
 * ADR-417) → τα snap κουμπώνουν ΑΚΡΙΒΩΣ πάνω στο ορατό γείσο.
 *
 * @see docs/centralized-systems/reference/adrs/ADR-417-bim-roof-element.md §10
 * @see bim/geometry/roof-eave-detail.ts — ο 2D/3D consumer (quads + overhang ring)
 */

import type { Point3D } from '../types/bim-base';
import type { RoofEdgeSlope, RoofRidgeLine } from '../types/roof-types';
import { inwardNormal, windingSign, type Vec2 } from './roof-lower-envelope';
import { projectPointTo2D } from './shared/polygon-utils';

const v2 = (p: Point3D): Vec2 => projectPointTo2D(p);

/**
 * Τομή δύο ευθειών (σημείο `p` + διεύθυνση `d`). Λύνει `p1 + t·d1 = p2 + u·d2`
 * για `t` (cross-product). `null` όταν ~παράλληλες (καμία/άπειρες τομές).
 */
export function lineIntersect(p1: Vec2, d1: Vec2, p2: Vec2, d2: Vec2): Vec2 | null {
  const denom = d1.x * d2.y - d1.y * d2.x;
  if (Math.abs(denom) < 1e-9) return null;
  const t = ((p2.x - p1.x) * d2.y - (p2.y - p1.y) * d2.x) / denom;
  return { x: p1.x + t * d1.x, y: p1.y + t * d1.y };
}

/**
 * Παράμετρος `t∈[0,1]` του `p` πάνω στο τμήμα `a→b`, ή `null` αν δεν κάθεται
 * πάνω του (κάθετη απόσταση > `tol`).
 */
function paramOnSegment(a: Point3D, b: Point3D, p: Vec2, tol: number): number | null {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-12) return null;
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  const px = a.x + t * dx;
  const py = a.y + t * dy;
  const dist2 = (p.x - px) ** 2 + (p.y - py) ** 2;
  if (dist2 > tol * tol) return null;
  return t;
}

/**
 * Σπάει footprint edges που **διασχίζουν** κορφιά/hip (τα endpoints τους πέφτουν
 * ΑΥΣΤΗΡΑ μέσα στην ακμή) σε υπο-ακμές στο σημείο διέλευσης. Κάθε υπο-ακμή
 * κληρονομεί το `RoofEdgeSlope` της μητρικής → ο per-edge `governingPlane`
 * διαλέγει σωστά το νερό κάθε πλευράς (το αέτωμα/rake ακολουθεί την κλίση). Χωρίς
 * ridges (ή κανένα crossing) → επιστρέφει τα αρχικά. Pure.
 */
export function splitOutlineAtRidges(
  verts: readonly Point3D[],
  edges: readonly RoofEdgeSlope[],
  ridges: readonly RoofRidgeLine[],
): { verts: Point3D[]; edges: RoofEdgeSlope[] } {
  if (ridges.length === 0) return { verts: verts.slice(), edges: edges.slice() };
  const n = verts.length;
  // Κλίμακα ανοχής από τη διαγώνιο του bbox (mirror roof-lower-envelope BOUNDARY_EPS).
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const v of verts) {
    if (v.x < minX) minX = v.x; if (v.y < minY) minY = v.y;
    if (v.x > maxX) maxX = v.x; if (v.y > maxY) maxY = v.y;
  }
  const tol = Math.max(1e-6, 1e-4 * Math.hypot(maxX - minX, maxY - minY));
  const tTol = 1e-3;
  const candidates: Vec2[] = [];
  for (const r of ridges) {
    candidates.push({ x: r.a.x, y: r.a.y }, { x: r.b.x, y: r.b.y });
  }

  const outVerts: Point3D[] = [];
  const outEdges: RoofEdgeSlope[] = [];
  for (let i = 0; i < n; i++) {
    const a = verts[i];
    const b = verts[(i + 1) % n];
    outVerts.push(a);
    outEdges.push(edges[i]);
    const onEdge: number[] = [];
    for (const c of candidates) {
      const t = paramOnSegment(a, b, c, tol);
      if (t === null || t <= tTol || t >= 1 - tTol) continue;
      if (onEdge.some((u) => Math.abs(u - t) < tTol)) continue; // dedupe
      onEdge.push(t);
    }
    onEdge.sort((x, y) => x - y);
    for (const t of onEdge) {
      outVerts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, z: 0 });
      outEdges.push(edges[i]); // η υπο-ακμή κληρονομεί την κλίση/overhang της μητρικής
    }
  }
  return { verts: outVerts, edges: outEdges };
}

/**
 * Το εξωτερικό **mitered δαχτυλίδι του γείσου** σε plan (canvas-unit xy) — μία
 * κορυφή ανά (split) footprint κορυφή. Όταν όλες οι ακμές έχουν overhang 0, το
 * δαχτυλίδι ταυτίζεται με το footprint. `ridges` → split των ακμών που διασχίζουν
 * κορφιά/hip (ίδιο τεμαχισμό με τον renderer). Κενό όταν footprint < 3 κορυφές ή
 * edges/verts mismatch. Pure / idempotent.
 */
export function roofEaveOuterRing(
  verts: readonly Point3D[],
  edges: readonly RoofEdgeSlope[],
  s: number,
  ridges: readonly RoofRidgeLine[] = [],
): Vec2[] {
  if (verts.length < 3 || edges.length !== verts.length) return [];
  const { verts: rv, edges: re } = splitOutlineAtRidges(verts, edges, ridges);
  const n = rv.length;
  const sign = windingSign(rv);

  // Offset-γραμμή ανά ακμή (παράλληλη, μετατοπισμένη έξω κατά overhang· outward = -inward).
  const offPts: Vec2[] = [];
  const offDirs: Vec2[] = [];
  for (let i = 0; i < n; i++) {
    const p0 = v2(rv[i]);
    const p1 = v2(rv[(i + 1) % n]);
    const inward = inwardNormal(rv[i], rv[(i + 1) % n], sign);
    const oh = Math.max(0, re[i].overhangMm) * s;
    offPts.push({ x: p0.x - inward.x * oh, y: p0.y - inward.y * oh });
    offDirs.push({ x: p1.x - p0.x, y: p1.y - p0.y });
  }

  // Mitered κορυφή `k` = τομή offset(k-1) ∩ offset(k) (γειτονικές strips μοιράζονται
  // την ΙΔΙΑ γωνία → καμία τρύπα). Fallback (~παράλληλες ακμές): κάθετο offset.
  const ring: Vec2[] = [];
  for (let k = 0; k < n; k++) {
    const prev = (k - 1 + n) % n;
    ring.push(lineIntersect(offPts[prev], offDirs[prev], offPts[k], offDirs[k]) ?? offPts[k]);
  }
  return ring;
}
