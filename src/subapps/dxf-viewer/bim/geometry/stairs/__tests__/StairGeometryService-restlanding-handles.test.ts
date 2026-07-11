/**
 * ADR-637 Phase 4-A — `StairGeometry.restLandingHandles` output (grip-placement SSoT).
 *
 * The handle set is computed by `buildRectilinearRun` from the SAME cursor walk
 * that builds each landing quad, so a handle's centre/along/length can never
 * disagree with the drawn landing. This suite proves the straight-run path emits
 * one handle per rest landing with the right id + centre (on the run centreline
 * at the landing's level z) + resolved length, and that the field is ABSENT when
 * the stair carries no rest landings (back-compat).
 *
 * @see ../StairGeometryService.ts
 * @see ../stair-flight-run-builder.ts
 */

import { computeStairGeometry } from '../StairGeometryService';
import type {
  StairParams,
  StairRestLanding,
  StairVariantStraight,
} from '../../../../bim/types/stair-types';

function makeStraightParams(restLandings?: readonly StairRestLanding[]): StairParams {
  const stepCount = 10;
  const rise = 175;
  const tread = 280;
  const variant: StairVariantStraight = { kind: 'straight' };
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
    totalRun: tread * (stepCount - 1),
    pitch: 30,
    structureType: 'monolithic',
    riserType: 'closed',
    antiskidNosing: false,
    adaContrastStrip: false,
    variant,
    restLandings,
    walklineOffset: 300,
    handrails: { inner: false, outer: false, height: 900 },
    upDirection: 'forward',
    treadNumberStart: 1,
    treadLabelDisplay: 'none',
    treadLabelRestartPerFlight: false,
    codeProfile: 'none',
  };
}

describe('StairGeometryService — restLandingHandles (ADR-637 Phase 4-A)', () => {
  it('straight with one landing → 1 handle, correct id / centre / along / length', () => {
    const g = computeStairGeometry(makeStraightParams([{ id: 'l1', at: 0.5, length: 'auto' }]));
    expect(g.restLandingHandles).toHaveLength(1);
    const h = g.restLandingHandles![0];
    expect(h.id).toBe('l1');
    // at=0.5, stepCount=10 → level 5 → z = 175·5 = 875. Flight 1 = 5 treads → along
    // 280·5 = 1400; 'auto' length → width 1000 → centre on centreline at 1400 + 500.
    expect(h.center.x).toBeCloseTo(1900, 6);
    expect(h.center.y).toBeCloseTo(0, 6); // run centreline (direction 0)
    expect(h.center.z).toBeCloseTo(875, 6);
    expect(h.along.x).toBeCloseTo(1, 6);
    expect(h.along.y).toBeCloseTo(0, 6);
    expect(h.length).toBeCloseTo(1000, 6);
    expect(h.depth).toBeCloseTo(1000, 6);
  });

  it('handle centre coincides with the drawn landing quad centroid (SSoT)', () => {
    const g = computeStairGeometry(makeStraightParams([{ id: 'l1', at: 0.5, length: 1500 }]));
    const quad = g.landings[0];
    const cx = quad.reduce((s, v) => s + v.x, 0) / quad.length;
    const cy = quad.reduce((s, v) => s + v.y, 0) / quad.length;
    const h = g.restLandingHandles![0];
    expect(h.center.x).toBeCloseTo(cx, 6);
    expect(h.center.y).toBeCloseTo(cy, 6);
    expect(h.length).toBeCloseTo(1500, 6);
  });

  it('two landings → 2 handles, ids preserved in run order', () => {
    const g = computeStairGeometry(
      makeStraightParams([
        { id: 'a', at: 0.3, length: 'auto' },
        { id: 'b', at: 0.7, length: 'auto' },
      ]),
    );
    expect(g.restLandingHandles).toHaveLength(2);
    expect(g.restLandingHandles!.map((h) => h.id)).toEqual(['a', 'b']);
  });

  it('no rest landings → restLandingHandles ABSENT (back-compat)', () => {
    expect(computeStairGeometry(makeStraightParams()).restLandingHandles).toBeUndefined();
    expect(computeStairGeometry(makeStraightParams([])).restLandingHandles).toBeUndefined();
  });
});
