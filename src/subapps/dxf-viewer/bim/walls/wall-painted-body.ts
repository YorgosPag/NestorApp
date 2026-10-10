/**
 * ADR-458 / ADR-911 Φ3α-4 — το σώμα ενός τοίχου ΟΠΩΣ ΖΩΓΡΑΦΙΖΕΤΑΙ στην κάτοψη. ΕΝΑ SSoT.
 *
 * Ο `WallRenderer` ζωγραφίζει `geometry.displayFootprint ?? δακτύλιο(outerEdge, innerEdge)`. Το
 * `displayFootprint` το παράγουν δύο βήματα, με αυτή τη σειρά:
 *   1. κόψιμο από κολώνες («η κολόνα νικάει») — ο δακτύλιος μείον τα αποτυπώματα των κολωνών·
 *   2. κόψιμο διασταύρωσης Χ — κάθε κομμάτι του ηττημένου μείον το αποτύπωμα του νικητή.
 *
 * Τα βήματα ζούσαν inline στις δύο περάσεις σκηνής (`hooks/canvas/dxf-scene-wall-cutback`,
 * `dxf-scene-wall-wall-cutback`). Η προεπισκόπηση πλήρωσης (ADR-419 «προεπισκόπηση ≡ αποτέλεσμα»)
 * χρειάζεται ΤΟ ΙΔΙΟ σώμα πριν υπάρξει σκηνή αποδόσεως· αν το ξανάγραφε, θα υπήρχαν δύο ορισμοί
 * του «τι ζωγραφίζεται». Εδώ ζει ο ένας: οι περάσεις καλούν τα βήματα, η προεπισκόπηση τη σύνθεση.
 *
 * ΚΑΘΑΡΟ (pure) — zero React/DOM/store. Καμία νέα γεωμετρία: σύνθεση των `buildWallFootprintRing`,
 * `computeMemberCutbackOutline`, `computeWallCrossCutters`.
 *
 * @see ../renderers/wall-render-paths.ts — `traceWallBody` (ο καταναλωτής του σώματος)
 * @see ../geometry/member-column-cutback.ts — η boolean διαφορά
 * @see ./wall-cross-cutback.ts — ποιος νικά σε διασταύρωση
 */

import type { Point2D } from '../../rendering/types/Types';
import type { WallGeometry, WallKind } from '../types/wall-types';
import { buildWallFootprintRing } from '../geometry/wall-geometry';
import { computeMemberCutbackOutline } from '../geometry/member-column-cutback';
import { computeWallCrossCutters, type WallCrossInput } from './wall-cross-cutback';
import { polygonArea } from './perimeter-polygon-math';

/** Ό,τι χρειάζεται το σώμα από έναν τοίχο — το ικανοποιούν και ο `WallEntity` και ο `DxfWall`. */
export interface PaintedBodyWall {
  readonly id: string;
  readonly kind: WallKind;
  readonly params: WallCrossInput['params'];
  readonly geometry: Pick<WallGeometry, 'outerEdge' | 'innerEdge'>;
}

/** Τα κομμάτια ενός σώματος: κλειστοί 2Δ δακτύλιοι. `[]` = ο τοίχος δεν ζωγραφίζεται καθόλου. */
export type WallBodyPieces = Point2D[][];

/** Ο άκοπος δακτύλιος του σώματος (outer εμπρός + inner ανάποδα) — ό,τι ζωγραφίζεται χωρίς κόπτες. */
export function wallBodyRing(wall: PaintedBodyWall): Point2D[] {
  return buildWallFootprintRing(wall.geometry.outerEdge.points, wall.geometry.innerEdge.points);
}

/**
 * Βήμα 1 — κόψιμο από κολώνες. `null` = καμία ουσιαστική τομή ⇒ ζωγραφίζεται ο άκοπος δακτύλιος
 * (ο καλών ΔΕΝ γράφει `displayFootprint`, μηδέν churn).
 */
