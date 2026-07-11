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
 * ΟΛΑ τα σκαλοπάτια της κάτοψης: below-cut ∪ above-cut. ADR-632 alias trap — το
 * `geometry.treads` είναι legacy alias του `treadsBelowCut`, οπότε ενώνουμε ΡΗΤΑ τα δύο
 * πραγματικά σύνολα (fallback στο `treads` για legacy geometry χωρίς split cut sets).
 */
function allTreads(entity: StairEntity): readonly Polygon3D[] {
  const g = entity.geometry;
  const below = g.treadsBelowCut ?? g.treads ?? [];
  const above = g.treadsAboveCut ?? [];
  return [...below, ...above];
}

/**
 * Χαρακτηριστικά σημεία έλξης μιας σκάλας: grip θέσεις + γωνίες/μέσα ΚΑΘΕ σκαλοπατιού.
 */
export function getStairCharacteristicPoints(entity: StairEntity): StairCharPoints {
  const corners: Point2D[] = getStairGrips(entity).map((grip) => grip.position);
  const midpoints: Point2D[] = [];
  for (const tread of allTreads(entity)) {
    // Τα tread vertices είναι bare `Point3D[]` σε winding order → projection + preOrdered
    // ώστε γωνίες/μέσα να μη «σπάνε» σε μη-κυρτά (σπάνιο για tread, αλλά συνεπές με ADR-597).
    const verts2d = projectVerticesTo2D(tread);
    corners.push(...verts2d);
    midpoints.push(...footprintEdgeMidpoints(verts2d, { preOrdered: true }));
  }
  return { corners, midpoints };
}
