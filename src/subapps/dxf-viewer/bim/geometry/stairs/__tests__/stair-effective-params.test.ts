/**
 * Tests για την SSoT γέφυρα profile → StairParams (ADR-401 Phase G.2).
 *
 * `applyStairVerticalProfile`: attached → spread των snapped τιμών· non-attached →
 * **identity** (ίδιο reference). `resolveEffectiveStairParams`: end-to-end με host
 * inputs — η ΙΔΙΑ γέφυρα που τρώνε 3D (`BimSceneLayer.syncStairs`) + BOQ
 * (`stair-boq-sync`), ώστε να μην αποκλίνουν ποτέ.
 */

import type { HostFootprintInput } from '../../wall-host-plan-builder';
import type { StairParams } from '../../../types/stair-types';
import { makeStairHostResolver, type StairVerticalProfile } from '../../stair-vertical-profile';
import {
  applyStairVerticalProfile,
  resolveEffectiveStairParams,
} from '../stair-effective-params';

function params(p: Partial<StairParams> = {}): StairParams {
  return {
    basePoint: { x: 0, y: 0, z: 0 },
    direction: 0,
    totalRun: 3000,
    width: 1000,
    rise: 180,
    stepCount: 10,
    totalRise: 1800,
    tread: 300,
    ...p,
  } as unknown as StairParams;
}

function profile(p: Partial<StairVerticalProfile> = {}): StairVerticalProfile {
  return {
    baseZmm: 0,
    topZmm: 1800,
    totalRise: 1800,
    stepCount: 10,
    rise: 180,
    topHasAttach: false,
    baseHasAttach: false,
    degenerate: false,
    missingHostIds: [],
    ...p,
  };
}

/** Host που καλύπτει base (x=0) + top (x=3000) samples, y από -1000 ως 1000. */
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

// ─── applyStairVerticalProfile ────────────────────────────────────────────────

describe('applyStairVerticalProfile', () => {
  test('non-attached profile → identity (ίδιο reference)', () => {
    const p = params();
    const out = applyStairVerticalProfile(p, profile());
    expect(out).toBe(p); // ίδιο reference → μηδέν recompute downstream
  });

  test('attached → spread snapped z/rise/stepCount/totalRise, υπόλοιπα άθικτα', () => {
    const p = params();
    const out = applyStairVerticalProfile(
      p,
      profile({ baseZmm: 300, topZmm: 1800, totalRise: 1500, stepCount: 8, rise: 187.5, baseHasAttach: true }),
    );
    expect(out).not.toBe(p);
    expect(out.basePoint.z).toBe(300);
    expect(out.basePoint.x).toBe(0); // x/y άθικτα
    expect(out.rise).toBe(187.5);
    expect(out.stepCount).toBe(8);
    expect(out.totalRise).toBe(1500);
    expect(out.tread).toBe(300); // μη-κατακόρυφα πεδία άθικτα
    expect(out.width).toBe(1000);
  });
});

// ─── resolveEffectiveStairParams (end-to-end) ─────────────────────────────────

describe('resolveEffectiveStairParams', () => {
  test('χωρίς host resolver / μη-attached → identity params', () => {
    const p = params();
    const { params: eff, profile: prof } = resolveEffectiveStairParams(p, {});
    expect(eff).toBe(p);
    expect(prof.topHasAttach).toBe(false);
    expect(prof.baseHasAttach).toBe(false);
  });

  test('base-attached → η βάση κάθεται στην άνω-παρειά host (lift)', () => {
    const p = params({ baseBinding: 'attached', attachBaseToIds: ['f1'] });
    const { params: eff } = resolveEffectiveStairParams(p, {
      resolveHostInput: makeStairHostResolver([fullHost('f1', { hostType: 'slab', topsideZmm: 300 })]),
    });
    expect(eff).not.toBe(p);
    expect(eff.basePoint.z).toBe(300);
    // top μη-attached → nominal top = 300 + 180×10 = 2100· totalRise=1800· stepCount αμετάβλητο
    expect(eff.totalRise).toBeCloseTo(1800, 6);
    expect(eff.stepCount).toBe(10);
  });

  test('top-attached → re-step (whole-step snap, ίσα risers)', () => {
    const p = params({ topBinding: 'attached', attachTopToIds: ['h1'] });
    const { params: eff } = resolveEffectiveStairParams(p, {
      // underside 1500 → totalRise 1500· round(1500/180)=8 σκαλοπάτια· rise 187.5
      resolveHostInput: makeStairHostResolver([fullHost('h1', { undersideZmm: 1500 })]),
    });
    expect(eff.basePoint.z).toBe(0);
    expect(eff.stepCount).toBe(8);
    expect(eff.rise).toBeCloseTo(187.5, 6);
    expect(eff.totalRise).toBeCloseTo(1500, 6);
  });
});
