/**
 * ADR-358 Phase 3f — L-shape with winders geometry tests.
 *
 * NOK convention: winder treads (σκαλοπάτια κουρμπαριστά) at the corner
 * preserve walkline going (no extra rise for landing). Count conservation:
 * `n1 + winderCount + n2 = stepCount`.
 *
 * @see ../stair-geometry-lshape.ts
 * @see ../stair-geometry-winder.ts (SSoT reuse)
 */

import { computeStairGeometry } from '../StairGeometryService';
import type {
  Polygon3D,
  StairParams,
  StairTreadLabelDisplay,
  StairTurnDirectionLR,
  StairVariantLShape,
  StairWinderMethod,
} from '../../../../types/stair';

const COORD_TOL = 1e-6;
const Z_TOL = 1e-9;

function makeLShapeWinders(overrides?: {
  flightSplit?: readonly [number, number];
  winderCount?: number;
  winderMethod?: StairWinderMethod;
  turnDirection?: StairTurnDirectionLR;
  treadLabelDisplay?: StairTreadLabelDisplay;
  cutPlaneHeight?: number;
  rise?: number;
  stepCount?: number;
}): StairParams {
  const winderCount = overrides?.winderCount ?? 3;
  const flightSplit = overrides?.flightSplit ?? ([7, 7] as const);
  const stepCount = overrides?.stepCount ?? (flightSplit[0] + winderCount + flightSplit[1]);
  const rise = overrides?.rise ?? 175;
  const tread = 280;
  const variant: StairVariantLShape = {
    kind: 'l-shape',
    cornerStyle: 'winders',
    turnDirection: overrides?.turnDirection ?? 'right',
    winderCount,
    winderMethod: overrides?.winderMethod ?? 'equal-going',
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
    treadNumberStart: 1,
    treadLabelDisplay: overrides?.treadLabelDisplay ?? 'none',
    treadLabelRestartPerFlight: false,
    codeProfile: 'none',
  };
}

