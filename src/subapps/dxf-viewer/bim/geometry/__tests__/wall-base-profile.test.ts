/**
 * Tests — wall-base-profile resolver (ADR-401 γ, base-attach upper-envelope).
 *
 * Καλύπτει τα 3 top-risks του plan:
 *  (1) `highestAt` comparator (upper-envelope = MAX topside),
 *  (2) bidirectional φορά (base κατεβαίνει ΚΑΙ ανεβαίνει — Revit),
 *  (3) missing host → fallback + missingHostIds.
 */

import {
  resolveWallBaseProfile,
  evaluateWallBaseAt,
} from '../wall-base-profile';
import type {
  WallVerticalParams,
  WallVerticalContext,
  HostTopsidePlan,
} from '../wall-top-profile';

const baseParams: WallVerticalParams = {
  baseBinding: 'storey-floor',
  topBinding: 'storey-ceiling',
  baseOffset: 0, // → nominal base = floorElevationMm + 0 = 0
  topOffset: 0,
  height: 3000,
};

function ctxWith(hosts: Record<string, HostTopsidePlan>): WallVerticalContext {
  return {
    floorElevationMm: 0,
    nextFloorElevationMm: 3000,
    resolveHostTopside: (id) => hosts[id] ?? null,
  };
}

const attached = (ids: string[]): WallVerticalParams => ({
  ...baseParams,
  baseBinding: 'attached',
  attachBaseToIds: ids,
});

const plan = (hostId: string, z0mm: number, z1mm = z0mm, t0 = 0, t1 = 1): HostTopsidePlan => ({
  hostId,
  hostType: 'beam',
  t0,
  t1,
  z0mm,
  z1mm,
});

describe('resolveWallBaseProfile', () => {
  it('non-attached → single nominal segment at base', () => {
    const p = resolveWallBaseProfile(baseParams, ctxWith({}));
    expect(p.hasAttach).toBe(false);
    expect(p.segments).toHaveLength(1);
    expect(p.segments[0].z0mm).toBe(0);
    expect(p.minBaseZmm).toBe(0);
  });

  it('bidirectional DOWN — host topside below nominal → base drops (foundation)', () => {
    const p = resolveWallBaseProfile(attached(['f1']), ctxWith({ f1: plan('f1', -300) }));
    expect(p.hasAttach).toBe(true);
    expect(evaluateWallBaseAt(p, 0.5)).toBe(-300);
    expect(p.minBaseZmm).toBe(-300);
  });

  it('bidirectional UP — host topside above nominal → base rises (upstand)', () => {
    const p = resolveWallBaseProfile(attached(['s1']), ctxWith({ s1: plan('s1', 200) }));
    expect(evaluateWallBaseAt(p, 0.5)).toBe(200);
    expect(p.maxBaseZmm).toBe(200);
  });

  it('upper-envelope — multiple overlapping hosts → rests on HIGHEST (highestAt)', () => {
    const p = resolveWallBaseProfile(
      attached(['a', 'b']),
      ctxWith({ a: plan('a', 100), b: plan('b', 300) }),
    );
    // Όλο το span καλύπτεται από αμφότερα → πατάει στο ψηλότερο (300), όχι 100.
    expect(evaluateWallBaseAt(p, 0.25)).toBe(300);
    expect(evaluateWallBaseAt(p, 0.75)).toBe(300);
    expect(p.maxBaseZmm).toBe(300);
  });

  it('partial coverage — covered span=host, uncovered=nominal', () => {
    const p = resolveWallBaseProfile(attached(['h']), ctxWith({ h: plan('h', -200, -200, 0, 0.5) }));
    expect(evaluateWallBaseAt(p, 0.25)).toBe(-200); // covered
    expect(evaluateWallBaseAt(p, 0.75)).toBe(0); // uncovered → nominal
  });

  it('missing host → fallback nominal + missingHostIds', () => {
    const p = resolveWallBaseProfile(attached(['ghost']), ctxWith({}));
    expect(p.hasAttach).toBe(false);
    expect(p.missingHostIds).toEqual(['ghost']);
    expect(p.segments[0].z0mm).toBe(0);
  });

  it('tilted host (z0≠z1) → sloped base segment', () => {
    const p = resolveWallBaseProfile(attached(['t']), ctxWith({ t: plan('t', -100, -400) }));
    expect(evaluateWallBaseAt(p, 0)).toBeCloseTo(-100, 6);
    expect(evaluateWallBaseAt(p, 1)).toBeCloseTo(-400, 6);
    expect(evaluateWallBaseAt(p, 0.5)).toBeCloseTo(-250, 6);
  });

  it('attached binding but empty ids → flat nominal (no crash)', () => {
    const p = resolveWallBaseProfile(attached([]), ctxWith({}));
    expect(p.hasAttach).toBe(false);
    expect(p.segments).toHaveLength(1);
  });
});
