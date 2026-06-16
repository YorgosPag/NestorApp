/**
 * ADR-463 — Foundation reinforcement 2Δ scene-level overlay.
 * Extracted from `DxfRenderer.ts` for file-size compliance (<500 lines);
 * behavior-preserving free function (mirror του column reinforcement overlay).
 *
 * @module canvas-v2/dxf-canvas/dxf-foundation-reinforcement-overlay
 * @see ./DxfRenderer.ts
 */

import type { ViewTransform, Viewport, Point2D } from '../../rendering/types/Types';
import type { DxfEntityUnion } from './dxf-types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { isReinforcementVisible } from '../../bim/structural/reinforcement/rebar-visibility';
import { mmToSceneUnits } from '../../utils/scene-units';
import { drawFootingRebar2D } from '../../bim/renderers/footing-rebar-2d';

/**
 * Ζωγραφίζει τον οπλισμό ΟΛΩΝ των θεμελιακών στοιχείων με ορισμένο `reinforcement`,
 * ως scene-level overlay μέσα στο cached normal-state bitmap (mirror του column
 * reinforcement overlay). Καταναλώνει το ΙΔΙΟ geometry SSoT με τα grips/3Δ. No-op
 * όταν ο διακόπτης «Οπλισμός» είναι κλειστός. ADR-040: pure draw, zero subscriptions.
 */
export function drawFoundationReinforcement2D(
  ctx: CanvasRenderingContext2D,
  entities: readonly DxfEntityUnion[],
  transform: ViewTransform,
  actualViewport: Viewport,
): void {
  if (!isReinforcementVisible()) return;
  const worldToScreen = (p: Point2D): Point2D =>
    CoordinateTransforms.worldToScreen(p, transform, actualViewport);
  for (const entity of entities) {
    if (entity.type !== 'foundation' || !entity.visible) continue;
    const p = entity.params;
    if (!p.reinforcement) continue;
    const pxPerMm = mmToSceneUnits(p.sceneUnits ?? 'mm') * transform.scale;
    drawFootingRebar2D(ctx, p, pxPerMm, worldToScreen);
  }
}
