/**
 * Circular rebar layout (ADR-460 — Multi-shape, Slice 2).
 *
 * Κυκλική διατομή: οι διαμήκεις ράβδοι κατανέμονται **ακτινικά** σε κύκλο και ο
 * εγκάρσιος οπλισμός είναι **δακτύλιος** (closed hoop) ή **σπείρα** (`type==='spiral'`)
 * — όχι ορθογώνιο στεφάνι. Παράγει το ΙΔΙΟ `ColumnRebarLayout` interface (το
 * `stirrupPathMm` είναι το tessellated κυκλικό μονοπάτι) → 2Δ/3Δ/ποσότητες το
 * τρέφονται αμετάβλητα. LOCAL mm (centroid = κέντρο κύκλου). Pure.
 *
 * @see ./column-section-outline.ts
 * @see ./column-rebar-layout.ts
 */

import type { Point2D } from '../../../rendering/types/Types';
import type { ColumnReinforcement } from './column-reinforcement-types';
import type { ColumnRebarLayout } from './column-rebar-layout';

/** Τμήματα tessellation του κυκλικού δακτυλίου (λείο σε column scale). */
const CIRCULAR_STIRRUP_SEGMENTS = 48;

/** `n` ισαπέχοντα σημεία σε κύκλο ακτίνας `radius` (αρχή στο +X, CCW). */
function pointsOnCircle(radius: number, n: number, startAngle = 0): Point2D[] {
  if (n <= 0 || radius <= 0) return [];
  const out: Point2D[] = [];
  const step = (2 * Math.PI) / n;
  for (let i = 0; i < n; i++) {
    const a = startAngle + i * step;
    out.push({ x: radius * Math.cos(a), y: radius * Math.sin(a) });
  }
  return out;
}

/**
 * Διάταξη οπλισμού κυκλικής διατομής διαμέτρου `diameterMm`. Επιστρέφει `null` αν η
 * διατομή είναι πολύ μικρή για το cover ή δεν υπάρχει οπλισμός.
 */
export function buildCircularLayout(
  r: ColumnReinforcement,
  diameterMm: number,
): ColumnRebarLayout | null {
  const radius = diameterMm / 2;
  if (radius <= 0) return null;
  const dbL = Math.max(0, r.longitudinal.diameterMm);
  const dbw = Math.max(0, r.stirrups.diameterMm);
  const cover = Math.max(0, r.coverMm);

  // Ακτίνα άξονα δακτυλίου = radius − cover − dbw/2· ακτίνα κέντρων ράβδων εσώτερα.
  const ringRadius = radius - cover - dbw / 2;
  const barRadius = radius - cover - dbw - dbL / 2;
  if (ringRadius <= 0) return null;

  const count = Math.max(0, Math.floor(r.longitudinal.count));
  // Αρχή στο −90° (κάτω) → συμμετρική εμφάνιση· CCW.
  const longitudinalBarsMm = barRadius > 0 ? pointsOnCircle(barRadius, count, -Math.PI / 2) : [];
  const stirrupRingMm = pointsOnCircle(ringRadius, CIRCULAR_STIRRUP_SEGMENTS);
  // Το tessellated κυκλικό μονοπάτι = ΚΑΙ το ring ΚΑΙ το draw path (μηδέν γωνίες).
  const stirrupPathMm = stirrupRingMm.map((p) => ({ x: p.x, y: p.y }));

  return {
    longitudinalBarsMm,
    stirrupRingMm,
    stirrupPathMm,
    stirrupCornerRadiusMm: 0, // κύκλος — καμία γωνία κάμψης
    stirrupHookEndsMm: [],
    barDiameterMm: dbL,
    stirrupDiameterMm: dbw,
    // Ακριβής περιφέρεια άξονα δακτυλίου (το 48-γωνο υποεκτιμά οριακά).
    stirrupCenterlineLengthMm: 2 * Math.PI * ringRadius,
  };
}
