/**
 * Polyline arc-length frame sampler — geometry SSoT (ADR-471 Slice 2).
 *
 * ΕΝΑ μέρος που, δοθείσας μιας polyline (καμπύλη/τεθλασμένη) και μιας απόστασης
 * `distance` κατά μήκος της (arc-length), επιστρέφει το **τοπικό πλαίσιο** εκεί:
 * σημείο + μοναδιαίο εφαπτόμενο (κατά την αύξουσα απόσταση) + μοναδιαίο κάθετο
 * (CCW 90° του εφαπτομένου). Αυτό είναι το θεμέλιο για κάθε «κατά-μήκος +
 * εγκάρσια-μετατόπιση» τοποθέτηση (path-relative local→world):
 *
 *   world(u, v) = frame(u).point + v · frame(u).normal
 *
 * Χρησιμοποιείται από τον οπλισμό δοκού (2Δ `beam-rebar-2d`, 3Δ `beam-rebar-3d`):
 * u = θέση κατά τον άξονα, v = εγκάρσια θέση διατομής. Pure — zero deps πέρα από
 * τον τύπο `Point2D`. Units-agnostic: ο caller δίνει σημεία ΚΑΙ απόσταση στο ΙΔΙΟ
 * σύστημα μονάδων (π.χ. canvas units). Η railing geometry έχει δικά της private
 * `pointAtDistance`/`angleAtDistance` (Point3D + z, ξεχωριστά) — μελλοντική
 * μετανάστευση σε αυτόν τον SSoT είναι ratchet item (δες pending-ratchet-work).
 *
 * @see ../../structural/reinforcement/beam-rebar-layout.ts — ο καταναλωτής (LOCAL mm)
 */

import type { Point2D } from '../../../rendering/types/Types';
import { clamp01 } from '../../../utils/scalar-math';

/** Τοπικό πλαίσιο σε σημείο της polyline (όλα στο σύστημα μονάδων του caller). */
export interface PolylineFrame {
  /** Σημείο στην polyline στην απόσταση `distance`. */
  readonly point: Point2D;
  /** Μοναδιαίο εφαπτόμενο (κατεύθυνση αύξουσας απόστασης). */
  readonly tangent: Point2D;
  /** Μοναδιαίο κάθετο = CCW 90° του εφαπτομένου ((−ty, tx)). */
  readonly normal: Point2D;
}

/** Συνολικό μήκος polyline (άθροισμα ευκλείδειων ακμών). 0 για <2 σημεία. */
export function polylineLength(points: readonly Point2D[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  }
  return total;
}

/** Μοναδιαίο εφαπτόμενο της ακμής a→b· (1,0) για εκφυλισμένη ακμή. */
function segmentTangent(a: Point2D, b: Point2D): Point2D {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  if (len <= 1e-12) return { x: 1, y: 0 };
  return { x: dx / len, y: dy / len };
}

/**
 * Δειγματοληπτεί το πλαίσιο της polyline στην απόσταση `distance` (clamped στο
 * [0, μήκος]). Επιστρέφει `null` αν η polyline έχει <2 σημεία. Εκφυλισμένες ακμές
 * (μηδενικού μήκους) προσπερνώνται για το εφαπτόμενο — ώστε το tangent να μην
 * «κολλάει» σε διπλό σημείο.
 */
export function samplePolylineFrame(
  points: readonly Point2D[],
  distance: number,
): PolylineFrame | null {
  if (points.length < 2) return null;

  let acc = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    // Τελευταία ακμή ⇒ κρατά το υπόλοιπο (clamp στο τέλος).
    if (acc + segLen >= distance || i === points.length - 1) {
      const t = segLen <= 1e-12 ? 0 : clamp01((distance - acc) / segLen);
      const tangent = segmentTangent(a, b);
      return {
        point: { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t },
        tangent,
        normal: { x: -tangent.y, y: tangent.x },
      };
    }
    acc += segLen;
  }
  // Μη-προσβάσιμο (το loop επιστρέφει στην τελευταία ακμή) — defensive.
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  const tangent = segmentTangent(prev, last);
  return { point: { ...last }, tangent, normal: { x: -tangent.y, y: tangent.x } };
}
