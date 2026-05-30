/**
 * Tests για τον SSoT vertical-extent resolver (ADR-401 Phase A).
 *
 * Καλύπτει: nominal modes (storey-ceiling/absolute/unconnected/fallback),
 * lower-envelope attached (single/σκαλωτή/μερική κάλυψη/κεκλιμένη/τομή baseline),
 * missing-host fallback, base resolution. Παράδειγμα ADR §1: 3.00→2.85→2.50.
 */

import {
  resolveWallBaseZmm,
  resolveWallNominalTopZmm,
  resolveWallTopProfile,
  type HostUndersidePlan,
  type WallVerticalContext,
  type WallVerticalParams,
} from '../wall-top-profile';

const Z_TOL = 6; // toBeCloseTo digits

function params(p: Partial<WallVerticalParams> = {}): WallVerticalParams {
  return {
    baseBinding: 'storey-floor',
    topBinding: 'storey-ceiling',
    baseOffset: 0,
    topOffset: 0,
    height: 3000,
    ...p,
  };
}

function hostsCtx(
  hosts: readonly HostUndersidePlan[],
  ctx: Partial<WallVerticalContext> = {},
): WallVerticalContext {
  const map = new Map(hosts.map((h) => [h.hostId, h]));
  return {
    floorElevationMm: 0,
    resolveHost: (id) => map.get(id) ?? null,
    ...ctx,
  };
}

describe('resolveWallBaseZmm', () => {
  test('storey-floor → FFL + baseOffset', () => {
    expect(resolveWallBaseZmm(params({ baseOffset: 100 }), { floorElevationMm: 3000 })).toBe(3100);
  });
  test('absolute → baseOffset ως απόλυτο (αγνοεί FFL)', () => {
    expect(resolveWallBaseZmm(params({ baseBinding: 'absolute', baseOffset: 500 }), { floorElevationMm: 3000 })).toBe(500);
  });
});

describe('resolveWallNominalTopZmm', () => {
  test('storey-ceiling χωρίς context → baseZ + height (fallback)', () => {
    expect(resolveWallNominalTopZmm(params({ height: 2850 }), { floorElevationMm: 0 })).toBe(2850);
  });
  test('storey-ceiling με next floor + slab → nextFFL − slab', () => {
    const top = resolveWallNominalTopZmm(params(), {
      floorElevationMm: 0,
      nextFloorElevationMm: 3000,
      ceilingSlabThicknessMm: 150,
    });
    expect(top).toBe(2850);
  });
  test('absolute → topOffset', () => {
    expect(resolveWallNominalTopZmm(params({ topBinding: 'absolute', topOffset: 2700 }), { floorElevationMm: 0 })).toBe(2700);
  });
  test('unconnected → baseZ + unconnectedHeight', () => {
    expect(
      resolveWallNominalTopZmm(params({ topBinding: 'unconnected', unconnectedHeight: 1200 }), { floorElevationMm: 500 }),
    ).toBe(1700);
  });
});

describe('resolveWallTopProfile — non-attached', () => {
  test('storey-ceiling → ένα segment, hasAttach=false', () => {
    const prof = resolveWallTopProfile(params(), { floorElevationMm: 0, nextFloorElevationMm: 3000, ceilingSlabThicknessMm: 150 });
    expect(prof.segments).toHaveLength(1);
    expect(prof.segments[0]).toMatchObject({ t0: 0, t1: 1, source: 'storey-ceiling' });
    expect(prof.maxTopZmm).toBe(2850);
    expect(prof.hasAttach).toBe(false);
    expect(prof.missingHostIds).toEqual([]);
  });
});

