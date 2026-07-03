/**
 * ADR-565 — wall-arc-descriptor normalization SSoT tests.
 *
 * Coverage:
 *   - bulgeFrom3Points: quarter / semicircle arcs, CW vs CCW sign, collinear→null
 *   - bulgeFromRadius: minor vs major, side sign, R < chord/2 → null
 *   - arcCurveFromBulge: round-trips bulgeFrom3Points back to center/radius
 */

import {
  bulgeFrom3Points,
  bulgeFromRadius,
  bulgeFromCenterStartEnd,
  bulgeFromTangent,
  arcCurveFromBulge,
} from '../wall-arc-descriptor';

const TOL = 1e-9;

describe('bulgeFrom3Points', () => {
  it('upper semicircle (start→top→end) is CW (bulge = −1)', () => {
    const b = bulgeFrom3Points({ x: -1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 0 });
    expect(b).not.toBeNull();
    expect(b as number).toBeCloseTo(-1, 9); // tan(−π/4)
  });

  it('lower semicircle (start→bottom→end) is CCW (bulge = +1)', () => {
    const b = bulgeFrom3Points({ x: -1, y: 0 }, { x: 0, y: -1 }, { x: 1, y: 0 });
    expect(b as number).toBeCloseTo(1, 9);
  });

  it('CCW quarter arc → bulge = tan(π/8)', () => {
    const b = bulgeFrom3Points({ x: 1, y: 0 }, { x: Math.SQRT1_2, y: Math.SQRT1_2 }, { x: 0, y: 1 });
    expect(b as number).toBeCloseTo(Math.tan(Math.PI / 8), 9);
  });

  it('CW quarter arc (mirror through-point) flips the sign', () => {
    const ccw = bulgeFrom3Points({ x: 1, y: 0 }, { x: Math.SQRT1_2, y: Math.SQRT1_2 }, { x: 0, y: 1 }) as number;
    const cw = bulgeFrom3Points({ x: 1, y: 0 }, { x: Math.SQRT1_2, y: -Math.SQRT1_2 }, { x: 0, y: -1 }) as number;
    expect(Math.sign(cw)).toBe(-Math.sign(ccw));
  });

  it('collinear points → null (no unique circle)', () => {
    expect(bulgeFrom3Points({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 })).toBeNull();
  });
});

describe('bulgeFromRadius', () => {
  it('semicircle: R = chord/2 → |bulge| = 1', () => {
    const b = bulgeFromRadius({ x: -1000, y: 0 }, { x: 1000, y: 0 }, 1000, 'ccw');
    expect(b as number).toBeCloseTo(1, 6);
  });

  it('minor arc: R = chord/√2 → bulge = tan(π/8)', () => {
    const R = 1000 * Math.SQRT2; // half-chord 1000, asin(1/√2)=π/4 → sweep π/2
    const b = bulgeFromRadius({ x: -1000, y: 0 }, { x: 1000, y: 0 }, R, 'ccw');
    expect(b as number).toBeCloseTo(Math.tan(Math.PI / 8), 6);
  });

  it('major arc selects the reflex sweep (larger |bulge|)', () => {
    const R = 1000 * Math.SQRT2;
    const minor = bulgeFromRadius({ x: -1000, y: 0 }, { x: 1000, y: 0 }, R, 'ccw', false) as number;
    const major = bulgeFromRadius({ x: -1000, y: 0 }, { x: 1000, y: 0 }, R, 'ccw', true) as number;
    expect(Math.abs(major)).toBeGreaterThan(Math.abs(minor));
  });

  it("side 'cw' negates the bulge", () => {
    const ccw = bulgeFromRadius({ x: -1000, y: 0 }, { x: 1000, y: 0 }, 1000, 'ccw') as number;
    const cw = bulgeFromRadius({ x: -1000, y: 0 }, { x: 1000, y: 0 }, 1000, 'cw') as number;
    expect(cw).toBeCloseTo(-ccw, 9);
  });

  it('R smaller than half-chord → null (cannot span)', () => {
    expect(bulgeFromRadius({ x: -1000, y: 0 }, { x: 1000, y: 0 }, 500, 'ccw')).toBeNull();
  });
});

