/**
 * ADR-422 L1 — tests για το orchestration (derive-space-heat-loads).
 * jest globals (describe/it/expect) — ΟΧΙ vitest import.
 *
 * Εστιάζει στη συναρμολόγηση input (Ti/n από catalog, geometry volume/area),
 * στα branches δαπέδου/οροφής ανά storeyPosition και στην άθροιση/εύρος. Η
 * αντιστοίχιση footprint→τοίχου (matchWallsToFootprint) καλύπτεται in-browser.
 */

import { createThermalSpace } from '@/services/factories/thermal-space.factory';
import {
  computeThermalSpaceGeometry,
  type ThermalSpaceEntity,
  type ThermalSpaceParams,
} from '../../../types/thermal-space-types';
import {
  deriveSpaceHeatLoads,
  computeOneSpaceHeatLoad,
  type SpaceHeatLoadDeriveInputs,
} from '../derive-space-heat-loads';
import type { StoreyPosition } from '../space-boundary-resolver';

/** Τετράγωνο δωμάτιο 4×5 m σε scene units 'm' (area=20 m², volume=60 m³). */
function makeSpace(id: string, overrides: Partial<ThermalSpaceParams> = {}): ThermalSpaceEntity {
  const params: ThermalSpaceParams = {
    footprint: {
      vertices: [
        { x: 0, y: 0 },
        { x: 4, y: 0 },
        { x: 4, y: 5 },
        { x: 0, y: 5 },
      ],
    },
    useType: 'generic',
    ceilingHeightMm: 3000,
    sceneUnits: 'm',
    setpointTempC: 20,
    airChangesPerHour: 0.75,
    ...overrides,
  };
  return createThermalSpace({ params, geometry: computeThermalSpaceGeometry(params), layerId: 'L', id });
}

/** Inputs χωρίς τοίχους/κουφώματα — απομονώνει δάπεδο/οροφή/αερισμό. */
function makeInputs(storeyPosition: StoreyPosition): SpaceHeatLoadDeriveInputs {
  return {
    walls: [],
    openings: [],
    exteriorWallIds: new Set<string>(),
    storeyPosition,
    outdoorTempC: -5, // Te → ΔΤ = 20 − (−5) = 25 K
    tol: 0.3,
  };
}

// Σταθερές worked-example: ΔΤ=25, area=20, volume=60, n=0.75
// Δάπεδο επί εδάφους: 0.5 (DEFAULT_FLOOR_U) · 20 · 0.5 (b ground) · 25 = 125 W
// Οροφή/στέγη εξωτ.:  0.4 (DEFAULT_ROOF_U)  · 20 · 1.0 (b ext)    · 25 = 200 W
// Αερισμός:           0.34 · 0.75 · 60 · 25                            = 382.5 W
const VENT_W = 382.5;
const FLOOR_GROUND_W = 125;
const ROOF_EXT_W = 200;

describe('computeOneSpaceHeatLoad — storeyPosition branches', () => {
  it("'only' → δάπεδο ground + στέγη external-air", () => {
    const r = computeOneSpaceHeatLoad(makeSpace('a'), makeInputs('only'));
    expect(r.deltaTC).toBe(25);
    expect(r.transmissionW).toBeCloseTo(FLOOR_GROUND_W + ROOF_EXT_W, 5);
    expect(r.ventilationW).toBeCloseTo(VENT_W, 5);
    expect(r.totalW).toBeCloseTo(FLOOR_GROUND_W + ROOF_EXT_W + VENT_W, 5);
  });

  it("'lowest' → δάπεδο ground + οροφή adjacent-heated (b=0)", () => {
    const r = computeOneSpaceHeatLoad(makeSpace('a'), makeInputs('lowest'));
    expect(r.transmissionW).toBeCloseTo(FLOOR_GROUND_W, 5);
  });

  it("'highest' → δάπεδο adjacent-heated (b=0) + στέγη external-air", () => {
    const r = computeOneSpaceHeatLoad(makeSpace('a'), makeInputs('highest'));
    expect(r.transmissionW).toBeCloseTo(ROOF_EXT_W, 5);
  });

  it("'middle' → μηδέν αγωγή (δάπεδο+οροφή adjacent) — μόνο αερισμός", () => {
    const r = computeOneSpaceHeatLoad(makeSpace('a'), makeInputs('middle'));
    expect(r.transmissionW).toBe(0);
    expect(r.totalW).toBeCloseTo(VENT_W, 5);
  });

  it('ειδικό φορτίο = Φ / εμβαδό δαπέδου', () => {
    const r = computeOneSpaceHeatLoad(makeSpace('a'), makeInputs('lowest'));
    expect(r.specificLoadWperM2).toBeCloseTo((FLOOR_GROUND_W + VENT_W) / 20, 4);
  });
});

describe('computeOneSpaceHeatLoad — L1.5 per-space overrides', () => {
  it('default (χωρίς override) ⇒ TB/reheat 0, ίδιο totalW με L1', () => {
    const r = computeOneSpaceHeatLoad(makeSpace('a'), makeInputs('only'));
    expect(r.thermalBridgeW).toBe(0);
    expect(r.reheatW).toBe(0);
    expect(r.totalW).toBeCloseTo(FLOOR_GROUND_W + ROOF_EXT_W + VENT_W, 5);
  });

  it("thermalBridgeLevel='medium' → +ΔU_TB σε δάπεδο+στέγη", () => {
    // floor ground: 0.10·20·0.5·25=25· roof ext: 0.10·20·1·25=50 → TB=75.
    const r = computeOneSpaceHeatLoad(
      makeSpace('a', { thermalBridgeLevel: 'medium' }),
      makeInputs('only'),
    );
    expect(r.thermalBridgeW).toBeCloseTo(75, 5);
    expect(r.transmissionW).toBeCloseTo(FLOOR_GROUND_W + ROOF_EXT_W + 75, 5);
  });

  it("reheatMode='night-setback' → Φ_RH = A·f_RH = 20·11 = 220", () => {
    const r = computeOneSpaceHeatLoad(
      makeSpace('a', { reheatMode: 'night-setback' }),
      makeInputs('only'),
    );
    expect(r.reheatW).toBeCloseTo(220, 5);
    expect(r.totalW).toBeCloseTo(FLOOR_GROUND_W + ROOF_EXT_W + VENT_W + 220, 5);
  });
});

