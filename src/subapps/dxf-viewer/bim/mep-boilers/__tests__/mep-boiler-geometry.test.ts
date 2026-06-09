/**
 * ADR-408 Εύρος Β #2 — Heating boiler geometry + validation + connector layout.
 *
 * Pins: footprint is a centred rotatable rectangle (mirror of the radiator), area
 * is in m², validation rejects degenerate dims, and the connector layout produces
 * exactly 2 connectors with REVERSED flow vs the radiator — a supply outlet (+X,
 * flow:out, hydronic-supply → sources the network) + a return inlet (−X, flow:in,
 * hydronic-return).
 */

import {
  buildBoilerConnectors,
  computeMepBoilerGeometry,
  validateMepBoilerParams,
} from '../mep-boiler-geometry';
import type { MepBoilerParams } from '../../types/mep-boiler-types';
import {
  defaultBoilerFlueDiameterMm,
  defaultBoilerFuelDiameterMm,
} from '../../types/mep-boiler-types';

function params(overrides: Partial<MepBoilerParams> = {}): MepBoilerParams {
  return {
    kind: 'wall-boiler',
    shape: 'rectangular',
    position: { x: 0, y: 0, z: 0 },
    rotation: 0,
    width: 450,
    length: 350,
    bodyHeightMm: 700,
    mountingElevationMm: 1200,
    connectorDiameterMm: 22,
    systemClassification: 'hydronic-supply',
    sceneUnits: 'mm',
    ...overrides,
  };
}

describe('computeMepBoilerGeometry', () => {
  it('builds a centred rectangular footprint (4 verts) in canvas units', () => {
    const geo = computeMepBoilerGeometry(params());
    expect(geo.footprint.vertices).toHaveLength(4);
    // width 450 → half-width 225 (mm-scene s=1).
    const xs = geo.footprint.vertices.map((v) => v.x);
    expect(Math.max(...xs)).toBeCloseTo(225, 6);
    expect(Math.min(...xs)).toBeCloseTo(-225, 6);
  });

  it('area is in m² (450mm × 350mm = 0.1575 m²)', () => {
    expect(computeMepBoilerGeometry(params()).area).toBeCloseTo(0.1575, 6);
  });

  it('height mirrors bodyHeightMm', () => {
    expect(computeMepBoilerGeometry(params({ bodyHeightMm: 700 })).height).toBe(700);
  });

  it('rotates the footprint about the insertion point', () => {
    const geo = computeMepBoilerGeometry(params({ rotation: 90 }));
    // After 90° the body width (450) now spans Y; X spans the depth (350).
    const xs = geo.footprint.vertices.map((v) => v.x);
    expect(Math.max(...xs)).toBeCloseTo(175, 6);
  });
});

describe('validateMepBoilerParams', () => {
  it('passes for valid params', () => {
    expect(validateMepBoilerParams(params()).hardErrors).toHaveLength(0);
  });

  it('rejects non-positive width', () => {
    expect(validateMepBoilerParams(params({ width: 0 })).hardErrors).toContain(
      'mepBoiler.validation.hardErrors.nonPositiveWidth',
    );
  });

  it('rejects a too-small dimension', () => {
    expect(validateMepBoilerParams(params({ length: 5 })).hardErrors).toContain(
      'mepBoiler.validation.hardErrors.dimensionTooSmall',
    );
  });

  it('rejects zero body height', () => {
    expect(validateMepBoilerParams(params({ bodyHeightMm: 0 })).hardErrors).toContain(
      'mepBoiler.validation.hardErrors.nonPositiveBodyHeight',
    );
  });
});

