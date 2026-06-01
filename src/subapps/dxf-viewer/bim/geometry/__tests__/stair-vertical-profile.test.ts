/**
 * Tests για τον SSoT stair vertical-extent resolver (ADR-401 Phase G).
 *
 * Mirror του `column-vertical-profile.test.ts`, αλλά με **stair semantics**:
 * upper-envelope base (κάθεται στην ψηλότερη άνω-παρειά), lower-envelope top
 * (σταματά στη χαμηλότερη κάτω-παρειά, unbounded) και **whole-step snap** του
 * resolved `totalRise` σε ακέραια σκαλοπάτια (Revit ίσα risers). Καλύπτει: fast
 * path, base upper-envelope, top lower-envelope, whole-step snap, degenerate,
 * missing host, both-attached, rise<=0 guard, stepCount≥1, makeStairHostResolver.
 */

import type { HostFootprintInput, Pt2 } from '../wall-host-plan-builder';
import {
  resolveStairBaseZmm,
  resolveStairTopZmm,
  resolveStairVerticalProfile,
  makeStairHostResolver,
  type StairVerticalContext,
  type StairVerticalParams,
} from '../stair-vertical-profile';

/**
 * Nominal ίσια σκάλα: base (0,0,0), run κατά +X (dir=0), totalRun=3000, width=1000.
 * 10 σκαλοπάτια × 180mm rise = totalRise 1800 → nominal top στο Z=1800.
 *
 * Με direction=0: u={1,0}, perp(u)={0,1} →
 *   - base samples = (0,0), (0,±500)
 *   - top samples  = (3000,0), (3000,±500)
 */
function params(p: Partial<StairVerticalParams> = {}): StairVerticalParams {
  return {
    basePoint: { x: 0, y: 0, z: 0 },
    direction: 0,
    totalRun: 3000,
    width: 1000,
    rise: 180,
    stepCount: 10,
    totalRise: 1800,
    ...p,
  };
}

/** Host που καλύπτει ΟΛΑ τα samples (base x=0 + top x=3000), y από -1000 ως 1000. */
function fullHost(id: string, p: Partial<HostFootprintInput> = {}): HostFootprintInput {
  return {
    hostId: id,
    hostType: 'beam',
    footprint: [
      { x: -1000, y: -1000 },
      { x: 4000, y: -1000 },
      { x: 4000, y: 1000 },
      { x: -1000, y: 1000 },
    ],
    undersideZmm: 1500,
    ...p,
  };
}

/** Host μακριά από τα samples → δεν συνεισφέρει (ακάλυπτο). */
function offHost(id: string, p: Partial<HostFootprintInput> = {}): HostFootprintInput {
  return {
    hostId: id,
    hostType: 'beam',
    footprint: [
      { x: 5000, y: 5000 },
      { x: 6000, y: 5000 },
      { x: 6000, y: 6000 },
      { x: 5000, y: 6000 },
    ],
    undersideZmm: 1500,
    ...p,
  };
}

function ctxWith(hosts: readonly HostFootprintInput[]): StairVerticalContext {
  return { resolveHostInput: makeStairHostResolver(hosts) };
}

// ─── Base resolution (upper-envelope) ─────────────────────────────────────────

describe('resolveStairBaseZmm', () => {
  test('μη-attached → nominal basePoint.z, hasAttach=false', () => {
    const r = resolveStairBaseZmm(params({ basePoint: { x: 0, y: 0, z: 250 } }), {});
    expect(r.baseZmm).toBe(250);
    expect(r.hasAttach).toBe(false);
    expect(r.missingHostIds).toEqual([]);
  });

  test('attached single host → host topside (κάθεται πάνω)', () => {
    const r = resolveStairBaseZmm(
      params({ baseBinding: 'attached', attachBaseToIds: ['f1'] }),
      ctxWith([fullHost('f1', { hostType: 'slab', topsideZmm: 300 })]),
    );
    expect(r.baseZmm).toBe(300);
    expect(r.hasAttach).toBe(true);
  });

  test('attached 2 hosts → upper-envelope (ψηλότερη άνω-παρειά κερδίζει)', () => {
    const r = resolveStairBaseZmm(
      params({ baseBinding: 'attached', attachBaseToIds: ['f1', 'f2'] }),
      ctxWith([
        fullHost('f1', { hostType: 'slab', topsideZmm: 300 }),
        fullHost('f2', { hostType: 'slab', topsideZmm: 500 }),
      ]),
    );
    expect(r.baseZmm).toBe(500);
    expect(r.hasAttach).toBe(true);
  });

  test('attached αλλά ακάλυπτο sample → nominal, hasAttach=false', () => {
    const r = resolveStairBaseZmm(
      params({ baseBinding: 'attached', attachBaseToIds: ['f1'] }),
      ctxWith([offHost('f1', { hostType: 'slab', topsideZmm: 300 })]),
    );
    expect(r.baseZmm).toBe(0);
    expect(r.hasAttach).toBe(false);
  });

  test('missing host → missingHostIds + nominal fallback', () => {
    const r = resolveStairBaseZmm(
      params({ baseBinding: 'attached', attachBaseToIds: ['ghost'] }),
      ctxWith([]),
    );
    expect(r.missingHostIds).toEqual(['ghost']);
    expect(r.baseZmm).toBe(0);
    expect(r.hasAttach).toBe(false);
  });
});

