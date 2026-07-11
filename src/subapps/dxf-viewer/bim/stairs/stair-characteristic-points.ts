/**
 * ADR-597 §stair — Characteristic snap points for a `StairEntity`.
 *
 * Η σκάλα ΔΕΝ έχει ενιαίο footprint (αποτελείται από πολλά σκαλοπάτια), οπότε ΔΕΝ περνά
 * από τον κοινό `footprintPoints` core του dispatcher. Αντ' αυτού συγκεντρώνει, σε
 * world 2D συντεταγμένες:
 *   - **corners** = ΟΛΕΣ οι θέσεις των grips (SSoT `getStairGrips` — «ίδια με τα grips»,
 *     Giorgio 2026-07-11) + οι γωνίες ΚΑΘΕ σκαλοπατιού.
 *   - **midpoints** = τα μέσα των ακμών ΚΑΘΕ σκαλοπατιού.
 *
 * Reuse ΜΟΝΟ υπαρχουσών γεωμετρικών SSoT (`getStairGrips`, `projectVerticesTo2D`,
 * `footprintEdgeMidpoints`) — καμία νέα γεωμετρία, κανένα διπλότυπο. Pure module: μηδέν
 * React / DOM / canvas / Firestore deps.
 *
 * @see bim/utils/bim-characteristic-points.ts — ο dispatcher που το καταναλώνει
 * @see snapping/engines/BimCharacteristicSnapEngine.ts — ο generic snap consumer
 */

import type { Point2D } from '../../rendering/types/Types';
import type { StairEntity, Polygon3D } from '../types/stair-types';
import { getStairGrips } from './stair-grips';
import { projectVerticesTo2D, footprintEdgeMidpoints } from '../geometry/shared/polygon-utils';

/** Οι χαρακτηριστικές θέσεις έλξης μιας σκάλας (χωρίς center — πολλά σκαλοπάτια). */
export interface StairCharPoints {
  readonly corners: Point2D[];
  readonly midpoints: Point2D[];
}

/**
 * ΟΛΕΣ οι walkable επιφάνειες της κάτοψης: σκαλοπάτια (below-cut ∪ above-cut) + πλατύσκαλα
 * (landings). ADR-632 alias trap — το `geometry.treads` είναι legacy alias του
 * `treadsBelowCut`, οπότε ενώνουμε ΡΗΤΑ τα δύο πραγματικά σύνολα (fallback στο `treads` για
 * legacy geometry χωρίς split cut sets). ADR-637 §5 — τα `landings` καλύπτουν τη ΓΩΝΙΑΚΗ
 * περιοχή σε L/U/Γ σκάλες (+ intermediate rest landings)· χωρίς αυτά η γωνιακή γωνία + τα
 * landing σκαλοπάτια δεν πρόσφεραν καθόλου snap points (Giorgio 2026-07-11).
 */
function walkableSurfaces(entity: StairEntity): readonly Polygon3D[] {
  const g = entity.geometry;
  const below = g.treadsBelowCut ?? g.treads ?? [];
  const above = g.treadsAboveCut ?? [];
  const landings = g.landings ?? [];
  return [...below, ...above, ...landings];
}

/**
 * Χαρακτηριστικά σημεία έλξης μιας σκάλας: grip θέσεις + γωνίες/μέσα ΚΑΘΕ σκαλοπατιού.
 */
export function getStairCharacteristicPoints(entity: StairEntity): StairCharPoints {
  const corners: Point2D[] = getStairGrips(entity).map((grip) => grip.position);
  const midpoints: Point2D[] = [];
  for (const surface of walkableSurfaces(entity)) {
    // Τα vertices είναι bare `Point3D[]` σε winding order → projection + preOrdered ώστε
    // γωνίες/μέσα να μη «σπάνε» σε μη-κυρτά (landings μπορεί να είναι L/Γ, ADR-597 §non-convex).
    const verts2d = projectVerticesTo2D(surface);
    corners.push(...verts2d);
    midpoints.push(...footprintEdgeMidpoints(verts2d, { preOrdered: true }));
  }
  return { corners, midpoints };
}
