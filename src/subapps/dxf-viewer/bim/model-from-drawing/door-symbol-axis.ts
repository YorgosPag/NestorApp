/**
 * ADR-911 Φ4-1 (§4.6) — η πόρτα ορίζει τον άξονά της.
 *
 * Ένα τόξο κουφώματος δίνει: μεντεσέ (κέντρο), κλειστό άκρο, πλευρά ανοίγματος. Οι λαμπάδες είναι
 * το πρώτο σώμα που συναντά ακτίνα πίσω από τον μεντεσέ και μπροστά από το κλειστό άκρο. Το κενό
 * λαμπά–λαμπά είναι το πλάτος του ανοίγματος (Δ6)· η ακτίνα του τόξου είναι το φύλλο.
 *
 * Καθαρή συνάρτηση: δεν ξέρει τοίχους, μόνο δακτυλίους-εμπόδια. Ποιο από τα δύο άκρα του τόξου
 * είναι το κλειστό δεν δηλώνεται στο DXF — δοκιμάζονται και τα δύο και κρατιέται το στενότερο κενό.
 */

import type { Point2D } from '../../rendering/types/Types';
import type { ArcEntity } from '../../types/entities';
import { MODEL_FROM_DRAWING_LIMITS as LIMITS } from '../../config/tolerance-config';
import {
  addPoints, dotProduct, normalizeVector, pointOnCircle, scalePoint, subtractPoints,
} from '../../rendering/entities/shared/geometry-vector-utils';
import { degToRad } from '../../rendering/entities/shared/geometry-utils';
import { normalizeAngleDeg } from '../../rendering/entities/shared/geometry-angle-utils';
import { locatePointInPolygon } from '../geometry/shared/polygon-point-location';
import { nearestRayHitOnRings } from '../geometry/shared/ray-segment';

/** Εμπόδιο της ακτίνας: δακτύλιος σώματος. `wallId` απών ⇒ κολώνα. */
export interface DoorObstacle {
  readonly ring: readonly Point2D[];
  readonly wallId?: string;
}

export interface DoorJamb {
  /** Το σημείο της λαμπάδας πάνω στη γραμμή του φύλλου (ΧΩΡΙΣ τη μετατόπιση της ακτίνας). */
  readonly point: Point2D;
  readonly dist: number;
  readonly obstacle: DoorObstacle;
}

export interface DoorSymbolSolution {
  readonly hinge: Point2D;
  /** Μοναδιαίο από τον μεντεσέ προς το κλειστό άκρο. */
  readonly u: Point2D;
  /** Μοναδιαίο κάθετο στο `u`, προς την πλευρά που ανοίγει το φύλλο. */
  readonly swing: Point2D;
  readonly leaf: number;
  /** Λαμπάδα πίσω από τον μεντεσέ. */
  readonly back: DoorJamb;
  /** Λαμπάδα μπροστά από το κλειστό άκρο. */
  readonly front: DoorJamb;
  readonly gap: number;
}

export type DoorSymbolResult =
  | { readonly kind: 'solved'; readonly solution: DoorSymbolSolution }
  /** Ο μεντεσές βρίσκεται ήδη μέσα σε σώμα: ο τοίχος περνά συνεχής πίσω από το σύμβολο. */
  | { readonly kind: 'inside-body'; readonly obstacle: DoorObstacle }
  | { readonly kind: 'not-a-door' }
  | { readonly kind: 'no-jamb' };

/** Άνοιγμα τόξου σε μοίρες, ανεξάρτητα από τη φορά σχεδίασης (0–180). */
export function arcSweepDeg(arc: Pick<ArcEntity, 'startAngle' | 'endAngle'>): number {
  const raw = normalizeAngleDeg(arc.endAngle - arc.startAngle);
  return Math.min(raw, 360 - raw);
}