describe('resolveWallTopProfile — attached lower-envelope', () => {
  test('ADR §1 παράδειγμα: δοκάρι 2500 κάτω από baseline 2850 → 2,50μ', () => {
    const beam: HostUndersidePlan = { hostId: 'b1', hostType: 'beam', t0: 0, t1: 1, z0mm: 2500, z1mm: 2500 };
    const prof = resolveWallTopProfile(
      params({ topBinding: 'attached', attachTopToIds: ['b1'] }),
      hostsCtx([beam], { nextFloorElevationMm: 3000, ceilingSlabThicknessMm: 150 }),
    );
    expect(prof.segments).toHaveLength(1);
    expect(prof.segments[0]).toMatchObject({ source: 'attached', hostId: 'b1' });
    expect(prof.maxTopZmm).toBe(2500);
    expect(prof.hasAttach).toBe(true);
  });

  test('σκαλωτή — δύο δοκάρια διαφορετικού ύψους', () => {
    const a: HostUndersidePlan = { hostId: 'a', hostType: 'beam', t0: 0, t1: 0.5, z0mm: 2500, z1mm: 2500 };
    const b: HostUndersidePlan = { hostId: 'b', hostType: 'beam', t0: 0.5, t1: 1, z0mm: 2300, z1mm: 2300 };
    const prof = resolveWallTopProfile(
      params({ topBinding: 'attached', attachTopToIds: ['a', 'b'] }),
      hostsCtx([a, b], { nextFloorElevationMm: 3000, ceilingSlabThicknessMm: 150 }),
    );
    expect(prof.segments).toHaveLength(2);
    expect(prof.segments[0]).toMatchObject({ t0: 0, t1: 0.5, z0mm: 2500, hostId: 'a' });
    expect(prof.segments[1]).toMatchObject({ t0: 0.5, t1: 1, z0mm: 2300, hostId: 'b' });
    expect(prof.maxTopZmm).toBe(2500);
    expect(prof.minTopZmm).toBe(2300);
  });

  test('μερική κάλυψη — ακάλυπτο μένει στο storey-ceiling', () => {
    const beam: HostUndersidePlan = { hostId: 'b', hostType: 'beam', t0: 0.3, t1: 0.7, z0mm: 2500, z1mm: 2500 };
    const prof = resolveWallTopProfile(
      params({ topBinding: 'attached', attachTopToIds: ['b'] }),
      hostsCtx([beam], { nextFloorElevationMm: 3000, ceilingSlabThicknessMm: 150 }),
    );
    expect(prof.segments).toHaveLength(3);
    expect(prof.segments[0]).toMatchObject({ t0: 0, t1: 0.3, z0mm: 2850, source: 'storey-ceiling' });
    expect(prof.segments[1]).toMatchObject({ t0: 0.3, t1: 0.7, z0mm: 2500, source: 'attached' });
    expect(prof.segments[2]).toMatchObject({ t0: 0.7, t1: 1, z0mm: 2850, source: 'storey-ceiling' });
  });

  test('κεκλιμένο δοκάρι κάτω από baseline → ένα attached segment z0≠z1', () => {
    const beam: HostUndersidePlan = { hostId: 'b', hostType: 'beam', t0: 0, t1: 1, z0mm: 2600, z1mm: 2400 };
    const prof = resolveWallTopProfile(
      params({ topBinding: 'attached', attachTopToIds: ['b'] }),
      hostsCtx([beam], { nextFloorElevationMm: 3000, ceilingSlabThicknessMm: 150 }),
    );
    expect(prof.segments).toHaveLength(1);
    expect(prof.segments[0].z0mm).toBeCloseTo(2600, Z_TOL);
    expect(prof.segments[0].z1mm).toBeCloseTo(2400, Z_TOL);
    expect(prof.segments[0].source).toBe('attached');
  });

  test('κεκλιμένο δοκάρι που τέμνει το baseline → split storey-ceiling/attached', () => {
    // baseline 2850· beam 2900→2700· τομή στο t=0.25.
    const beam: HostUndersidePlan = { hostId: 'b', hostType: 'beam', t0: 0, t1: 1, z0mm: 2900, z1mm: 2700 };
    const prof = resolveWallTopProfile(
      params({ topBinding: 'attached', attachTopToIds: ['b'] }),
      hostsCtx([beam], { nextFloorElevationMm: 3000, ceilingSlabThicknessMm: 150 }),
    );
    expect(prof.segments).toHaveLength(2);
    expect(prof.segments[0]).toMatchObject({ source: 'storey-ceiling' });
    expect(prof.segments[0].t1).toBeCloseTo(0.25, 4);
    expect(prof.segments[0].z0mm).toBeCloseTo(2850, Z_TOL);
    expect(prof.segments[1].source).toBe('attached');
    expect(prof.segments[1].z1mm).toBeCloseTo(2700, Z_TOL);
  });

  test('host που λείπει → missingHostIds + baseline fallback', () => {
    const prof = resolveWallTopProfile(
      params({ topBinding: 'attached', attachTopToIds: ['ghost'] }),
      hostsCtx([], { nextFloorElevationMm: 3000, ceilingSlabThicknessMm: 150 }),
    );
    expect(prof.missingHostIds).toEqual(['ghost']);
    expect(prof.hasAttach).toBe(false);
    expect(prof.segments).toHaveLength(1);
    expect(prof.segments[0].z0mm).toBe(2850);
  });

  test('μερικώς ελλιπή hosts — ένας βρίσκεται, ένας λείπει', () => {
    const beam: HostUndersidePlan = { hostId: 'ok', hostType: 'beam', t0: 0, t1: 1, z0mm: 2500, z1mm: 2500 };
    const prof = resolveWallTopProfile(
      params({ topBinding: 'attached', attachTopToIds: ['ok', 'gone'] }),
      hostsCtx([beam], { nextFloorElevationMm: 3000, ceilingSlabThicknessMm: 150 }),
    );
    expect(prof.missingHostIds).toEqual(['gone']);
    expect(prof.hasAttach).toBe(true);
    expect(prof.maxTopZmm).toBe(2500);
  });
});
