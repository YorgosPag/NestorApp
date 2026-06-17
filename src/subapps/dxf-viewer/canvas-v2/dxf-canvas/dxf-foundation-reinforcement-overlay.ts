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
import { isStructuralComponentVisible } from '../../bim/visibility/structural-component-visibility';
import { isHiddenByCutPlane } from '../../bim/visibility/entity-z-extents';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';
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
  // ADR-469 — gate ανά entity (per-element override → per-view flag), όχι early-return.
  const bimSettings = useBimRenderSettingsStore.getState();
  const worldToScreen = (p: Point2D): Point2D =>
    CoordinateTransforms.worldToScreen(p, transform, actualViewport);
  for (const entity of entities) {
    if (entity.type !== 'foundation' || !entity.visible) continue;
    const p = entity.params;
    if (!p.reinforcement) continue;
    // ADR-469 — per-element reinforcement visibility + cut-plane parity.
    if (!isStructuralComponentVisible('reinforcement', entity)) continue;
    if (isHiddenByCutPlane(entity, bimSettings.viewRange, bimSettings.cutPlaneActive)) continue;
    const pxPerMm = mmToSceneUnits(p.sceneUnits ?? 'mm') * transform.scale;
    drawFootingRebar2D(ctx, p, pxPerMm, worldToScreen);
  }
}
