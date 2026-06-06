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
  roofHostInput,
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
import type { RoofEntity } from '../../types/roof-types';

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

// ─── Phase E2 — tilted roof/slab host (κεκλιμένη κάτω-παρειά) ─────────────────

describe('slabHostInput — tilted roof host (Phase E2)', () => {
  /** Roof slab 0..10000mm, level 3000, thick 200, 10% κλίση +X, pivot center. */
  const tiltedRoof = {
    id: 'roof_1', type: 'slab', kind: 'roof',
    params: {
      kind: 'roof',
      outline: { vertices: [{ x: 0, y: 0 }, { x: 10000, y: 0 }, { x: 10000, y: 10000 }, { x: 0, y: 10000 }] },
      levelElevation: 3000, thickness: 200,
      geometryType: 'tilted',
      slope: { direction: 0, angle: 10, pivotEdge: 'center' },
    },
  } as unknown as SlabEntity;

  it('roof slab → hostType=roof + undersideZmmAt ορισμένο', () => {
    const input = slabHostInput(tiltedRoof);
    expect(input.hostType).toBe('roof');
    expect(typeof input.undersideZmmAt).toBe('function');
    // x=10000 → top 3500, underside 3300· x=0 → underside 2300.
    expect(input.undersideZmmAt!({ x: 10000, y: 5000 })).toBeCloseTo(3300, 6);
    expect(input.undersideZmmAt!({ x: 0, y: 5000 })).toBeCloseTo(2300, 6);
  });

  it('box slab → ΧΩΡΙΣ undersideZmmAt (flat scalar back-compat)', () => {
    const boxSlab = {
      id: 'slab_2', type: 'slab', kind: 'floor',
      params: {
        kind: 'floor',
        outline: { vertices: [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 5000 }, { x: 0, y: 5000 }] },
        levelElevation: 3000, heightOffsetFromLevel: 0, thickness: 150, geometryType: 'box',
      },
    } as unknown as SlabEntity;
    expect(slabHostInput(boxSlab).undersideZmmAt).toBeUndefined();
  });

  it('buildHostUndersidePlans → sloped plan z0mm ≠ z1mm κατά μήκος άξονα', () => {
    const wallStart: Pt2 = { x: 1000, y: 5000 };
    const wallEnd: Pt2 = { x: 9000, y: 5000 };
    const plans = buildHostUndersidePlans(wallStart, wallEnd, [slabHostInput(tiltedRoof)]);
    expect(plans).toHaveLength(1);
    // t0 @ x=1000 → top 2600, underside 2400· t1 @ x=9000 → top 3400, underside 3200.
    expect(plans[0].z0mm).toBeCloseTo(2400, 6);
    expect(plans[0].z1mm).toBeCloseTo(3200, 6);
  });

  it('πλήρες chain → wall top ακολουθεί κλίση (evaluateWallTopAt 0≠1)', () => {
    const wallStart: Pt2 = { x: 1000, y: 5000 };
    const wallEnd: Pt2 = { x: 9000, y: 5000 };
    const resolveHost = makeResolveHost(wallStart, wallEnd, [slabHostInput(tiltedRoof)]);
    const params: WallVerticalParams = {
      baseBinding: 'storey-floor', topBinding: 'attached',
      baseOffset: 0, topOffset: 0, height: 5000, // nominal ψηλό → host είναι το lower-envelope
      attachTopToIds: ['roof_1'],
    };
    const ctx: WallVerticalContext = { floorElevationMm: 0, resolveHost };
    const profile = resolveWallTopProfile(params, ctx);
    expect(profile.hasAttach).toBe(true);
    expect(profile.missingHostIds).toHaveLength(0);
    expect(evaluateWallTopAt(profile, 0)).toBeCloseTo(2400, 6);
    expect(evaluateWallTopAt(profile, 1)).toBeCloseTo(3200, 6);
    // monotonικά αύξον (κλίση) — μέσο ~2800
    expect(evaluateWallTopAt(profile, 0.5)).toBeCloseTo(2800, 6);
  });
});

// ─── ADR-417 Φ4 — roofHostInput (ADR-417 parametric RoofEntity) ──────────────

