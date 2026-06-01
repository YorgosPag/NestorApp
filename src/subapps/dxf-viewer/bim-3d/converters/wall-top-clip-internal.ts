/**
 * wall-top-clip-internal.ts — low-level plan-geometry helpers for the wall-top
 * attach clip (ADR-404 ↔ ADR-401). Extracted from `wall-top-clip.ts` (Google
 * 500-line SRP split): pure ring math + `quad ∖ host` differencing + loft
 * footprint construction. No public-API surface — consumed only by
 * `wall-top-clip.ts`. Keeping these here keeps the orchestration file focused on
 * the planar/tilted region builders.
 */
import type { Pt2, HostFootprintInput } from '../../bim/geometry/wall-host-plan-builder';
import { hostUndersideAt } from '../../bim/geometry/host-footprint-eval';
import { safeDifference, type ClipGeom } from '../../bim/geometry/shared/safe-polygon-boolean';
import {
  convexPolygonDifference,
  isConvexRing,
} from '../../bim/geometry/shared/convex-polygon-difference';
import type { Ring } from 'polygon-clipping';

/** Όριο εμβαδού (plan units²) κάτω από το οποίο μια περιοχή είναι sliver → skip. */
export const AREA_EPS = 1e-9;

/** plan polygon → polygon-clipping `Polygon` (single ring). */
export function toClipGeom(poly: readonly Pt2[]): ClipGeom {
  return [poly.map((p) => [p.x, p.y] as [number, number])];
}

/** Signed εμβαδόν (shoelace): θετικό ⇒ CCW στο plan (x,y), αρνητικό ⇒ CW. */
export function signedRingArea(pts: readonly Pt2[]): number {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

/** Εμβαδόν (absolute) — για sliver filter. */
export function ringArea(pts: readonly Pt2[]): number {
  return Math.abs(signedRingArea(pts));
}

/**
 * Outer ring ενός clipped polygon → `Pt2[]`, (α) αφαιρώντας **συνεχόμενες διπλές
 * κορυφές** (το polygon-clipping βγάζει περιστασιακά zero-length ακμές σε γωνιακές
 * τομές — π.χ. ένα τρίγωνο με την κάτω κορυφή διπλή) ΚΑΙ το closing vertex, και
 * (β) **κανονικοποιώντας σε CCW**. Το `buildColumnPrismGeometry` υποθέτει CCW
 * footprint για να βγάλει το πάνω καπάκι με normal **+Y** (κοιτά πάνω)· η
 * `polygon-clipping` ΔΕΝ εγγυάται σταθερό winding (intersection vs difference, ανά
 * region) → χωρίς αυτό μερικά regions έβγαζαν **ανεστραμμένο** καπάκι (normal −Y)
 * → ασυνεπής φωτισμός/σκιά στις οριζόντιες επιφάνειες (top/bottom) του τοίχου.
 */
export function ringToPts(ring: Ring): Pt2[] {
  const pts: Pt2[] = [];
  for (const [x, y] of ring) {
    const prev = pts[pts.length - 1];
    if (prev && Math.abs(prev.x - x) < 1e-12 && Math.abs(prev.y - y) < 1e-12) continue;
    pts.push({ x, y });
  }
  if (pts.length > 1) {
    const a = pts[0];
    const b = pts[pts.length - 1];
    if (Math.abs(a.x - b.x) < 1e-12 && Math.abs(a.y - b.y) < 1e-12) pts.pop();
  }
  if (pts.length >= 3 && signedRingArea(pts) < 0) pts.reverse();
  return pts;
}

/**
 * ADR-404 Phase 4.3 robustness — `quad ∖ hostPoly` ως CCW κομμάτια, sliver-filtered.
 *
 * **Κυρτό host** (αποτύπωμα δοκαριού = ορθογώνιο) → analytic half-plane peel
 * (`convexPolygonDifference`) — ποτέ δεν αποτυγχάνει, μηδέν «Unable to complete output
 * ring» στις σχεδόν-εκφυλισμένες θέσεις (δοκάρι που γεφυρώνει λεπτό τοίχο στο Hu) που
 * έσπαγαν το `safeDifference`. **Μη-κυρτό host** (π.χ. L-shaped slab) → boolean fallback.
 *
 * Ο `quad` είναι πάντα κυρτό τετράπλευρο κομματιού τοίχου· ο sliver/CCW κανόνας ίδιος
 * με `ringToPts` ώστε ο prism/loft builder να βγάζει top cap normal +Y.
 */
export function diffQuadMinusHostPieces(quad: readonly Pt2[], hostPoly: readonly Pt2[]): Pt2[][] {
  if (isConvexRing(hostPoly)) {
    return convexPolygonDifference(quad, hostPoly).filter((p) => ringArea(p) >= AREA_EPS);
  }
  const pieces: Pt2[][] = [];
  for (const poly of safeDifference(toClipGeom(quad), toClipGeom(hostPoly))) {
    const pts = ringToPts(poly[0]);
    if (pts.length >= 3 && ringArea(pts) >= AREA_EPS) pieces.push(pts);
  }
  return pieces;
}

/** Κεντροειδές (μέσος όρος κορυφών — επαρκές για convex/simple regions). */
export function centroid(pts: readonly Pt2[]): Pt2 {
  let x = 0;
  let y = 0;
  for (const p of pts) {
    x += p.x;
    y += p.y;
  }
  return { x: x / pts.length, y: y / pts.length };
}

/**
 * Ο host με τη **χαμηλότερη** κάτω-παρειά στο σημείο `pt` (lower-envelope winner), ή
 * `null` αν κανείς δεν καλύπτει το `pt`. Χρήση: επιλογή host για μια inside περιοχή
 * (μέσω του κεντροειδούς της — robust σε boundary vertices που το point-test απορρίπτει).
 */
export function lowestHostAt(hosts: readonly HostFootprintInput[], pt: Pt2): HostFootprintInput | null {
  let best: HostFootprintInput | null = null;
  let bestZ = Infinity;
  for (const h of hosts) {
    const z = hostUndersideAt(h, pt);
    if (z !== null && z < bestZ) {
      bestZ = z;
      best = h;
    }
  }
  return best;
}

/** Κάτω-παρειά host στο `pt` (flat scalar ή κεκλιμένο επίπεδο· χωρίς point-test). */
export function hostUndersidePlaneMm(h: HostFootprintInput, pt: Pt2): number {
  return h.undersideZmmAt ? h.undersideZmmAt(pt) : h.undersideZmm;
}

/** Απόσταση σημείου από τμήμα `ab` < eps ΚΑΙ προβολή εντός [0,1] (endpoint-inclusive). */
export function pointOnSegment(p: Pt2, a: Pt2, b: Pt2, eps: number): boolean {
  const abx = b.x - a.x, aby = b.y - a.y;
  const len2 = abx * abx + aby * aby;
  if (len2 < eps * eps) return Math.hypot(p.x - a.x, p.y - a.y) < eps;
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2;
  if (t < -eps || t > 1 + eps) return false;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * abx), p.y - (a.y + t * aby)) < eps;
}

