/**
 * @file grip-type-visibility.ts
 * @description 🏢 SSoT — the ONE predicate that decides whether a grip of a given TYPE is visible,
 * given the user's grip-type preferences («Εμφάνιση Midpoints/Centers/Quadrants»).
 *
 * Before this, the per-type filter lived ONLY in `grip-registry.ts` (hit-test/snap) as scattered
 * inline checks (`!showMidpoints && type === 'edge'` …) — and `showQuadrants` was honoured NOWHERE.
 * The VISIBLE render path (`BaseEntityRenderer.renderPhaseGrips → GripPhaseRenderer`) applied no
 * type filter at all, so the three «Grip Types» toggles had no visible effect. This predicate is
 * the single rule both paths now call (AutoCAD-style endpoint grips always show; only the
 * midpoint/center/quadrant *helper* grips are gated).
 *
 * Type mapping (the grip taxonomy uses `'edge'` for midpoint grips, `'quadrant'` for circle/ellipse
 * cardinal points; real endpoints/control points are `'vertex'|'corner'|'control'` and always show):
 *   • center               → showCenters
 *   • quadrant             → showQuadrants
 *   • midpoint | edge      → showMidpoints
 *   • vertex|corner|control→ always visible
 */

import type { GripInfo } from '../../rendering/types/Types';

/** The user-facing grip-type display preferences (subset of the grip style). */
export interface GripTypeVisibilityFlags {
  showMidpoints: boolean;
  showCenters: boolean;
  showQuadrants: boolean;
}

/**
 * True ⇒ a grip of `type` should be shown / picked under the given preferences.
 * Pure + idempotent: same inputs → same result, no side effects.
 */
export function isGripTypeVisible(
  type: GripInfo['type'],
  flags: GripTypeVisibilityFlags
): boolean {
  switch (type) {
    case 'center':
      return flags.showCenters;
    case 'quadrant':
      return flags.showQuadrants;
    case 'midpoint':
    case 'edge':
      return flags.showMidpoints;
    default:
      // 'vertex' | 'corner' | 'control' — structural endpoints, always shown (AutoCAD parity).
      return true;
  }
}
