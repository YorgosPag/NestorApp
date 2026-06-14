/**
 * ADR-453 — pdf-image-layout unit tests.
 */

import { computeImagePlacementMm } from '../assemble/pdf-image-layout';
import type { PrintableAreaMm } from '../config/paper-types';

const AREA: PrintableAreaMm = { xMm: 10, yMm: 10, widthMm: 190, heightMm: 277 };

describe('computeImagePlacementMm', () => {
  it('fills the area exactly when the aspect matches', () => {
    const rect = computeImagePlacementMm(190, 277, AREA);
    expect(rect).toEqual({ x: 10, y: 10, w: 190, h: 277 });
  });

  it('is width-bound and vertically centred for a wide image', () => {
    const rect = computeImagePlacementMm(2000, 1000, AREA);
    expect(rect.w).toBeCloseTo(190, 6);
    expect(rect.h).toBeCloseTo(95, 6);
    expect(rect.x).toBeCloseTo(10, 6);
    expect(rect.y).toBeCloseTo(10 + (277 - 95) / 2, 6);
  });

  it('is height-bound and horizontally centred for a tall image', () => {
    const rect = computeImagePlacementMm(500, 2000, AREA);
    expect(rect.h).toBeCloseTo(277, 6);
    expect(rect.w).toBeCloseTo(277 * (500 / 2000), 6);
    expect(rect.y).toBeCloseTo(10, 6);
    expect(rect.x).toBeGreaterThan(10);
  });

  it('never exceeds the printable area', () => {
    const rect = computeImagePlacementMm(3333, 1111, AREA);
    expect(rect.w).toBeLessThanOrEqual(AREA.widthMm + 1e-6);
    expect(rect.h).toBeLessThanOrEqual(AREA.heightMm + 1e-6);
  });

  it('falls back to the full area for a degenerate image size', () => {
    expect(computeImagePlacementMm(0, 0, AREA)).toEqual({ x: 10, y: 10, w: 190, h: 277 });
  });
});