describe('computeOneSpaceHeatLoad — L1.7 αερισμός/ανάκτηση', () => {
  it('default (χωρίς airTightness/ventilation override) ⇒ ventilationW = VENT_W (zero-regression)', () => {
    const r = computeOneSpaceHeatLoad(makeSpace('a'), makeInputs('only'));
    expect(r.ventilationW).toBeCloseTo(VENT_W, 5);
  });

  it("ventilationSystem='mechanical-hr-high' (η=0.8) ⇒ ventilationW μειωμένο −80% = 76.5", () => {
    // n_ven = 0.75·(1−0.8)=0.15· walls:[] ⇒ #όψεων=0 ⇒ n_inf=0 ⇒ n_eff=0.15.
    // Φ_V = 0.34·0.15·60·25 = 76.5 W.
    const r = computeOneSpaceHeatLoad(
      makeSpace('a', { ventilationSystem: 'mechanical-hr-high' }),
      makeInputs('only'),
    );
    expect(r.ventilationW).toBeCloseTo(76.5, 5);
  });

  it("airTightnessLevel χωρίς εκτεθειμένες όψεις (walls:[]) ⇒ n_inf=0 ⇒ VENT_W αμετάβλητο", () => {
    // makeInputs έχει walls:[] ⇒ exposedFacadeCount=0 ⇒ e=0 ⇒ n_inf=0 ανεξαρτήτως n50.
    const r = computeOneSpaceHeatLoad(
      makeSpace('a', { airTightnessLevel: 'very-leaky' }),
      makeInputs('only'),
    );
    expect(r.ventilationW).toBeCloseTo(VENT_W, 5);
  });
});

describe('computeOneSpaceHeatLoad — L1.8 αερισμός split επιφανειοποίηση', () => {
  it('default χώρος ⇒ infiltrationW=0, designedVentilationW=VENT_W, ventilationW=max', () => {
    // walls:[] ⇒ n_inf=0 ⇒ infiltrationW=0· n_ven=n_min=0.75 ⇒ designedVentilationW=382.5.
    const r = computeOneSpaceHeatLoad(makeSpace('a'), makeInputs('only'));
    expect(r.infiltrationW).toBeCloseTo(0, 5);
    expect(r.designedVentilationW).toBeCloseTo(VENT_W, 5);
    expect(r.ventilationW).toBeCloseTo(Math.max(r.infiltrationW, r.designedVentilationW), 5);
  });

  it("mechanical-hr-high (η=0.8) ⇒ designedVentilationW μειωμένο, ventilationW=max(0, designed)", () => {
    // n_ven=0.75·0.2=0.15 ⇒ designedVentilationW=0.34·0.15·60·25=76.5· infiltrationW=0.
    const r = computeOneSpaceHeatLoad(
      makeSpace('a', { ventilationSystem: 'mechanical-hr-high' }),
      makeInputs('only'),
    );
    expect(r.infiltrationW).toBeCloseTo(0, 5);
    expect(r.designedVentilationW).toBeCloseTo(76.5, 5);
    expect(r.ventilationW).toBeCloseTo(76.5, 5);
  });

  it('Σ invariant: Σ boundaries.lossW + ventilationW + reheatW === totalW', () => {
    const r = computeOneSpaceHeatLoad(makeSpace('a'), makeInputs('only'));
    const fabric = r.boundaries.reduce((s, b) => s + b.lossW, 0);
    expect(fabric + r.ventilationW + r.reheatW).toBeCloseTo(r.totalW, 5);
  });
});

describe('deriveSpaceHeatLoads — aggregation + range', () => {
  it('Map ανά spaceId + άθροισμα totalW', () => {
    const spaces = [makeSpace('a'), makeSpace('b')];
    const out = deriveSpaceHeatLoads(spaces, makeInputs('lowest'));
    expect(out.results.size).toBe(2);
    const per = FLOOR_GROUND_W + VENT_W;
    expect(out.totalW).toBeCloseTo(per * 2, 5);
    expect(out.results.get('a')!.totalW).toBeCloseTo(per, 5);
  });

  it('εύρος ειδικού φορτίου min/max (διαφορετική χρήση → διαφορετικό n)', () => {
    // kitchen n=1.5 (μεγαλύτερος αερισμός) → μεγαλύτερο ειδικό από generic n=0.75.
    const cold = makeSpace('a'); // generic, override n=0.75
    const hot = makeSpace('b', { useType: 'kitchen', airChangesPerHour: 1.5 });
    const out = deriveSpaceHeatLoads([cold, hot], makeInputs('lowest'));
    expect(out.maxWperM2).toBeGreaterThan(out.minWperM2);
    expect(out.minWperM2).toBeCloseTo(out.results.get('a')!.specificLoadWperM2, 5);
  });

  it('κενή λίστα → range 0/0, totalW 0', () => {
    const out = deriveSpaceHeatLoads([], makeInputs('only'));
    expect(out.totalW).toBe(0);
    expect(out.minWperM2).toBe(0);
    expect(out.maxWperM2).toBe(0);
  });
});