export function cutWallBodyByColumns(
  wall: PaintedBodyWall,
  columnFootprints: readonly (readonly Point2D[])[],
): WallBodyPieces | null {
  if (columnFootprints.length === 0) return null;
  const ring = wallBodyRing(wall);
  if (ring.length < 3) return null;
  return computeMemberCutbackOutline(ring, columnFootprints);
}

/**
 * Οι κόπτες διασταύρωσης ανά τοίχο (id ηττημένου → αποτυπώματα νικητών). Μόνο ευθύγραμμοι τοίχοι
 * με έγκυρο δακτύλιο συμμετέχουν· κενός χάρτης όταν δεν διασταυρώνεται κανείς.
 */
export function collectWallCrossCutters(walls: readonly PaintedBodyWall[]): Map<string, Point2D[][]> {
  const inputs: WallCrossInput[] = [];
  for (const wall of walls) {
    if (wall.kind !== 'straight') continue;
    const ring = wallBodyRing(wall);
    if (ring.length < 3) continue;
    inputs.push({ id: wall.id, params: wall.params, footprint: ring });
  }
  return computeWallCrossCutters(inputs);
}

/**
 * Βήμα 2 — κόψιμο διασταύρωσης, ΠΑΝΩ στα κομμάτια που άφησε το βήμα 1 (ή στον άκοπο δακτύλιο όταν
 * `columnPieces` απουσιάζει). `null` = οι κόπτες δεν αφαίρεσαν τίποτα ⇒ μένει ό,τι έδωσε το βήμα 1.
 */
export function cutWallBodyByCross(
  wall: PaintedBodyWall,
  columnPieces: readonly (readonly Point2D[])[] | undefined,
  cutters: readonly (readonly Point2D[])[],
): WallBodyPieces | null {
  if (cutters.length === 0) return null;
  const base: Point2D[][] = columnPieces ? columnPieces.map((r) => [...r]) : [wallBodyRing(wall)];
  let changed = false;
  const out: Point2D[][] = [];
  for (const ring of base) {
    const cut = ring.length < 3 ? null : computeMemberCutbackOutline(ring, cutters);
    if (cut === null) { out.push(ring); continue; }
    out.push(...cut);
    changed = true;
  }
  return changed ? out : null;
}

/**
 * Η θέση του μεγαλύτερου (κατ' εμβαδό) κομματιού — εκεί μπαίνει ό,τι είναι ΕΝΑ ανά τοίχο (π.χ. η
 * ετικέτα διαστάσεων της προεπισκόπησης). `-1` όταν δεν υπάρχει κομμάτι. Ισοπαλία → το πρώτο.
 */
export function largestBodyPieceIndex(pieces: readonly (readonly Point2D[])[]): number {
  let best = -1;
  let bestArea = -Infinity;
  pieces.forEach((piece, i) => {
    const area = polygonArea(piece);
    if (area > bestArea) { bestArea = area; best = i; }
  });
  return best;
}

/**
 * Η σύνθεση: για ΚΑΘΕ τοίχο τα κομμάτια του σώματός του όπως θα ζωγραφιστούν ανάμεσα σε αυτούς
 * τους τοίχους και αυτές τις κολώνες — πάντα παρόν (άκοπος τοίχος ⇒ ένας δακτύλιος). Ισοδύναμο
 * με `displayFootprint ?? δακτύλιο` μετά τις δύο περάσεις σκηνής· η ισοδυναμία είναι καρφωμένη
 * (`add-walls-to-scene.test.ts`, Α-3).
 */
export function resolveWallPaintedBodies(
  walls: readonly PaintedBodyWall[],
  columnFootprints: readonly (readonly Point2D[])[],
): Map<string, WallBodyPieces> {
  const crossCutters = collectWallCrossCutters(walls);
  const bodies = new Map<string, WallBodyPieces>();
  for (const wall of walls) {
    const byColumns = cutWallBodyByColumns(wall, columnFootprints);
    const cutters = crossCutters.get(wall.id);
    const byCross = cutters ? cutWallBodyByCross(wall, byColumns ?? undefined, cutters) : null;
    bodies.set(wall.id, byCross ?? byColumns ?? [wallBodyRing(wall)]);
  }
  return bodies;
}
