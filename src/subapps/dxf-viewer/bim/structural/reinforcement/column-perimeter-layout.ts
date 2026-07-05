/**
 * Perimeter rebar layout — outline-driven (ADR-460 — Multi-shape, Slice 2).
 *
 * Γενικεύει τη διάταξη οπλισμού της ορθογωνικής κολώνας σε **οποιοδήποτε** περίγραμμα
 * διατομής (Γ, Τ, Ι, Π-μη-τοίχωμα, πολύγωνο, σύνθετο): οι διαμήκεις ράβδοι μπαίνουν
 * στο **inset περίγραμμα** (κορυφή σε κάθε γωνία + ενδιάμεσες ομοιόμορφα), και το
 * στεφάνι **ακολουθεί το outline** με στρογγυλεμένες (concave-aware) γωνίες. Reuse:
 *   - `insetClosedPolygon` (polygon-utils SSoT) — inward offset, concave-safe
 *   - `distributeBarsAlongPolygon` / `buildRoundedStirrupPath` / `buildStirrupHookEndsMm`
 *     (column-rebar-layout primitives) — μηδέν διπλότυπο
 *
 * LOCAL mm (centroid-centered), ίδιο σύστημα με το rect layout → 2Δ/3Δ/ποσότητες
 * τρέφονται από την ΙΔΙΑ γεωμετρία (geometry-is-SSoT). Pure.
 *
 * @see ./column-section-outline.ts
 * @see ./column-rebar-layout.ts
 */

import type { Point2D } from '../../../rendering/types/Types';
import { insetPolygonMiter, projectVerticesTo2D } from '../../geometry/shared/polygon-utils';
import type { ColumnReinforcement } from './column-reinforcement-types';
import {
  buildRoundedStirrupPath,
  buildStirrupHookEndsMm,
  closedPolylineLengthMm,
  distributeBarsAlongPolygon,
  pointPairKey,
  STIRRUP_BEND_ARC_SEGMENTS,
  STIRRUP_BEND_CL_FACTOR,
  type ColumnRebarLayout,
} from './column-rebar-layout';

/** Inward miter inset κλειστού πολυγώνου κατά `d` mm (concave-safe). null αν καταρρεύσει. */
export function insetOutlineMm(outlineMm: readonly Point2D[], d: number): Point2D[] | null {
  const inner = insetPolygonMiter(outlineMm, d);
  return inner ? projectVerticesTo2D(inner) : null;
}

/** Ελάχιστο μήκος ακμής κλειστού πολυγώνου (mm). */
function minEdgeLengthMm(poly: readonly Point2D[]): number {
  let min = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    min = Math.min(min, Math.hypot(b.x - a.x, b.y - a.y));
  }
  return Number.isFinite(min) ? min : 0;
}

// ── ADR-460 — grid cross-ties για μη-ορθογώνια perimeter (Γ/Τ/Π/πολύγωνο) ───────
//
// Οι **ενδιάμεσες** + οι **reentrant (κοίλες) γωνιακές** διαμήκεις ράβδοι θέλουν εσωτερικό
// συνδετήριο που τις δένει με την **απέναντι ράβδο** διασχίζοντας το πάχος (EC8 §5.4.3.2.2(11)).
// Για κάθε τέτοια ράβδο: ρίχνουμε αχτίνα κατά το εσωτερικό κάθετο της παρειάς της ως την
// **πρώτη απέναντι ακμή** (`rayForwardDepth`) και πιάνουμε την πιο **ευθυγραμμισμένη
// ΠΡΑΓΜΑΤΙΚΗ** ράβδο εκεί (`alignedOppositeBar`, ≤45°) — **ΠΟΤΕ γάντζος στο κενό**: αν δεν
// υπάρχει ράβδος απέναντι, το tie δεν σχεδιάζεται. Ακμές-καπάκια (βάθος > μήκος ακμής)
// παραλείπονται (αλλιώς tie κατά μήκος). Οι **κυρτές** γωνίες πιάνονται από το στεφάνι (δεν
// θέλουν tie). Τα ζεύγη `{a,b}` πάνε στο `crossTieAnchorsMm` → ο dispatcher τα κάνει S-ties
// (ίδιο μονοπάτι με το τοίχωμα). Geometry-is-SSoT: 2Δ/3Δ/ποσότητες χωρίς νέο plumbing.
// Δένουμε **όλες** τις ενδιάμεσες (απόφαση Giorgio, παρ. με το ορθογωνικό `straightTies`).

const EPS = 1e-9;
/** Ανοχή «η ράβδος πατάει στην ακμή» (mm) — οι ενδιάμεσες κάθονται ακριβώς επί ακμής. */
const ON_EDGE_TOL_MM = 1;
/** Ελάχιστο βάθος (mm) έγκυρου tie/αχτίνας (αποκλείει t≈0 στην ίδια ακμή). */
const MIN_TIE_DEPTH_MM = 1;
/** Βάθος > μήκος ακμής × αυτό → ο tie τρέχει κατά μήκος (ακμή-καπάκι) → απορρίπτεται. */
const TIE_DEPTH_TO_EDGE_FACTOR = 1.5;