// ─── Top resolution (lower-envelope, unbounded) ───────────────────────────────

describe('resolveStairTopZmm', () => {
  test('μη-attached → baseZmm + rise × stepCount', () => {
    const r = resolveStairTopZmm(params(), 0, {});
    expect(r.topZmm).toBe(1800);
    expect(r.hasAttach).toBe(false);
  });

  test('attached single host → host underside', () => {
    const r = resolveStairTopZmm(
      params({ topBinding: 'attached', attachTopToIds: ['b1'] }),
      0,
      ctxWith([fullHost('b1', { undersideZmm: 1500 })]),
    );
    expect(r.topZmm).toBe(1500);
    expect(r.hasAttach).toBe(true);
  });

  test('attached 2 hosts → lower-envelope (χαμηλότερη κάτω-παρειά κερδίζει)', () => {
    const r = resolveStairTopZmm(
      params({ topBinding: 'attached', attachTopToIds: ['b1', 'b2'] }),
      0,
      ctxWith([fullHost('b1', { undersideZmm: 1500 }), fullHost('b2', { undersideZmm: 1200 })]),
    );
    expect(r.topZmm).toBe(1200);
    expect(r.hasAttach).toBe(true);
  });

  test('attached αλλά ακάλυπτο sample → nominal, hasAttach=false', () => {
    const r = resolveStairTopZmm(
      params({ topBinding: 'attached', attachTopToIds: ['b1'] }),
      0,
      ctxWith([offHost('b1', { undersideZmm: 1500 })]),
    );
    expect(r.topZmm).toBe(1800);
    expect(r.hasAttach).toBe(false);
  });

  test('missing host → missingHostIds + nominal fallback', () => {
    const r = resolveStairTopZmm(
      params({ topBinding: 'attached', attachTopToIds: ['ghost'] }),
      0,
      ctxWith([]),
    );
    expect(r.missingHostIds).toEqual(['ghost']);
    expect(r.topZmm).toBe(1800);
    expect(r.hasAttach).toBe(false);
  });
});

// ─── Combined profile (+ whole-step snap) ─────────────────────────────────────

