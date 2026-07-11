/**
 * ADR-358 Phase 4b — `StairGeometryService` winder-kind tests.
 *
 * Geometry parameterization (canonical mm):
 *   - stepCount=14, winderCount=4, turnAngle=+90° (ccw), 'equal-going'
 *   - basePoint=(0,0,0), direction=0 (+X), tread=250, width=1000
 *   - n1 = floor((14−4)/2) = 5, n2 = 5
 *   - rise = 175 → totalRise = 2450 (> default cut plane 1200)
 *
 * @see ../StairGeometryService.ts
 * @see ../stair-geometry-winder.ts
 */

import { computeStairGeometry } from '../StairGeometryService';
import type {
  Polygon3D,
  StairParams,
  StairTreadLabelDisplay,
  StairVariantWinder,
  StairWinderMethod,
} from '../../../../bim/types/stair-types';

const Z_TOL = 1e-9;

function makeWinderParams(overrides?: {
  stepCount?: number;
  winderCount?: number;
  turnAngle?: number;
  winderMethod?: StairWinderMethod;
  rise?: number;
  tread?: number;
  width?: number;
  cutPlaneHeight?: number;
  treadLabelDisplay?: StairTreadLabelDisplay;
}): StairParams {
  const stepCount = overrides?.stepCount ?? 14;
  const rise = overrides?.rise ?? 175;
  const variant: StairVariantWinder = {
    kind: 'winder',
    turnAngle: overrides?.turnAngle ?? 90,
    winderCount: overrides?.winderCount ?? 4,
    winderMethod: overrides?.winderMethod ?? 'equal-going',
  };
  return {
    basePoint: { x: 0, y: 0, z: 0 },
    direction: 0,
    rise,
    tread: overrides?.tread ?? 250,
    nosing: 0,
    nosingSide: 'none',
    width: overrides?.width ?? 1000,
    stepCount,
    totalRise: rise * stepCount,
    totalRun: 0,
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

function allTreads(g: ReturnType<typeof computeStairGeometry>): readonly Polygon3D[] {
  return [...g.treadsBelowCut, ...g.treadsAboveCut];
}

describe('StairGeometryService — winder', () => {
  it('Test 1: stepCount=14, winderCount=4 → 14 treads; pure flight 1 rectilinear', () => {
    const g = computeStairGeometry(makeWinderParams());
    const treads = allTreads(g);
    expect(treads).toHaveLength(14);
    // The first pure flight-1 tread starts at x=0 and is one tread deep along +X.
    // (ADR-630 Φ2c: `k` grows toward the tolerance, so the count of pure treads is
    //  k-dependent — assert the always-present first pure tread, k-agnostically.)
    expect(treads[0]).toHaveLength(4);
    expect(treads[0][0].x).toBeCloseTo(0, 6);
    const proj = treads[0].map((v) => v.x); // u1 = (1,0)
    expect(Math.max(...proj) - Math.min(...proj)).toBeCloseTo(250, 4);
  });

  it('Test 2: tread z progression Δz=rise across all 14 treads', () => {
    const g = computeStairGeometry(makeWinderParams());
    const treads = allTreads(g);
    for (let i = 0; i < treads.length; i++) {
      const expectedZ = 175 * i;
      for (const v of treads[i]) expect(Math.abs(v.z - expectedZ)).toBeLessThan(Z_TOL);
    }
  });

  it('Test 3: balanced band reaches the pivot P — several turn treads share it (no hole)', () => {
    // ADR-630 Phase 2 — the dancing-step wedges fill to the inner corner P.
    const g = computeStairGeometry(makeWinderParams());
    const treads = allTreads(g);
    const pivot = { x: 5 * 250, y: 500 }; // basePoint + u1·(n1·t) + v1·(+halfW), turnLeft
    const atPivot = treads.filter((t) =>
      t.some((v) => Math.hypot(v.x - pivot.x, v.y - pivot.y) < 1e-6),
    );
    expect(atPivot.length).toBeGreaterThanOrEqual(2);
  });

  it('Test 4: both winder methods produce the same balanced band reaching P', () => {
    // ADR-630 Phase 2 — the method (`pie`/`equal-going`) no longer changes the
    // shape; both drive the balanced band that fills to the pivot.
    const pivot = { x: 5 * 250, y: 500 };
    for (const winderMethod of ['pie', 'equal-going'] as const) {
      const treads = allTreads(computeStairGeometry(makeWinderParams({ winderMethod })));
      const atPivot = treads.filter((t) =>
        t.some((v) => Math.hypot(v.x - pivot.x, v.y - pivot.y) < 1e-6),
      );
      expect(atPivot.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('Test 5: pure flight 2 advances along u2 = rotate(u1, +90°) = (0,1)', () => {
    const g = computeStairGeometry(makeWinderParams());
    const treads = allTreads(g);
    // The last tread is the pure flight-2 end: one tread deep along u2=(0,1)
    // (k-agnostic — Φ2c grows the band, so the count of pure treads varies).
    const last = treads[treads.length - 1];
    const proj = last.map((v) => v.y); // u2 = (0,1)
    expect(Math.max(...proj) - Math.min(...proj)).toBeCloseTo(250, 4);
  });

  it('Test 6: stepCount=11, winderCount=3 → 11 treads, count conserved', () => {
    const g = computeStairGeometry(makeWinderParams({ stepCount: 11, winderCount: 3 }));
    const treads = allTreads(g);
    expect(treads).toHaveLength(11);
    // Pure flight 1 starts at x=0 and advances by one tread.
    expect(treads[0][0].x).toBeCloseTo(0, 6);
    expect(treads[1][0].x).toBeCloseTo(250, 6);
  });

  it('Test 7: walkline includes winder zone vertices (winderCount+3 = 7 total)', () => {
    const g = computeStairGeometry(makeWinderParams());
    expect(g.walkline).toHaveLength(7); // basePoint + (winderCount+1) winder samples + flight2 end
  });

  it('Test 8: stringers continuous through winder zone (same vertex count as walkline)', () => {
    const g = computeStairGeometry(makeWinderParams());
    expect(g.stringers.inner.length).toBe(g.walkline.length);
    expect(g.stringers.outer.length).toBe(g.walkline.length);
  });

  it('Test 9: cutLine emitted by default (totalRise=2450 > 1200), undefined for low rise', () => {
    const g = computeStairGeometry(makeWinderParams());
    expect(g.cutLine).toBeDefined();
    const low = computeStairGeometry(makeWinderParams({ rise: 50 }));
    expect(low.cutLine).toBeUndefined();
  });

  it("Test 10: 'kite'/'balanced' winderMethod throws /Phase 4c/", () => {
    expect(() => computeStairGeometry(makeWinderParams({ winderMethod: 'kite' })))
      .toThrow(/Phase 4c/);
    expect(() => computeStairGeometry(makeWinderParams({ winderMethod: 'balanced' })))
      .toThrow(/Phase 4c/);
  });

  it("Test 11: treadLabels 'all' span all stepCount treads", () => {
    const g = computeStairGeometry(makeWinderParams({ treadLabelDisplay: 'all' }));
    expect(g.treadLabels).toHaveLength(14);
  });

  it('Test 12: turnAngle=180° → u2 = -u1 = (-1,0); pure flight 2 advances along -X', () => {
    const g = computeStairGeometry(makeWinderParams({ turnAngle: 180 }));
    const treads = allTreads(g);
    // Last tread = pure flight-2 end: one tread deep along u2=(-1,0) (k-agnostic).
    const last = treads[treads.length - 1];
    const projX = last.map((v) => v.x); // depth along ±X
    expect(Math.max(...projX) - Math.min(...projX)).toBeCloseTo(250, 4);
  });
});
