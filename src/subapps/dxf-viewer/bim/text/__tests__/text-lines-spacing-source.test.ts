/**
 * ADR-557 — `resolveLineSpacingRatio` must read the line-spacing factor from the FLAT
 * `lineSpacing.factor` the converters now carry (render EntityModel / DxfText), and still
 * fall back to the nested `textNode.lineSpacing.factor` for raw scene-entity callers. This
 * is the fix for «ribbon Διάστιχο δεν άλλαζε τίποτα»: the converters flattened the textNode
 * away, so the factor was always 1 at render time.
 */

import { describe, it, expect } from '@jest/globals';
import type { DxfText } from '../../../canvas-v2/dxf-canvas/dxf-types';
import { resolveLineSpacingRatio } from '../text-lines';
import { CHARACTER_METRICS } from '../../../config/text-rendering-config';

const BASE = CHARACTER_METRICS.LINE_HEIGHT_RATIO; // 1.2

describe('resolveLineSpacingRatio — factor source (ADR-557)', () => {
  it('reads the FLAT lineSpacing.factor (render EntityModel / converted DxfText)', () => {
    const t = { lineSpacing: { mode: 'multiple', factor: 2 } } as unknown as DxfText;
    expect(resolveLineSpacingRatio(t)).toBeCloseTo(BASE * 2, 9);
  });

  it('falls back to the nested textNode.lineSpacing.factor (raw scene entity)', () => {
    const t = { textNode: { lineSpacing: { mode: 'multiple', factor: 1.5 } } } as unknown as DxfText;
    expect(resolveLineSpacingRatio(t)).toBeCloseTo(BASE * 1.5, 9);
  });

  it('prefers the flat factor over the nested one when both are present', () => {
    const t = {
      lineSpacing: { mode: 'multiple', factor: 2 },
      textNode: { lineSpacing: { mode: 'multiple', factor: 1 } },
    } as unknown as DxfText;
    expect(resolveLineSpacingRatio(t)).toBeCloseTo(BASE * 2, 9);
  });

  it('defaults to the base ratio (factor 1) when neither is present or factor ≤ 0', () => {
    expect(resolveLineSpacingRatio({} as unknown as DxfText)).toBeCloseTo(BASE, 9);
    const bad = { lineSpacing: { mode: 'multiple', factor: 0 } } as unknown as DxfText;
    expect(resolveLineSpacingRatio(bad)).toBeCloseTo(BASE, 9);
  });
});
