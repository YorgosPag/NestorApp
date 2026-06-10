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
  it('a plain boiler (no DHW, no fuel) draws exactly 2 pipe stubs, no vent, no fuel glyph', () => {
    const sym = symbol();
    expect(sym.strokes).toHaveLength(2);
    expect(sym.ventStrokes).toHaveLength(0);
    expect(sym.fuelStrokes).toHaveLength(0);
  });

  it('supply stub is regression-free: rooted at the +X edge midpoint, pointing +X', () => {
    const [supply] = symbol().strokes;
    expect(supply.line[0].x).toBeCloseTo(HW, 6);
    expect(supply.line[0].y).toBeCloseTo(0, 6);
    expect(supply.line[1].x).toBeCloseTo(HW + STUB_LEN, 6);
    expect(supply.line[1].y).toBeCloseTo(0, 6);
  });

  it('return stub is regression-free: rooted at the −X edge midpoint, pointing −X', () => {
    const ret = symbol().strokes[1];
    expect(ret.line[0].x).toBeCloseTo(-HW, 6);
    expect(ret.line[0].y).toBeCloseTo(0, 6);
    expect(ret.line[1].x).toBeCloseTo(-(HW + STUB_LEN), 6);
    expect(ret.line[1].y).toBeCloseTo(0, 6);
  });

  it('keeps the divider + flame glyph (4 glyph strokes)', () => {
    expect(symbol().glyphStrokes).toHaveLength(4);
  });
});

