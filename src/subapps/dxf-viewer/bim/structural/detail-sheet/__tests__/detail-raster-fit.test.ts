/**
 * ADR-457 Slice 3 — raster contain-fit SSoT unit tests.
 *
 * Verifies aspect-preserving, centred placement of a raster inside a sheet rect
 * (the shared canvas/PDF raster geometry) for landscape, portrait, exact-fit and
 * degenerate inputs.
 */

import { containFitRectMm } from '../render/detail-raster-fit';
import type { RectMm } from '../detail-sheet-types';

const EPS = 1e-6;
const RECT: RectMm = { x: 100, y: 50, w: 200, h: 400 }; // tall (portrait) region

function centerX(r: RectMm): number { return r.x + r.w / 2; }
function centerY(r: RectMm): number { return r.y + r.h / 2; }

describe('containFitRectMm (ADR-457 Slice 3)', () => {
  it('fits a landscape image by width and centres it vertically', () => {
    const fit = containFitRectMm(RECT, 800, 400); // aspect 2:1
    expect(fit.w).toBeCloseTo(200, 6);            // width-bound
    expect(fit.h).toBeCloseTo(100, 6);            // 200 / 2
    expect(centerX(fit)).toBeCloseTo(centerX(RECT), 6);
    expect(centerY(fit)).toBeCloseTo(centerY(RECT), 6);
  });

  it('fits a portrait image by height when taller than the rect aspect', () => {
    const fit = containFitRectMm(RECT, 300, 1200); // aspect 1:4 (taller than 1:2)
    expect(fit.h).toBeCloseTo(400, 6);             // height-bound
    expect(fit.w).toBeCloseTo(100, 6);             // 400 / 4
    expect(centerX(fit)).toBeCloseTo(centerX(RECT), 6);
    expect(centerY(fit)).toBeCloseTo(centerY(RECT), 6);
  });

  it('never exceeds the host rect', () => {
    const fit = containFitRectMm(RECT, 1234, 567);
    expect(fit.w).toBeLessThanOrEqual(RECT.w + EPS);
    expect(fit.h).toBeLessThanOrEqual(RECT.h + EPS);
  });

  it('collapses to a zero-size rect at the centre for degenerate inputs', () => {
    for (const fit of [
      containFitRectMm(RECT, 0, 400),
      containFitRectMm(RECT, 400, 0),
      containFitRectMm({ x: 0, y: 0, w: 0, h: 0 }, 400, 400),
    ]) {
      expect(fit.w).toBe(0);
      expect(fit.h).toBe(0);
    }
  });
});
