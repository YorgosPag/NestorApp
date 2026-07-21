/**
 * BIM composite hover-halo pre-pass — SSoT (ADR-584 / CHECK 3.28 de-dup).
 *
 * The generic per-primitive glow in `PhaseManager.renderWithPhases` loses to the
 * category fill of a FILLED composite (wall footprint, stair treads): each fill
 * paints over the previous primitive's glow, so only the outermost ring survives
 * (regression observed 2026-05-17). AutoCAD/Revit draw the halo for blocks/groups
 * as a single bounding OUTLINE instead. Wall + Stair each ran a byte-identical
 * glow-CONTEXT pre-pass around their own outline call; that boilerplate lives here
 * ONCE — save → kill shadow (GPU-expensive) → glow stroke style + width + opacity +
 * solid dash → restore.
 *
 * Only the outline SHAPE differs between entities (wall inner/outer ring vs stair
 * perimeter), so the caller supplies it via `drawOutline`; the glow context does not.
 *
 * @see systems/phase-manager/PhaseManager.ts — the generic per-primitive glow this
 *      replaces for filled composites (`applyHighlightedStyle` + renderWithPhases).
 */

import type { EntityModel } from '../../rendering/types/Types';
import { HOVER_HIGHLIGHT } from '../../config/color-config';

/**
 * Run `drawOutline` inside the shared BIM hover-glow context (highlighted phase).
 * The stroke width floors the entity's own weight at 1 px then adds the glow's
 * extra width, matching the per-entity pre-pass Wall/Stair previously inlined.
 */
export function drawBimHoverHalo(
  ctx: CanvasRenderingContext2D,
  entity: EntityModel,
  drawOutline: () => void,
): void {
  const entityLineWidth = Math.max(
    1,
    (entity as EntityModel & { lineWidth?: number }).lineWidth || 1,
  );
  ctx.save();
  ctx.shadowBlur = 0;
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = HOVER_HIGHLIGHT.ENTITY.glowColor;
  ctx.lineWidth = entityLineWidth + HOVER_HIGHLIGHT.ENTITY.glowExtraWidth;
  ctx.globalAlpha = HOVER_HIGHLIGHT.ENTITY.glowOpacity;
  ctx.setLineDash([]);
  drawOutline();
  ctx.restore();
}