describe('buildMepBoilerSymbol — per-stub System Classification (Revit color-coded MEP plan)', () => {
  it('tags the supply stub hydronic-supply and the return stub hydronic-return', () => {
    const [supply, ret] = symbol().strokes;
    expect(supply.classification).toBe('hydronic-supply');
    expect(ret.classification).toBe('hydronic-return');
  });

  it('tags the combi DHW hot outlet domestic-hot-water and cold inlet domestic-cold-water', () => {
    // order: supply, return, DHW hot (+X/+Y), DHW cold (−X/+Y).
    const [, , hot, cold] = symbol({ producesDhw: true, fuelType: 'electric' }).strokes;
    expect(hot.classification).toBe('domestic-hot-water');
    expect(cold.classification).toBe('domestic-cold-water');
  });

  it('tags the condensate drain stub sanitary-drainage', () => {
    // A condensing electric-free gas boiler: supply, return, …, condensate is the last pipe stub.
    const strokes = symbol({ fuelType: 'electric', condensing: true }).strokes;
    const condensate = strokes[strokes.length - 1];
    expect(condensate.classification).toBe('sanitary-drainage');
  });

  it('draws the condensate drain as a multi-stroke P-trap (σιφώνι), not a plain stub', () => {
    // The condensate connector is a sanitary-drainage pipe → it gets a distinct trap glyph
    // (inlet stub + «∪» water-seal), unlike supply/return which stay single plain stubs.
    const drain = symbol({ fuelType: 'electric', condensing: true }).strokes.filter(
      (s) => s.classification === 'sanitary-drainage',
    );
    expect(drain.length).toBeGreaterThanOrEqual(2); // stub + U-bend
    for (const s of drain) expect(s.classification).toBe('sanitary-drainage');
    // The U-bend is a multi-point polyline (not a 2-point stub) → reads as a trap.
    expect(drain.some((s) => s.line.length > 2)).toBe(true);
  });

  it('omits the condensate trap entirely on a non-condensing boiler', () => {
    const drain = symbol({ fuelType: 'gas', condensing: false }).strokes.filter(
      (s) => s.classification === 'sanitary-drainage',
    );
    expect(drain).toHaveLength(0);
  });

  it('keeps supply/return as single plain 2-point stubs (regression-free)', () => {
    const [supply, ret] = symbol({ fuelType: 'electric', condensing: true }).strokes;
    expect(supply.line).toHaveLength(2);
    expect(ret.line).toHaveLength(2);
  });

  it('builds the condensate trap rotation-aware (90°)', () => {
    const drain = symbol({ fuelType: 'electric', condensing: true, rotation: 90 }).strokes.filter(
      (s) => s.classification === 'sanitary-drainage',
    );
    expect(drain.length).toBeGreaterThanOrEqual(2);
    for (const s of drain) {
      for (const p of s.line) {
        expect(Number.isFinite(p.x)).toBe(true);
        expect(Number.isFinite(p.y)).toBe(true);
      }
    }
  });

  it('appends a neutraliser cartridge box on the condensate drain when fitted', () => {
    // stub + U-bend trap + neutraliser rect = 3 sanitary-drainage strokes (vs 2 without).
    const drain = symbol({
      fuelType: 'electric',
      condensing: true,
      condensateNeutraliser: true,
    }).strokes.filter((s) => s.classification === 'sanitary-drainage');
    expect(drain).toHaveLength(3);
    for (const s of drain) expect(s.classification).toBe('sanitary-drainage');
    // The cartridge is a closed rectangle (5 points, first === last).
    const rect = drain.find((s) => s.line.length === 5 && s.line[0].x === s.line[4].x && s.line[0].y === s.line[4].y);
    expect(rect).toBeDefined();
  });

  it('omits the neutraliser when the toggle is off (only stub + trap)', () => {
    const drain = symbol({ fuelType: 'electric', condensing: true }).strokes.filter(
      (s) => s.classification === 'sanitary-drainage',
    );
    expect(drain).toHaveLength(2); // stub + U-bend only
  });

  it('omits the neutraliser on a non-condensing boiler even if the flag is set', () => {
    const drain = symbol({ fuelType: 'gas', condensateNeutraliser: true }).strokes.filter(
      (s) => s.classification === 'sanitary-drainage',
    );
    expect(drain).toHaveLength(0); // no condensate connector → no drain strokes at all
  });

  it('builds the neutraliser cartridge rotation-aware (90°, finite)', () => {
    const drain = symbol({
      fuelType: 'electric',
      condensing: true,
      condensateNeutraliser: true,
      rotation: 90,
    }).strokes.filter((s) => s.classification === 'sanitary-drainage');
    expect(drain).toHaveLength(3);
    for (const s of drain) for (const p of s.line) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });

  it('tags every flue vent stroke exhaust (duct classification)', () => {
    const vent = symbol({ fuelType: 'gas' }).ventStrokes;
    expect(vent.length).toBeGreaterThan(0);
    for (const v of vent) expect(v.classification).toBe('exhaust');
  });

  it('leaves the fuel-cock glyph and the body glyph untagged (default boiler stroke)', () => {
    const sym = symbol({ fuelType: 'gas' });
    // fuelStrokes are plain BoilerStroke polylines (no classification wrapper).
    for (const stroke of sym.fuelStrokes) expect(Array.isArray(stroke)).toBe(true);
    for (const stroke of sym.glyphStrokes) expect(Array.isArray(stroke)).toBe(true);
  });
});

describe('buildMepBoilerSymbol — combi DHW ports', () => {
  it('a gas combi with recirculation draws 5 pipe stubs (supply/return + hot/cold/recirc) + fuel glyph', () => {
    // The gas fuel inlet (domain:'fuel') gets its OWN gas-cock glyph in `fuelStrokes`, NOT `strokes`.
    const sym = symbol({ producesDhw: true, dhwRecirculation: true, fuelType: 'gas' });
    expect(sym.strokes).toHaveLength(5);
    expect(sym.fuelStrokes).toHaveLength(5); // stub + 2 bow-tie triangles + lever stem + crossbar
  });

  it('a non-recirc electric combi draws 4 pipe stubs (supply/return + hot/cold) and no fuel glyph', () => {
    const sym = symbol({ producesDhw: true, fuelType: 'electric' });
    expect(sym.strokes).toHaveLength(4);
    expect(sym.fuelStrokes).toHaveLength(0);
  });
});

