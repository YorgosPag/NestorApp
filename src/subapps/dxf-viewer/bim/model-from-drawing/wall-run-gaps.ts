/**
 * ADR-911 Φ4-3α — τα κενά μιας ομοαξονικής διαδρομής τοίχων που ΔΕΝ έχουν σύμβολο.
 *
 * Δ6: «κενό χωρίς σύμβολο = άνοιγμα προς απόφαση, όχι σιωπηλή πόρτα». Η κάτοψη δείχνει ότι ο
 * τοίχος διακόπτεται· δεν λέει αν εκεί υπάρχει πόρτα, παράθυρο ή αν ο τοίχος απλώς τελειώνει.
 * Εδώ βρίσκονται μόνο τα κενά — το τι είναι το αποφασίζει ο άνθρωπος.
 *
 * Κενό = δύο τοίχοι που το εργαλείο ένωσης θα δεχόταν (`canMergeWalls`), με ελεύθερο διάστημα
 * ανάμεσα στα αντικριστά άκρα τους:
 *   · πλάτος από το κατώφλι περάσματος του ADR-568 ως το μέγιστο κενό ομοαξονικού γείτονα·
 *   · ΤΙΠΟΤΑ μέσα του — ούτε σώμα τρίτου τοίχου, ούτε κολώνα (μετρημένο §4.5: τα κενά των 250 mm
 *     ΕΙΝΑΙ κολώνες, και γεφύρωση εκεί θα περνούσε τοίχο μέσα από κολώνα)·
 *   · κανένα σύμβολο κουφώματος πάνω του (αυτό είναι ήδη πόρτα ή παράθυρο της πρότασης).
 *
 * Σώμα τοίχου ΜΟΝΟ από τα εμπόδια που δίνει ο καλών (`wall-painted-body`) — ίδια με της ακτίνας
 * της λαμπάδας: ό,τι ζωγραφίζεται είναι ό,τι φράζει το κενό.
 */

import type { Point2D } from '../../rendering/types/Types';
import { MODEL_FROM_DRAWING_LIMITS as LIMITS } from '../../config/tolerance-config';
import { locatePointInPolygon } from '../geometry/shared/polygon-point-location';
import { nearestRayHitOnRings } from '../geometry/shared/ray-segment';
import type { WallEntity } from '../types/wall-types';
import { MIN_GAP_FOR_OPENING_MM, canMergeWalls } from '../walls/wall-merge';
import type { DoorObstacle } from './door-symbol-axis';
import type { OpeningSpan } from './opening-host-plan';
import { frameCoords, pointOnFrame, type WallHostFrame } from './wall-host-frame';

export interface WallRunGap {
  /** Οι δύο τοίχοι εκατέρωθεν, με τη σειρά που δόθηκαν. */
  readonly wallIds: readonly [string, string];
  /** Τα δύο αντικριστά άκρα, πάνω στον άξονα του πρώτου τοίχου. */
  readonly span: OpeningSpan;
  readonly widthMm: number;
}

export interface WallRunGapInput {
  readonly walls: ReadonlyMap<string, WallEntity>;
  readonly frameList: readonly WallHostFrame[];
  readonly obstacles: readonly DoorObstacle[];
  /** Σημεία συμβόλων κουφώματος: κενό που περιέχει ένα από αυτά ΕΧΕΙ σύμβολο. */
  readonly claims: readonly Point2D[];
  /** Μονάδες σκηνής ανά mm. */
  readonly scale: number;
  /** Ανοχή κόμβου, σε μονάδες σκηνής. */
  readonly tol: number;
}

interface Interval { readonly lo: number; readonly hi: number }

/** Το ελεύθερο διάστημα ανάμεσα στους δύο τοίχους, πάνω στον άξονα του `a`. `null` = ακουμπούν ή επικαλύπτονται. */
function gapInterval(a: WallHostFrame, b: WallHostFrame): Interval | null {
  const ends = [frameCoords(a, b.origin).along, frameCoords(a, pointOnFrame(b, b.length)).along];
  const bLo = Math.min(...ends);
  const bHi = Math.max(...ends);
  if (bLo >= a.length) return { lo: a.length, hi: bLo };
  if (bHi <= 0) return { lo: bHi, hi: 0 };
  return null;
}

/** Τίποτα μέσα στο κενό: ούτε η αρχή του μέσα σε σώμα, ούτε σύνορο σώματος ως το απέναντι άκρο. */
function isClear(a: WallHostFrame, gap: Interval, rings: readonly (readonly Point2D[])[], tol: number): boolean {
  const origin = pointOnFrame(a, gap.lo + tol);
  const inside = rings.some((ring) => locatePointInPolygon(origin, ring, { boundaryToleranceMm: 0 }) !== 'exterior');
  if (inside) return false;
  return nearestRayHitOnRings(origin, a.u, rings, gap.hi - gap.lo - 2 * tol) === null;
}

function isClaimed(a: WallHostFrame, gap: Interval, claims: readonly Point2D[], tol: number): boolean {
  return claims.some((p) => {
    const { along, across } = frameCoords(a, p);
    return along >= gap.lo - tol && along <= gap.hi + tol && Math.abs(across) <= a.halfThickness + tol;
  });
}

function gapBetween(a: WallHostFrame, b: WallHostFrame, input: WallRunGapInput): WallRunGap | null {
  const wallA = input.walls.get(a.id);
  const wallB = input.walls.get(b.id);
  if (!wallA || !wallB || !canMergeWalls(wallA, wallB).ok) return null;
  const gap = gapInterval(a, b);
  if (!gap) return null;
  const widthMm = (gap.hi - gap.lo) / input.scale;
  if (widthMm < MIN_GAP_FOR_OPENING_MM || widthMm > LIMITS.CONTEXT_AXIS_MAX_GAP_MM) return null;
  // Τα σώματα των ίδιων των δύο τοίχων δεν χρειάζονται εξαίρεση: ο έλεγχος αρχίζει και τελειώνει
  // μια ανοχή ΜΕΣΑ από τα άκρα του κενού, άρα δεν τα αγγίζει (μετρημένο με μετάλλαξη, ADR-911 §12).
  const rings = input.obstacles.map((o) => o.ring);
  if (!isClear(a, gap, rings, input.tol) || isClaimed(a, gap, input.claims, input.tol)) return null;
  return {
    wallIds: [a.id, b.id],
    span: { start: pointOnFrame(a, gap.lo), end: pointOnFrame(a, gap.hi) },
    widthMm,
  };
}

/** Κάθε ζεύγος τοίχων εξετάζεται μία φορά· τοίχος ανάμεσα σε δύο άλλους φράζει το κενό τους. */
export function findWallRunGaps(input: WallRunGapInput): WallRunGap[] {
  const gaps: WallRunGap[] = [];
  input.frameList.forEach((a, i) => {
    for (const b of input.frameList.slice(i + 1)) {
      const gap = gapBetween(a, b, input);
      if (gap) gaps.push(gap);
    }
  });
  return gaps;
}
