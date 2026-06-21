/**
 * ADR-507 Φ2 — hatch lineweight resolution (AutoCAD LWT).
 *
 * resolveHatchLineWidthPx: concrete mm → zoom-independent px (mm→px SSoT)·
 * ByLayer/undefined → ιστορικό fallback (zero regression). Leaf module → χωρίς
 * το βαρύ render import chain.
 */

import {
  resolveHatchLineWidthPx,
  DEFAULT_HATCH_LINE_WIDTH_PX,
} from '../hatch-properties';
import { lineweightToPx, LINEWEIGHT_SPECIAL } from '../../../config/lineweight-iso-catalog';
import type { LineweightMm } from '../../../types/entities';

describe('resolveHatchLineWidthPx', () => {
  it('concrete mm → lineweightToPx (zoom-independent)', () => {
    expect(resolveHatchLineWidthPx(0.5 as LineweightMm)).toBeCloseTo(lineweightToPx(0.5), 5);
    expect(resolveHatchLineWidthPx(2.0 as LineweightMm)).toBeCloseTo(lineweightToPx(2.0), 5);
  });

  it('floor στο fallback ώστε λεπτές τιμές να μένουν ορατές', () => {
    // 0.05 mm @96dpi ≈ 0.19px < fallback → ανεβαίνει στο fallback.
    expect(resolveHatchLineWidthPx(0.05 as LineweightMm)).toBe(DEFAULT_HATCH_LINE_WIDTH_PX);
  });

  it('ByLayer/undefined/null → fallback', () => {
    expect(resolveHatchLineWidthPx(undefined)).toBe(DEFAULT_HATCH_LINE_WIDTH_PX);
    expect(resolveHatchLineWidthPx(null)).toBe(DEFAULT_HATCH_LINE_WIDTH_PX);
    expect(resolveHatchLineWidthPx(LINEWEIGHT_SPECIAL.BYLAYER)).toBe(DEFAULT_HATCH_LINE_WIDTH_PX);
  });
});