describe('buildMepBoilerSymbol — combustion fuel supply glyph (gas-cock)', () => {
  it('a plain gas boiler draws 2 pipe stubs + a 5-stroke fuel-cock glyph + the flue vent', () => {
    const sym = symbol({ fuelType: 'gas' });
    expect(sym.strokes).toHaveLength(2); // supply, return only — fuel is no longer a plain stub
    expect(sym.fuelStrokes).toHaveLength(5); // stub + 2 bow-tie triangles + lever stem + crossbar
    expect(sym.ventStrokes).toHaveLength(7); // flue chevron + roof-cowl terminal
  });

  it('the fuel-cock stub roots at the front-centre (+Y), pointing +Y', () => {
    // fuel at host-local {0,+hl}; the gas-cock glyph's first stroke is the stub [root, tip].
    const [stub] = symbol({ fuelType: 'gas' }).fuelStrokes;
    expect(stub[0].x).toBeCloseTo(0, 6);
    expect(stub[0].y).toBeCloseTo(175, 6);
    expect(stub[1].x).toBeCloseTo(0, 6);
    expect(stub[1].y).toBeCloseTo(175 + STUB_LEN, 6);
  });

  it('the bow-tie triangles are closed (first === last point) and meet at the stub tip', () => {
    const [, innerTri, outerTri] = symbol({ fuelType: 'gas' }).fuelStrokes;
    // Closed triangles: 4 points, first === last.
    expect(innerTri).toHaveLength(4);
    expect(outerTri).toHaveLength(4);
    expect(innerTri[0]).toEqual(innerTri[3]);
    expect(outerTri[0]).toEqual(outerTri[3]);
    // Both apexes meet at the same point (the stub tip = {0, 175 + STUB_LEN}).
    expect(innerTri[0].x).toBeCloseTo(0, 6);
    expect(innerTri[0].y).toBeCloseTo(175 + STUB_LEN, 6);
    expect(outerTri[0]).toEqual(innerTri[0]);
  });

  it('an oil boiler also gets the fuel-cock glyph (5 strokes)', () => {
    expect(symbol({ fuelType: 'oil' }).fuelStrokes).toHaveLength(5);
  });

  it('an electric boiler has no fuel glyph (only supply/return stubs)', () => {
    const sym = symbol({ fuelType: 'electric' });
    expect(sym.strokes).toHaveLength(2);
    expect(sym.fuelStrokes).toHaveLength(0);
  });

  it('a heat-pump boiler has no fuel glyph', () => {
    expect(symbol({ fuelType: 'heat-pump' }).fuelStrokes).toHaveLength(0);
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
    expect(stub.line[0].x).toBeCloseTo(0, 6);
    expect(stub.line[0].y).toBeCloseTo(-175, 6);
    expect(stub.line[1].x).toBeCloseTo(0, 6);
    expect(stub.line[1].y).toBeCloseTo(-175 - STUB_LEN, 6);
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
    expect(supply.line[0].x).toBeCloseTo(0, 6);
    expect(supply.line[0].y).toBeCloseTo(HW, 6);
    expect(supply.line[1].x).toBeCloseTo(0, 6);
    expect(supply.line[1].y).toBeCloseTo(HW + STUB_LEN, 6);
  });

  it('rotates the fuel-cock stub with the host (90° CCW → fuel front-centre points −X)', () => {
    // fuel local {0,175} rotated 90° CCW → {−175,0}, outward {−1,0}.
    const [stub] = symbol({ fuelType: 'gas', rotation: 90 }).fuelStrokes;
    expect(stub[0].x).toBeCloseTo(-175, 6);
    expect(stub[0].y).toBeCloseTo(0, 6);
    expect(stub[1].x).toBeCloseTo(-175 - STUB_LEN, 6);
    expect(stub[1].y).toBeCloseTo(0, 6);
  });
});

