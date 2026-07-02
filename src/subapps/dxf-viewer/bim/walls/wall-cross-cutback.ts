/**
 * ADR-458 (wall↔wall cross extension) — Priority-based **wall↔wall cross-junction** cutback.
 *
 * Όταν δύο τοίχοι **διασταυρώνονται** (σχήμα Χ: ο ένας περνά ΔΙΑΜΕΣΟΥ του άλλου, το σημείο τομής
 * είναι ΕΣΩΤΕΡΙΚΟ και στους δύο άξονες), τα solids επικαλύπτονται στη ΜΕΣΗ. Το `wall-trims.ts`
 * ρητά το παρατάει (`cross → skip`) γιατί δεν είναι endpoint-junction — δεν διορθώνεται με
 * miter/bevel άκρου. Οι μεγάλοι (Revit «Join Geometry» / ArchiCAD priority) το λύνουν με
 * **priority boolean cleanup**: ο υψηλότερης προτεραιότητας ΝΙΚΑΕΙ (μένει ακέραιος)· ο χαμηλότερος
 * ΚΟΒΕΤΑΙ στην κοινή περιοχή (net volume — η επικάλυψη μετριέται ΜΙΑ φορά, ανήκει στον νικητή).
 *
 * Αυτό το module κάνει ΜΟΝΟ τη διάγνωση: για κάθε τοίχο επιστρέφει τα **cutter footprints** των
 * τοίχων που (α) τον διασταυρώνουν γνήσια ΚΑΙ (β) κερδίζουν την προτεραιότητα. Οι consumers (2Δ
 * κάτοψη + BOQ + 3Δ) τα τροφοδοτούν στο ΥΠΑΡΧΟΝ generic SSoT `member-column-cutback`
 * (`computeMemberCutbackOutline` / `computeMemberCutbackRetentionRatio`) — μηδέν νέα boolean
 * geometry, ίδιος μηχανισμός με το wall↔column cutback (η κολόνα = «άπειρη» προτεραιότητα).
 *
 * **Γιατί μόνο CROSS (interior-interior):** corners (L) + T-junctions τα χειρίζεται ήδη το
 * `wall-trims` (miter/bevel άκρων). Αν αφαιρούσαμε τον νικητή και εκεί, θα συγκρουόμασταν με το
 * miter. Το κριτήριο cross είναι ίδιο με του `wall-trims.classifyPair` (t,u εσωτερικά) → μηδέν
 * επικάλυψη ευθυνών.
 *
 * Pure module: zero React / DOM / Firestore / three.js. Idempotent. DERIVED — ΠΟΤΕ persisted.
 *
 * @see bim/geometry/member-column-cutback.ts — generic boolean-difference SSoT (consumers)
 * @see bim/walls/wall-trims.ts — endpoint junctions (corner/T)· cross παρέμενε skip
 */

import type { WallParams } from '../types/wall-types';
import { WALL_JOIN_PRIORITY_BY_CATEGORY } from '../types/wall-types';
import type { Pt2 } from '../geometry/shared/segment-polygon-coverage';
import { mmToSceneUnits } from '../../utils/scene-units';
import { lineLineIntersect, sinAngleBetween } from './wall-trims-geometry';
import { JOIN_THRESHOLD_MM } from './wall-trims';

/** Near-parallel guard (sin < this ⇒ overlap is a sliver, handled by trims, not a clean cross). */
const MIN_CROSS_SIN = 1e-3;

/**
 * Minimal wall shape the cross-cutback needs — id (tiebreak), the axis + scene unit + priority
 * inputs (`WallParams` subset), and the wall's plan footprint ring (world units). Both the 2Δ
 * (`DxfWall`) and BOQ (`WallEntity`) callers adapt to this shape.
 */
export interface WallCrossInput {
  readonly id: string;
  readonly params: Pick<WallParams, 'start' | 'end' | 'sceneUnits' | 'category' | 'joinPriority'>;
  /** Plan footprint ring (outer fwd + inner reversed), world/canvas units. */
  readonly footprint: readonly Pt2[];
}

/**
 * Effective join priority: explicit `joinPriority` override wins, else the category default
 * (`WALL_JOIN_PRIORITY_BY_CATEGORY`). Higher number wins at a cross.
 */
