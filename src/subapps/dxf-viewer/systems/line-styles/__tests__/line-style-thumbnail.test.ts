/**
 * ADR-570 Φ1b — buildLineStyleThumbnail unit tests.
 *
 * A line-style swatch = dash pattern (reused from the linetype SSoT) enriched with
 * the style's lineweight (→ px stroke width) and pen color (hex, or `null`=ByLayer).
 */

import { buildLineStyleThumbnail } from '../line-style-thumbnail';
import { LINE_STYLE_BYLAYER_LWT, LINE_STYLE_BYLAYER_PEN } from '../line-style-types';

describe('ADR-570 Φ1b — buildLineStyleThumbnail', () => {
  it('renders a solid (empty-dash) preview for the Continuous pattern', () => {
    const t = buildLineStyleThumbnail('Continuous', 0.25, '#ff0000');
    expect(t.dash).toEqual([]);
    expect(t.width).toBeGreaterThan(0);
    expect(t.height).toBeGreaterThan(0);
  });

  it('produces a non-empty dash array for a dashed pattern (linetype SSoT reuse)', () => {
    const t = buildLineStyleThumbnail('DASHED', 0.5, '#000000');
    expect(t.dash.length).toBeGreaterThan(0);
  });

  it('returns a concrete hex color for a concrete pen', () => {
    const t = buildLineStyleThumbnail('Continuous', 0.35, '#3366ff');
    expect(t.color).toBe('#3366ff');
  });

  it('returns null color for a ByLayer pen (caller uses currentColor)', () => {
    const t = buildLineStyleThumbnail('Continuous', 0.35, LINE_STYLE_BYLAYER_PEN);
    expect(t.color).toBeNull();
  });

  it('maps a heavier lineweight to a wider stroke than a lighter one', () => {
    const thin = buildLineStyleThumbnail('Continuous', 0.13, '#000000');
    const thick = buildLineStyleThumbnail('Continuous', 2.0, '#000000');
    expect(thick.strokeWidth).toBeGreaterThan(thin.strokeWidth);
  });

  it('clamps the stroke width to the fixed-thumb range', () => {
    const t = buildLineStyleThumbnail('Continuous', 99, '#000000');
    expect(t.strokeWidth).toBeLessThanOrEqual(3);
    expect(t.strokeWidth).toBeGreaterThanOrEqual(0.75);
  });

  it('falls back to a default stroke width for the ByLayer lineweight', () => {
    const t = buildLineStyleThumbnail('Continuous', LINE_STYLE_BYLAYER_LWT, '#000000');
    expect(t.strokeWidth).toBeCloseTo(1.25);
  });
});
