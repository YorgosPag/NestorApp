/**
 * ADR-401 Phase B — wall-host-plan-builder SSoT tests.
 *
 * Καλύπτει: plan-overlap (segment ∩ polygon t-intervals), underside formulas
 * (§2.3), makeResolveHost lookup, και το πλήρες chain host→builder→resolver
 * (lower-envelope σκαλωτή κορυφή) incl. το παράδειγμα ADR §1 3.00→2.85→2.50.
 */

import {
  buildHostUndersidePlans,
  makeResolveHost,
  beamHostInput,
  slabHostInput,
  buildWallHostInputs,
  type HostFootprintInput,
  type Pt2,
} from '../wall-host-plan-builder';
import {
  resolveWallTopProfile,
  evaluateWallTopAt,
  type WallVerticalParams,
  type WallVerticalContext,
} from '../wall-top-profile';
import type { BeamEntity } from '../../types/beam-types';
import type { SlabEntity } from '../../types/slab-types';

// ─── Fixtures ────────────────────────────────────────────────────────────────

const WALL_START: Pt2 = { x: 0, y: 0 };
const WALL_END: Pt2 = { x: 10, y: 0 };

/** Άξονο-ευθυγραμμισμένο ορθογώνιο footprint που καλύπτει x∈[xa,xb] γύρω από y=0. */
function rectHost(id: string, xa: number, xb: number, undersideZmm: number): HostFootprintInput {
  return {
    hostId: id,
    hostType: 'beam',
    footprint: [
      { x: xa, y: -1 },
      { x: xb, y: -1 },
      { x: xb, y: 1 },
      { x: xa, y: 1 },
    ],
    undersideZmm,
  };
}

function attachedWallParams(ids: string[]): WallVerticalParams {
  return {
    baseBinding: 'storey-floor',
    topBinding: 'attached',
    baseOffset: 0,
    topOffset: 0,
    height: 2850,
    attachTopToIds: ids,
  };
}

/** ctx με storey-ceiling baseline 2850 (next FFL 3000 − slab 150). */
function ceilingCtx(resolveHost: WallVerticalContext['resolveHost']): WallVerticalContext {
  return { floorElevationMm: 0, nextFloorElevationMm: 3000, ceilingSlabThicknessMm: 150, resolveHost };
}

// ─── buildHostUndersidePlans — plan-overlap ──────────────────────────────────

describe('buildHostUndersidePlans — plan-overlap span', () => {
  it('beam crossing the middle → single span [0.4,0.6]', () => {
    const plans = buildHostUndersidePlans(WALL_START, WALL_END, [rectHost('b1', 4, 6, 2500)]);
    expect(plans).toHaveLength(1);
    expect(plans[0].t0).toBeCloseTo(0.4, 9);
    expect(plans[0].t1).toBeCloseTo(0.6, 9);
    expect(plans[0].z0mm).toBe(2500);
    expect(plans[0].z1mm).toBe(2500);
    expect(plans[0].hostId).toBe('b1');
  });

  it('host fully covering the wall → [0,1]', () => {
    const plans = buildHostUndersidePlans(WALL_START, WALL_END, [rectHost('b1', -5, 15, 2400)]);
    expect(plans).toHaveLength(1);
    expect(plans[0].t0).toBeCloseTo(0, 9);
    expect(plans[0].t1).toBeCloseTo(1, 9);
  });

  it('host covering from the start → [0,0.5]', () => {
    const plans = buildHostUndersidePlans(WALL_START, WALL_END, [rectHost('b1', -3, 5, 2400)]);
    expect(plans).toHaveLength(1);
    expect(plans[0].t0).toBeCloseTo(0, 9);
    expect(plans[0].t1).toBeCloseTo(0.5, 9);
  });

  it('host not overlapping → no plans', () => {
    const plans = buildHostUndersidePlans(WALL_START, WALL_END, [rectHost('b1', 20, 25, 2400)]);
    expect(plans).toHaveLength(0);
  });

  it('degenerate footprint (<3 verts) → skipped', () => {
    const bad: HostFootprintInput = { hostId: 'x', hostType: 'beam', footprint: [{ x: 0, y: 0 }], undersideZmm: 2400 };
    expect(buildHostUndersidePlans(WALL_START, WALL_END, [bad])).toHaveLength(0);
  });

  it('concave footprint (notch) → two spans', () => {
    // U-shape πάνω από τον άξονα: καλύπτει x∈[1,3] και x∈[7,9], κενό στη μέση.
    const concave: HostFootprintInput = {
      hostId: 'u1',
      hostType: 'slab',
      undersideZmm: 2400,
      footprint: [
        { x: 1, y: -1 }, { x: 3, y: -1 }, { x: 3, y: 0.5 }, { x: 7, y: 0.5 },
        { x: 7, y: -1 }, { x: 9, y: -1 }, { x: 9, y: 1 }, { x: 1, y: 1 },
      ],
    };
    const plans = buildHostUndersidePlans(WALL_START, WALL_END, [concave]);
    expect(plans).toHaveLength(2);
    expect(plans[0].t0).toBeCloseTo(0.1, 9);
    expect(plans[0].t1).toBeCloseTo(0.3, 9);
    expect(plans[1].t0).toBeCloseTo(0.7, 9);
    expect(plans[1].t1).toBeCloseTo(0.9, 9);
  });
});

