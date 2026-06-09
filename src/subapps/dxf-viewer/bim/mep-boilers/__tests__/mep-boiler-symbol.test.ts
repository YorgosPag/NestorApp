/**
 * ADR-408 Εύρος Β #2 — Heating boiler 2D symbol (connector-driven stubs + flue vent glyph).
 *
 * Pins: the plan symbol draws ONE stub per embedded connector, derived from the SAME
 * `buildBoilerConnectors` SSoT that seeds the real ports — so DHW + flue ports are always
 * visible. Supply/return reproduce their pre-connector-driven geometry EXACTLY (regression),
 * the gas/oil combustion flue (`domain:'duct'`) gets a distinct vent glyph (stub + chevron),
 * an electric boiler has no flue, and every stub follows the host rotation.
 */

import { buildMepBoilerSymbol } from '../mep-boiler-symbol';
import { computeMepBoilerGeometry } from '../mep-boiler-geometry';
import type { MepBoilerParams } from '../../types/mep-boiler-types';

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

function symbol(overrides: Partial<MepBoilerParams> = {}) {
  const p = params(overrides);
  return buildMepBoilerSymbol(p, computeMepBoilerGeometry(p));
}

// width 450 → half-width 225 (mm-scene s=1); stubLen = max(350*0.8, 60) = 280.
const HW = 225;
const STUB_LEN = 280;

describe('buildMepBoilerSymbol — connector-driven stubs', () => {
  it('a plain boiler (no DHW, no fuel) draws exactly 2 pipe stubs and no vent', () => {
    const sym = symbol();
    expect(sym.strokes).toHaveLength(2);
    expect(sym.ventStrokes).toHaveLength(0);
  });

  it('supply stub is regression-free: rooted at the +X edge midpoint, pointing +X', () => {
    const [supply] = symbol().strokes;
    expect(supply[0].x).toBeCloseTo(HW, 6);
    expect(supply[0].y).toBeCloseTo(0, 6);
    expect(supply[1].x).toBeCloseTo(HW + STUB_LEN, 6);
    expect(supply[1].y).toBeCloseTo(0, 6);
  });

  it('return stub is regression-free: rooted at the −X edge midpoint, pointing −X', () => {
    const ret = symbol().strokes[1];
    expect(ret[0].x).toBeCloseTo(-HW, 6);
    expect(ret[0].y).toBeCloseTo(0, 6);
    expect(ret[1].x).toBeCloseTo(-(HW + STUB_LEN), 6);
    expect(ret[1].y).toBeCloseTo(0, 6);
  });

  it('keeps the divider + flame glyph (4 glyph strokes)', () => {
    expect(symbol().glyphStrokes).toHaveLength(4);
  });
});

describe('buildMepBoilerSymbol — combi DHW ports', () => {
  it('a gas combi with recirculation draws 6 stubs (supply/return + hot/cold/recirc + fuel)', () => {
    // The gas fuel inlet (domain:'fuel') also reads as a plain stub in `strokes`.
    const sym = symbol({ producesDhw: true, dhwRecirculation: true, fuelType: 'gas' });
    expect(sym.strokes).toHaveLength(6);
  });

  it('a non-recirc electric combi draws 4 pipe stubs (supply/return + hot/cold, no fuel)', () => {
    expect(symbol({ producesDhw: true, fuelType: 'electric' }).strokes).toHaveLength(4);
  });
});

