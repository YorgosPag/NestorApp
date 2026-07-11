/**
 * ADR-611 Φ4 (ADR-358 Q19) — per-tread nosing SSoT tests.
 *
 * Covers the `stair-tread-overrides` module directly (resolver + plan pass) AND
 * the end-to-end cascade through `computeStairGeometry` (the footprint the 2D
 * renderer + 3D flat-extrude + BOQ all read).
 *
 * Geometry frame: +X/+Y math frame, canonical mm. Straight fixture:
 *   stepCount=10, rise=175, tread=280, nosing=25, width=1000, basePoint=(0,0,0).
 *
 * @see ../stair-tread-overrides.ts
 */

import {
  resolveTreadNosing,
  applyPerTreadNosing,
} from '../stair-tread-overrides';
import { computeStairGeometry } from '../StairGeometryService';
import type {
  Point2D,
  Polygon3D,
  StairParams,
  StairPerTreadOverride,
  StairVariantStraight,
} from '../../../../bim/types/stair-types';

const COORD_TOL = 1e-6;

function makeStraightParams(
  perTreadOverrides?: Record<number, StairPerTreadOverride>,
  extra?: { direction?: number; nosing?: number },
): StairParams {
  const rise = 175;
  const tread = 280;
  const stepCount = 10;
  const variant: StairVariantStraight = { kind: 'straight' };
  return {
    basePoint: { x: 0, y: 0, z: 0 },
    direction: extra?.direction ?? 0,
    rise,
    tread,
    nosing: extra?.nosing ?? 25,
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
    cutPlaneHeight: undefined,
    variant,
    walklineOffset: 300,
    handrails: { inner: false, outer: false, height: 900 },
    upDirection: 'forward',
    treadNumberStart: 1,
    treadLabelDisplay: 'none',
    treadLabelRestartPerFlight: false,
    codeProfile: 'none',
    ...(perTreadOverrides ? { perTreadOverrides } : {}),
  };
}

/** Maximum vertex coordinate along an axis — the leading-edge position for a +axis flight. */
function maxAlong(poly: Polygon3D, axis: 'x' | 'y'): number {
  return Math.max(...poly.map((p) => p[axis]));
}

describe('resolveTreadNosing — precedence chain', () => {
  it('falls back to params.nosing with no override', () => {
    const params = makeStraightParams();
    expect(resolveTreadNosing(params, 3)).toEqual({ overhangDepth: 25 });
  });

  it('uses override.nosing over params.nosing', () => {
    const params = makeStraightParams({ 2: { nosing: 60 } });
    expect(resolveTreadNosing(params, 2)).toEqual({ overhangDepth: 60 });
  });

  it('customProfile max-depth wins over nosing and carries the section', () => {
    const section: Point2D[] = [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 40 },
      { x: 0, y: 40 },
    ];
    const params = makeStraightParams({ 1: { nosing: 50, customProfile: section } });
    const resolved = resolveTreadNosing(params, 1);
    expect(resolved.overhangDepth).toBe(80);
    expect(resolved.section).toBe(section);
  });

  it('clamps a negative overhang to zero', () => {
    const params = makeStraightParams({ 0: { nosing: -10 } });
    expect(resolveTreadNosing(params, 0).overhangDepth).toBe(0);
  });
});

describe('applyPerTreadNosing — plan-footprint pass', () => {
  it('returns the SAME reference when there are no overrides', () => {
    const params = makeStraightParams();
    const treads: Polygon3D[] = [
      [
        { x: 0, y: -500, z: 0 },
        { x: 305, y: -500, z: 0 },
        { x: 305, y: 500, z: 0 },
        { x: 0, y: 500, z: 0 },
      ],
    ];
    expect(applyPerTreadNosing(treads, params)).toBe(treads);
  });

  it('leaves treads without an override untouched', () => {
    const params = makeStraightParams({ 0: { nosing: 60 } });
    const geom = computeStairGeometry(params);
    // tread 1 has no override → default 305mm depth (leading edge at x=585 for i=1).
    expect(maxAlong(geom.treads[1]!, 'x')).toBeCloseTo(585, COORD_TOL);
  });
});

describe('computeStairGeometry — per-tread nosing cascade', () => {
  it('extends only the overridden tread front edge (+X flight)', () => {
    const base = computeStairGeometry(makeStraightParams());
    const withOverride = computeStairGeometry(makeStraightParams({ 0: { nosing: 60 } }));
    // tread 0 default leading edge = tread + nosing = 305; override 60 → 340.
    expect(maxAlong(base.treads[0]!, 'x')).toBeCloseTo(305, COORD_TOL);
    expect(maxAlong(withOverride.treads[0]!, 'x')).toBeCloseTo(340, COORD_TOL);
    // Back edge (x=0) unchanged — nosing is a forward overhang only.
    expect(Math.min(...withOverride.treads[0]!.map((p) => p.x))).toBeCloseTo(0, COORD_TOL);
  });

  it('customProfile drives the plan overhang via its max depth', () => {
    const section: Point2D[] = [
      { x: 0, y: 0 },
      { x: 80, y: 0 },
      { x: 80, y: 40 },
      { x: 0, y: 40 },
    ];
    const geom = computeStairGeometry(makeStraightParams({ 2: { customProfile: section } }));
    // tread 2 leading edge = 280*2 + (280 + 80)? No — footprint depth = tread + overhang.
    // tread i back edge at x=280*i; front edge = 280*i + tread(280) + overhang(80) − tread? …
    // Simpler: default front edge for tread 2 = 280*2 + 305 = 865; overhang 80 → +55 → 920.
    expect(maxAlong(geom.treads[2]!, 'x')).toBeCloseTo(920, COORD_TOL);
  });

  it('is winding-agnostic — extends along +Y for a 90° flight', () => {
    const base = computeStairGeometry(makeStraightParams(undefined, { direction: 90 }));
    const withOverride = computeStairGeometry(
      makeStraightParams({ 0: { nosing: 75 } }, { direction: 90 }),
    );
    // +Y flight: leading edge grows along +Y by (75 − 25) = 50mm.
    expect(maxAlong(withOverride.treads[0]!, 'y') - maxAlong(base.treads[0]!, 'y')).toBeCloseTo(
      50,
      COORD_TOL,
    );
  });

  it('leaves geometry byte-identical when the override equals params.nosing', () => {
    const base = computeStairGeometry(makeStraightParams());
    const noop = computeStairGeometry(makeStraightParams({ 0: { nosing: 25 } }));
    expect(noop.treads[0]).toEqual(base.treads[0]);
  });
});
