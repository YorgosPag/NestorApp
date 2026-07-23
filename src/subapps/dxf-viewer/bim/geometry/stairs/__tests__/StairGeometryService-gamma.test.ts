/**
 * ADR-358 Phase 3b — `StairGeometryService` gamma (Γ) tests.
 *
 * Default parameterization:
 *   - flightSplit=[3,4,3], stepCount=10, turnSequence=['right','right']
 *   - rise=175, tread=280, width=1000
 *   - landings=['auto','auto'] (→ width)
 *   - basePoint=(0,0,0), direction=0° (+X)
 *
 * z model (one rise per landing transition, prompt §1.2):
 *   - landing[0] z = n1·rise = 525
 *   - flight 2 last tread z = (n1+n2)·rise = 1225
 *   - landing[1] z = (n1+n2+1)·rise = 1400
 *   - flight 3 last tread z = (stepCount+1)·rise = 1925
 *
 * @see ../stair-geometry-gamma.ts
 */

import { computeStairGeometry } from '../StairGeometryService';
import type {
  StairParams,
  StairVariantGamma,
  Polygon3D,
  StairTurnDirectionLR,
  StairLandingCornerStyle,
} from '../../../../bim/types/stair-types';

const COORD_TOL = 1e-6;
const Z_TOL = 1e-9;