describe('bulgeFromCenterStartEnd (ADR-565 «κέντρο-άκρα»)', () => {
  it('CCW quarter arc: center O, start (1,0), cursor (0,1) → bulge tan(π/8), endPoint (0,1)', () => {
    const r = bulgeFromCenterStartEnd({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 });
    expect(r).not.toBeNull();
    expect(r!.bulge).toBeCloseTo(Math.tan(Math.PI / 8), 9);
    expect(r!.endPoint.x).toBeCloseTo(0, 9);
    expect(r!.endPoint.y).toBeCloseTo(1, 9);
  });

  it('CW cursor (0,-1) flips the sign', () => {
    const r = bulgeFromCenterStartEnd({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: -1 });
    expect(r!.bulge).toBeCloseTo(-Math.tan(Math.PI / 8), 9);
  });

  it('projects an off-circle cursor back onto the radius (endPoint on the circle)', () => {
    const r = bulgeFromCenterStartEnd({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 0, y: 7 });
    expect(Math.hypot(r!.endPoint.x, r!.endPoint.y)).toBeCloseTo(2, 9); // radius = |start−center| = 2
  });

  it('degenerate radius (start === center) → null', () => {
    expect(bulgeFromCenterStartEnd({ x: 3, y: 3 }, { x: 3, y: 3 }, { x: 0, y: 1 })).toBeNull();
  });
});

describe('bulgeFromTangent (ADR-565 «εφαπτομενικό»)', () => {
  it('tangent +x, chord at 45° → bulge tan(π/8) (tangent-chord angle = π/4)', () => {
    const b = bulgeFromTangent({ x: 0, y: 0 }, { x: 1, y: 1 }, 0);
    expect(b as number).toBeCloseTo(Math.tan(Math.PI / 8), 9);
  });

  it('chord below the tangent flips the sign', () => {
    const b = bulgeFromTangent({ x: 0, y: 0 }, { x: 1, y: -1 }, 0);
    expect(b as number).toBeCloseTo(-Math.tan(Math.PI / 8), 9);
  });

  it('chord collinear with the tangent → ~0 bulge (straight)', () => {
    const b = bulgeFromTangent({ x: 0, y: 0 }, { x: 5, y: 0 }, 0);
    expect(Math.abs(b as number)).toBeLessThan(TOL);
  });

  it('collapsed chord → null', () => {
    expect(bulgeFromTangent({ x: 2, y: 2 }, { x: 2, y: 2 }, 0)).toBeNull();
  });
});

describe('arcCurveFromBulge (round-trip)', () => {
  it('recovers unit-circle center/radius from a quarter-arc bulge', () => {
    const start = { x: 1, y: 0, z: 0 };
    const end = { x: 0, y: 1, z: 0 };
    const bulge = bulgeFrom3Points(start, { x: Math.SQRT1_2, y: Math.SQRT1_2 }, end) as number;
    const arc = arcCurveFromBulge(start, end, bulge);
    expect(arc).not.toBeNull();
    expect(arc!.radius).toBeCloseTo(1, 6);
    expect(arc!.center.x).toBeCloseTo(0, 6);
    expect(arc!.center.y).toBeCloseTo(0, 6);
  });

  it('returns null for a (near-)straight bulge', () => {
    expect(arcCurveFromBulge({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, 0)).toBeNull();
  });

  it('round-trips a semicircle radius', () => {
    const start = { x: -1000, y: 0, z: 0 };
    const end = { x: 1000, y: 0, z: 0 };
    const bulge = bulgeFrom3Points(start, { x: 0, y: 1000, z: 0 }, end) as number;
    const arc = arcCurveFromBulge(start, end, bulge);
    expect(arc!.radius).toBeCloseTo(1000, 6);
  });
});