/** Inward normal + μήκος ακμής του polygon που πατάει μια ράβδος. */
interface BarEdge {
  readonly nIn: Point2D;
  readonly lenMm: number;
}

/** Μοναδιαίο **εσωτερικό** κάθετο της ακμής a→b (CCW left-normal — το barPolygon είναι CCW). */
function inwardEdgeNormal(a: Point2D, b: Point2D): Point2D {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: -dy / len, y: dx / len };
}

/** Η ακμή του `polygon` που πατάει η ράβδος `bar` → inward normal + μήκος (null αν σε καμία). */
function edgeOfBar(bar: Point2D, polygon: readonly Point2D[]): BarEdge | null {
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const a = polygon[i];
    const b = polygon[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 < EPS) continue;
    const t = ((bar.x - a.x) * dx + (bar.y - a.y) * dy) / len2;
    if (t < -1e-6 || t > 1 + 1e-6) continue;
    const dist = Math.hypot(bar.x - (a.x + t * dx), bar.y - (a.y + t * dy));
    if (dist <= ON_EDGE_TOL_MM) return { nIn: inwardEdgeNormal(a, b), lenMm: Math.sqrt(len2) };
  }
  return null;
}

/** Βάθος (mm) από `bar` κατά `d` ως την **πρώτη απέναντι** ακμή του `polygon`. null αν καμία. */
function rayForwardDepth(bar: Point2D, d: Point2D, polygon: readonly Point2D[]): number | null {
  let best = Infinity;
  const n = polygon.length;
  for (let i = 0; i < n; i++) {
    const p = polygon[i];
    const q = polygon[(i + 1) % n];
    const ex = q.x - p.x;
    const ey = q.y - p.y;
    const det = ex * d.y - ey * d.x;
    if (Math.abs(det) < EPS) continue;
    const rx = p.x - bar.x;
    const ry = p.y - bar.y;
    const t = (-rx * ey + ex * ry) / det; // απόσταση κατά την αχτίνα
    const s = (d.x * ry - d.y * rx) / det; // παράμετρος επί της ακμής
    if (t > MIN_TIE_DEPTH_MM && s >= -1e-6 && s <= 1 + 1e-6 && t < best) best = t;
  }
  return Number.isFinite(best) ? best : null;
}

/**
 * Η πιο **ευθυγραμμισμένη ΠΡΑΓΜΑΤΙΚΗ** ράβδος πάνω στην απέναντι παρειά (βάθος ≈ `depthFace`
 * κατά `nIn`), με πλευρική απόκλιση ≤ `maxLat` (≤45° tie). `null` αν καμία — έτσι το tie
 * πιάνει ΠΑΝΤΑ ράβδο (ποτέ γάντζος στο κενό) ή δεν σχεδιάζεται καθόλου.
 */
function alignedOppositeBar(
  bar: Point2D,
  nIn: Point2D,
  bars: readonly Point2D[],
  depthFace: number,
  depthTol: number,
  maxLat: number,
): Point2D | null {
  let best: Point2D | null = null;
  let bestLat = maxLat;
  for (const other of bars) {
    const vx = other.x - bar.x;
    const vy = other.y - bar.y;
    const depth = vx * nIn.x + vy * nIn.y;
    if (Math.abs(depth - depthFace) > depthTol) continue;
    const lat = Math.hypot(vx - depth * nIn.x, vy - depth * nIn.y);
    if (lat < bestLat) {
      bestLat = lat;
      best = other;
    }
  }
  return best;
}

/** Reflex (κοίλη/εσωτερική) κορυφή CCW πολυγώνου: cross(prev→curr, curr→next) < 0. */
function isReflexVertex(poly: readonly Point2D[], i: number): boolean {
  const k = poly.length;
  const prev = poly[(i - 1 + k) % k];
  const curr = poly[i];
  const next = poly[(i + 1) % k];
  return (curr.x - prev.x) * (next.y - curr.y) - (curr.y - prev.y) * (next.x - curr.x) < 0;
}

/**
 * Προσθέτει ΕΝΑ tie από `bar` εγκάρσια (κατά `nIn`) στην απέναντι **πραγματική ράβδο**.
 * No-op όταν: ακμή-καπάκι (βάθος > μήκος ακμής), καμία ράβδος απέναντι (ποτέ γάντζος στο
 * κενό), ή διπλό ζεύγος (dedup). `dbL` = διάμετρος διαμήκους (ανοχή «πάνω στην παρειά»).
 */
function pushPerpTie(
  bar: Point2D,
  nIn: Point2D,
  edgeLenMm: number,
  barPolygon: readonly Point2D[],
  bars: readonly Point2D[],
  dbL: number,
  seen: Set<string>,
  anchors: { a: Point2D; b: Point2D }[],
): void {
  const depthFace = rayForwardDepth(bar, nIn, barPolygon);
  if (depthFace === null || depthFace > edgeLenMm * TIE_DEPTH_TO_EDGE_FACTOR) return;
  const partner = alignedOppositeBar(bar, nIn, bars, depthFace, Math.max(2, 2 * dbL), depthFace);
  if (!partner) return;
  const key = pointPairKey(bar, partner);
  if (seen.has(key)) return;
  seen.add(key);
  anchors.push({ a: bar, b: partner });
}

