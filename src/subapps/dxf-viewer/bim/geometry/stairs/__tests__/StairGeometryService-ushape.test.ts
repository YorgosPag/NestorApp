/**
 * ADR-358 Phase 3b — `StairGeometryService` u-shape tests.
 *
 * Default parameterization (canonical mm, +X/+Y math frame):
 *   - stepCount=10, flightSplit=[5,5], turnRight, rise=175, tread=280, width=1000
 *   - landingDepth='auto' (→ width)
 *   - basePoint=(0,0,0), direction=0° (+X), upDirection='forward'
 *
 * Tolerance: 1e-6 for xy, 1e-9 for z (Phase 2a/2b convention).
 *
 * @see ../stair-geometry-ushape.ts
 */

import { computeStairGeometry } from '../StairGeometryService';
import type {
  StairParams,
  StairVariantUShape,
  Polygon3D,
  StairTurnDirectionLR,
  StairLandingCornerStyle,
  StairTreadLabelDisplay,
} from '../../../../bim/types/stair-types';

const COORD_TOL = 1e-6;
const Z_TOL = 1e-9;

function makeUShapeParams(overrides?: {
  flightSplit?: readonly [number, number];
  turnDirection?: StairTurnDirectionLR;
  landingDepth?: 'auto' | number;
  landingCornerStyle?: StairLandingCornerStyle;
  cutPlaneHeight?: number;
  treadLabelDisplay?: StairTreadLabelDisplay;
  treadLabelEveryN?: number;
  treadLabelRestartPerFlight?: boolean;
  treadNumberStart?: number;
}): StairParams {
  const flightSplit = overrides?.flightSplit ?? ([5, 5] as const);
  const stepCount = flightSplit[0] + flightSplit[1];
  const rise = 175;
  const tread = 280;
  const variant: StairVariantUShape = {
    kind: 'u-shape',
    turnDirection: overrides?.turnDirection ?? 'right',
    landingDepth: overrides?.landingDepth ?? 'auto',
    landingCornerStyle: overrides?.landingCornerStyle,
    flightSplit,
  };
  return {
    basePoint: { x: 0, y: 0, z: 0 },
    direction: 0,
    rise,
    tread,
    nosing: 25,
    nosingSide: 'front',
    width: 1000,
    stepCount,
    totalRise: rise * stepCount,
    totalRun: tread * Math.max(stepCount - 1, 0),
    pitch: 30,
    structureType: 'monolithic',
    riserType: 'closed',
    antiskidNosing: false,
    adaContrastStrip: false,
    cutPlaneHeight: overrides?.cutPlaneHeight,
    variant,
    walklineOffset: 300,
    handrails: { inner: false, outer: false, height: 900 },
    upDirection: 'forward',
    treadNumberStart: overrides?.treadNumberStart ?? 1,
    treadLabelDisplay: overrides?.treadLabelDisplay ?? 'none',
    treadLabelEveryN: overrides?.treadLabelEveryN,
    treadLabelRestartPerFlight: overrides?.treadLabelRestartPerFlight ?? false,
    codeProfile: 'none',
  };
}

function centroidXY(poly: Polygon3D): { x: number; y: number } {
  let sx = 0;
  let sy = 0;
  for (const p of poly) { sx += p.x; sy += p.y; }
  return { x: sx / poly.length, y: sy / poly.length };
}

function polygonAreaXY(poly: Polygon3D): number {
  let s = 0;
  const n = poly.length;
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    s += a.x * b.y - b.x * a.y;
  }
  return Math.abs(s) * 0.5;
}

