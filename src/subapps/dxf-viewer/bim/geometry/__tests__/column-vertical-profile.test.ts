/**
 * Tests για τον SSoT column vertical-extent resolver (ADR-401 Phase F).
 *
 * Καλύπτει: scalar base/nominal-top (storey-ceiling/absolute/unconnected/
 * fallback), per-corner lower-envelope top (single/μερική κάλυψη/κεκλιμένο host/
 * cap στο nominal/missing host), per-corner upper-envelope base (bidirectional
 * πάνω/κάτω/ακάλυπτη γωνία/legacy host χωρίς topside), makeColumnHostResolver.
 */

import type { HostFootprintInput, Pt2 } from '../wall-host-plan-builder';
import {
  resolveColumnBaseZmm,
  resolveColumnNominalTopZmm,
  resolveColumnTopProfile,
  resolveColumnBaseProfile,
  makeColumnHostResolver,
  type ColumnVerticalContext,
  type ColumnVerticalParams,
} from '../column-vertical-profile';

/** 400×400 footprint στην αρχή (γωνίες CCW: SW, SE, NE, NW). */
const FOOTPRINT: readonly Pt2[] = [
  { x: 0, y: 0 },
  { x: 400, y: 0 },
  { x: 400, y: 400 },
  { x: 0, y: 400 },
];

function params(p: Partial<ColumnVerticalParams> = {}): ColumnVerticalParams {
  return {
    baseBinding: 'storey-floor',
    topBinding: 'storey-ceiling',
    baseOffset: 0,
    topOffset: 0,
    height: 3000,
    ...p,
  };
}

/** Host που καλύπτει ΟΛΟ το footprint (μεγάλο τετράγωνο). */
function fullHost(id: string, p: Partial<HostFootprintInput> = {}): HostFootprintInput {
  return {
    hostId: id,
    hostType: 'beam',
    footprint: [
      { x: -1000, y: -1000 },
      { x: 2000, y: -1000 },
      { x: 2000, y: 2000 },
      { x: -1000, y: 2000 },
    ],
    undersideZmm: 2500,
    ...p,
  };
}

/** Host που καλύπτει μόνο τις γωνίες με x ≥ 200 (SE + NE). */
function halfHost(id: string, p: Partial<HostFootprintInput> = {}): HostFootprintInput {
  return {
    hostId: id,
    hostType: 'beam',
    footprint: [
      { x: 200, y: -1000 },
      { x: 2000, y: -1000 },
      { x: 2000, y: 2000 },
      { x: 200, y: 2000 },
    ],
    undersideZmm: 2400,
    ...p,
  };
}

function ctxWith(hosts: readonly HostFootprintInput[], c: Partial<ColumnVerticalContext> = {}): ColumnVerticalContext {
  return { floorElevationMm: 0, resolveHostInput: makeColumnHostResolver(hosts), ...c };
}

// ─── Scalars ───────────────────────────────────────────────────────────────

describe('resolveColumnBaseZmm', () => {
  test('storey-floor → FFL + baseOffset', () => {
    expect(resolveColumnBaseZmm(params({ baseOffset: 100 }), { floorElevationMm: 3000 })).toBe(3100);
  });
  test('absolute → baseOffset (αγνοεί FFL)', () => {
    expect(resolveColumnBaseZmm(params({ baseBinding: 'absolute', baseOffset: 500 }), { floorElevationMm: 3000 })).toBe(500);
  });
});

describe('resolveColumnNominalTopZmm', () => {
  test('storey-ceiling χωρίς context → baseZ + height', () => {
    expect(resolveColumnNominalTopZmm(params({ height: 2850 }), { floorElevationMm: 0 })).toBe(2850);
  });
  test('storey-ceiling με next floor + slab → nextFFL − slab', () => {
    expect(
      resolveColumnNominalTopZmm(params(), { floorElevationMm: 0, nextFloorElevationMm: 3000, ceilingSlabThicknessMm: 150 }),
    ).toBe(2850);
  });
  test('absolute → topOffset', () => {
    expect(resolveColumnNominalTopZmm(params({ topBinding: 'absolute', topOffset: 2700 }), { floorElevationMm: 0 })).toBe(2700);
  });
  test('unconnected → baseZ + unconnectedHeight', () => {
    expect(
      resolveColumnNominalTopZmm(params({ topBinding: 'unconnected', unconnectedHeight: 1200 }), { floorElevationMm: 500 }),
    ).toBe(1700);
  });
});