/**
 * Ζεύγη αγκύρωσης cross-ties για perimeter διάταξη (LOCAL mm, pure):
 *   1. **Reentrant (κοίλες) γωνιακές** ράβδοι → κάθετο tie σε ΚΑΘΕ γειτονική παρειά
 *      (η ράβδος λυγίζει προς τα μέσα στην κοίλη γωνία → EC8 κρίσιμη συγκράτηση· οι
 *      κυρτές γωνίες πιάνονται από το στεφάνι, δεν θέλουν tie).
 *   2. **Ενδιάμεσες** ράβδοι (index ≥ K κορυφών) → κάθετο tie ως την απέναντι παρειά.
 * Dedup ανά ευθεία· skip ακμές-καπάκια. `[]` αν μόνο γωνίες χωρίς ενδιάμεσες.
 */
function buildPerimeterCrossTieAnchors(
  barPolygon: readonly Point2D[],
  bars: readonly Point2D[],
  dbL: number,
): { a: Point2D; b: Point2D }[] {
  const k = barPolygon.length;
  if (k < 3 || bars.length <= k) return [];
  const anchors: { a: Point2D; b: Point2D }[] = [];
  const seen = new Set<string>();
  // 1) Reentrant γωνίες — tie εγκάρσια σε ΚΑΘΕ από τις δύο γειτονικές παρειές.
  for (let i = 0; i < k; i++) {
    if (!isReflexVertex(barPolygon, i)) continue;
    const prev = barPolygon[(i - 1 + k) % k];
    const curr = barPolygon[i];
    const next = barPolygon[(i + 1) % k];
    pushPerpTie(bars[i], inwardEdgeNormal(prev, curr), Math.hypot(curr.x - prev.x, curr.y - prev.y), barPolygon, bars, dbL, seen, anchors);
    pushPerpTie(bars[i], inwardEdgeNormal(curr, next), Math.hypot(next.x - curr.x, next.y - curr.y), barPolygon, bars, dbL, seen, anchors);
  }
  // 2) Ενδιάμεσες ράβδοι — κάθετο tie στην απέναντι παρειά.
  for (let i = k; i < bars.length; i++) {
    const edge = edgeOfBar(bars[i], barPolygon);
    if (edge) pushPerpTie(bars[i], edge.nIn, edge.lenMm, barPolygon, bars, dbL, seen, anchors);
  }
  return anchors;
}

/**
 * Διάταξη οπλισμού για perimeter mode από το LOCAL-mm outline. Επιστρέφει `null` αν
 * το inset καταρρέει (διατομή πολύ μικρή για το cover) ή δεν υπάρχει οπλισμός.
 */
export function buildPerimeterLayoutFromOutline(
  r: ColumnReinforcement,
  outlineMm: readonly Point2D[],
): ColumnRebarLayout | null {
  if (outlineMm.length < 3) return null;
  const dbL = Math.max(0, r.longitudinal.diameterMm);
  const dbw = Math.max(0, r.stirrups.diameterMm);
  const cover = Math.max(0, r.coverMm);

  const stirrupRingMm = insetOutlineMm(outlineMm, cover + dbw / 2);
  if (!stirrupRingMm || stirrupRingMm.length < 3) return null;
  const barPolygon = insetOutlineMm(outlineMm, cover + dbw + dbL / 2) ?? stirrupRingMm;
  const longitudinalBarsMm = distributeBarsAlongPolygon(barPolygon, Math.max(0, Math.floor(r.longitudinal.count)));

  const stirrupCornerRadiusMm = Math.min(STIRRUP_BEND_CL_FACTOR * dbw, minEdgeLengthMm(stirrupRingMm) / 2);
  const stirrupPathMm = buildRoundedStirrupPath(stirrupRingMm, stirrupCornerRadiusMm, STIRRUP_BEND_ARC_SEGMENTS);
  const hookBar = longitudinalBarsMm.length > 0 ? longitudinalBarsMm[0] : stirrupRingMm[0];
  const stirrupHookEndsMm = buildStirrupHookEndsMm(stirrupRingMm, hookBar, { x: 0, y: 0 }, dbw, dbL, STIRRUP_BEND_ARC_SEGMENTS);

  // Grid cross-ties: δένουν τις ενδιάμεσες ράβδους με την αντικριστή τους (ADR-460).
  const crossTieAnchorsMm = buildPerimeterCrossTieAnchors(barPolygon, longitudinalBarsMm, dbL);

  return {
    longitudinalBarsMm,
    stirrupRingMm,
    stirrupPathMm,
    stirrupCornerRadiusMm,
    stirrupHookEndsMm,
    barDiameterMm: dbL,
    stirrupDiameterMm: dbw,
    stirrupCenterlineLengthMm: closedPolylineLengthMm(stirrupPathMm),
    ...(crossTieAnchorsMm.length > 0 ? { crossTieAnchorsMm } : {}),
  };
}