describe('StairGeometryService — U-shape', () => {
  it('Test 1: stepCount=10, flightSplit=[5,5], turnRight → 10 treads + 1 landing', () => {
    const g = computeStairGeometry(makeUShapeParams());
    expect(g.treadsBelowCut.length + g.treadsAboveCut.length).toBe(10);
    expect(g.landings).toHaveLength(1);
  });

  it('Test 2: flight 2 direction = -u1 (anti-parallel 180°)', () => {
    const g = computeStairGeometry(makeUShapeParams());
    const all: readonly Polygon3D[] = [...g.treadsBelowCut, ...g.treadsAboveCut];
    const c5 = centroidXY(all[5]);
    const c6 = centroidXY(all[6]);
    expect(c6.x - c5.x).toBeCloseTo(-280, 6);
    expect(Math.abs(c6.y - c5.y)).toBeLessThan(COORD_TOL);
  });

  it('Test 3: flight 2 parallel band offset by -width (turnRight) — y between -1500 and -500', () => {
    const g = computeStairGeometry(makeUShapeParams());
    const all: readonly Polygon3D[] = [...g.treadsBelowCut, ...g.treadsAboveCut];
    for (let i = 5; i < 10; i++) {
      for (const v of all[i]) {
        expect(v.y).toBeGreaterThanOrEqual(-1500 - COORD_TOL);
        expect(v.y).toBeLessThanOrEqual(-500 + COORD_TOL);
      }
    }
  });

  it('Test 4: landing dimensions = (2·width) × landingDepth', () => {
    const g = computeStairGeometry(makeUShapeParams());
    expect(polygonAreaXY(g.landings[0])).toBeCloseTo(2 * 1000 * 1000, 3);
  });

  it('Test 5: landing z = n1 · rise = 875', () => {
    const g = computeStairGeometry(makeUShapeParams());
    for (const v of g.landings[0]) {
      expect(Math.abs(v.z - 875)).toBeLessThan(Z_TOL);
    }
  });

  it('Test 6: flight 2 z range = [(n1+1)·rise, stepCount·rise]', () => {
    const g = computeStairGeometry(makeUShapeParams());
    const all: readonly Polygon3D[] = [...g.treadsBelowCut, ...g.treadsAboveCut];
    const flight2 = all.slice(5);
    expect(flight2[0][0].z).toBeCloseTo(1050, 9);
    expect(flight2[4][0].z).toBeCloseTo(1750, 9);
  });

  it('Test 7: walkline has 4 vertices with sharp 90° corners at p2 and p3', () => {
    const g = computeStairGeometry(makeUShapeParams());
    expect(g.walkline).toHaveLength(4);
    // p2 should be on flight 1 axis at end of flight 1, p3 across the landing
    expect(g.walkline[1].x).toBeCloseTo(1400 + 500, 6); // n1·tread + halfW
    expect(g.walkline[1].y).toBeCloseTo(0, 6);
    expect(g.walkline[2].x).toBeCloseTo(1400 + 500, 6);
    expect(g.walkline[2].y).toBeCloseTo(-1000, 6); // turnSign·width
  });

  it('Test 8: turnLeft mirrors turnRight across the flight-1 axis (y=0)', () => {
    const right = computeStairGeometry(makeUShapeParams({ turnDirection: 'right' }));
    const left = computeStairGeometry(makeUShapeParams({ turnDirection: 'left' }));
    const rt: readonly Polygon3D[] = [...right.treadsBelowCut, ...right.treadsAboveCut];
    const lt: readonly Polygon3D[] = [...left.treadsBelowCut, ...left.treadsAboveCut];
    for (let i = 0; i < 10; i++) {
      const rc = centroidXY(rt[i]);
      const lc = centroidXY(lt[i]);
      expect(lc.x).toBeCloseTo(rc.x, 6);
      expect(lc.y).toBeCloseTo(-rc.y, 6);
    }
  });

  it('Test 9: cutLine emitted when totalRise crosses cutPlaneHeight, undefined otherwise', () => {
    const cut = computeStairGeometry(makeUShapeParams({ cutPlaneHeight: 1200 }));
    expect(cut.cutLine).toBeDefined();
    const noCut = computeStairGeometry(makeUShapeParams({ cutPlaneHeight: 5000 }));
    expect(noCut.cutLine).toBeUndefined();
  });

  it("Test 10: treadLabelDisplay='all' → 11 labels (10 treads + 1 landing, γ); 'none' → undefined", () => {
    const all = computeStairGeometry(makeUShapeParams({ treadLabelDisplay: 'all' }));
    // ADR-358 Phase 3e γ: landing gets its own label interleaved between flights.
    expect(all.treadLabels).toHaveLength(11);
    expect(all.treadLabels!.map(l => l.text)).toEqual(
      ['1','2','3','4','5','6','7','8','9','10','11'],
    );
    // Position 5 = landing (after flight1 of 5 treads, indices 0..4 → labels 1..5).
    expect(all.treadLabels![5].kind).toBe('landing');
    expect(all.treadLabels![0].kind).toBe('tread');
    const none = computeStairGeometry(makeUShapeParams({ treadLabelDisplay: 'none' }));
    expect(none.treadLabels).toBeUndefined();
  });

  it('Test 11: tread label position equals tread centroid (xy + z) — landing skipped here', () => {
    const g = computeStairGeometry(makeUShapeParams({ treadLabelDisplay: 'all' }));
    const labels = g.treadLabels;
    if (!labels) throw new Error('expected labels');
    const all: readonly Polygon3D[] = [...g.treadsBelowCut, ...g.treadsAboveCut];
    for (const label of labels) {
      if (label.kind === 'landing') continue; // landing centroid checked separately
      const c = centroidXY(all[label.treadIndex]);
      const cz = all[label.treadIndex][0].z;
      expect(label.position.x).toBeCloseTo(c.x, 6);
      expect(label.position.y).toBeCloseTo(c.y, 6);
      expect(label.position.z).toBeCloseTo(cz, 9);
    }
  });

  it("Test 12: landingCornerStyle 'chamfer' / 'fillet' throws (Phase 3c)", () => {
    expect(() => computeStairGeometry(makeUShapeParams({ landingCornerStyle: 'chamfer' }))).toThrow(
      /Phase 3c/,
    );
    expect(() => computeStairGeometry(makeUShapeParams({ landingCornerStyle: 'fillet' }))).toThrow(
      /Phase 3c/,
    );
  });

  it('Test 13: flight 2 treads do NOT overlap the landing footprint (regression)', () => {
    // Flight 2 runs anti-parallel (−u1) back ALONGSIDE flight 1. Its treads must
    // start at the landing's NEAR u1 edge (x = n1·tread = 1400) and descend toward
    // basePoint — NOT at the far edge (x = 1400 + landingDepth = 2400), which would
    // lay the treads back over the [1400, 2400] landing footprint (the reported bug:
    // "το δεύτερο σκέλος καλύπτει το πλατύσκαλο").
    const g = computeStairGeometry(makeUShapeParams());
    const all: readonly Polygon3D[] = [...g.treadsBelowCut, ...g.treadsAboveCut];
    const landingNearX = 5 * 280; // n1·tread
    for (let i = 5; i < 10; i++) {
      for (const v of all[i]) {
        expect(v.x).toBeLessThanOrEqual(landingNearX + COORD_TOL);
      }
    }
  });

  it('Test 14: transition risers bridge the switchback landing (regression)', () => {
    // Regression: flight generators emit only count−1 INTERNAL risers, so the two
    // level boundaries around the turn landing had no vertical face — flight 2's
    // first tread floated a rise above the πλατύσκαλο with no riser (reported bug:
    // "μετά το πλατύσκαλο δεν έχει ρίχτυ").
    const g = computeStairGeometry(makeUShapeParams());
    // 10 steps + 1 turn landing (level 5) → 10 transitions → 10 risers (8 internal + 2).
    expect(g.risers).toHaveLength(10);
    const bridges = (zLo: number, zHi: number): boolean =>
      g.risers.some((r) => {
        const lo = Math.min(r.start.z, r.end.z);
        const hi = Math.max(r.start.z, r.end.z);
        return Math.abs(lo - zLo) < COORD_TOL && Math.abs(hi - zHi) < COORD_TOL;
      });
    // rise=175, n1=5: flight-1 top tread @700 → landing @875 → flight-2 first @1050.
    expect(bridges(700, 875)).toBe(true);  // exit riser (flight 1 → landing)
    expect(bridges(875, 1050)).toBe(true); // entry riser (landing → flight 2) — the bug
  });
});
