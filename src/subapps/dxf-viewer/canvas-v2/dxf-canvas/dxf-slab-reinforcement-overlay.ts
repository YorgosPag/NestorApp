/**
 * ADR-476 — Slab reinforcement 2Δ scene-level overlay.
 * Mirror του `dxf-foundation-reinforcement-overlay.ts` — behavior-preserving free
 * function. Ζωγραφίζει τις σχάρες ΟΛΩΝ των πλακών (εδαφόπλακα + αναρτημένη) με
 * ορισμένο `structuralReinforcement`, μέσα στο cached normal-state bitmap.
 *
 * ⚠️ Η πλάκα είναι **wrapper** (`entity.slabEntity.params`, όχι flat `entity.params`).
 * Το per-element visibility override ζει στο `slabEntity` (BimEntity)· το cut-plane
 * z-extent στο wrapper (entity-z-extents `case 'slab'`).
 *
 * @module canvas-v2/dxf-canvas/dxf-slab-reinforcement-overlay
 * @see ./dxf-foundation-reinforcement-overlay.ts
 * @see docs/centralized-systems/reference/adrs/ADR-476-unified-slab-reinforcement.md
 */

import type { ViewTransform, Viewport, Point2D } from '../../rendering/types/Types';
import type { DxfEntityUnion } from './dxf-types';
import { CoordinateTransforms } from '../../rendering/core/CoordinateTransforms';
import { isStructuralComponentVisible } from '../../bim/visibility/structural-component-visibility';
import { isHiddenByCutPlane } from '../../bim/visibility/entity-z-extents';
import { useBimRenderSettingsStore } from '../../state/bim-render-settings-store';
import { mmToSceneUnits } from '../../utils/scene-units';
import { drawSlabRebar2D } from '../../bim/renderers/slab-rebar-2d';

/**
 * Ζωγραφίζει τον οπλισμό ΟΛΩΝ των πλακών με ορισμένο `structuralReinforcement`, ως
 * scene-level overlay (mirror foundation overlay). Καταναλώνει το ΙΔΙΟ geometry SSoT
 * με grips/3Δ. No-op όταν ο διακόπτης «Οπλισμός» είναι κλειστός. ADR-040: pure draw,
 * zero subscriptions.
 */
export function drawSlabReinforcement2D(
  ctx: CanvasRenderingContext2D,
  entities: readonly DxfEntityUnion[],
  transform: ViewTransform,
  actualViewport: Viewport,
): void {
  const bimSettings = useBimRenderSettingsStore.getState();
  const worldToScreen = (p: Point2D): Point2D =>
    CoordinateTransforms.worldToScreen(p, transform, actualViewport);
  for (const entity of entities) {
    if (entity.type !== 'slab' || !entity.visible) continue;
    const slab = entity.slabEntity;
    if (!slab.params.structuralReinforcement) continue;
    // ADR-470 — per-element reinforcement visibility (στο slabEntity) + cut-plane parity.
    if (!isStructuralComponentVisible('reinforcement', slab)) continue;
    if (isHiddenByCutPlane(entity, bimSettings.viewRange, bimSettings.cutPlaneActive)) continue;
    const pxPerMm = mmToSceneUnits(slab.params.sceneUnits ?? 'mm') * transform.scale;
    drawSlabRebar2D(ctx, slab, pxPerMm, worldToScreen);
  }
}
