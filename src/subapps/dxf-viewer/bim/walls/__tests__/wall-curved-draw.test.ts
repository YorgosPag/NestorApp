/**
 * ADR-565 §12 Φ1.x — wall-curved-draw resolver + tangent-lookup tests.
 *
 * Coverage:
 *   - resolveCurvedArcParams: 3-point / center-ends / tangent · degenerate → null
 *   - wallEndTangentAt: straight endpoint (outward), curved endpoint (arc tangent), miss → null
 */

import type { WallEntity } from '../../types/wall-types';
import { resolveCurvedArcParams, wallEndTangentAt } from '../wall-curved-draw';

// Minimal wall factory — only the fields the tangent lookup reads (params.start/end/arc).
function wall(start: { x: number; y: number }, end: { x: number; y: number }, arc = 0): WallEntity {
  return { params: { start, end, arc } } as unknown as WallEntity;
}

describe('resolveCurvedArcParams', () => {
  it('3-point: through-point → bulge from the 3 points, start/end unchanged', () => {
    const r = resolveCurvedArcParams(
      { arcVariant: '3-point', startPoint: { x: 1, y: 0 }, endPoint: { x: 0, y: 1 }, arcCenter: null },
      { x: Math.SQRT1_2, y: Math.SQRT1_2 },
    );
    expect(r).not.toBeNull();
    expect(r!.bulge).toBeCloseTo(Math.tan(Math.PI / 8), 9);
    expect(r!.start).toEqual({ x: 1, y: 0 });
    expect(r!.end).toEqual({ x: 0, y: 1 });
  });

  it('center-ends: end is projected onto the circle from the cursor angle', () => {
    const r = resolveCurvedArcParams(
      { arcVariant: 'center-ends', startPoint: { x: 1, y: 0 }, endPoint: null, arcCenter: { x: 0, y: 0 } },
      { x: 0, y: 9 },
    );
    expect(r).not.toBeNull();
    expect(r!.end.x).toBeCloseTo(0, 9);
    expect(r!.end.y).toBeCloseTo(1, 9);
    expect(r!.bulge).toBeCloseTo(Math.tan(Math.PI / 8), 9);
  });

  it('tangent: bulge from the given tangent direction; null tangent → null bulge (straight)', () => {
    const withRef = resolveCurvedArcParams(
      { arcVariant: 'tangent', startPoint: { x: 0, y: 0 }, endPoint: null, arcCenter: null },
      { x: 1, y: 1 },
      0,
    );
    expect(withRef!.bulge).toBeCloseTo(Math.tan(Math.PI / 8), 9);
    expect(withRef!.end).toEqual({ x: 1, y: 1 });

    const noRef = resolveCurvedArcParams(
      { arcVariant: 'tangent', startPoint: { x: 0, y: 0 }, endPoint: null, arcCenter: null },
      { x: 1, y: 1 },
      null,
    );
    expect(noRef!.bulge).toBeNull();
  });

  it('missing required points → null (defensive)', () => {
    expect(resolveCurvedArcParams({ arcVariant: 'center-ends', startPoint: null, endPoint: null, arcCenter: null }, { x: 0, y: 0 })).toBeNull();
    expect(resolveCurvedArcParams({ arcVariant: '3-point', startPoint: { x: 0, y: 0 }, endPoint: null, arcCenter: null }, { x: 1, y: 1 })).toBeNull();
  });
});

describe('wallEndTangentAt', () => {
  it('straight wall: tangent at end points outward (away from body)', () => {
    // wall along +x from (0,0) to (10,0); continue past the end → +x (0 rad).
    const t = wallEndTangentAt([wall({ x: 0, y: 0 }, { x: 10, y: 0 })], { x: 10, y: 0 }, 1);
    expect(t).not.toBeNull();
    expect(Math.cos(t as number)).toBeCloseTo(1, 9);
    expect(Math.sin(t as number)).toBeCloseTo(0, 9);
  });

  it('straight wall: tangent at start points backward (reversed)', () => {
    const t = wallEndTangentAt([wall({ x: 0, y: 0 }, { x: 10, y: 0 })], { x: 0, y: 0 }, 1);
    expect(Math.cos(t as number)).toBeCloseTo(-1, 9);
  });

  it('no endpoint within tolerance → null', () => {
    expect(wallEndTangentAt([wall({ x: 0, y: 0 }, { x: 10, y: 0 })], { x: 5, y: 5 }, 1)).toBeNull();
  });

  it('curved wall: tangent at the end deviates from the chord by −sweep/2', () => {
    // A CCW quarter arc has bulge tan(π/8); at the end the tangent = chordDir − 2·atan(bulge).
    const arc = Math.tan(Math.PI / 8);
    const t = wallEndTangentAt([wall({ x: 1, y: 0 }, { x: 0, y: 1 }, arc)], { x: 0, y: 1 }, 1e-6);
    const chordDir = Math.atan2(1 - 0, 0 - 1); // atan2(1,-1) = 3π/4
    expect(t as number).toBeCloseTo(chordDir - 2 * Math.atan(arc), 9);
  });
});
