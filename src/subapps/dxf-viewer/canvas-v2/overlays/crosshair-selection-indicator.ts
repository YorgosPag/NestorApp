/**
 * CROSSHAIR SELECTION INDICATOR
 *
 * Draws the AutoCAD-style "+" / "−" badge at the top-right corner of the
 * crosshair center gap to signal add-to-selection / remove-from-selection intent.
 *
 * @module canvas-v2/overlays/crosshair-selection-indicator
 */

/** Which action the indicator signals. */
export type SelectionIndicatorMode = '+' | '−';

/**
 * Draw the selection indicator badge at the top-right of the crosshair aperture.
 *
 * @param ctx   - 2D rendering context (DPR transform already applied by caller)
 * @param cx    - Crosshair center X (CSS pixels, DPR-scaled by ctx transform)
 * @param cy    - Crosshair center Y
 * @param gap   - Half-size of the crosshair center gap in pixels
 * @param mode  - '+' = add to selection (green), '−' = remove (red)
 */
export function drawSelectionIndicator(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  gap: number,
  mode: SelectionIndicatorMode,
): void {
  const size = 11;
  const offset = Math.max(gap, 4) + 2;
  const x = cx + offset + size * 0.5;
  const y = cy - offset - size * 0.5;

  ctx.save();

  // Subtle dark background for contrast on any canvas colour.
  ctx.globalAlpha = 0.82;
  ctx.fillStyle = mode === '+' ? '#0d2b0d' : '#2b0d0d';
  ctx.fillRect(x - size / 2, y - size / 2, size, size);

  // Symbol — bright green (add) or red (remove).
  ctx.globalAlpha = 1.0;
  ctx.fillStyle = mode === '+' ? '#44FF88' : '#FF5555';
  ctx.font = `bold ${size}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(mode, x, y + 0.5);

  ctx.restore();
}