// ─── Top profile ─────────────────────────────────────────────────────────────

describe('resolveColumnTopProfile', () => {
  test('μη-attached → επίπεδο top στο nominal, hasAttach=false', () => {
    const prof = resolveColumnTopProfile(params({ height: 2850 }), FOOTPRINT, { floorElevationMm: 0 });
    expect(prof.cornerTopZmm).toEqual([2850, 2850, 2850, 2850]);
    expect(prof.hasAttach).toBe(false);
    expect(prof.maxTopZmm).toBe(2850);
    expect(prof.minTopZmm).toBe(2850);
  });

  test('attached single host < nominal → όλες οι γωνίες στην κάτω-παρειά', () => {
    const prof = resolveColumnTopProfile(
      params({ topBinding: 'attached', attachTopToIds: ['b1'] }),
      FOOTPRINT,
      ctxWith([fullHost('b1', { undersideZmm: 2500 })], { nextFloorElevationMm: 3000 }),
    );
    expect(prof.cornerTopZmm).toEqual([2500, 2500, 2500, 2500]);
    expect(prof.hasAttach).toBe(true);
  });

  test('attached host > nominal → cap στο nominal (lower-envelope), hasAttach=false', () => {
    const prof = resolveColumnTopProfile(
      params({ topBinding: 'attached', attachTopToIds: ['b1'], height: 2800 }),
      FOOTPRINT,
      ctxWith([fullHost('b1', { undersideZmm: 5000 })]),
    );
    expect(prof.cornerTopZmm).toEqual([2800, 2800, 2800, 2800]);
    expect(prof.hasAttach).toBe(false);
  });

  test('μερική κάλυψη → σκαλωτό top (covered γωνίες κάτω, υπόλοιπες nominal)', () => {
    const prof = resolveColumnTopProfile(
      params({ topBinding: 'attached', attachTopToIds: ['b1'], height: 3000 }),
      FOOTPRINT,
      ctxWith([halfHost('b1', { undersideZmm: 2400 })]),
    );
    // SW(0,0) & NW(0,400) ακάλυπτα → 3000· SE(400,0) & NE(400,400) → 2400.
    expect(prof.cornerTopZmm).toEqual([3000, 2400, 2400, 3000]);
    expect(prof.maxTopZmm).toBe(3000);
    expect(prof.minTopZmm).toBe(2400);
    expect(prof.hasAttach).toBe(true);
  });

  test('κεκλιμένο host (undersideZmmAt) → κεκλιμένη κορυφή (γωνίες διαφέρουν)', () => {
    const prof = resolveColumnTopProfile(
      params({ topBinding: 'attached', attachTopToIds: ['r1'], height: 5000 }),
      FOOTPRINT,
      ctxWith([fullHost('r1', { hostType: 'roof', undersideZmm: 2000, undersideZmmAt: (pt) => 2000 + pt.x })]),
    );
    // x=0 → 2000, x=400 → 2400.
    expect(prof.cornerTopZmm).toEqual([2000, 2400, 2400, 2000]);
    expect(prof.hasAttach).toBe(true);
  });

  test('missing host → missingHostIds + fallback στο nominal', () => {
    const prof = resolveColumnTopProfile(
      params({ topBinding: 'attached', attachTopToIds: ['ghost'], height: 2850 }),
      FOOTPRINT,
      ctxWith([]),
    );
    expect(prof.missingHostIds).toEqual(['ghost']);
    expect(prof.cornerTopZmm).toEqual([2850, 2850, 2850, 2850]);
    expect(prof.hasAttach).toBe(false);
  });

  test('δύο hosts → lower-envelope ανά γωνία (το χαμηλότερο κερδίζει)', () => {
    const prof = resolveColumnTopProfile(
      params({ topBinding: 'attached', attachTopToIds: ['b1', 'b2'], height: 4000 }),
      FOOTPRINT,
      ctxWith([fullHost('b1', { undersideZmm: 2800 }), halfHost('b2', { undersideZmm: 2400 })]),
    );
    // SW/NW μόνο b1 → 2800· SE/NE min(2800,2400) → 2400.
    expect(prof.cornerTopZmm).toEqual([2800, 2400, 2400, 2800]);
    expect(prof.hasAttach).toBe(true);
  });
});