function castJamb(
  from: Point2D, dir: Point2D, inset: Point2D, obstacles: readonly DoorObstacle[], reach: number,
): DoorJamb | null {
  const hit = nearestRayHitOnRings(addPoints(from, inset), dir, obstacles.map((o) => o.ring), reach);
  if (!hit) return null;
  return { point: addPoints(from, scalePoint(dir, hit.dist)), dist: hit.dist, obstacle: obstacles[hit.ringIndex] };
}

function tryClosedEnd(
  arc: ArcEntity, closed: Point2D, open: Point2D, obstacles: readonly DoorObstacle[], scale: number,
): DoorSymbolSolution | DoorObstacle | null {
  const u = normalizeVector(subtractPoints(closed, arc.center));
  const rel = subtractPoints(open, arc.center);
  const swing = normalizeVector(subtractPoints(rel, scalePoint(u, dotProduct(rel, u))));
  const inset = scalePoint(swing, -LIMITS.DOOR_JAMB_RAY_INSET_MM * scale);
  const probe = addPoints(arc.center, inset);
  const inside = obstacles.find((o) => locatePointInPolygon(probe, o.ring) === 'interior');
  if (inside) return inside;
  const reach = LIMITS.DOOR_JAMB_MAX_REACH_MM * scale;
  const back = castJamb(arc.center, scalePoint(u, -1), inset, obstacles, reach);
  const front = castJamb(closed, u, inset, obstacles, reach);
  if (!back || !front) return null;
  return { hinge: arc.center, u, swing, leaf: arc.radius, back, front, gap: back.dist + arc.radius + front.dist };
}

/**
 * Λαμπάδα κολλημένη στον μεντεσέ ή στο άκρο του φύλλου δεν αφήνει χώρο για κάσα: η «λύση» αυτή
 * είναι το φύλλο κάθετο σε τοίχο που περνά δίπλα του. Μετρημένο: μόλις ο τοίχος γεφυρωθεί, το
 * ΛΑΘΟΣ άκρο του τόξου βρίσκει την παρειά του σε 0,4 mm και έδινε δεύτερη, ψεύτικη πόρτα. Μια
 * τέτοια λύση υποχωρεί μπροστά στην ένδειξη «ο μεντεσές είναι μέσα σε σώμα».
 */
function hasRoomForFrame(door: DoorSymbolSolution, scale: number): boolean {
  const min = LIMITS.DOOR_FRAME_MIN_MM * scale;
  return door.back.dist >= min && door.front.dist >= min;
}

const isSolution = (v: DoorSymbolSolution | DoorObstacle): v is DoorSymbolSolution => 'gap' in v;

export function solveDoorSymbol(
  arc: ArcEntity, obstacles: readonly DoorObstacle[], scale: number,
): DoorSymbolResult {
  const sweep = arcSweepDeg(arc);
  if (sweep < LIMITS.DOOR_SWEEP_MIN_DEG || sweep > LIMITS.DOOR_SWEEP_MAX_DEG || arc.radius <= 0) {
    return { kind: 'not-a-door' };
  }
  const ends = [arc.startAngle, arc.endAngle].map((deg) => pointOnCircle(arc.center, arc.radius, degToRad(deg)));
  const tries = [tryClosedEnd(arc, ends[0], ends[1], obstacles, scale), tryClosedEnd(arc, ends[1], ends[0], obstacles, scale)];
  const solved = tries.filter((t): t is DoorSymbolSolution => t !== null && isSolution(t));
  const narrowest = (list: readonly DoorSymbolSolution[]): DoorSymbolResult =>
    ({ kind: 'solved', solution: list.reduce((a, b) => (b.gap < a.gap ? b : a)) });
  const clean = solved.filter((s) => hasRoomForFrame(s, scale));
  if (clean.length > 0) return narrowest(clean);
  const inside = tries.find((t): t is DoorObstacle => t !== null && !isSolution(t));
  if (inside) return { kind: 'inside-body', obstacle: inside };
  return solved.length > 0 ? narrowest(solved) : { kind: 'no-jamb' };
}
