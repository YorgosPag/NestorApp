/**
 * ADR-464 Slice 1 — bearing engine (EC7) + load combinations + load resolver.
 *
 * Πιστοποιεί: (α) EN1990 ULS/SLS συνδυασμούς, (β) resolver/zero-guard φορτίου,
 * (γ) κατανομή πίεσης εδάφους — concentric, εντός πυρήνα, μονοαξονική αποκόλληση
 * (ακριβής τριγωνική επαφή), ίδιο βάρος, μηδενικό/αρνητικό αξονικό, επάρκεια.
 */

import {
  isZeroMemberLoad,
  resolveAppliedMemberLoad,
  ZERO_MEMBER_LOAD,
  type MemberLoad,
} from '../../loads/structural-loads-types';
import { combineSls, combineUls } from '../../loads/load-combinations';
import { computeFootingBearing } from '../footing-bearing';
import type { FootingDesignInput } from '../footing-design-types';

// ─── Load resolver ────────────────────────────────────────────────────────────

describe('resolveAppliedMemberLoad', () => {
  it('undefined → μηδενικό φορτίο', () => {
    expect(resolveAppliedMemberLoad(undefined)).toEqual(ZERO_MEMBER_LOAD);
    expect(isZeroMemberLoad(resolveAppliedMemberLoad(undefined))).toBe(true);
  });

  it('γεμίζει absent ροπές με 0, κρατά αξονικά', () => {
    const r = resolveAppliedMemberLoad({ deadAxialKn: 500, liveAxialKn: 200 });
    expect(r.deadAxialKn).toBe(500);
    expect(r.liveAxialKn).toBe(200);
    expect(r.deadMomentXKnm).toBe(0);
    expect(r.liveMomentYKnm).toBe(0);
    expect(isZeroMemberLoad(r)).toBe(false);
  });

  it('αγνοεί μη-πεπερασμένες τιμές → 0', () => {
    const r = resolveAppliedMemberLoad({
      deadAxialKn: Number.NaN,
      liveAxialKn: Number.POSITIVE_INFINITY,
    });
    expect(isZeroMemberLoad(r)).toBe(true);
  });
});

// ─── Load combinations (EN1990) ──────────────────────────────────────────────

describe('load combinations (EN1990)', () => {
  const load: MemberLoad = {
    deadAxialKn: 100,
    liveAxialKn: 50,
    deadMomentXKnm: 10,
    liveMomentXKnm: 4,
    deadMomentYKnm: 0,
    liveMomentYKnm: 0,
    source: 'manual',
  };

  it('ULS = 1.35G + 1.5Q ανά συνιστώσα', () => {
    const uls = combineUls(load, { gammaG: 1.35, gammaQ: 1.5 });
    expect(uls.axialKn).toBeCloseTo(1.35 * 100 + 1.5 * 50); // 210
    expect(uls.momentXKnm).toBeCloseTo(1.35 * 10 + 1.5 * 4); // 19.5
  });

  it('SLS = G + Q (χαρακτηριστικός)', () => {
    const sls = combineSls(load);
    expect(sls.axialKn).toBe(150);
    expect(sls.momentXKnm).toBe(14);
  });
});

// ─── Bearing (EC7) ────────────────────────────────────────────────────────────

function input(overrides: Partial<FootingDesignInput> = {}): FootingDesignInput {
  return {
    widthMm: 2000,
    lengthMm: 2000,
    thicknessMm: 500,
    columnWidthMm: 400,
    columnDepthMm: 400,
    serviceLoad: { axialKn: 800, momentXKnm: 0, momentYKnm: 0 },
    ulsLoad: { axialKn: 1080, momentXKnm: 0, momentYKnm: 0 },
    soilBearingCapacityKpa: 300,
    footingSelfWeightKn: 0,
    ...overrides,
  };
}

describe('computeFootingBearing', () => {
  it('κεντρικό φορτίο → ομοιόμορφη πίεση = N/A', () => {
    const b = computeFootingBearing(input());
    expect(b.pMaxKpa).toBeCloseTo(200); // 800 / (2·2)
    expect(b.pMinKpa).toBeCloseTo(200);
    expect(b.upliftsBase).toBe(false);
    expect(b.check.adequate).toBe(true);
    expect(b.check.utilization).toBeCloseTo(200 / 300);
  });

  it('ίδιο βάρος προστίθεται στο αξονικό', () => {
    const b = computeFootingBearing(input({ footingSelfWeightKn: 200 }));
    expect(b.pMaxKpa).toBeCloseTo(250); // 1000 / 4
  });

  it('εκκεντρότητα εντός πυρήνα → τραπεζοειδής πίεση, χωρίς αποκόλληση', () => {
    const b = computeFootingBearing(input({ serviceLoad: { axialKn: 800, momentXKnm: 80, momentYKnm: 0 } }));
    // e_x = 80/800 = 0.1m· kx = 6·0.1/2 = 0.3
    expect(b.eccentricityXMm).toBeCloseTo(100);
    expect(b.pMaxKpa).toBeCloseTo(260); // 200·1.3
    expect(b.pMinKpa).toBeCloseTo(140); // 200·0.7
    expect(b.upliftsBase).toBe(false);
  });

  it('εκκεντρότητα εκτός πυρήνα → μερική αποκόλληση (ακριβής τριγωνική επαφή)', () => {
    const b = computeFootingBearing(input({ serviceLoad: { axialKn: 800, momentXKnm: 400, momentYKnm: 0 } }));
    // e_x = 0.5m > W/6 → contact = 3·(1−0.5)=1.5m· p_max = 2·800/(2·1.5) = 533.3
    expect(b.upliftsBase).toBe(true);
    expect(b.pMinKpa).toBe(0);
    expect(b.pMaxKpa).toBeCloseTo(1600 / 3, 1);
    expect(b.check.adequate).toBe(false); // 533 > 300
  });

  it('μηδενικό/αρνητικό αξονικό → καμία απαίτηση έδρασης (adequate)', () => {
    const b = computeFootingBearing(input({ serviceLoad: { axialKn: -10, momentXKnm: 0, momentYKnm: 0 } }));
    expect(b.pMaxKpa).toBe(0);
    expect(b.check.adequate).toBe(true);
  });

  it('ανεπαρκής έδραση όταν p_max > σ_allow', () => {
    const b = computeFootingBearing(input({ serviceLoad: { axialKn: 1400, momentXKnm: 0, momentYKnm: 0 } }));
    expect(b.pMaxKpa).toBeCloseTo(350);
    expect(b.check.adequate).toBe(false);
    expect(b.check.utilization).toBeCloseTo(350 / 300);
  });
});
