/**
 * ADR-583 Φ2.1 — Scale-bar numeral + unit-label drawing (SRP split).
 *
 * Extracted from `ScaleBarRenderer` so the renderer stays under the 500-line
 * Google limit (N.7.1) and the two concerns are separated: the renderer owns the
 * bar body geometry, this module owns the annotative text.
 *
 * The label strings are ALREADY formatted by the length-format SSoT
 * (`formatLengthForDisplay`, folded inside `computeScaleBarGeometry`) — this
 * module never hardcodes a unit or re-formats a number. It just stamps
 * `geometry.boundaryLabels[i].text` at each major boundary and `geometry.unitText`
 * once past the far end, at the annotative label height.
 *
 * Positions come through the caller's `toScreen(axisOffsetMm, perpOffsetMm)`
 * closure (owns the world rotation + `worldToScreen` Y-flip), so this module is
 * pure canvas stamping with no coordinate math of its own.
 *
 * @see rendering/entities/ScaleBarRenderer.ts — the caller
 * @see config/display-length-format.ts — `formatLengthForDisplay` (the numeral SSoT)
 */

import type { Point2D } from '../../types/Types';
import type { ScaleBarGeometry } from '../../../types/scale-bar';
import { buildUIFont } from '../../../config/text-rendering-config';

/** Below this on-screen cap height a numeral is unreadable — skip drawing labels. */
const MIN_LABEL_SCREEN_PX = 5;

export interface ScaleBarLabelDrawContext {
  readonly ctx: CanvasRenderingContext2D;
  readonly geometry: ScaleBarGeometry;
  /** World-frame mapper: (offset along axis, perpendicular offset) mm → screen px. */
  readonly toScreen: (axisOffsetMm: number, perpOffsetMm: number) => Point2D;
  /** Annotative numeral height in screen px (paper mm × drawingScale × view scale). */
  readonly fontPx: number;
  /** Signed perpendicular offset (model mm) of the label baseline from the bar axis. */
  readonly labelPerpMm: number;
  /** Extra axis gap (model mm) placed before the trailing unit label. */
  readonly unitGapMm: number;
  /** Phase-resolved fill colour (matches the bar body so hover/selection tints uniformly). */
  readonly color: string;
}

/**
 * Stamp each major-boundary numeral + the trailing unit label. No-op when the
 * annotative height collapses below legibility (`MIN_LABEL_SCREEN_PX`).
 */
export function drawScaleBarLabels(rc: ScaleBarLabelDrawContext): void {
  if (rc.fontPx < MIN_LABEL_SCREEN_PX) return;
  const { ctx, geometry } = rc;

  ctx.save();
  ctx.fillStyle = rc.color;
  ctx.font = buildUIFont(rc.fontPx, 'arial', 'normal');
  ctx.textBaseline = 'middle';

  // Major-boundary numerals, centred on each tick.
  ctx.textAlign = 'center';
  for (const label of geometry.boundaryLabels) {
    const anchor = rc.toScreen(label.offsetMm, rc.labelPerpMm);
    ctx.fillText(label.text, anchor.x, anchor.y);
  }

  // Trailing unit label ("m" / "ft" / …), left-aligned just past the far end.
  const unitAnchor = rc.toScreen(geometry.totalModelLengthMm + rc.unitGapMm, rc.labelPerpMm);
  ctx.textAlign = 'left';
  ctx.fillText(geometry.unitText, unitAnchor.x, unitAnchor.y);

  ctx.restore();
}
