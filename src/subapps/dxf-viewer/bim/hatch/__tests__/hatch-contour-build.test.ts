/**
 * ADR-507 — tests για το contour-pen build SSoT (build helper + immutable patch +
 * baseline detector). Mirror του `hatch-gradient-build.test.ts`.
 */

import {
  buildContourPenFromDefaults,
  withContourPenPatch,
  isContourAtBaseline,
  type ContourDefaults,
} from '../hatch-contour-build';
import type { HatchContourPen } from '../../../types/entities';
import { LINEWEIGHT_SPECIAL } from '../../../config/lineweight-iso-catalog';

const BASELINE: ContourDefaults = {
  contourVisible: true,
  contourColor: '',
  contourLineweightMm: LINEWEIGHT_SPECIAL.BYLAYER,
  contourLinetypeName: '',
};

describe('isContourAtBaseline', () => {
  it('is true for the untouched defaults (visible, zero overrides)', () => {
    expect(isContourAtBaseline(BASELINE)).toBe(true);
  });

  it('is false once visible is toggled off', () => {
    expect(isContourAtBaseline({ ...BASELINE, contourVisible: false })).toBe(false);
  });

  it('is false once a color override is set', () => {
    expect(isContourAtBaseline({ ...BASELINE, contourColor: '#ff0000' })).toBe(false);
  });

  it('is false once a concrete lineweight override is set', () => {
    expect(isContourAtBaseline({ ...BASELINE, contourLineweightMm: 0.5 })).toBe(false);
  });

  it('is false once a linetype override is set', () => {
    expect(isContourAtBaseline({ ...BASELINE, contourLinetypeName: 'DASHED' })).toBe(false);
  });
});

describe('buildContourPenFromDefaults', () => {
  it('omits color/lineweight/linetype at baseline (they inherit/hairline/Continuous)', () => {
    const pen = buildContourPenFromDefaults(BASELINE);
    expect(pen.visible).toBe(true);
    expect(pen.color).toBeUndefined();
    expect(pen.lineweightMm).toBeUndefined();
    expect(pen.linetypeName).toBeUndefined();
  });

  it('carries a customized color/lineweight/linetype', () => {
    const pen = buildContourPenFromDefaults({
      contourVisible: false,
      contourColor: '#112233',
      contourLineweightMm: 0.5,
      contourLinetypeName: 'DASHED',
    });
    expect(pen.visible).toBe(false);
    expect(pen.color).toBe('#112233');
    expect(pen.lineweightMm).toBe(0.5);
    expect(pen.linetypeName).toBe('DASHED');
  });
});

describe('withContourPenPatch', () => {
  it('rebuilds the whole pen immutably (does not mutate current)', () => {
    const current: HatchContourPen = { visible: true, color: '#112233' };
    const next = withContourPenPatch(current, BASELINE, { field: 'visible', value: false });
    expect(next).not.toBe(current);
    expect(current.visible).toBe(true); // αμετάβλητο
    expect(next.visible).toBe(false);
    expect(next.color).toBe('#112233'); // κρατήθηκε
  });

  it('changing color keeps visible/lineweight/linetype', () => {
    const current: HatchContourPen = { visible: false, color: '#112233', lineweightMm: 0.5, linetypeName: 'DASHED' };
    const next = withContourPenPatch(current, BASELINE, { field: 'color', value: '#ff0000' });
    expect(next.color).toBe('#ff0000');
    expect(next.visible).toBe(false);
    expect(next.lineweightMm).toBe(0.5);
    expect(next.linetypeName).toBe('DASHED');
  });

  it('falls back to defaults when current pen is undefined', () => {
    const next = withContourPenPatch(undefined, BASELINE, { field: 'color', value: '#ff0000' });
    expect(next.visible).toBe(true);
    expect(next.color).toBe('#ff0000');
    expect(next.lineweightMm).toBeUndefined();
    expect(next.linetypeName).toBeUndefined();
  });

  it('reverting a lineweight override back to ByLayer trims it away again', () => {
    const current: HatchContourPen = { visible: true, lineweightMm: 0.5 };
    const next = withContourPenPatch(
      current, BASELINE, { field: 'lineweightMm', value: LINEWEIGHT_SPECIAL.BYLAYER },
    );
    expect(next.lineweightMm).toBeUndefined();
  });

  it('reverting a linetype override back to \'\' trims it away again', () => {
    const current: HatchContourPen = { visible: true, linetypeName: 'DASHED' };
    const next = withContourPenPatch(current, BASELINE, { field: 'linetypeName', value: '' });
    expect(next.linetypeName).toBeUndefined();
  });
});