function makeGammaParams(overrides?: {
  flightSplit?: readonly [number, number, number];
  turnSequence?: readonly [StairTurnDirectionLR, StairTurnDirectionLR];
  landings?: readonly ['auto' | number, 'auto' | number];
  landingCornerStyle?: StairLandingCornerStyle;
  treadLabelRestartPerFlight?: boolean;
  treadLabelDisplay?: 'all' | 'nth' | 'none';
  treadNumberStart?: number;
}): StairParams {
  const flightSplit = overrides?.flightSplit ?? ([3, 4, 3] as const);
  const stepCount = flightSplit[0] + flightSplit[1] + flightSplit[2];
  const rise = 175;
  const tread = 280;
  const variant: StairVariantGamma = {
    kind: 'gamma',
    turnSequence: overrides?.turnSequence ?? (['right', 'right'] as const),
    landings: overrides?.landings ?? (['auto', 'auto'] as const),
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
    totalRise: rise * (stepCount + 1),
    totalRun: tread * stepCount,
    pitch: 30,
    structureType: 'monolithic',
    riserType: 'closed',
    antiskidNosing: false,
    adaContrastStrip: false,
    variant,
    walklineOffset: 300,
    handrails: { inner: false, outer: false, height: 900 },
    upDirection: 'forward',
    treadNumberStart: overrides?.treadNumberStart ?? 1,
    treadLabelDisplay: overrides?.treadLabelDisplay ?? 'none',
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

describe('StairGeometryService — Gamma (Γ)', () => {
  it('Test 1: flightSplit=[3,4,3] → 10 treads + 2 landings', () => {
    const g = computeStairGeometry(makeGammaParams());
    expect(g.treadsBelowCut.length + g.treadsAboveCut.length).toBe(10);
    expect(g.landings).toHaveLength(2);
  });

  it('Test 2: landings[0].z = n1·rise = 525; landings[1].z = (n1+n2+1)·rise = 1400', () => {
    const g = computeStairGeometry(makeGammaParams());
    for (const v of g.landings[0]) {
      expect(Math.abs(v.z - 525)).toBeLessThan(Z_TOL);
    }
    for (const v of g.landings[1]) {
      expect(Math.abs(v.z - 1400)).toBeLessThan(Z_TOL);
    }
  });

  it("Test 3: flight 2 direction = right of u1 = (0, -1) for turnSequence[0]='right'", () => {
    const g = computeStairGeometry(makeGammaParams());
    const all: readonly Polygon3D[] = [...g.treadsBelowCut, ...g.treadsAboveCut];
    const c3 = centroidXY(all[3]); // first flight 2 tread
    const c4 = centroidXY(all[4]); // second flight 2 tread
    expect(c4.y - c3.y).toBeCloseTo(-280, 6);
    expect(Math.abs(c4.x - c3.x)).toBeLessThan(COORD_TOL);
  });

  it("Test 4: flight 3 direction = right of u2 = (-1, 0) for turnSequence=['right','right']", () => {
    const g = computeStairGeometry(makeGammaParams());
    const all: readonly Polygon3D[] = [...g.treadsBelowCut, ...g.treadsAboveCut];
    const c7 = centroidXY(all[7]); // first flight 3 tread
    const c8 = centroidXY(all[8]); // second flight 3 tread
    expect(c8.x - c7.x).toBeCloseTo(-280, 6);
    expect(Math.abs(c8.y - c7.y)).toBeLessThan(COORD_TOL);
  });

  it("Test 5: turnSequence=['right','left'] → flight 3 parallel to flight 1", () => {
    const g = computeStairGeometry(makeGammaParams({ turnSequence: ['right', 'left'] }));
    const all: readonly Polygon3D[] = [...g.treadsBelowCut, ...g.treadsAboveCut];
    const c7 = centroidXY(all[7]);
    const c8 = centroidXY(all[8]);
    expect(c8.x - c7.x).toBeCloseTo(280, 6); // +u1 direction
    expect(Math.abs(c8.y - c7.y)).toBeLessThan(COORD_TOL);
  });

  it('Test 6: walkline has 6 vertices (2 L-corner pairs)', () => {
    const g = computeStairGeometry(makeGammaParams());
    expect(g.walkline).toHaveLength(6);
  });

  it('Test 7: stringers have 6 vertices each; outer/inner miter at both L corners = halfW·√2', () => {
    const g = computeStairGeometry(makeGammaParams());
    const outer = g.stringers.outer;
    const inner = g.stringers.inner;
    expect(outer).toHaveLength(6);
    expect(inner).toHaveLength(6);
    const expectedMiter = 500 * Math.sqrt(2);
    // L corner 1 = walkline[2], L corner 2 = walkline[4]
    const pivots = [g.walkline[2], g.walkline[4]];
    const outerMiters = [outer[2], outer[4]];
    const innerMiters = [inner[2], inner[4]];
    for (let i = 0; i < 2; i++) {
      const dOuter = Math.hypot(outerMiters[i].x - pivots[i].x, outerMiters[i].y - pivots[i].y);
      const dInner = Math.hypot(innerMiters[i].x - pivots[i].x, innerMiters[i].y - pivots[i].y);
      expect(dOuter).toBeCloseTo(expectedMiter, 6);
      expect(dInner).toBeCloseTo(expectedMiter, 6);
    }
  });

  it("Test 8: landings='auto' → both landings have area = width²", () => {
    const g = computeStairGeometry(makeGammaParams());
    expect(polygonAreaXY(g.landings[0])).toBeCloseTo(1000 * 1000, 3);
    expect(polygonAreaXY(g.landings[1])).toBeCloseTo(1000 * 1000, 3);
  });

  it('Test 9: landings[1]=1500 override → area = width · 1500', () => {
    const g = computeStairGeometry(makeGammaParams({ landings: ['auto', 1500] }));
    expect(polygonAreaXY(g.landings[1])).toBeCloseTo(1000 * 1500, 3);
  });

  it('Test 10: continuous numbering with γ landings → 12 labels (10 treads + 2 landings)', () => {
    const g = computeStairGeometry(
      makeGammaParams({ treadLabelDisplay: 'all', treadLabelRestartPerFlight: false }),
    );
    expect(g.treadLabels).toHaveLength(12);
    if (!g.treadLabels) throw new Error('expected labels');
    expect(g.treadLabels.map(l => l.text)).toEqual(
      ['1','2','3','4','5','6','7','8','9','10','11','12'],
    );
    // ADR-358 Phase 3e γ: indices 3 and 8 are landings (after flight1 of 3 and flight2 of 4).
    expect(g.treadLabels[3].kind).toBe('landing');
    expect(g.treadLabels[8].kind).toBe('landing');
    expect(g.treadLabels[0].kind).toBe('tread');
  });

  it('Test 11: restartPerFlight=true → flights restart, landings number after preceding flight', () => {
    const g = computeStairGeometry(
      makeGammaParams({ treadLabelDisplay: 'all', treadLabelRestartPerFlight: true }),
    );
    if (!g.treadLabels) throw new Error('expected labels');
    // Landing localIdx = preceding flightSize → flight1(n1=3) landing1 text = "4"; flight2(n2=4) landing2 = "5".
    expect(g.treadLabels.map(l => l.text)).toEqual([
      '1','2','3',          // flight 1 (n1=3)
      '4',                  // landing 1 (= n1+1 in flight1 local frame)
      '1','2','3','4',      // flight 2 (n2=4)
      '5',                  // landing 2 (= n2+1)
      '1','2','3',          // flight 3 (n3=3)
    ]);
  });

  it("Test 12: landingCornerStyle 'chamfer' / 'fillet' throws (Phase 3c)", () => {
    expect(() => computeStairGeometry(makeGammaParams({ landingCornerStyle: 'chamfer' }))).toThrow(
      /Phase 3c/,
    );
    expect(() => computeStairGeometry(makeGammaParams({ landingCornerStyle: 'fillet' }))).toThrow(
      /Phase 3c/,
    );
  });

  // ADR-358 — flight 3 is edge-origin off flight 2's EDGE end (not a centreline).
  // Regression for the constant halfW gap: flight 3 was offset by `v2·turnSign2·halfW`
  // as if run2 ended on the centreline, leaving it a half-width away from landing 2
  // (visible as a disconnected 3rd flight in plan AND 3D).
  it('Test 13: flight 3 first tread is FLUSH against landing 2 (no gap) — all 4 turn combos', () => {
    const combos: readonly (readonly [StairTurnDirectionLR, StairTurnDirectionLR])[] = [
      ['right', 'right'], ['right', 'left'], ['left', 'right'], ['left', 'left'],
    ];
    for (const turnSequence of combos) {
      const g = computeStairGeometry(makeGammaParams({ turnSequence }));
      const all: readonly Polygon3D[] = [...g.treadsBelowCut, ...g.treadsAboveCut];
      const flight3First = all[7]; // idx: n1(3) + n2(4) = 7 → first flight-3 tread
      const landing2 = g.landings[1];
      // The tread's back width-edge shares BOTH its vertices with landing 2's boundary
      // → zero gap. Pre-fix these were halfW=500 apart.
      let shared = 0;
      for (const a of flight3First) {
        for (const b of landing2) {
          if (Math.hypot(a.x - b.x, a.y - b.y) < COORD_TOL) shared++;
        }
      }
      expect(shared).toBeGreaterThanOrEqual(2);
    }
  });

  // ADR-358 — the bespoke 6-vertex walkline (→ stringers + handrails) must track the
  // run-built treads. Regression for the `(n−1)·tread` leg length that pulled the
  // walkline ~1 tread off the steps, mis-seating stringers/handrails by one tread.
  it('Test 14: walkline flight-3 segment is collinear with the flight-3 tread centreline', () => {
    const g = computeStairGeometry(makeGammaParams());
    const all: readonly Polygon3D[] = [...g.treadsBelowCut, ...g.treadsAboveCut];
    const flight3 = all.slice(7, 10).map(centroidXY); // n3 = 3
    const wStart = g.walkline[g.walkline.length - 2];
    const wEnd = g.walkline[g.walkline.length - 1];
    const dx = wEnd.x - wStart.x;
    const dy = wEnd.y - wStart.y;
    const len = Math.hypot(dx, dy);
    for (const c of flight3) {
      const dist = Math.abs((c.x - wStart.x) * dy - (c.y - wStart.y) * dx) / len;
      expect(dist).toBeLessThan(COORD_TOL);
    }
  });
});
