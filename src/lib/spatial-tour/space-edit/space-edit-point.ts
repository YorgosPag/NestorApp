/**
 * @fileoverview **ΠΟΥ ΠΕΦΤΕΙ ΜΙΑ ΓΩΝΙΑ** — ο ΕΝΑΣ κανόνας για την πένα και τις λαβές του επεξεργαστή χώρων: Shift = ορθή γωνία ·
 * αλλιώς έλξη σε γειτονικούς χώρους · πάντα μέσα στην κάτοψη (ADR-884 Φ2στ-γ Γ3γ-2β · §12 Δ9.5 · Δ9.6). Καθαρό.
 * @related `lib/geometry/planar-snap.ts` (έλξη + ορθογώνιος περιορισμός) · `lib/spatial-tour/tour-plan-frame.ts` (πλαίσιο
 *   κάτοψης: x ανατολή, y βορράς ⇒ η εικόνα καλύπτει y ∈ [−ύψος, 0])
 * @module lib/spatial-tour/space-edit/space-edit-point
 *
 * 🔑 **Η ανοχή έλξης σε PIXEL οθόνης** (Figma): 8 px είναι 8 px σε κάθε ζουμ — σε μέτρα θα ήταν αδύνατη στο 1× και τεράστια στο 5×.
 * 🔑 **Shift ΑΝΤΙ για έλξη, όχι μαζί**: ο άνθρωπος που κρατά Shift ζητά ορθή γωνία· μια έλξη σε λοξή ακμή θα την έσπαγε.
 * 🔑 **Μέσα στην κάτοψη**: γωνία έξω από την εικόνα θα την αρνιόταν ο γραφέας (`space-outside-plan`) — κόβεται εδώ, αθόρυβα.
 */

import { clamp } from '@/lib/geometry/scalar';
import type { PlanarPoint } from '@/lib/geometry/planar-polygon';
import { constrainOrthogonal, snapToRings, type PlanarSnapKind } from '@/lib/geometry/planar-snap';

import type { TourPlanXY } from '../tour-graph-edit';

/** Η ανοχή έλξης σε css px (ίδιο τάγμα με το snap του Figma). */
export const SPACE_SNAP_PX = 8;

export interface SpacePointContext {
  /** Οι δακτύλιοι στους οποίους «κολλά» (οι **άλλοι** χώροι — ποτέ ο ίδιος). */
  readonly rings: readonly (readonly PlanarPoint[])[];
  /** Το σημείο αναφοράς του Shift (η προηγούμενη γωνία της πένας / η αρχική θέση της λαβής) — `null` ⇒ κανένα. */
  readonly shiftFrom: TourPlanXY | null;
  readonly shiftKey: boolean;
  /** Μέτρα ανά css px της επιφάνειας τη στιγμή του γεγονότος. */
  readonly metresPerPx: number;
  /** Το μέγεθος της κάτοψης σε μέτρα. */
  readonly planSize: { readonly width: number; readonly height: number };
}

export interface ResolvedSpacePoint {
  readonly point: TourPlanXY;
  readonly snap: PlanarSnapKind | 'orthogonal';
}

function insidePlan(point: TourPlanXY, size: SpacePointContext['planSize']): TourPlanXY {
  return { x: clamp(point.x, 0, size.width), y: clamp(point.y, -size.height, 0) };
}

/** Η θέση μιας γωνίας από το ωμό σημείο του δείκτη. */
export function resolveSpacePoint(raw: TourPlanXY, ctx: SpacePointContext): ResolvedSpacePoint {
  if (ctx.shiftKey && ctx.shiftFrom !== null) {
    return { point: insidePlan(constrainOrthogonal(ctx.shiftFrom, raw), ctx.planSize), snap: 'orthogonal' };
  }
  const snapped = snapToRings(raw, ctx.rings, SPACE_SNAP_PX * ctx.metresPerPx);
  return { point: insidePlan(snapped.point, ctx.planSize), snap: snapped.kind };
}