// ─── makeResolveHost ─────────────────────────────────────────────────────────

describe('makeResolveHost', () => {
  it('returns plan by id, null for missing', () => {
    const resolve = makeResolveHost(WALL_START, WALL_END, [rectHost('b1', 4, 6, 2500)]);
    expect(resolve('b1')?.z0mm).toBe(2500);
    expect(resolve('nope')).toBeNull();
  });

  it('concave multi-span host → largest span wins (Phase E refinement noted)', () => {
    const concave: HostFootprintInput = {
      hostId: 'u1',
      hostType: 'slab',
      undersideZmm: 2400,
      footprint: [
        { x: 1, y: -1 }, { x: 2, y: -1 }, { x: 2, y: 0.5 }, { x: 6, y: 0.5 },
        { x: 6, y: -1 }, { x: 9, y: -1 }, { x: 9, y: 1 }, { x: 1, y: 1 },
      ],
    };
    const plan = makeResolveHost(WALL_START, WALL_END, [concave])('u1');
    // spans: [0.1,0.2] (0.1) και [0.6,0.9] (0.3) → κρατά το μεγαλύτερο.
    expect(plan?.t0).toBeCloseTo(0.6, 9);
    expect(plan?.t1).toBeCloseTo(0.9, 9);
  });
});

// ─── Full chain: host → builder → resolver (lower-envelope) ───────────────────

describe('resolveWallTopProfile + host plans (ADR §1 παράδειγμα)', () => {
  it('3.00→2.85(−πλάκα)→2.50(−δοκάρι): σκαλωτή κορυφή', () => {
    const resolve = makeResolveHost(WALL_START, WALL_END, [rectHost('beam1', 4, 6, 2500)]);
    const profile = resolveWallTopProfile(attachedWallParams(['beam1']), ceilingCtx(resolve));

    expect(profile.hasAttach).toBe(true);
    expect(profile.maxTopZmm).toBe(2850);
    expect(profile.minTopZmm).toBe(2500);
    expect(profile.missingHostIds).toHaveLength(0);
    // 3 segments: ceiling 2850 | attached 2500 | ceiling 2850
    expect(profile.segments).toHaveLength(3);
    expect(profile.segments[0].source).toBe('storey-ceiling');
    expect(profile.segments[0].z0mm).toBe(2850);
    expect(profile.segments[1].source).toBe('attached');
    expect(profile.segments[1].z0mm).toBe(2500);
    expect(profile.segments[1].t0).toBeCloseTo(0.4, 9);
    expect(profile.segments[1].t1).toBeCloseTo(0.6, 9);
    expect(profile.segments[2].source).toBe('storey-ceiling');
  });

  it('δύο δοκάρια διαφορετικού ύψους → σκαλωτή lower-envelope', () => {
    const resolve = makeResolveHost(WALL_START, WALL_END, [
      rectHost('a', 2, 5, 2500),
      rectHost('b', 5, 8, 2300),
    ]);
    const profile = resolveWallTopProfile(attachedWallParams(['a', 'b']), ceilingCtx(resolve));
    const tops = profile.segments.map((s) => s.z0mm);
    expect(tops).toEqual([2850, 2500, 2300, 2850]);
  });

  it('επικαλυπτόμενα δοκάρια → χαμηλότερο κερδίζει στην τομή', () => {
    const resolve = makeResolveHost(WALL_START, WALL_END, [
      rectHost('a', 2, 7, 2500),
      rectHost('b', 4, 9, 2300),
    ]);
    const profile = resolveWallTopProfile(attachedWallParams(['a', 'b']), ceilingCtx(resolve));
    // [0,0.2]2850 | [0.2,0.4]2500(a) | [0.4,0.9]2300(b) | [0.9,1]2850
    expect(profile.segments.map((s) => s.z0mm)).toEqual([2850, 2500, 2300, 2850]);
    expect(profile.minTopZmm).toBe(2300);
  });

  it('host που λείπει → missingHostIds + fallback baseline', () => {
    const resolve = makeResolveHost(WALL_START, WALL_END, []); // κανένας host
    const profile = resolveWallTopProfile(attachedWallParams(['ghost']), ceilingCtx(resolve));
    expect(profile.missingHostIds).toEqual(['ghost']);
    expect(profile.hasAttach).toBe(false);
    expect(profile.segments).toHaveLength(1);
    expect(profile.segments[0].z0mm).toBe(2850);
  });
});

// ─── evaluateWallTopAt ───────────────────────────────────────────────────────

