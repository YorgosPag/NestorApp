/**
 * ADR-397 §glyph-suppression — SSoT predicate: does the live snap point sit ON a
 * selected entity's 4-arrow MOVE cross?
 *
 * The move cross is drawn AT the entity's move-glyph grip position, so the OSNAP glyph
 * (□/△, drawn at the snap point) covers the handle exactly when the snap point lands on
 * that grip. Move grips are the ONLY grips carrying `moveGlyphFrame` (attached in
 * `grip-registry`), so filtering on it isolates the whole-entity MOVE handles.
 *
 * Big-player parity (Revit/AutoCAD): the OSNAP marker is hidden while it would overlap a
 * gizmo — but the snap ATTRACTION itself is untouched (the click still snaps). This is a
 * pure presentation predicate; it never feeds the attraction path (`mouse-handler-up`).
 *
 * Pure (world point + view scale + grip snapshot) → unit-testable, zero React/DOM/store
 * deps. The caller (`SnapIndicatorSubscriber` leaf) passes `AllGripsStore.get()`.
 *
 * @see components/dxf-layout/canvas-layer-stack-leaves.tsx — SnapIndicatorSubscriber gate
 * @see docs/centralized-systems/reference/adrs/ADR-397-bim-grip-glyph-behavior-ssot.md
 */

import type { Point2D } from '../../rendering/types/Types';
import type { UnifiedGripInfo } from '../../hooks/grips/unified-grip-types';

/**
 * Suppression band (screen px) around a move-grip centre. Snap point and grip position
 * are the SAME characteristic point, so a tight band suppresses ON the cross without
 * swallowing a nearby endpoint/vertex snap of a small selected entity.
 */
export const SNAP_ON_MOVE_CROSS_PX = 10;

/**
 * `true` when `point` (world) coincides — within {@link SNAP_ON_MOVE_CROSS_PX} screen px
 * (converted to world via `scale`) — with any move-glyph grip in `grips`. Returns `false`
 * for a non-positive scale or when no move grip is present.
 */
export function snapCoversMoveCross(
  point: Point2D,
  scale: number,
  grips: ReadonlyArray<UnifiedGripInfo>,
): boolean {
  if (!(scale > 0)) return false;
  const epsWorld = SNAP_ON_MOVE_CROSS_PX / scale;
  const epsSq = epsWorld * epsWorld;
  for (const grip of grips) {
    if (!grip.moveGlyphFrame) continue;
    const dx = point.x - grip.position.x;
    const dy = point.y - grip.position.y;
    if (dx * dx + dy * dy <= epsSq) return true;
  }
  return false;
}
