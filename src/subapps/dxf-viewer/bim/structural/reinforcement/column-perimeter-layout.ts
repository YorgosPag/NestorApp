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
import { insetPolygonMiter } from '../../geometry/shared/polygon-utils';
import type { ColumnReinforcement } from './column-reinforcement-types';
import {
  buildRoundedStirrupPath,
  buildStirrupHookEndsMm,
  closedPolylineLengthMm,
  distributeBarsAlongPolygon,
  STIRRUP_BEND_ARC_SEGMENTS,
  STIRRUP_BEND_CL_FACTOR,
  type ColumnRebarLayout,
} from './column-rebar-layout';

/** Inward miter inset κλειστού πολυγώνου κατά `d` mm (concave-safe). null αν καταρρεύσει. */
export function insetOutlineMm(outlineMm: readonly Point2D[], d: number): Point2D[] | null {
  const inner = insetPolygonMiter(outlineMm, d);
  return inner ? inner.map((p) => ({ x: p.x, y: p.y })) : null;
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

  return {
    longitudinalBarsMm,
    stirrupRingMm,
    stirrupPathMm,
    stirrupCornerRadiusMm,
    stirrupHookEndsMm,
    barDiameterMm: dbL,
    stirrupDiameterMm: dbw,
    stirrupCenterlineLengthMm: closedPolylineLengthMm(stirrupPathMm),
  };
}