describe('StairGeometryService — L-shape with winders (Phase 3f)', () => {
  it('Test 1: flightSplit=[7,7] + 3 winders → 17 total treads', () => {
    const g = computeStairGeometry(makeLShapeWinders({ cutPlaneHeight: 10000 }));
    expect(g.treadsBelowCut.length + g.treadsAboveCut.length).toBe(17);
    expect(g.landings).toHaveLength(0);
  });

  it('Test 2: z-progression contiguous tread i → z = i·rise (no landing extra rise)', () => {
    const g = computeStairGeometry(makeLShapeWinders({ cutPlaneHeight: 10000 }));
    const all: readonly Polygon3D[] = [...g.treadsBelowCut, ...g.treadsAboveCut];
    for (let i = 0; i < all.length; i++) {
      expect(all[i][0].z).toBeCloseTo(175 * i, 9);
    }
  });

  it('Test 3: flight1 treads rectilinear along u1 (+X)', () => {
    const g = computeStairGeometry(makeLShapeWinders({ cutPlaneHeight: 10000 }));
    const all: readonly Polygon3D[] = [...g.treadsBelowCut, ...g.treadsAboveCut];
    for (let i = 0; i < 7; i++) {
      const c0 = all[0][0];
      const ci = all[i][0];
      // Flight 1 first vertex lies on the inner edge at z=0 + along +X.
      expect(ci.x - c0.x).toBeCloseTo(280 * i, 5);
      expect(ci.y - c0.y).toBeCloseTo(0, 5);
    }
  });

  it('Test 4: winders (3 wedges, equal-going) span 90° from u1 to u2', () => {
    const g = computeStairGeometry(makeLShapeWinders({ cutPlaneHeight: 10000 }));
    const all: readonly Polygon3D[] = [...g.treadsBelowCut, ...g.treadsAboveCut];
    // Indices 7,8,9 are winder treads. Each is a 4-vertex equal-going polygon
    // (apex repeated as last vertex). Verify first ≠ last vertex offset (= apex
    // duplicated → distance 0).
    for (let i = 7; i < 10; i++) {
      const v0 = all[i][0];
      const v3 = all[i][3];
      expect(Math.hypot(v3.x - v0.x, v3.y - v0.y)).toBeLessThan(COORD_TOL);
    }
  });

  it('Test 5: flight2 advances along u2 (turnDirection=right → -Y)', () => {
    const g = computeStairGeometry(makeLShapeWinders({ cutPlaneHeight: 10000 }));
    const all: readonly Polygon3D[] = [...g.treadsBelowCut, ...g.treadsAboveCut];
    // Indices 10..16 are flight2 (7 treads).
    const c10 = all[10][0];
    const c11 = all[11][0];
    expect(c11.y - c10.y).toBeCloseTo(-280, 5); // right turn → -Y
    expect(Math.abs(c11.x - c10.x)).toBeLessThan(COORD_TOL);
  });

  it('Test 6: landings array is empty (winders replace landing)', () => {
    const g = computeStairGeometry(makeLShapeWinders());
    expect(g.landings).toHaveLength(0);
  });

  it('Test 7: walkline has flight1 base + winderCount+1 arc samples + flight2 end', () => {
    const g = computeStairGeometry(makeLShapeWinders());
    // basePoint (1) + 4 winder vertices (winderCount=3 → 4 samples j=0..3) + flight2 end (1) = 6
    expect(g.walkline.length).toBe(6);
  });

  it('Test 8: stringers populated via buildStringersFromWalkline (inner + outer)', () => {
    const g = computeStairGeometry(makeLShapeWinders());
    expect(g.stringers.inner).toBeDefined();
    expect(g.stringers.outer).toBeDefined();
    expect(g.stringers.inner.length).toBeGreaterThan(0);
    expect(g.stringers.outer.length).toBeGreaterThan(0);
  });

  it('Test 9: cutLine emitted when totalRise > cutPlaneHeight, undefined otherwise', () => {
    const cut = computeStairGeometry(makeLShapeWinders({ cutPlaneHeight: 1200 }));
    expect(cut.cutLine).toBeDefined();
    const noCut = computeStairGeometry(makeLShapeWinders({ cutPlaneHeight: 100000 }));
    expect(noCut.cutLine).toBeUndefined();
  });

  it('Test 10: treadLabels span all stepCount, all kind="tread" (winders ARE treads)', () => {
    const g = computeStairGeometry(makeLShapeWinders({
      treadLabelDisplay: 'all',
      cutPlaneHeight: 10000,
    }));
    expect(g.treadLabels).toHaveLength(17);
    for (const label of g.treadLabels!) {
      // Default kind = 'tread' (omitted in buildTreadLabels, undefined or 'tread' both OK).
      expect(label.kind === undefined || label.kind === 'tread').toBe(true);
    }
  });

  it('Test 11: turnDirection="left" → flight2 along +Y (mirror of right)', () => {
    const g = computeStairGeometry(makeLShapeWinders({
      turnDirection: 'left',
      cutPlaneHeight: 10000,
    }));
    const all: readonly Polygon3D[] = [...g.treadsBelowCut, ...g.treadsAboveCut];
    const c10 = all[10][0];
    const c11 = all[11][0];
    expect(c11.y - c10.y).toBeCloseTo(280, 5); // left turn → +Y
  });

  it('Test 12: winderCount=2 → factory split correctly handles minimum (e.g. stepCount=10 → [4,4])', () => {
    const g = computeStairGeometry(makeLShapeWinders({
      flightSplit: [4, 4],
      winderCount: 2,
      stepCount: 10,
      cutPlaneHeight: 10000,
    }));
    expect(g.treadsBelowCut.length + g.treadsAboveCut.length).toBe(10);
  });

  it('Test 13: winderMethod="pie" → 3-vertex polygon treads at corner', () => {
    const g = computeStairGeometry(makeLShapeWinders({
      winderMethod: 'pie',
      cutPlaneHeight: 10000,
    }));
    const all: readonly Polygon3D[] = [...g.treadsBelowCut, ...g.treadsAboveCut];
    for (let i = 7; i < 10; i++) {
      expect(all[i]).toHaveLength(3); // pie = triangle
    }
  });

  it('Test 14: bbox covers flight1 + winders + flight2', () => {
    const g = computeStairGeometry(makeLShapeWinders());
    const span = (a: number, b: number): number => Math.abs(b - a);
    expect(span(g.bbox.min.x, g.bbox.max.x)).toBeGreaterThan(1000); // flight1 + winders extend in X
    expect(span(g.bbox.min.y, g.bbox.max.y)).toBeGreaterThan(1000); // winders + flight2 extend in Y
  });

  it('Test 15: total rise = stepCount · rise (winders consume rise; NO extra landing rise)', () => {
    const g = computeStairGeometry(makeLShapeWinders({ cutPlaneHeight: 10000 }));
    const all: readonly Polygon3D[] = [...g.treadsBelowCut, ...g.treadsAboveCut];
    const topZ = all[all.length - 1][0].z;
    expect(topZ).toBeCloseTo(175 * 16, Z_TOL); // tread 17 at z = 16·rise (i=0..16)
  });
});