describe('buildMepBoilerSymbol — service-clearance envelope (Revit «Clearances»)', () => {
  // footprint half-extents: half-width 225 (x), half-length 175 (y). Default clearance 500.
  const HL = 175;
  it('omits the clearance outline by default (toggle off)', () => {
    expect(symbol().clearanceOutline).toBeUndefined();
  });

  it('emits a closed 4-vertex envelope when showServiceClearance is set', () => {
    const outline = symbol({ showServiceClearance: true }).clearanceOutline;
    expect(outline).toBeDefined();
    expect(outline).toHaveLength(4);
  });

  it('offsets the footprint uniformly outward by the default 500mm on every side', () => {
    const o = symbol({ showServiceClearance: true }).clearanceOutline!;
    // corners: (−725,−675) (725,−675) (725,675) (−725,675)
    expect(o[0].x).toBeCloseTo(-(HW + 500), 6);
    expect(o[0].y).toBeCloseTo(-(HL + 500), 6);
    expect(o[2].x).toBeCloseTo(HW + 500, 6);
    expect(o[2].y).toBeCloseTo(HL + 500, 6);
  });

  it('every clearance corner lies farther from the centroid than the matching footprint corner', () => {
    const sym = symbol({ showServiceClearance: true });
    const foot = sym.outline;
    const clr = sym.clearanceOutline!;
    for (let i = 0; i < 4; i++) {
      expect(Math.hypot(clr[i].x, clr[i].y)).toBeGreaterThan(Math.hypot(foot[i].x, foot[i].y));
    }
  });

  it('honours an explicit serviceClearanceMm override', () => {
    const o = symbol({ showServiceClearance: true, serviceClearanceMm: 300 }).clearanceOutline!;
    expect(o[2].x).toBeCloseTo(HW + 300, 6);
    expect(o[2].y).toBeCloseTo(HL + 300, 6);
  });

  it('builds the clearance envelope rotation-aware (90°, finite)', () => {
    const o = symbol({ showServiceClearance: true, rotation: 90 }).clearanceOutline!;
    expect(o).toHaveLength(4);
    for (const p of o) {
      expect(Number.isFinite(p.x)).toBe(true);
      expect(Number.isFinite(p.y)).toBe(true);
    }
  });
});

describe('buildMepBoilerSymbol — safety relief valve glyph (Revit «Safety Relief Valve»)', () => {
  it('draws no relief-valve glyph by default (exactly 4 base glyph strokes: divider + flame)', () => {
    expect(symbol().glyphStrokes).toHaveLength(4);
  });

  it('appends the 5-stroke relief-valve glyph when safetyReliefValve is set (4 base + 5 = 9)', () => {
    expect(symbol({ safetyReliefValve: true }).glyphStrokes).toHaveLength(9);
  });

  it('keeps every glyph stroke a finite-point polyline (rotation 90°)', () => {
    const sym = symbol({ safetyReliefValve: true, rotation: 90 });
    expect(sym.glyphStrokes).toHaveLength(9);
    for (const stroke of sym.glyphStrokes) {
      expect(stroke.length).toBeGreaterThanOrEqual(2);
      for (const p of stroke) {
        expect(Number.isFinite(p.x)).toBe(true);
        expect(Number.isFinite(p.y)).toBe(true);
      }
    }
  });

  it('does not touch the connector stubs / clearance (visual-only body glyph)', () => {
    const sym = symbol({ safetyReliefValve: true });
    expect(sym.strokes).toHaveLength(2); // plain supply + return, unchanged
    expect(sym.clearanceOutline).toBeUndefined();
  });
});

describe('buildMepBoilerSymbol — expansion vessel glyph (Revit accessory, IFC IfcTank EXPANSION)', () => {
  it('draws no vessel glyph by default (exactly 4 base glyph strokes: divider + flame)', () => {
    expect(symbol().glyphStrokes).toHaveLength(4);
  });

  it('appends the 3-stroke vessel glyph when expansionVessel is set (4 base + 3 = 7)', () => {
    expect(symbol({ expansionVessel: true }).glyphStrokes).toHaveLength(7);
  });

  it('stacks with the relief valve (4 base + 5 valve + 3 vessel = 12)', () => {
    expect(
      symbol({ safetyReliefValve: true, expansionVessel: true }).glyphStrokes,
    ).toHaveLength(12);
  });

  it('keeps every glyph stroke a finite-point polyline (rotation 90°)', () => {
    const sym = symbol({ expansionVessel: true, rotation: 90 });
    expect(sym.glyphStrokes).toHaveLength(7);
    for (const stroke of sym.glyphStrokes) {
      expect(stroke.length).toBeGreaterThanOrEqual(2);
      for (const p of stroke) {
        expect(Number.isFinite(p.x)).toBe(true);
        expect(Number.isFinite(p.y)).toBe(true);
      }
    }
  });

  it('does not touch the connector stubs / clearance (visual-only body glyph)', () => {
    const sym = symbol({ expansionVessel: true });
    expect(sym.strokes).toHaveLength(2); // plain supply + return, unchanged
    expect(sym.clearanceOutline).toBeUndefined();
  });
});

