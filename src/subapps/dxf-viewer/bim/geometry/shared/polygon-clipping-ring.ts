/**
 * polygon-clipping ring → `Pt2[]` (απλή μετατροπή): pure SSoT.
 *
 * Οι consumers των boolean αποτελεσμάτων (`safeUnion`/`safeDifference`) που θέλουν **σκέτη**
 * μετατροπή ενός ring (`Pair[]`) σε `Pt2[]`, αφαιρώντας ΜΟΝΟ τη διπλή κορυφή κλεισίματος
 * (πρώτη === τελευταία). ΔΕΝ κάνει dedup ενδιάμεσων κορυφών ούτε winding-normalize — γι' αυτό
 * υπάρχει χωριστά το «βαρύ» `ringToPts` (`wall-top-clip-internal.ts`: +CCW +collinear dedup, για
 * top-cap normal +Y). Κεντρικοποιεί το πρώην τριπλό αντίγραφο (finishes silhouette/horizontal/
 * face-profile — ADR-534 Φ7 N.0.2 boy-scout).
 */

import type { Pair, Polygon } from 'polygon-clipping';
import type { Pt2 } from './segment-polygon-coverage';

/** Ring (`Pair[]`) → `Pt2[]`, πετώντας τη διπλή κορυφή κλεισίματος (αν υπάρχει). */
export function pairRingToPt2(ring: readonly Pair[]): Pt2[] {
  const n = ring.length;
  const closed = n > 1 && ring[0][0] === ring[n - 1][0] && ring[0][1] === ring[n - 1][1];
  const lim = closed ? n - 1 : n;
  const out: Pt2[] = [];
  for (let i = 0; i < lim; i++) out.push({ x: ring[i][0], y: ring[i][1] });
  return out;
}

/** Shoelace signed area (units²) ενός ring· **>0 = CCW**. */
export function pt2SignedArea(ring: readonly Pt2[]): number {
  let s = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % ring.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s / 2;
}

/**
 * `Pt2[]` footprint → κλειστό polygon-clipping `Polygon` (ένα ring), **κανονικοποιημένο σε CCW**.
 * Η `polygon-clipping` είναι winding-sensitive — ένα CW ring ερμηνεύεται ως **τρύπα** (π.χ. το beam
 * outline signed-area<0 → το `safeUnion` δεν θα ένωνε το δοκάρι) → CCW-normalize + κλείσιμο ring.
 * ΕΝΑ SSoT (πρώην `footprintToPolygon`/`footprintToClip` — finishes silhouette/horizontal).
 */
export function pt2FootprintToClipPolygon(fp: readonly Pt2[]): Polygon {
  const ccw = pt2SignedArea(fp) < 0 ? [...fp].reverse() : fp;
  const ring: Pair[] = ccw.map((p) => [p.x, p.y]);
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) ring.push([first[0], first[1]]);
  return [ring];
}
