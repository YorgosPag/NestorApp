/**
 * ADR-561 — Plain DXF CIRCLE grip SSoT (pure helpers).
 *
 * The SINGLE source of truth for a `circle` primitive's grips, consumed by BOTH
 * grip paths so they can never diverge (mirror `systems/line/line-grips.ts` ↔
 * `LineRenderer.getGrips`, and `bim/text/text-grips.ts` ↔ `TextRenderer.getGrips`):
 *   - `computeDxfEntityGrips` (case 'circle') → interaction + hit-testing.
 *   - `CircleRenderer.getGrips`               → on-canvas 2D grip painting.
 *
 * Before this module the circle grips were hand-emitted in those two places, so
 * the centre grip rendered a plain square with no directional MOVE affordance.
 *
 * The circle is geometrically SYMMETRIC → it gets ONLY a move cross, NO rotation
 * handle (a rotation would be a visual no-op; parity με την κυκλική κολόνα
 * ADR-519 που εκπέμπει μόνο center-move, Giorgio 2026-07-01). The centre grip
 * carries `gripKind: { on:'circle', kind:'circle-move' }` so the shared registry gives it the
 * 4-arrow MOVE glyph and the per-arm directional move-by-value runs (ADR-397 Φ2);
 * the whole-entity translate is the existing `movesEntity` path — NO new commit.
 *
 * Zero React / DOM / Firestore / canvas deps.
 *
 * @see bim/grips/grip-glyph-registry.ts — `'circle-move' → 'move'`
 * @see docs/centralized-systems/reference/adrs/ADR-561-move-rotate-grips-primitives.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { GripInfo, CircleGripKind } from '../../hooks/grip-types';

/** The single circle MOVE grip kind (mirror `line-move` / `wall-midpoint`). */
export const CIRCLE_MOVE_KIND: CircleGripKind = 'circle-move';

/**
 * The 4 cardinal (quadrant) points on the circumference, in E/N/W/S order. Shared
 * so interaction + render place the radius-edit handles identically.
 */
export function circleQuadrantPoints(center: Point2D, radius: number): Point2D[] {
  return [
    { x: center.x + radius, y: center.y }, // East
    { x: center.x, y: center.y + radius }, // North
    { x: center.x - radius, y: center.y }, // West
    { x: center.x, y: center.y - radius }, // South
  ];
}

/**
 * The 5 grips of a plain DXF circle — the SSoT both grip paths consume:
 *   0     → centre (whole-circle translate; `'circle-move'` → 4-arrow MOVE glyph +
 *           per-arm directional distance prompt). `movesEntity` keeps it ORTHO-eligible.
 *   1..4  → quadrant handles (radius edit), typed `'quadrant'` so the «Εμφάνιση
 *           Quadrants» toggle gates them in BOTH render + hit-test (ADR-559).
 *
 * Returns the hooks `GripInfo`; the 2D renderer maps each to its render `GripInfo`
 * (+`shape` via `gripGlyphShape`) — see `CircleRenderer.getGrips`.
 */
export function getCircleGrips(entityId: string, center: Point2D, radius: number): GripInfo[] {
  const grips: GripInfo[] = [
    {
      entityId, gripIndex: 0, type: 'center',
      position: center, movesEntity: true,
      gripKind: { on: 'circle', kind: CIRCLE_MOVE_KIND },
    },
  ];
  circleQuadrantPoints(center, radius).forEach((position, i) => {
    grips.push({ entityId, gripIndex: i + 1, type: 'quadrant', position, movesEntity: false });
  });
  return grips;
}