describe('buildMepBoilerSymbol — pressure gauge glyph (Revit accessory, IFC IfcSensor PRESSURE)', () => {
  it('draws no gauge glyph by default (exactly 4 base glyph strokes: divider + flame)', () => {
    expect(symbol().glyphStrokes).toHaveLength(4);
  });

  it('appends the 3-stroke gauge glyph when pressureGauge is set (4 base + 3 = 7)', () => {
    expect(symbol({ pressureGauge: true }).glyphStrokes).toHaveLength(7);
  });

  it('stacks with the full sealed-system trio (4 base + 5 valve + 3 vessel + 3 gauge = 15)', () => {
    expect(
      symbol({ safetyReliefValve: true, expansionVessel: true, pressureGauge: true }).glyphStrokes,
    ).toHaveLength(15);
  });

  it('keeps every glyph stroke a finite-point polyline (rotation 90°)', () => {
    const sym = symbol({ pressureGauge: true, rotation: 90 });
    expect(sym.glyphStrokes).toHaveLength(7);
    for (const stroke of sym.glyphStrokes) {
      expect(stroke.length).toBeGreaterThanOrEqual(2);
      for (const p of stroke) {
        expect(Number.isFinite(p.x)).toBe(true);
        expect(Number.isFinite(p.y)).toBe(true);
      }
    }
  });

  it('does not touch the connector stubs / clearance (visual-only body glyph)', () => {
    const sym = symbol({ pressureGauge: true });
    expect(sym.strokes).toHaveLength(2); // plain supply + return, unchanged
    expect(sym.clearanceOutline).toBeUndefined();
  });
});

describe('buildMepBoilerSymbol — filling loop glyph (βρόχος πλήρωσης, Revit/IFC IfcValve CHECK)', () => {
  it('draws no filling-loop glyph by default (exactly 4 base glyph strokes: divider + flame)', () => {
    expect(symbol().glyphStrokes).toHaveLength(4);
  });

  it('appends the 6-stroke filling-loop glyph when fillingLoop is set (4 base + 6 = 10)', () => {
    expect(symbol({ fillingLoop: true }).glyphStrokes).toHaveLength(10);
  });

  it('stacks on top of the full sealed-system trio (4 base + 5 valve + 3 vessel + 3 gauge + 6 loop = 21)', () => {
    expect(
      symbol({
        safetyReliefValve: true,
        expansionVessel: true,
        pressureGauge: true,
        fillingLoop: true,
      }).glyphStrokes,
    ).toHaveLength(21);
  });

  it('keeps every glyph stroke a finite-point polyline (rotation 90°)', () => {
    const sym = symbol({ fillingLoop: true, rotation: 90 });
    expect(sym.glyphStrokes).toHaveLength(10);
    for (const stroke of sym.glyphStrokes) {
      expect(stroke.length).toBeGreaterThanOrEqual(2);
      for (const p of stroke) {
        expect(Number.isFinite(p.x)).toBe(true);
        expect(Number.isFinite(p.y)).toBe(true);
      }
    }
  });

  it('does not touch the connector stubs / clearance (visual-only body glyph)', () => {
    const sym = symbol({ fillingLoop: true });
    expect(sym.strokes).toHaveLength(2); // plain supply + return, unchanged
    expect(sym.clearanceOutline).toBeUndefined();
  });
});
