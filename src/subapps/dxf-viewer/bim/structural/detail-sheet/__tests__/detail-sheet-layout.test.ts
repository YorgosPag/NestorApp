/**
 * ADR-457 — detail-sheet-layout unit tests.
 *
 * Verifies the three-column split is geometrically consistent (within the
 * printable area, non-overlapping, columns/rows aligned, centre full-height)
 * for the default A3 landscape sheet, independent of any canvas.
 */

import {
  computeDetailSheetLayout,
  DEFAULT_DETAIL_SHEET_LAYOUT_INPUT,
  DETAIL_SHEET_MARGIN_MM,
  DETAIL_SHEET_GUTTER_MM,
} from '../detail-sheet-layout';
import type { RectMm } from '../detail-sheet-types';

const EPS = 1e-6;

function right(r: RectMm): number { return r.x + r.w; }
function bottom(r: RectMm): number { return r.y + r.h; }

describe('computeDetailSheetLayout (ADR-457)', () => {
  const layout = computeDetailSheetLayout(DEFAULT_DETAIL_SHEET_LAYOUT_INPUT);
  const { plan, elevation, perspective, schedule } = layout.regions;
  const titleBlock = layout.regions['title-block'];

  it('resolves A3 landscape sheet dimensions (420×297 mm)', () => {
    expect(layout.sheetWidthMm).toBeCloseTo(420, 3);
    expect(layout.sheetHeightMm).toBeCloseTo(297, 3);
  });

  it('keeps every region inside the printable area (margin honoured)', () => {
    const m = DETAIL_SHEET_MARGIN_MM;
    for (const r of [plan, elevation, perspective, schedule, titleBlock]) {
      expect(r.x).toBeGreaterThanOrEqual(m - EPS);
      expect(r.y).toBeGreaterThanOrEqual(m - EPS);
      expect(right(r)).toBeLessThanOrEqual(layout.sheetWidthMm - m + EPS);
      expect(bottom(r)).toBeLessThanOrEqual(layout.sheetHeightMm - m + EPS);
      expect(r.w).toBeGreaterThan(0);
      expect(r.h).toBeGreaterThan(0);
    }
  });

  it('stacks elevation over plan in the left column (same x/width, one gutter)', () => {
    expect(elevation.x).toBeCloseTo(plan.x, 6);
    expect(elevation.w).toBeCloseTo(plan.w, 6);
    expect(elevation.h).toBeCloseTo(plan.h, 6);
    expect(plan.y - bottom(elevation)).toBeCloseTo(DETAIL_SHEET_GUTTER_MM, 6);
  });

  it('stacks schedule over title-block in the right column (same x/width, one gutter)', () => {
    expect(schedule.x).toBeCloseTo(titleBlock.x, 6);
    expect(schedule.w).toBeCloseTo(titleBlock.w, 6);
    expect(titleBlock.y - bottom(schedule)).toBeCloseTo(DETAIL_SHEET_GUTTER_MM, 6);
  });

  it('places the perspective as the full-height centre column', () => {
    expect(perspective.y).toBeCloseTo(elevation.y, 6);
    expect(bottom(perspective)).toBeCloseTo(bottom(plan), 6);
    expect(perspective.h).toBeCloseTo(elevation.h + plan.h + DETAIL_SHEET_GUTTER_MM, 6);
  });

  it('orders the three columns left → centre → right, each split by one gutter', () => {
    expect(perspective.x - right(elevation)).toBeCloseTo(DETAIL_SHEET_GUTTER_MM, 6);
    expect(schedule.x - right(perspective)).toBeCloseTo(DETAIL_SHEET_GUTTER_MM, 6);
    expect(right(plan)).toBeLessThanOrEqual(perspective.x + EPS);
    expect(right(perspective)).toBeLessThanOrEqual(schedule.x + EPS);
  });
});
