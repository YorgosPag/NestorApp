/**
 * Preview label paint helpers — pure (this-free) text overlays for the drawing preview.
 * Extracted from `PreviewRenderer` (ADR-065 SRP) so the renderer class stays focused on
 * the frame lifecycle; these two helpers carry no instance state.
 *
 * @see ./PreviewRenderer.ts — ο caller (helpers object + grip dispatch)
 */

import type { Point2D } from '../../rendering/types/Types';
import { renderDistanceLabel, PREVIEW_LABEL_DEFAULTS } from '../../rendering/entities/shared/distance-label-utils';
import { getTextPreviewStyleWithOverride } from '../../hooks/useTextPreviewStyle';
// 🏢 ADR-160 (δ): ΕΝΑΣ measurement-text painter atom — το preview label delegate-άρει
// per-line εδώ αντί για δικό του ctx.fillText loop (μηδέν διπλός painter).
import { paintMeasurementText } from '../../rendering/entities/shared/measurement-label';

/** Distance label between two world points (segment midpoint), using the shared preview defaults. */
export function renderDistanceLabelFromWorld(
  ctx: CanvasRenderingContext2D,
  worldP1: Point2D, worldP2: Point2D, screenP1: Point2D, screenP2: Point2D,
): void {
  renderDistanceLabel(ctx, worldP1, worldP2, screenP1, screenP2, PREVIEW_LABEL_DEFAULTS);
}

/** Multi-line info label below a screen anchor, honouring the user's text-preview style. */
export function renderInfoLabel(
  ctx: CanvasRenderingContext2D, screenPos: Point2D, lines: string[],
): void {
  if (lines.length === 0) return;
  const style = getTextPreviewStyleWithOverride();
  if (!style.enabled) return;

  // Layout stays preview-specific (below-anchor stacking); the actual per-line
  // draw delegates to the shared gated atom so ONE painter owns the drawing.
  const fontSize = parseInt(style.fontSize);
  const lineHeight = fontSize + 4;
  const boxY = screenPos.y + fontSize + 6;
  for (let i = 0; i < lines.length; i++) {
    paintMeasurementText(ctx, lines[i], screenPos.x, boxY + i * lineHeight + lineHeight / 2, { gate: true });
  }
}
