/**
 * ADR-453 — paper-math unit tests.
 */

import {
  resolvePaperDimensionsMm,
  mmToPx,
  pxToMm,
  resolvePrintableAreaMm,
  computePaperRasterPx,
  computeDrawingScaleTransform,
} from '../config/paper-math';
import { MAX_CANVAS_DIMENSION_PX, MM_PER_INCH } from '../config/paper-constants';
import type { Bounds } from '../../utils/bounds-utils';

describe('resolvePaperDimensionsMm', () => {
  it('returns ISO portrait dimensions', () => {
    expect(resolvePaperDimensionsMm({ size: 'A4', orientation: 'portrait' })).toEqual({
      widthMm: 210,
      heightMm: 297,
    });
    expect(resolvePaperDimensionsMm({ size: 'A0', orientation: 'portrait' })).toEqual({
      widthMm: 841,
      heightMm: 1189,
    });
  });

  it('swaps axes for landscape', () => {
    expect(resolvePaperDimensionsMm({ size: 'A3', orientation: 'landscape' })).toEqual({
      widthMm: 420,
      heightMm: 297,
    });
  });
});

describe('mmToPx / pxToMm', () => {
  it('round-trips at any DPI', () => {
    for (const dpi of [72, 96, 150, 300]) {
      expect(pxToMm(mmToPx(100, dpi), dpi)).toBeCloseTo(100, 6);
    }
  });

  it('matches the inch definition', () => {
    expect(mmToPx(MM_PER_INCH, 150)).toBeCloseTo(150, 6);
  });
});

describe('resolvePrintableAreaMm', () => {
  it('subtracts a symmetric margin', () => {
    expect(resolvePrintableAreaMm({ size: 'A4', orientation: 'portrait' }, 10)).toEqual({
      xMm: 10,
      yMm: 10,
      widthMm: 190,
      heightMm: 277,
    });
  });

  it('clamps an over-large margin so the area stays positive', () => {
    const area = resolvePrintableAreaMm({ size: 'A4', orientation: 'portrait' }, 9999);
    expect(area.widthMm).toBeGreaterThan(0);
    expect(area.heightMm).toBeGreaterThan(0);
  });
});

describe('computePaperRasterPx', () => {
  it('keeps the requested DPI when under the pixel ceiling (A4@150)', () => {
    const r = computePaperRasterPx({ size: 'A4', orientation: 'portrait' }, 150, 10);
    expect(r.effectiveDpi).toBe(150);
    expect(r.widthPx).toBe(Math.round(mmToPx(190, 150)));
  });

  it('clamps DPI so neither axis exceeds MAX_CANVAS_DIMENSION_PX (A0@300)', () => {
    const r = computePaperRasterPx({ size: 'A0', orientation: 'portrait' }, 300, 10);
    expect(r.effectiveDpi).toBeLessThan(300);
    expect(Math.max(r.widthPx, r.heightPx)).toBeLessThanOrEqual(MAX_CANVAS_DIMENSION_PX);
  });
});

describe('computeDrawingScaleTransform', () => {
  const bounds: Bounds = { min: { x: 0, y: 0 }, max: { x: 1000, y: 500 } };
  const viewport = { width: 1122, height: 793 };

  it('computes px-per-unit for 1:100 in millimetre units at 150 DPI', () => {
    // 1 scene-mm at 1:100 = 0.01mm paper = 0.01 * 150/25.4 px
    const t = computeDrawingScaleTransform(bounds, viewport, {
      scaleDenominator: 100,
      mmPerSceneUnit: 1,
      dpi: 150,
    });
    expect(t.scale).toBeCloseTo((1 / 100) * (150 / MM_PER_INCH), 9);
  });

  it('scales linearly with mmPerSceneUnit (metre drawings)', () => {
    const mm = computeDrawingScaleTransform(bounds, viewport, {
      scaleDenominator: 50,
      mmPerSceneUnit: 1,
      dpi: 150,
    });
    const metres = computeDrawingScaleTransform(bounds, viewport, {
      scaleDenominator: 50,
      mmPerSceneUnit: 1000,
      dpi: 150,
    });
    expect(metres.scale).toBeCloseTo(mm.scale * 1000, 6);
  });

  it('centres the bounds in the viewport', () => {
    const t = computeDrawingScaleTransform(bounds, viewport, {
      scaleDenominator: 100,
      mmPerSceneUnit: 1,
      dpi: 150,
    });
    // worldToScreen X at centre = left + centerX*scale + offsetX ≈ viewport centre (+ ruler left)
    const centerX = 500;
    expect(centerX * t.scale + t.offsetX).toBeCloseTo(viewport.width / 2, 6);
  });
});