describe('roofHostInput — ADR-417 Φ4 (parametric RoofEntity)', () => {
  /**
   * Flat roof (no slope-defining edges): 5m×5m outline, basePivotZ=3000mm, thickness=200mm.
   * Αναμένουμε: undersideZmm = 2800, undersideZmmAt = 2800 παντού.
   */
  const flatRoof = {
    id: 'roof_flat', type: 'roof', kind: 'roof',
    ifcType: 'IfcRoof',
    params: {
      outline: { vertices: [
        { x: 0, y: 0, z: 3000 }, { x: 5000, y: 0, z: 3000 },
        { x: 5000, y: 5000, z: 3000 }, { x: 0, y: 5000, z: 3000 },
      ] },
      edges: [
        { definesSlope: false, slope: 0, overhangMm: 0 },
        { definesSlope: false, slope: 0, overhangMm: 0 },
        { definesSlope: false, slope: 0, overhangMm: 0 },
        { definesSlope: false, slope: 0, overhangMm: 0 },
      ],
      slopeUnit: 'deg',
      basePivotZ: 3000,
      thickness: 200,
      sceneUnits: 'mm',
    },
  } as unknown as RoofEntity;

  /**
   * Gable roof: 10m×5m footprint, γείσο στο +Y και −Y (definesSlope=true, 45°).
   * Η κορυφή (ridge) ανεβαίνει 2500mm πάνω από basePivotZ=3000mm (ratio=1, half-width=2500mm).
   * basePivotZ=3000, thickness=200, sceneUnits='mm'.
   * Γείσο: eave midpoint (x=5000, y=0 ή y=5000) → z=3000, underside=2800.
   * Κορφιάς midpoint (x=5000, y=2500) → z=3000+2500=5500, underside=5300.
   */
  const gableRoof = {
    id: 'roof_gable', type: 'roof', kind: 'roof',
    ifcType: 'IfcRoof',
    params: {
      outline: { vertices: [
        { x: 0, y: 0, z: 3000 }, { x: 10000, y: 0, z: 3000 },
        { x: 10000, y: 5000, z: 3000 }, { x: 0, y: 5000, z: 3000 },
      ] },
      edges: [
        { definesSlope: true, slope: 45, overhangMm: 0 },   // +Y eave
        { definesSlope: false, slope: 0, overhangMm: 0 },   // gable end
        { definesSlope: true, slope: 45, overhangMm: 0 },   // −Y eave
        { definesSlope: false, slope: 0, overhangMm: 0 },   // gable end
      ],
      slopeUnit: 'deg',
      basePivotZ: 3000,
      thickness: 200,
      sceneUnits: 'mm',
    },
  } as unknown as RoofEntity;

  it('flat roof → undersideZmm = basePivotZ − thickness', () => {
    const input = roofHostInput(flatRoof);
    expect(input.hostId).toBe('roof_flat');
    expect(input.hostType).toBe('roof');
    expect(input.undersideZmm).toBe(2800);
    expect(typeof input.undersideZmmAt).toBe('function');
  });

  it('flat roof → undersideZmmAt παντού = basePivotZ − thickness (planes=[]))', () => {
    const input = roofHostInput(flatRoof);
    expect(input.undersideZmmAt!({ x: 0, y: 0 })).toBeCloseTo(2800, 6);
    expect(input.undersideZmmAt!({ x: 2500, y: 2500 })).toBeCloseTo(2800, 6);
    expect(input.undersideZmmAt!({ x: 5000, y: 5000 })).toBeCloseTo(2800, 6);
  });

  it('gable roof → eave edge (y=0) undersideZmmAt = 2800 (nominal)', () => {
    const input = roofHostInput(gableRoof);
    // Γείσο midpoint — απόσταση 0 από την ακμή → z=basePivotZ → underside=2800.
    expect(input.undersideZmmAt!({ x: 5000, y: 0 })).toBeCloseTo(2800, 1);
  });

  it('gable roof → ridge midpoint (y=2500) undersideZmmAt = basePivotZ + 2500 − thickness', () => {
    const input = roofHostInput(gableRoof);
    // Κορφιάς: dist=2500mm από κάθε γείσο (ratio=tan45°=1) → rise=2500mm → z=5500→underside=5300.
    expect(input.undersideZmmAt!({ x: 5000, y: 2500 })).toBeCloseTo(5300, 1);
  });

  it('gable roof → topsideZmm absent (top-only host)', () => {
    const input = roofHostInput(gableRoof);
    expect(input.topsideZmm).toBeUndefined();
    expect(input.topsideZmmAt).toBeUndefined();
  });

  it('buildWallHostInputs με roofs → roofHostInput συμπεριλαμβάνεται', () => {
    const beam = {
      id: 'b1', type: 'beam', kind: 'straight',
      params: { kind: 'straight', startPoint: { x: 0, y: 0 }, endPoint: { x: 4000, y: 0 }, width: 250, depth: 500, topElevation: 3000, zOffset: 0, sceneUnits: 'mm' },
    } as unknown as BeamEntity;
    const slab = {
      id: 's1', type: 'slab', kind: 'floor',
      params: { kind: 'floor', outline: { vertices: [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 5000 }, { x: 0, y: 5000 }] }, levelElevation: 3000, heightOffsetFromLevel: 0, thickness: 150, geometryType: 'box' },
    } as unknown as SlabEntity;
    const out = buildWallHostInputs([beam], [slab], [flatRoof]);
    expect(out).toHaveLength(3);
    expect(out[2].hostId).toBe('roof_flat');
    expect(out[2].hostType).toBe('roof');
  });

  it('buildWallHostInputs χωρίς roofs → backward-compat (2 hosts)', () => {
    const beam = {
      id: 'b1', type: 'beam', kind: 'straight',
      params: { kind: 'straight', startPoint: { x: 0, y: 0 }, endPoint: { x: 4000, y: 0 }, width: 250, depth: 500, topElevation: 3000, zOffset: 0, sceneUnits: 'mm' },
    } as unknown as BeamEntity;
    const slab = {
      id: 's1', type: 'slab', kind: 'floor',
      params: { kind: 'floor', outline: { vertices: [{ x: 0, y: 0 }, { x: 5000, y: 0 }, { x: 5000, y: 5000 }, { x: 0, y: 5000 }] }, levelElevation: 3000, heightOffsetFromLevel: 0, thickness: 150, geometryType: 'box' },
    } as unknown as SlabEntity;
    expect(buildWallHostInputs([beam], [slab])).toHaveLength(2);
  });
});