/** Τομή δύο **ευθειών** (όχι τμημάτων) p1p2 × p3p4· `null` αν ~παράλληλες. */
export function lineIntersect(p1: Pt2, p2: Pt2, p3: Pt2, p4: Pt2): Pt2 | null {
  const d1x = p2.x - p1.x, d1y = p2.y - p1.y;
  const d2x = p4.x - p3.x, d2y = p4.y - p3.y;
  const denom = d1x * d2y - d1y * d2x;
  if (Math.abs(denom) < 1e-12) return null;
  const tt = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
  return { x: p1.x + tt * d1x, y: p1.y + tt * d1y };
}

/**
 * Χτίζει το **top footprint** (@nominal) **απευθείας από** το `bottom` (@Hu) ώστε να
 * εγγυηθεί **1:1 αντιστοιχία κορυφών** — robust σε διαφορετικό vertex count μεταξύ
 * ανεξάρτητων clip (η αιτία που το naive matching αποτύγχανε στο runtime). Κάθε κορυφή
 * `v` του `bottom` κατατάσσεται ως προς το `host_atHu` (`host`) + το `quad`:
 *   - **εκτός host** (quad corner) → αμετάβλητη (η κάτοψη του τοίχου δεν αλλάζει με ύψος).
 *   - **quad-edge ∩ host-edge** (cut crossing) → τομή της ΙΔΙΑΣ quad ακμής με την
 *     **μετατοπισμένη** host ακμή (`host − Δcut`) → κινείται κατά μήκος της παρειάς.
 *   - **host corner εντός quad** (notch tip) → μετατόπιση κατά `−Δcut` (κατακόρυφη ακμή
 *     δοκαριού).
 * Μετά τον `emit()` shear, η κοπή ξαναγίνεται **κατακόρυφη** στο `host_real`. Επιστρέφει
 * `null` (→ fallback) σε εκφυλισμό (παράλληλες ακμές).
 */
export function buildTopFootprintFromBottom(
  bottom: readonly Pt2[], host: readonly Pt2[], quad: readonly Pt2[],
  dCutFn: (v: Pt2) => Pt2, eps: number,
): Pt2[] | null {
  const out: Pt2[] = [];
  for (const v of bottom) {
    // Per-vertex Δcut: για flat host σταθερό (== shear(nominal)−shear(Hu))· για
    // κεκλιμένη κάτω-παρειά μεταβάλλεται με το τοπικό Hu(v) στην κορυφή.
    const dCut = dCutFn(v);
    let hostEdge: readonly [Pt2, Pt2] | null = null;
    for (let i = 0; i < host.length; i++) {
      const a = host[i], b = host[(i + 1) % host.length];
      if (pointOnSegment(v, a, b, eps)) { hostEdge = [a, b]; break; }
    }
    if (!hostEdge) { out.push({ x: v.x, y: v.y }); continue; } // εκτός host → quad corner
    let quadEdge: readonly [Pt2, Pt2] | null = null;
    for (let i = 0; i < quad.length; i++) {
      const a = quad[i], b = quad[(i + 1) % quad.length];
      if (pointOnSegment(v, a, b, eps)) { quadEdge = [a, b]; break; }
    }
    if (quadEdge) {
      // cut crossing: τομή quad ακμής × μετατοπισμένης host ακμής.
      const h0 = { x: hostEdge[0].x - dCut.x, y: hostEdge[0].y - dCut.y };
      const h1 = { x: hostEdge[1].x - dCut.x, y: hostEdge[1].y - dCut.y };
      const p = lineIntersect(quadEdge[0], quadEdge[1], h0, h1);
      if (!p) return null;
      out.push(p);
    } else {
      out.push({ x: v.x - dCut.x, y: v.y - dCut.y }); // host corner εντός quad
    }
  }
  return out;
}