describe('buildBoilerConnectors', () => {
  it('produces exactly 2 pipe connectors (supply + return)', () => {
    const connectors = buildBoilerConnectors(params());
    expect(connectors).toHaveLength(2);
    expect(connectors.every((c) => c.domain === 'pipe')).toBe(true);
  });

  it('supply outlet at +X, flow:out, hydronic-supply (sources the network)', () => {
    const supply = buildBoilerConnectors(params()).find((c) => c.connectorId === 'boiler-supply')!;
    expect(supply.flow).toBe('out');
    expect(supply.localPosition.x).toBeCloseTo(225, 6); // +half-width
    expect(supply.localPosition.y).toBeCloseTo(0, 6);
    expect(supply.pipe?.systemClassification).toBe('hydronic-supply');
    expect(supply.pipe?.diameterMm).toBe(22);
  });

  it('return inlet at −X, flow:in, hydronic-return', () => {
    const ret = buildBoilerConnectors(params()).find((c) => c.connectorId === 'boiler-return')!;
    expect(ret.flow).toBe('in');
    expect(ret.localPosition.x).toBeCloseTo(-225, 6); // −half-width
    expect(ret.localPosition.y).toBeCloseTo(0, 6);
    expect(ret.pipe?.systemClassification).toBe('hydronic-return');
  });

  it('scales connector x-offsets with width', () => {
    const connectors = buildBoilerConnectors(params({ width: 600 }));
    const xs = connectors
      .filter((c) => c.connectorId !== 'boiler-dhw')
      .map((c) => c.localPosition.x)
      .sort((a, b) => a - b);
    expect(xs[0]).toBeCloseTo(-300, 6);
    expect(xs[1]).toBeCloseTo(300, 6);
  });

  // ─── COMBI boiler — DHW cold inlet + hot outlet (ADR-408 Εύρος Β combi) ──────────

  it('omits the DHW connectors when producesDhw is absent/false (2 connectors)', () => {
    expect(buildBoilerConnectors(params())).toHaveLength(2);
    expect(buildBoilerConnectors(params({ producesDhw: false }))).toHaveLength(2);
    const ids = buildBoilerConnectors(params()).map((c) => c.connectorId);
    expect(ids).not.toContain('boiler-dhw-hot');
    expect(ids).not.toContain('boiler-dhw-cold');
  });

  it('appends BOTH DHW connectors when producesDhw (4 connectors, combi water path)', () => {
    const connectors = buildBoilerConnectors(params({ producesDhw: true }));
    expect(connectors).toHaveLength(4);
    const hot = connectors.find((c) => c.connectorId === 'boiler-dhw-hot')!;
    const cold = connectors.find((c) => c.connectorId === 'boiler-dhw-cold')!;
    // hot outlet → sources the DHW network.
    expect(hot.flow).toBe('out');
    expect(hot.pipe?.systemClassification).toBe('domestic-hot-water');
    // cold inlet → member of the cold-water network (combi takes cold, makes hot).
    expect(cold.flow).toBe('in');
    expect(cold.pipe?.systemClassification).toBe('domestic-cold-water');
  });

  it('places DHW hot at +X/+Y and cold at −X/+Y, all four corners distinct', () => {
    const connectors = buildBoilerConnectors(params({ producesDhw: true }));
    const hot = connectors.find((c) => c.connectorId === 'boiler-dhw-hot')!;
    const cold = connectors.find((c) => c.connectorId === 'boiler-dhw-cold')!;
    // width 450 → ±225 ; length 350 → +175 (mm-scene s=1).
    expect(hot.localPosition.x).toBeCloseTo(225, 6);
    expect(hot.localPosition.y).toBeCloseTo(175, 6);
    expect(cold.localPosition.x).toBeCloseTo(-225, 6);
    expect(cold.localPosition.y).toBeCloseTo(175, 6);
    // all four connector positions are distinct.
    const keys = new Set(connectors.map((c) => `${c.localPosition.x},${c.localPosition.y}`));
    expect(keys.size).toBe(4);
  });

  it('uses the dedicated DHW diameter when set, else falls back to connectorDiameterMm', () => {
    const overridden = buildBoilerConnectors(params({ producesDhw: true, dhwConnectorDiameterMm: 15 }));
    expect(overridden.find((c) => c.connectorId === 'boiler-dhw-hot')!.pipe?.diameterMm).toBe(15);
    expect(overridden.find((c) => c.connectorId === 'boiler-dhw-cold')!.pipe?.diameterMm).toBe(15);
    // fallback: no dhwConnectorDiameterMm → uses the hydronic connectorDiameterMm (22).
    const fallback = buildBoilerConnectors(params({ producesDhw: true }));
    expect(fallback.find((c) => c.connectorId === 'boiler-dhw-hot')!.pipe?.diameterMm).toBe(22);
  });

  // ─── DHW recirculation — 5th connector (ADR-408 Εύρος Β combi + recirculation) ───

  it('appends a recirc return inlet when combi + dhwRecirculation (5 connectors)', () => {
    const connectors = buildBoilerConnectors(params({ producesDhw: true, dhwRecirculation: true }));
    expect(connectors).toHaveLength(5);
    const recirc = connectors.find((c) => c.connectorId === 'boiler-dhw-recirc')!;
    // recirc return inlet → member of the SAME DHW network (reuses domestic-hot-water).
    expect(recirc.flow).toBe('in');
    expect(recirc.pipe?.systemClassification).toBe('domestic-hot-water');
    // placed at the −X/−Y (back-left) corner — distinct from all four other ports.
    expect(recirc.localPosition.x).toBeCloseTo(-225, 6);
    expect(recirc.localPosition.y).toBeCloseTo(-175, 6);
    const keys = new Set(connectors.map((c) => `${c.localPosition.x},${c.localPosition.y}`));
    expect(keys.size).toBe(5);
  });

  it('gates recirc behind producesDhw — no recirc on a non-combi boiler even if flag set', () => {
    const connectors = buildBoilerConnectors(params({ producesDhw: false, dhwRecirculation: true }));
    expect(connectors).toHaveLength(2);
    expect(connectors.map((c) => c.connectorId)).not.toContain('boiler-dhw-recirc');
  });

  it('combi without dhwRecirculation keeps 4 connectors (no recirc)', () => {
    const connectors = buildBoilerConnectors(params({ producesDhw: true }));
    expect(connectors).toHaveLength(4);
    expect(connectors.map((c) => c.connectorId)).not.toContain('boiler-dhw-recirc');
  });

  it('recirc uses the dedicated DHW diameter when set, else falls back to connectorDiameterMm', () => {
    const overridden = buildBoilerConnectors(
      params({ producesDhw: true, dhwRecirculation: true, dhwConnectorDiameterMm: 15 }),
    );
    expect(overridden.find((c) => c.connectorId === 'boiler-dhw-recirc')!.pipe?.diameterMm).toBe(15);
    const fallback = buildBoilerConnectors(params({ producesDhw: true, dhwRecirculation: true }));
    expect(fallback.find((c) => c.connectorId === 'boiler-dhw-recirc')!.pipe?.diameterMm).toBe(22);
  });

  // ─── Combustion flue (καπναγωγός) — duct connector (ADR-408 duct foundation) ─────

  it('appends a flue duct connector for a gas boiler (back-centre, flow:out, exhaust)', () => {
    const connectors = buildBoilerConnectors(params({ fuelType: 'gas' }));
    expect(connectors).toHaveLength(4); // supply + return + flue + fuel inlet (no DHW)
    const flue = connectors.find((c) => c.connectorId === 'boiler-flue')!;
    expect(flue.domain).toBe('duct');
    expect(flue.flow).toBe('out');
    expect(flue.duct?.systemClassification).toBe('exhaust');
    // back-centre {0, -hl}: length 350 → -175 (mm-scene s=1).
    expect(flue.localPosition.x).toBeCloseTo(0, 6);
    expect(flue.localPosition.y).toBeCloseTo(-175, 6);
    // points up toward the chimney.
    expect(flue.localDirection).toEqual({ x: 0, y: 0, z: 1 });
  });

  it('appends a flue for an oil boiler too', () => {
    const ids = buildBoilerConnectors(params({ fuelType: 'oil' })).map((c) => c.connectorId);
    expect(ids).toContain('boiler-flue');
  });

  it('omits the flue for electric / heat-pump / unspecified fuel (no combustion)', () => {
    expect(buildBoilerConnectors(params({ fuelType: 'electric' })).map((c) => c.connectorId)).not.toContain('boiler-flue');
    expect(buildBoilerConnectors(params({ fuelType: 'heat-pump' })).map((c) => c.connectorId)).not.toContain('boiler-flue');
    expect(buildBoilerConnectors(params()).map((c) => c.connectorId)).not.toContain('boiler-flue');
  });

  it('flue diameter defaults to the gas baseline DN100, overridden by flueDiameterMm', () => {
    const def = buildBoilerConnectors(params({ fuelType: 'gas' }));
    expect(def.find((c) => c.connectorId === 'boiler-flue')!.duct?.diameterMm).toBe(100);
    const overridden = buildBoilerConnectors(params({ fuelType: 'gas', flueDiameterMm: 150 }));
    expect(overridden.find((c) => c.connectorId === 'boiler-flue')!.duct?.diameterMm).toBe(150);
  });

  it('oil boiler flue defaults to the larger DN130 (type-driven per fuel)', () => {
    const def = buildBoilerConnectors(params({ fuelType: 'oil' }));
    expect(def.find((c) => c.connectorId === 'boiler-flue')!.duct?.diameterMm).toBe(130);
    // explicit override still wins over the per-fuel default.
    const overridden = buildBoilerConnectors(params({ fuelType: 'oil', flueDiameterMm: 100 }));
    expect(overridden.find((c) => c.connectorId === 'boiler-flue')!.duct?.diameterMm).toBe(100);
  });

  it('coexists with a combi + recirc gas boiler — 7 distinct connectors', () => {
    const connectors = buildBoilerConnectors(
      params({ fuelType: 'gas', producesDhw: true, dhwRecirculation: true }),
    );
    expect(connectors).toHaveLength(7); // supply, return, dhwHot, dhwCold, recirc, flue, fuel
    const ids = connectors.map((c) => c.connectorId).sort();
    expect(ids).toEqual(
      ['boiler-dhw-cold', 'boiler-dhw-hot', 'boiler-dhw-recirc', 'boiler-flue', 'boiler-fuel', 'boiler-return', 'boiler-supply'].sort(),
    );
    // all seven local positions are distinct.
    const keys = new Set(connectors.map((c) => `${c.localPosition.x},${c.localPosition.y}`));
    expect(keys.size).toBe(7);
  });

  // ─── Combustion fuel supply (τροφοδοσία καυσίμου) — fuel connector (ADR-408 fuel foundation) ─

  it('appends a fuel inlet for a gas boiler (front-centre, flow:in, fuel-gas)', () => {
    const fuel = buildBoilerConnectors(params({ fuelType: 'gas' })).find(
      (c) => c.connectorId === 'boiler-fuel',
    )!;
    expect(fuel.domain).toBe('fuel');
    expect(fuel.flow).toBe('in'); // fuel FEEDS the boiler
    expect(fuel.fuel?.systemClassification).toBe('fuel-gas');
    // front-centre {0, +hl}: length 350 → +175 (mm-scene s=1).
    expect(fuel.localPosition.x).toBeCloseTo(0, 6);
    expect(fuel.localPosition.y).toBeCloseTo(175, 6);
    // carries no pipe/duct payload — it is a distinct fuel-domain connector.
    expect(fuel.pipe).toBeUndefined();
    expect(fuel.duct).toBeUndefined();
  });

  it('uses fuel-oil classification for an oil boiler', () => {
    const fuel = buildBoilerConnectors(params({ fuelType: 'oil' })).find(
      (c) => c.connectorId === 'boiler-fuel',
    )!;
    expect(fuel.fuel?.systemClassification).toBe('fuel-oil');
  });

  it('omits the fuel inlet for electric / heat-pump / unspecified fuel (no combustion)', () => {
    expect(buildBoilerConnectors(params({ fuelType: 'electric' })).map((c) => c.connectorId)).not.toContain('boiler-fuel');
    expect(buildBoilerConnectors(params({ fuelType: 'heat-pump' })).map((c) => c.connectorId)).not.toContain('boiler-fuel');
    expect(buildBoilerConnectors(params()).map((c) => c.connectorId)).not.toContain('boiler-fuel');
  });

  it('fuel diameter defaults to the gas baseline DN20, overridden by fuelConnectorDiameterMm', () => {
    const def = buildBoilerConnectors(params({ fuelType: 'gas' }));
    expect(def.find((c) => c.connectorId === 'boiler-fuel')!.fuel?.diameterMm).toBe(20);
    const overridden = buildBoilerConnectors(params({ fuelType: 'gas', fuelConnectorDiameterMm: 25 }));
    expect(overridden.find((c) => c.connectorId === 'boiler-fuel')!.fuel?.diameterMm).toBe(25);
  });

  it('oil boiler fuel inlet defaults to the narrower DN15 (type-driven per fuel)', () => {
    const def = buildBoilerConnectors(params({ fuelType: 'oil' }));
    expect(def.find((c) => c.connectorId === 'boiler-fuel')!.fuel?.diameterMm).toBe(15);
    // explicit override still wins over the per-fuel default.
    const overridden = buildBoilerConnectors(params({ fuelType: 'oil', fuelConnectorDiameterMm: 20 }));
    expect(overridden.find((c) => c.connectorId === 'boiler-fuel')!.fuel?.diameterMm).toBe(20);
  });

  it('per-fuel diameter resolvers (SSoT) map fuelType → type-driven default', () => {
    expect(defaultBoilerFlueDiameterMm('gas')).toBe(100);
    expect(defaultBoilerFlueDiameterMm('oil')).toBe(130);
    expect(defaultBoilerFuelDiameterMm('gas')).toBe(20);
    expect(defaultBoilerFuelDiameterMm('oil')).toBe(15);
    // non-oil combustion / undefined → the gas baseline (resolvers only reached under the gate).
    expect(defaultBoilerFlueDiameterMm(undefined)).toBe(100);
    expect(defaultBoilerFuelDiameterMm(undefined)).toBe(20);
  });

  it('fuel inlet is independent of the combi/DHW gate (plain gas boiler still has it)', () => {
    const ids = buildBoilerConnectors(params({ fuelType: 'gas', producesDhw: false })).map((c) => c.connectorId);
    expect(ids).toContain('boiler-fuel');
    expect(ids).toContain('boiler-flue');
  });

  // ─── Condensate drain (αποχέτευση συμπυκνωμάτων) — pipe connector (ADR-408 condensate) ─

  it('appends a condensate drain for a condensing boiler (back-right, flow:out, sanitary-drainage)', () => {
    const connectors = buildBoilerConnectors(params({ fuelType: 'gas', condensing: true }));
    const condensate = connectors.find((c) => c.connectorId === 'boiler-condensate')!;
    expect(condensate.domain).toBe('pipe');
    expect(condensate.flow).toBe('out'); // condensate LEAVES toward the sewer
    expect(condensate.pipe?.systemClassification).toBe('sanitary-drainage');
    // back-right {+hw, -hl}: width 450 → +225, length 350 → -175 (mm-scene s=1).
    expect(condensate.localPosition.x).toBeCloseTo(225, 6);
    expect(condensate.localPosition.y).toBeCloseTo(-175, 6);
    // distinct fuel/duct payloads absent — it is a plain pipe-domain connector (renders as stub).
    expect(condensate.duct).toBeUndefined();
    expect(condensate.fuel).toBeUndefined();
  });

  it('omits the condensate drain when condensing is absent/false', () => {
    expect(buildBoilerConnectors(params({ fuelType: 'gas' })).map((c) => c.connectorId)).not.toContain('boiler-condensate');
    expect(buildBoilerConnectors(params({ fuelType: 'gas', condensing: false })).map((c) => c.connectorId)).not.toContain('boiler-condensate');
  });

  it('seeds the condensate drain by the explicit flag, independent of fuelType', () => {
    // Revit-grade: the condensing flag is explicit, NOT inferred from fuelType — an electric
    // boiler the user marks condensing still gets the drain (and a plain gas boiler does not).
    expect(buildBoilerConnectors(params({ fuelType: 'electric', condensing: true })).map((c) => c.connectorId)).toContain('boiler-condensate');
    expect(buildBoilerConnectors(params({ condensing: true })).map((c) => c.connectorId)).toContain('boiler-condensate');
  });

  it('condensate diameter defaults to DN25, overridden by condensateConnectorDiameterMm', () => {
    const def = buildBoilerConnectors(params({ condensing: true }));
    expect(def.find((c) => c.connectorId === 'boiler-condensate')!.pipe?.diameterMm).toBe(25);
    const overridden = buildBoilerConnectors(params({ condensing: true, condensateConnectorDiameterMm: 32 }));
    expect(overridden.find((c) => c.connectorId === 'boiler-condensate')!.pipe?.diameterMm).toBe(32);
  });

  it('coexists with a full gas combi + recirc + condensing boiler — 8 distinct connectors', () => {
    const connectors = buildBoilerConnectors(
      params({ fuelType: 'gas', producesDhw: true, dhwRecirculation: true, condensing: true }),
    );
    expect(connectors).toHaveLength(8); // supply, return, dhwHot, dhwCold, recirc, flue, fuel, condensate
    const ids = connectors.map((c) => c.connectorId).sort();
    expect(ids).toEqual(
      ['boiler-condensate', 'boiler-dhw-cold', 'boiler-dhw-hot', 'boiler-dhw-recirc', 'boiler-flue', 'boiler-fuel', 'boiler-return', 'boiler-supply'].sort(),
    );
    // all eight local positions are distinct.
    const keys = new Set(connectors.map((c) => `${c.localPosition.x},${c.localPosition.y}`));
    expect(keys.size).toBe(8);
  });
});