describe('evaluateWallTopAt', () => {
  const resolve = makeResolveHost(WALL_START, WALL_END, [rectHost('beam1', 4, 6, 2500)]);
  const profile = resolveWallTopProfile(attachedWallParams(['beam1']), ceilingCtx(resolve));

  it('μέσα στο attached span → 2500', () => {
    expect(evaluateWallTopAt(profile, 0.5)).toBeCloseTo(2500, 6);
  });
  it('εκτός attached span → 2850 (storey-ceiling)', () => {
    expect(evaluateWallTopAt(profile, 0.1)).toBeCloseTo(2850, 6);
    expect(evaluateWallTopAt(profile, 0.9)).toBeCloseTo(2850, 6);
  });
  it('clamps t εκτός [0,1]', () => {
    expect(evaluateWallTopAt(profile, -0.5)).toBeCloseTo(2850, 6);
    expect(evaluateWallTopAt(profile, 1.5)).toBeCloseTo(2850, 6);
  });

  it('κεκλιμένο segment → γραμμική παρεμβολή', () => {
    // attached host με z0≠z1 (κεκλιμένο δοκάρι) πλήρους κάλυψης
    const sloped: WallVerticalContext = ceilingCtx((id) =>
      id === 's1' ? { hostId: 's1', hostType: 'beam', t0: 0, t1: 1, z0mm: 2400, z1mm: 2600 } : null,
    );
    const p = resolveWallTopProfile(attachedWallParams(['s1']), sloped);
    expect(evaluateWallTopAt(p, 0)).toBeCloseTo(2400, 6);
    expect(evaluateWallTopAt(p, 0.5)).toBeCloseTo(2500, 6);
    expect(evaluateWallTopAt(p, 1)).toBeCloseTo(2600, 6);
  });
});

// ─── Entity adapters (§2.3 formulas) ─────────────────────────────────────────

describe('beamHostInput / slabHostInput — underside formulas', () => {
  it('beam underside = topElevation + zOffset − depth', () => {
    const beam = {
      id: 'beam_1',
      type: 'beam',
      kind: 'straight',
      params: {
        kind: 'straight',
        startPoint: { x: 0, y: 0 },
        endPoint: { x: 4000, y: 0 },
        width: 250,
        depth: 500,
        topElevation: 3000,
        zOffset: 0,
        sceneUnits: 'mm',
      },
    } as unknown as BeamEntity;
    const input = beamHostInput(beam);
    expect(input.hostId).toBe('beam_1');
    expect(input.hostType).toBe('beam');
    expect(input.undersideZmm).toBe(2500); // 3000 + 0 − 500
    expect(input.footprint.length).toBeGreaterThanOrEqual(4);
  });

  it('slab underside = levelElevation + heightOffset − thickness', () => {
    const slab = {
      id: 'slab_1',
      type: 'slab',
      kind: 'floor',
      params: {
        kind: 'floor',
        outline: { vertices: [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 5000 }, { x: 0, y: 5000 }] },
        levelElevation: 3000,
        heightOffsetFromLevel: 0,
        thickness: 150,
        geometryType: 'box',
      },
    } as unknown as SlabEntity;
    const input = slabHostInput(slab);
    expect(input.hostId).toBe('slab_1');
    expect(input.hostType).toBe('slab');
    expect(input.undersideZmm).toBe(2850); // 3000 + 0 − 150
    expect(input.footprint).toHaveLength(4);
  });
});

// ─── buildWallHostInputs (SSoT, B3b) ─────────────────────────────────────────

describe('buildWallHostInputs — SSoT σύνθεση beams + slabs', () => {
  const beam = {
    id: 'beam_1', type: 'beam', kind: 'straight',
    params: {
      kind: 'straight', startPoint: { x: 0, y: 0 }, endPoint: { x: 4000, y: 0 },
      width: 250, depth: 500, topElevation: 3000, zOffset: 0, sceneUnits: 'mm',
    },
  } as unknown as BeamEntity;
  const slab = {
    id: 'slab_1', type: 'slab', kind: 'floor',
    params: {
      kind: 'floor',
      outline: { vertices: [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 5000 }, { x: 0, y: 5000 }] },
      levelElevation: 3000, heightOffsetFromLevel: 0, thickness: 150, geometryType: 'box',
    },
  } as unknown as SlabEntity;

  it('beams first, slabs after — ίδιο output με το inline pattern', () => {
    const out = buildWallHostInputs([beam], [slab]);
    expect(out).toHaveLength(2);
    expect(out[0].hostId).toBe('beam_1');
    expect(out[0].hostType).toBe('beam');
    expect(out[1].hostId).toBe('slab_1');
    expect(out[1].hostType).toBe('slab');
    expect(out[0].undersideZmm).toBe(2500);
    expect(out[1].undersideZmm).toBe(2850);
  });

  it('κενά arrays → κενό', () => {
    expect(buildWallHostInputs([], [])).toHaveLength(0);
  });
});
