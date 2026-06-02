/**
 * ADR-406 — MEP fixture 2D family symbol SSoT unit tests.
 */

import { buildFixtureSymbol } from '../mep-fixture-symbol';
import { computeMepFixtureGeometry } from '../mep-fixture-geometry';
import type { MepFixtureParams } from '../../types/mep-fixture-types';

function params(overrides: Partial<MepFixtureParams> = {}): MepFixtureParams {
  return {
    kind: 'light-fixture',
    shape: 'rectangular',
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    width: 600,
    length: 600,
    bodyHeightMm: 80,
    mountingElevationMm: 2700,
    sceneUnits: 'mm',
    ...overrides,
  };
}

describe('buildFixtureSymbol', () => {
  it('rectangular → outline + 2 diagonal strokes (the luminaire "X")', () => {
    const p = params();
    const sym = buildFixtureSymbol(p, computeMepFixtureGeometry(p));
    expect(sym.outline).toHaveLength(4);
    expect(sym.strokes).toHaveLength(2);
    // each stroke is a diagonal: connects two opposite corners.
    for (const s of sym.strokes) expect(s).toHaveLength(2);
  });

  it('circular → 2 diameter strokes through centre', () => {
    const p = params({ shape: 'circular', width: 200 });
    const sym = buildFixtureSymbol(p, computeMepFixtureGeometry(p));
    expect(sym.strokes).toHaveLength(2);
    // strokes cross at the centre (0,0).
    const mid = (a: { x: number; y: number }, b: { x: number; y: number }) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
    for (const s of sym.strokes) {
      const m = mid(s[0], s[1]);
      expect(m.x).toBeCloseTo(0, 6);
      expect(m.y).toBeCloseTo(0, 6);
    }
  });
});