// ─── Base profile ────────────────────────────────────────────────────────────

describe('resolveColumnBaseProfile', () => {
  test('μη-attached → επίπεδη βάση στο nominal', () => {
    const prof = resolveColumnBaseProfile(params({ baseOffset: 200 }), FOOTPRINT, { floorElevationMm: 1000 });
    expect(prof.cornerBaseZmm).toEqual([1200, 1200, 1200, 1200]);
    expect(prof.hasAttach).toBe(false);
  });

  test('attached upper-envelope κάτω από nominal → βάση κατεβαίνει (bidirectional)', () => {
    const prof = resolveColumnBaseProfile(
      params({ baseBinding: 'attached', attachBaseToIds: ['f1'], baseOffset: 1000 }),
      FOOTPRINT,
      ctxWith([fullHost('f1', { hostType: 'slab', topsideZmm: 400 })], { floorElevationMm: 0 }),
    );
    expect(prof.cornerBaseZmm).toEqual([400, 400, 400, 400]);
    expect(prof.hasAttach).toBe(true);
  });

  test('attached upper-envelope πάνω από nominal → βάση ανεβαίνει', () => {
    const prof = resolveColumnBaseProfile(
      params({ baseBinding: 'attached', attachBaseToIds: ['f1'], baseOffset: 0 }),
      FOOTPRINT,
      ctxWith([fullHost('f1', { hostType: 'slab', topsideZmm: 600 })], { floorElevationMm: 0 }),
    );
    expect(prof.cornerBaseZmm).toEqual([600, 600, 600, 600]);
    expect(prof.hasAttach).toBe(true);
  });

  test('μερική κάλυψη → ακάλυπτη γωνία στο nominal base', () => {
    const prof = resolveColumnBaseProfile(
      params({ baseBinding: 'attached', attachBaseToIds: ['f1'], baseOffset: 0 }),
      FOOTPRINT,
      ctxWith([halfHost('f1', { hostType: 'slab', topsideZmm: 700 })], { floorElevationMm: 0 }),
    );
    // SW/NW ακάλυπτα → 0· SE/NE → 700.
    expect(prof.cornerBaseZmm).toEqual([0, 700, 700, 0]);
    expect(prof.hasAttach).toBe(true);
  });

  test('legacy host χωρίς topside → δεν συνεισφέρει, nominal base', () => {
    const prof = resolveColumnBaseProfile(
      params({ baseBinding: 'attached', attachBaseToIds: ['f1'], baseOffset: 250 }),
      FOOTPRINT,
      ctxWith([fullHost('f1', { undersideZmm: 100 })], { floorElevationMm: 0 }), // topsideZmm undefined
    );
    expect(prof.cornerBaseZmm).toEqual([250, 250, 250, 250]);
    expect(prof.hasAttach).toBe(false);
  });
});

// ─── Helper ─────────────────────────────────────────────────────────────────

describe('makeColumnHostResolver', () => {
  test('lookup ανά id, null για άγνωστο', () => {
    const resolve = makeColumnHostResolver([fullHost('b1'), halfHost('b2')]);
    expect(resolve('b1')?.hostId).toBe('b1');
    expect(resolve('nope')).toBeNull();
  });
});