describe('buildMepBoilerSymbol — combustion fuel supply stub', () => {
  it('a plain gas boiler draws 3 stubs (supply/return + fuel) and the flue vent', () => {
    const sym = symbol({ fuelType: 'gas' });
    expect(sym.strokes).toHaveLength(3); // supply, return, fuel inlet
    expect(sym.ventStrokes).toHaveLength(7); // flue chevron + roof-cowl terminal
  });

  it('the fuel stub roots at the front-centre (+Y), pointing +Y', () => {
    // fuel at host-local {0,+hl}; supply[0]/return[1], fuel appended last → strokes[2].
    const fuel = symbol({ fuelType: 'gas' }).strokes[2];
    expect(fuel[0].x).toBeCloseTo(0, 6);
    expect(fuel[0].y).toBeCloseTo(175, 6);
    expect(fuel[1].x).toBeCloseTo(0, 6);
    expect(fuel[1].y).toBeCloseTo(175 + STUB_LEN, 6);
  });

  it('an electric boiler has no fuel stub (only supply/return)', () => {
    expect(symbol({ fuelType: 'electric' }).strokes).toHaveLength(2);
  });
});

describe('buildMepBoilerSymbol — combustion flue vent glyph', () => {
  // ventStrokes = chevron (stub + 2 legs = 3) + vent terminal cap. Default terminal is the
  // roof cowl (open hood box = 4 strokes), so a default gas/oil boiler emits 3 + 4 = 7.
  it('a gas boiler emits chevron (3) + default roof-cowl terminal (4) = 7 strokes', () => {
    expect(symbol({ fuelType: 'gas' }).ventStrokes).toHaveLength(7);
  });

  it('an oil boiler also vents (3 + 4 = 7)', () => {
    expect(symbol({ fuelType: 'oil' }).ventStrokes).toHaveLength(7);
  });

  it('an electric boiler has no flue (no combustion)', () => {
    expect(symbol({ fuelType: 'electric' }).ventStrokes).toHaveLength(0);
  });

  it('a heat-pump boiler has no flue', () => {
    expect(symbol({ fuelType: 'heat-pump' }).ventStrokes).toHaveLength(0);
  });

  it('the flue vent stub roots at the back-centre (−Y), pointing −Y', () => {
    // length 350 → half-length 175; flue at host-local {0,-hl}.
    const [stub] = symbol({ fuelType: 'gas' }).ventStrokes;
    expect(stub[0].x).toBeCloseTo(0, 6);
    expect(stub[0].y).toBeCloseTo(-175, 6);
    expect(stub[1].x).toBeCloseTo(0, 6);
    expect(stub[1].y).toBeCloseTo(-175 - STUB_LEN, 6);
  });
});

describe('buildMepBoilerSymbol — vent terminal type (καμινάδα)', () => {
  it('a through-wall terminal yields chevron (3) + wall glyph (3) = 6 strokes', () => {
    const sym = symbol({ fuelType: 'gas', flueTermination: 'wall-horizontal' });
    expect(sym.ventStrokes).toHaveLength(6);
  });

  it('a concentric terminal yields chevron (3) + 2 diamonds = 5 strokes', () => {
    const sym = symbol({ fuelType: 'oil', flueTermination: 'balanced-concentric' });
    expect(sym.ventStrokes).toHaveLength(5);
  });

  it('explicit roof-cowl matches the default (7 strokes)', () => {
    expect(symbol({ fuelType: 'gas', flueTermination: 'roof-cowl' }).ventStrokes).toHaveLength(7);
  });

  it('a non-combustion boiler ignores flueTermination (no flue at all)', () => {
    expect(
      symbol({ fuelType: 'electric', flueTermination: 'balanced-concentric' }).ventStrokes,
    ).toHaveLength(0);
  });
});

describe('buildMepBoilerSymbol — rotation', () => {
  it('rotates the supply stub with the host (90° CCW → supply points +Y)', () => {
    const [supply] = symbol({ rotation: 90 }).strokes;
    // supply local {225,0} rotated 90° CCW → {0,225}, outward {0,1}.
    expect(supply[0].x).toBeCloseTo(0, 6);
    expect(supply[0].y).toBeCloseTo(HW, 6);
    expect(supply[1].x).toBeCloseTo(0, 6);
    expect(supply[1].y).toBeCloseTo(HW + STUB_LEN, 6);
  });
});
