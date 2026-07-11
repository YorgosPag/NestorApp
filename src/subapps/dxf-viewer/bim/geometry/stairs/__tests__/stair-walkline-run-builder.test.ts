/**
 * ADR-637 Phase 3 — unit tests for `buildWalklineRunWithLandings` (the walkline
 * rest-landing SSoT). Uses a synthetic STRAIGHT base walkline so every plan
 * coordinate is exact, isolating the stretch/reclassify logic from the ellipse/
 * sketch samplers.
 *
 * @see ../stair-walkline-run-builder.ts
 */

import { buildWalklineRunWithLandings } from '../stair-walkline-run-builder';
import type { Point3D, StairRestLanding } from '../../../../bim/types/stair-types';

const Z_TOL = 1e-9;
const XY_TOL = 1e-6;

// stepCount=5, going=250, rise=180, along +X. z_i = i·rise.
const GOING = 250;
const RISE = 180;
const WIDTH = 800;
function baseWalkline(): Point3D[] {
  const pts: Point3D[] = [];
  for (let i = 0; i <= 5; i++) pts.push({ x: GOING * i, y: 0, z: RISE * i });
  return pts;
}

describe('buildWalklineRunWithLandings', () => {
  it('empty schedule → walkline unchanged, every chord a tread, no landings', () => {
    const base = baseWalkline();
    const run = buildWalklineRunWithLandings(base, [], WIDTH, 1);
    expect(run.treads).toHaveLength(5);
    expect(run.landings).toHaveLength(0);
    expect(run.flightSplit).toEqual([5]);
    expect(run.walkline).toHaveLength(6);
    run.walkline.forEach((p, i) => {
      expect(p.x).toBeCloseTo(base[i].x, 6);
      expect(p.y).toBeCloseTo(base[i].y, 6);
      expect(p.z).toBeCloseTo(base[i].z, 6);
    });
  });

  it('one auto landing at mid-run → level 2, flat z, footprint grows, treads re-flow', () => {
    const landings: StairRestLanding[] = [{ id: 'l1', at: 0.5, length: 'auto' }];
    const run = buildWalklineRunWithLandings(baseWalkline(), landings, WIDTH, 1);

    // 5 levels, 1 landing at level 2 → 4 rising treads + 1 landing quad.
    expect(run.treads).toHaveLength(4);
    expect(run.landings).toHaveLength(1);
    expect(run.flightSplit).toEqual([2, 2]); // levels 0,1 | landing 2 | levels 3,4

    // z-model invariant: top z unchanged, all z untouched by the stretch.
    const w = run.walkline;
    expect(w[w.length - 1].z).toBeCloseTo(RISE * 5, 9);

    // Landing chord (level 2) sits flat at z = 2·rise, length = width (auto square).
    const landing = run.landings[0];
    for (const v of landing) expect(Math.abs(v.z - RISE * 2)).toBeLessThan(Z_TOL);
    // Plan length along +X between the two chord ends = auto length = WIDTH.
    // Landing quad winding [innerA, outerA, outerB, innerB] → chord = A-corners → B-corners.
    const chordLen = Math.abs(landing[2].x - landing[1].x); // outerB.x − outerA.x
    expect(chordLen).toBeCloseTo(WIDTH, 6);

    // Footprint grew by (autoLen − going) = 800 − 250 = 550 past the landing.
    expect(w[3].x).toBeCloseTo(500 + WIDTH, XY_TOL); // out[2].x(500) + 800
    expect(w[5].x).toBeCloseTo(GOING * 5 + (WIDTH - GOING), XY_TOL); // 1250 + 550 = 1800
  });

  it('explicit numeric length is honoured (footprint grows by length−going)', () => {
    const landings: StairRestLanding[] = [{ id: 'l1', at: 0.5, length: 1000 }];
    const run = buildWalklineRunWithLandings(baseWalkline(), landings, WIDTH, 1);
    const w = run.walkline;
    // out[2].x = 500, landing length 1000 → out[3].x = 1500.
    expect(w[3].x).toBeCloseTo(1500, XY_TOL);
    // downstream shift = 1000 − 250 = 750 → out[5].x = 1250 + 750 = 2000.
    expect(w[5].x).toBeCloseTo(2000, XY_TOL);
  });

  it('two landings → 3 rising sub-flights, 2 landings, contract landings = flights−1', () => {
    const landings: StairRestLanding[] = [
      { id: 'a', at: 0.25, length: 'auto' },
      { id: 'b', at: 0.75, length: 'auto' },
    ];
    const run = buildWalklineRunWithLandings(baseWalkline(), landings, WIDTH, 1);
    expect(run.landings).toHaveLength(2);
    expect(run.flightSplit.length).toBe(run.landings.length + 1);
    // Rising treads = total levels − landings.
    expect(run.treads).toHaveLength(5 - 2);
  });
});