export function resolveWallJoinPriority(
  params: Pick<WallParams, 'joinPriority' | 'category'>,
): number {
  return params.joinPriority ?? WALL_JOIN_PRIORITY_BY_CATEGORY[params.category];
}

/**
 * At a CROSS junction, which wall WINS (stays whole)? Higher `joinPriority` wins; on a tie the
 * wall with the smaller id wins — deterministic & stable so neither the plan nor the take-off
 * flickers between re-derives. Never returns a "both lose" state.
 */
export function resolveWallCrossWinnerId(a: WallCrossInput, b: WallCrossInput): string {
  const pa = resolveWallJoinPriority(a.params);
  const pb = resolveWallJoinPriority(b.params);
  if (pa !== pb) return pa > pb ? a.id : b.id;
  return a.id <= b.id ? a.id : b.id;
}

/**
 * True iff A,B form a genuine X-crossing: their axes intersect at a point INTERIOR to both
 * (not a corner endpoint, not a T-stem). Mirrors the `wall-trims.classifyPair` interior test so
 * corner/T junctions (owned by `wall-trims`) are excluded.
 */
export function isWallCrossPair(a: WallCrossInput, b: WallCrossInput): boolean {
  const a1 = a.params.start, a2 = a.params.end;
  const b1 = b.params.start, b2 = b.params.end;
  const lenA = Math.hypot(a2.x - a1.x, a2.y - a1.y);
  const lenB = Math.hypot(b2.x - b1.x, b2.y - b1.y);
  const sA = mmToSceneUnits(a.params.sceneUnits ?? 'mm');
  const sB = mmToSceneUnits(b.params.sceneUnits ?? 'mm');
  if (lenA < sA || lenB < sB) return false; // degenerate (≥1mm in scene units)

  const isect = lineLineIntersect(a1.x, a1.y, a2.x, a2.y, b1.x, b1.y, b2.x, b2.y);
  if (!isect) return false;
  const sinA = sinAngleBetween(a2.x - a1.x, a2.y - a1.y, b2.x - b1.x, b2.y - b1.y);
  if (sinA < MIN_CROSS_SIN) return false;

  const joinThreshold = JOIN_THRESHOLD_MM * sA; // uniform scale assumed (mirror wall-trims)
  const epsA = joinThreshold / lenA;
  const epsB = joinThreshold / lenB;
  const tInterior = isect.t > epsA && isect.t < 1 - epsA;
  const uInterior = isect.u > epsB && isect.u < 1 - epsB;
  return tInterior && uInterior;
}

/**
 * Per-wall CUTTER footprints for the cross cutback. For each wall id → the plan footprints of
 * every OTHER wall that genuinely crosses it AND wins the priority contest. Winners collect no
 * cutters from their losers (they stay whole). Only walls with ≥1 cutter appear in the map.
 *
 * Feed the returned cutters into `computeMemberCutbackOutline` (2Δ/3Δ display) or
 * `computeMemberCutbackRetentionRatio` (BOQ net area/volume) — the same SSoT that already
 * powers wall↔column cutback.
 *
 * O(n²) pairwise (n = straight walls in the level) with a cheap length/angle reject; negligible
 * for realistic floor plans. Idempotent.
 */
export function computeWallCrossCutters(
  walls: readonly WallCrossInput[],
): Map<string, Pt2[][]> {
  const result = new Map<string, Pt2[][]>();
  if (walls.length < 2) return result;

  for (let i = 0; i < walls.length; i++) {
    for (let j = i + 1; j < walls.length; j++) {
      const a = walls[i], b = walls[j];
      if (a.footprint.length < 3 || b.footprint.length < 3) continue;
      if (!isWallCrossPair(a, b)) continue;
      const winnerId = resolveWallCrossWinnerId(a, b);
      const winner = winnerId === a.id ? a : b;
      const loser = winner === a ? b : a;
      const cutters = result.get(loser.id) ?? [];
      cutters.push(winner.footprint.map((p) => ({ x: p.x, y: p.y })));
      result.set(loser.id, cutters);
    }
  }
  return result;
}
