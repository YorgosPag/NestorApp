/**
 * ADR-565 §12 / Φ1.x — Curved-wall draw-variant geometry resolver (pure SSoT).
 *
 * ΕΝΑ σημείο που μετατρέπει το FSM state ενός arc draw-variant + το τελικό σημείο του χρήστη σε
 * `{ start, end, bulge }` — το canonical σχήμα που τρέφει το `buildWallEntity('curved', { arc })`
 * (preview ≡ commit). Όλη η arc math γίνεται reuse από το `wall-arc-descriptor.ts`:
 *   - '3-point' / 'start-end-radius' (click path) → `bulgeFrom3Points`
 *   - 'center-ends'                               → `bulgeFromCenterStartEnd`
 *   - 'tangent'                                   → `bulgeFromTangent`
 *
 * `bulge === null` σημαίνει «εκφυλισμένο» (collinear / degenerate) → ο caller κάνει fallback
 * (Bézier `curveControl` ή ευθύ τοίχο), ώστε η χειρονομία να μην αποτυγχάνει ποτέ.
 *
 * @see ./wall-arc-descriptor.ts — bulge math SSoT
 */

import type { Point2D } from '../../rendering/types/Types';
import type { WallArcVariant, WallEntity } from '../types/wall-types';
import {
  bulgeFrom3Points,
  bulgeFromCenterStartEnd,
  bulgeFromTangent,
} from './wall-arc-descriptor';

/** Το ελάχιστο FSM state που χρειάζεται ο resolver (start/end/center + variant). */
export interface CurvedDrawState {
  readonly arcVariant: WallArcVariant;
  readonly startPoint: Point2D | null;
  readonly endPoint: Point2D | null;
  readonly arcCenter: Point2D | null;
}

/** Το κανονικοποιημένο αποτέλεσμα: chord (start→end) + signed bulge (`null` = εκφυλισμένο). */
export interface CurvedArcParams {
  readonly start: Point2D;
  readonly end: Point2D;
  readonly bulge: number | null;
}

/**
 * Επίλυσε το arc `{ start, end, bulge }` για το CLICK path του τελικού σημείου, ανά variant.
 * Returns `null` όταν λείπουν τα απαιτούμενα σημεία του variant (defensive· ο caller ήδη gate-άρει
 * τη φάση). `tangentDirRad` απαιτείται μόνο για το 'tangent' variant (world radians)· `null` εκεί →
 * `bulge=null` (fallback σε ευθύ).
 */
export function resolveCurvedArcParams(
  s: CurvedDrawState,
  finalPoint: Readonly<Point2D>,
  tangentDirRad: number | null = null,
): CurvedArcParams | null {
  const final: Point2D = { x: finalPoint.x, y: finalPoint.y };
  switch (s.arcVariant) {
    case 'center-ends': {
      if (!s.arcCenter || !s.startPoint) return null;
      const r = bulgeFromCenterStartEnd(s.arcCenter, s.startPoint, final);
      if (!r) return null;
      return { start: s.startPoint, end: r.endPoint, bulge: r.bulge };
    }
    case 'tangent': {
      if (!s.startPoint) return null;
      const bulge = tangentDirRad != null ? bulgeFromTangent(s.startPoint, final, tangentDirRad) : null;
      return { start: s.startPoint, end: final, bulge };
    }
    // '3-point' + 'start-end-radius' (click path): finalPoint = σημείο πάνω στο τόξο.
    default: {
      if (!s.startPoint || !s.endPoint) return null;
      return { start: s.startPoint, end: s.endPoint, bulge: bulgeFrom3Points(s.startPoint, final, s.endPoint) };
    }
  }
}

/**
 * ADR-565 Φ1.x «εφαπτομενικό» — η κατεύθυνση εφαπτομένης (world radians) στην οποία ο νέος τοίχος
 * ΣΥΝΕΧΙΖΕΙ, αν το `point` πέφτει (εντός `tol`) πάνω σε άκρο υπάρχοντος τοίχου. Straight → κατεύθυνση
 * του άξονα προς τα έξω· curved → arc tangent στο άκρο (reuse του `arc` bulge). `null` αν κανένα άκρο
 * δεν ταιριάζει (τότε ο resolver πέφτει σε ευθύ). Το επιστρεφόμενο διάνυσμα δείχνει ΜΑΚΡΙΑ από τον
 * υπάρχοντα τοίχο (η φυσική φορά συνέχειας).
 */
export function wallEndTangentAt(
  walls: readonly WallEntity[],
  point: Readonly<Point2D>,
  tol: number,
): number | null {
  const tolSq = tol * tol;
  for (const w of walls) {
    const { start, end } = w.params;
    const arc = w.params.arc ?? 0;
    const atStart = distSq(point, start) <= tolSq;
    const atEnd = distSq(point, end) <= tolSq;
    if (!atStart && !atEnd) continue;
    // Chord direction of the axis (start→end).
    const chord = Math.atan2(end.y - start.y, end.x - start.x);
    if (Math.abs(arc) < 1e-9) {
      // Straight: outward tangent = away from the wall body.
      return atEnd ? chord : chord + Math.PI;
    }
    // Curved (bulge): the tangent at an endpoint deviates from the chord by ±sweep/2.
    // sweep = 4·atan(bulge); at `start` the tangent = chord + sweep/2, at `end` = chord − sweep/2.
    const halfSweep = 2 * Math.atan(arc);
    if (atEnd) return chord - halfSweep;          // continue forward past `end`
    return chord + halfSweep + Math.PI;           // continue backward past `start` (reversed)
  }
  return null;
}

function distSq(a: Readonly<Point2D>, b: Readonly<Point2D>): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}