describe('resolveStairVerticalProfile', () => {
  test('fast path (καμία attach) → nominal byte-for-byte', () => {
    const prof = resolveStairVerticalProfile(params(), {});
    expect(prof.baseZmm).toBe(0);
    expect(prof.topZmm).toBe(1800);
    expect(prof.totalRise).toBe(1800);
    expect(prof.stepCount).toBe(10);
    expect(prof.rise).toBe(180);
    expect(prof.topHasAttach).toBe(false);
    expect(prof.baseHasAttach).toBe(false);
    expect(prof.degenerate).toBe(false);
    expect(prof.missingHostIds).toEqual([]);
  });

  test('base attached only → baseZmm = host topside, top nominal-relative + re-snap', () => {
    const prof = resolveStairVerticalProfile(
      params({ baseBinding: 'attached', attachBaseToIds: ['f1'] }),
      ctxWith([fullHost('f1', { hostType: 'slab', topsideZmm: 300 })]),
    );
    expect(prof.baseZmm).toBe(300);
    // top μη-attached → nominal = baseZmm + rise×stepCount = 300 + 1800 = 2100.
    expect(prof.topZmm).toBe(2100);
    expect(prof.totalRise).toBe(1800);
    expect(prof.stepCount).toBe(10);
    expect(prof.rise).toBe(180);
    expect(prof.baseHasAttach).toBe(true);
    expect(prof.topHasAttach).toBe(false);
    expect(prof.degenerate).toBe(false);
  });

  test('top attached only → topZmm = host underside, whole-step snap', () => {
    const prof = resolveStairVerticalProfile(
      params({ topBinding: 'attached', attachTopToIds: ['b1'] }),
      ctxWith([fullHost('b1', { undersideZmm: 1500 })]),
    );
    expect(prof.baseZmm).toBe(0);
    expect(prof.topZmm).toBe(1500);
    expect(prof.totalRise).toBe(1500);
    // round(1500/180) = round(8.33) = 8· rise = 1500/8 = 187.5.
    expect(prof.stepCount).toBe(8);
    expect(prof.rise).toBeCloseTo(187.5, 6);
    expect(prof.topHasAttach).toBe(true);
    expect(prof.degenerate).toBe(false);
  });

  test('whole-step snap (Revit ίσα risers) — totalRise 1700 → 9 σκαλοπάτια', () => {
    const prof = resolveStairVerticalProfile(
      params({ topBinding: 'attached', attachTopToIds: ['b1'] }),
      ctxWith([fullHost('b1', { undersideZmm: 1700 })]),
    );
    expect(prof.topZmm).toBe(1700);
    // round(1700/180) = round(9.44) = 9· rise = 1700/9 ≈ 188.9 (ακριβής συνάντηση top).
    expect(prof.stepCount).toBe(9);
    expect(prof.rise).toBeCloseTo(1700 / 9, 6);
    expect(prof.totalRise).toBe(1700);
  });

  test('both attached → base upper-envelope + top lower-envelope, snap στο ενδιάμεσο', () => {
    const prof = resolveStairVerticalProfile(
      params({
        baseBinding: 'attached',
        attachBaseToIds: ['f1'],
        topBinding: 'attached',
        attachTopToIds: ['b1'],
      }),
      ctxWith([
        fullHost('f1', { hostType: 'slab', topsideZmm: 300 }),
        fullHost('b1', { undersideZmm: 2100 }),
      ]),
    );
    expect(prof.baseZmm).toBe(300);
    expect(prof.topZmm).toBe(2100);
    expect(prof.totalRise).toBe(1800);
    expect(prof.stepCount).toBe(10);
    expect(prof.rise).toBe(180);
    expect(prof.baseHasAttach).toBe(true);
    expect(prof.topHasAttach).toBe(true);
  });

  test('degenerate (top underside ≤ base) → fallback nominal σκαλοπάτια + flag', () => {
    const prof = resolveStairVerticalProfile(
      params({ topBinding: 'attached', attachTopToIds: ['b1'] }),
      ctxWith([fullHost('b1', { undersideZmm: -500 })]), // κάτω από τη βάση (0)
    );
    expect(prof.degenerate).toBe(true);
    expect(prof.baseZmm).toBe(0);
    expect(prof.topZmm).toBe(1800); // base + rise×stepCount (nominal fallback)
    expect(prof.stepCount).toBe(10);
    expect(prof.rise).toBe(180);
    expect(prof.topHasAttach).toBe(true);
  });

  test('rise ≤ 0 guard → degenerate fallback', () => {
    const prof = resolveStairVerticalProfile(
      params({ rise: 0, stepCount: 10, totalRise: 0, topBinding: 'attached', attachTopToIds: ['b1'] }),
      ctxWith([fullHost('b1', { undersideZmm: 1500 })]),
    );
    expect(prof.degenerate).toBe(true);
    expect(prof.rise).toBe(0);
    expect(prof.stepCount).toBe(10);
    expect(prof.topZmm).toBe(0); // base + rise×stepCount = 0
  });

  test('stepCount ≥ 1 (Math.max) — πολύ μικρό totalRise', () => {
    const prof = resolveStairVerticalProfile(
      params({ topBinding: 'attached', attachTopToIds: ['b1'] }),
      ctxWith([fullHost('b1', { undersideZmm: 50 })]),
    );
    // round(50/180) = round(0.27) = 0 → Math.max(1, 0) = 1· rise = 50/1 = 50.
    expect(prof.stepCount).toBe(1);
    expect(prof.rise).toBe(50);
    expect(prof.topZmm).toBe(50);
    expect(prof.degenerate).toBe(false);
  });

  test('missing host → missingHostIds + nominal fast-path', () => {
    const prof = resolveStairVerticalProfile(
      params({ topBinding: 'attached', attachTopToIds: ['ghost'] }),
      ctxWith([]),
    );
    expect(prof.missingHostIds).toEqual(['ghost']);
    expect(prof.topZmm).toBe(1800);
    expect(prof.stepCount).toBe(10);
    expect(prof.degenerate).toBe(false);
  });
});

// ─── Helper ───────────────────────────────────────────────────────────────────

describe('makeStairHostResolver', () => {
  test('lookup ανά id, null για άγνωστο', () => {
    const resolve = makeStairHostResolver([fullHost('b1'), fullHost('b2')]);
    expect(resolve('b1')?.hostId).toBe('b1');
    expect(resolve('nope')).toBeNull();
  });
});
