/**
 * Column **Magnet** tiers (ADR-398 §3.13 Polar / §3.15 Cartesian) — pure SSoT.
 *
 * Όταν ο cursor είναι ΕΝΤΟΣ ενός κυκλικού δίσκου (πολικό πλέγμα) ή ορθογωνίου (καρτεσιανό πλέγμα),
 * η κολώνα κουμπώνει στο αντίστοιχο πλέγμα με `anchor:'center'`. Επιστρέφουν `{ snap, dist }` για
 * nearest-wins σύγκριση με τα υπόλοιπα tiers στο `resolveColumnFaceSnapFromTargets`.
 *
 * Reuse `resolvePolarDiskSnap` / `resolveRectCartesianSnap` SSoT — ΜΗΔΕΝ polar/grid math εδώ.
 *
 * @see ./column-face-snap.ts — ο core resolver που τα καταναλώνει (nearest-wins)
 * @see ./polar-disk-snap.ts / ./rect-cartesian-snap.ts — οι grid resolvers
 * @see docs/centralized-systems/reference/adrs/ADR-398-column-placement-snap.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { SceneUnits } from '../../utils/scene-units';
import { resolvePolarDiskSnap, type PolarDiskSnapOptions } from './polar-disk-snap';
import { resolveRectCartesianSnap } from './rect-cartesian-snap';
import type { RectFrame } from '../framing/rect-frame';
import { axisAlignmentRotationDeg, buildCenteredAxisFaceFrame } from './column-face-snap-helpers';
import type { ColumnFaceSnap } from './column-face-snap';

/**
 * ADR-398 §3.13 — **Polar Magnet**: όταν ο cursor είναι ΕΝΤΟΣ κυκλικού δίσκου, η κολώνα κουμπώνει στο
 * πολικό πλέγμα (κέντρο / δακτύλιος∩ακτίνα), `anchor:'center'`. Επιστρέφει + dist για nearest-wins με
 * edge/bbox. `null` όταν λείπει `worldPerPixel` (zoom-adaptive) ή ο cursor είναι κοντά στο χείλος
 * (→ §3.12 circumference). Reuse `resolvePolarDiskSnap` SSoT — ΜΗΔΕΝ polar math εδώ.
 */
export function resolvePolarDiskHit(
  cursor: Readonly<Point2D>,
  disks: readonly { center: Point2D; radius: number }[],
  sceneUnits: SceneUnits,
  opts: Readonly<PolarDiskSnapOptions>,
): { snap: ColumnFaceSnap; dist: number } | null {
  let best: { snap: ColumnFaceSnap; dist: number } | null = null;
  for (const disk of disks) {
    const r = resolvePolarDiskSnap(cursor, disk, sceneUnits, opts);
    if (r && (!best || r.dist < best.dist)) {
      best = {
        snap: { position: r.position, anchor: 'center', status: 'beam', rotation: 0, targetId: null, face: 'N', third: 'mid', faceFrame: r.faceFrame },
        dist: r.dist,
      };
    }
  }
  return best;
}

/**
 * ADR-398 §3.15 — **Cartesian Magnet**: cursor ΕΝΤΟΣ ορθογωνίου → καρτεσιανό πλέγμα (κέντρο / 9-point /
 * grid∩), `anchor:'center'`, rotation = γωνία του u (0 axis-aligned). Τα 4 dx/dy dims παράγονται ξεχωριστά
 * στο `generateColumnPreview` (faceFrame εδώ = degenerate). Reuse `resolveRectCartesianSnap` SSoT.
 */
export function resolveRectHit(
  cursor: Readonly<Point2D>,
  rects: readonly RectFrame[],
  sceneUnits: SceneUnits,
  opts: Readonly<PolarDiskSnapOptions>,
): { snap: ColumnFaceSnap; dist: number } | null {
  let best: { snap: ColumnFaceSnap; dist: number } | null = null;
  for (const rect of rects) {
    const r = resolveRectCartesianSnap(cursor, rect, sceneUnits, opts);
    if (r && (!best || r.dist < best.dist)) {
      best = {
        snap: {
          position: r.position, anchor: 'center', status: 'beam',
          rotation: axisAlignmentRotationDeg(rect.u), targetId: null, face: 'N', third: 'mid',
          faceFrame: buildCenteredAxisFaceFrame(r.position, { x: 1, y: 0 }, { x: 0, y: 1 }, 0, 0, 0),
        },
        dist: r.dist,
      };
    }
  }
  return best;
}
