/**
 * ADR-408 Εύρος Β #2 — Boiler 2D plan tag content SSoT (Revit «Mechanical Equipment Tag»).
 *
 * Pins the pure `buildBoilerTagLines` core: a catalogue model surfaces its literal product
 * label; thermal output renders as whole kW; fuel resolves to a localized enum; the flue Ø
 * line appears ONLY for combustion fuels (gas/oil) and is omitted for electric/heat-pump;
 * a parametric boiler (no model) falls back to the generic label; and absent params drop
 * their lines entirely. The i18n-bound `resolveBoilerTagLines` wrapper is out of scope (it
 * just binds the live translator).
 */

import { buildBoilerTagLines, type BoilerTagTranslator } from '../mep-boiler-tag';
import type { MepBoilerParams } from '../../types/mep-boiler-types';

/** Fake translator — echoes the short key so assertions can pin label/value composition. */
const fakeT: BoilerTagTranslator = (shortKey) => shortKey;

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

describe('buildBoilerTagLines', () => {
  it('a gas combi catalogue boiler shows model, power (kW), fuel and flue Ø', () => {
    const lines = buildBoilerTagLines(
      params({ modelId: 'gas-condensing-24', fuelType: 'gas', thermalOutputW: 24000, producesDhw: true }),
      fakeT,
    );
    // Model is the literal catalogue label (not an i18n key).
    expect(lines[0]).toBe('Επίτοιχος αερίου συμπύκνωσης 24 kW');
    expect(lines).toContain('power: 24 kWUnit');
    expect(lines).toContain('fuel: fuelTypes.gas');
    expect(lines).toContain('flue: Ø dnPrefix100'); // default flue DN100
  });

  it('uses an explicit flueDiameterMm when present', () => {
    const lines = buildBoilerTagLines(
      params({ fuelType: 'oil', thermalOutputW: 30000, flueDiameterMm: 110 }),
      fakeT,
    );
    expect(lines).toContain('flue: Ø dnPrefix110');
  });

  it('an oil boiler tag shows the type-driven per-fuel defaults (flue DN130, fuel DN15)', () => {
    // SSoT: the tag must match the connector defaults from buildBoilerConnectors.
    const lines = buildBoilerTagLines(params({ fuelType: 'oil', thermalOutputW: 30000 }), fakeT);
    expect(lines).toContain('flue: Ø dnPrefix130');
    expect(lines).toContain('fuelSupply: Ø dnPrefix15');
  });

  it('an electric boiler omits the flue line (no combustion)', () => {
    const lines = buildBoilerTagLines(
      params({ modelId: 'electric-9', fuelType: 'electric', thermalOutputW: 9000 }),
      fakeT,
    );
    expect(lines.some((l) => l.startsWith('flue'))).toBe(false);
    expect(lines).toContain('fuel: fuelTypes.electric');
  });

  it('a heat-pump boiler omits the flue line', () => {
    const lines = buildBoilerTagLines(params({ fuelType: 'heat-pump', thermalOutputW: 12000 }), fakeT);
    expect(lines.some((l) => l.startsWith('flue'))).toBe(false);
  });

  it('a parametric boiler (no model) falls back to the generic label', () => {
    const lines = buildBoilerTagLines(params(), fakeT);
    expect(lines[0]).toBe('modelFallback');
  });

  it('rounds thermal output to whole kW', () => {
    const lines = buildBoilerTagLines(params({ thermalOutputW: 28400 }), fakeT);
    expect(lines).toContain('power: 28 kWUnit');
  });

  it('omits the power line when thermalOutputW is absent or zero', () => {
    expect(buildBoilerTagLines(params(), fakeT).some((l) => l.startsWith('power'))).toBe(false);
    expect(
      buildBoilerTagLines(params({ thermalOutputW: 0 }), fakeT).some((l) => l.startsWith('power')),
    ).toBe(false);
  });

  it('omits the fuel line when fuelType is absent', () => {
    const lines = buildBoilerTagLines(params({ thermalOutputW: 24000 }), fakeT);
    expect(lines.some((l) => l.startsWith('fuel'))).toBe(false);
  });

  it('shows the vent-terminal line for combustion fuels (default roof cowl)', () => {
    const lines = buildBoilerTagLines(params({ fuelType: 'gas' }), fakeT);
    expect(lines).toContain('terminationLabel: terminationTypes.roof-cowl');
  });

  it('reflects an explicit flueTermination type', () => {
    const lines = buildBoilerTagLines(params({ fuelType: 'oil', flueTermination: 'wall-horizontal' }), fakeT);
    expect(lines).toContain('terminationLabel: terminationTypes.wall-horizontal');
  });

  it('omits the terminal line for non-combustion boilers', () => {
    const lines = buildBoilerTagLines(
      params({ fuelType: 'electric', flueTermination: 'balanced-concentric' }),
      fakeT,
    );
    expect(lines.some((l) => l.startsWith('terminationLabel'))).toBe(false);
  });

  it('shows the fuel-supply Ø line for combustion fuels (default DN20)', () => {
    const lines = buildBoilerTagLines(params({ fuelType: 'gas' }), fakeT);
    expect(lines).toContain('fuelSupply: Ø dnPrefix20');
  });

  it('uses an explicit fuelConnectorDiameterMm when present', () => {
    const lines = buildBoilerTagLines(params({ fuelType: 'gas', fuelConnectorDiameterMm: 25 }), fakeT);
    expect(lines).toContain('fuelSupply: Ø dnPrefix25');
  });

  it('omits the fuel-supply line for non-combustion boilers', () => {
    const lines = buildBoilerTagLines(params({ fuelType: 'heat-pump' }), fakeT);
    expect(lines.some((l) => l.startsWith('fuelSupply'))).toBe(false);
  });

  // ─── Condensate drain (αποχέτευση συμπυκνωμάτων), condensing boilers only ──────

  it('shows the condensate Ø line for a condensing boiler (default DN25)', () => {
    const lines = buildBoilerTagLines(params({ fuelType: 'gas', condensing: true }), fakeT);
    expect(lines).toContain('condensate: Ø dnPrefix25');
  });

  it('uses an explicit condensateConnectorDiameterMm when present', () => {
    const lines = buildBoilerTagLines(
      params({ fuelType: 'gas', condensing: true, condensateConnectorDiameterMm: 32 }),
      fakeT,
    );
    expect(lines).toContain('condensate: Ø dnPrefix32');
  });

  it('omits the condensate line for a non-condensing boiler', () => {
    const lines = buildBoilerTagLines(params({ fuelType: 'gas' }), fakeT);
    expect(lines.some((l) => l.startsWith('condensate'))).toBe(false);
  });

  // ─── Service clearance (Revit «Clearances»), shown when the keep-clear zone is on ─

  it('shows the clearance line with the default 500mm when showServiceClearance is set', () => {
    const lines = buildBoilerTagLines(params({ showServiceClearance: true }), fakeT);
    expect(lines).toContain('clearance: 500 mm');
  });

  it('uses an explicit serviceClearanceMm when present', () => {
    const lines = buildBoilerTagLines(
      params({ showServiceClearance: true, serviceClearanceMm: 300 }),
      fakeT,
    );
    expect(lines).toContain('clearance: 300 mm');
  });

  it('omits the clearance line when showServiceClearance is absent', () => {
    const lines = buildBoilerTagLines(params({ serviceClearanceMm: 400 }), fakeT);
    expect(lines.some((l) => l.startsWith('clearance'))).toBe(false);
  });

  // ─── Condensate neutraliser (εξουδετερωτής), condensing boilers that have one ─────

  it('shows the neutraliser line for a condensing boiler with a neutraliser fitted', () => {
    const lines = buildBoilerTagLines(
      params({ fuelType: 'gas', condensing: true, condensateNeutraliser: true }),
      fakeT,
    );
    expect(lines).toContain('neutraliser: ✓');
  });

  it('omits the neutraliser line when the toggle is off', () => {
    const lines = buildBoilerTagLines(params({ fuelType: 'gas', condensing: true }), fakeT);
    expect(lines.some((l) => l.startsWith('neutraliser'))).toBe(false);
  });

  it('omits the neutraliser line on a non-condensing boiler even if the flag is set', () => {
    const lines = buildBoilerTagLines(params({ fuelType: 'gas', condensateNeutraliser: true }), fakeT);
    expect(lines.some((l) => l.startsWith('neutraliser'))).toBe(false);
  });

  // ─── Efficiency + ErP class (any fuel, NOT combustion-gated) ──────────────────

  it('shows the efficiency line + ErP class for a gas boiler (94% → A)', () => {
    const lines = buildBoilerTagLines(params({ fuelType: 'gas', seasonalEfficiencyPercent: 94 }), fakeT);
    expect(lines).toContain('efficiency: 94%');
    expect(lines).toContain('erp: A');
  });

  it('rounds the efficiency to a whole percent', () => {
    const lines = buildBoilerTagLines(params({ fuelType: 'oil', seasonalEfficiencyPercent: 88.6 }), fakeT);
    expect(lines).toContain('efficiency: 89%');
  });

  it('shows efficiency + ErP for an electric boiler too (D via primary-energy factor)', () => {
    const lines = buildBoilerTagLines(
      params({ fuelType: 'electric', seasonalEfficiencyPercent: 99 }),
      fakeT,
    );
    expect(lines).toContain('efficiency: 99%');
    expect(lines).toContain('erp: D');
  });

  it('shows A+++ for a high-η_s heat-pump', () => {
    const lines = buildBoilerTagLines(
      params({ fuelType: 'heat-pump', seasonalEfficiencyPercent: 156 }),
      fakeT,
    );
    expect(lines).toContain('erp: A+++');
  });

  it('omits the efficiency + ErP lines when seasonalEfficiencyPercent is absent or zero', () => {
    expect(
      buildBoilerTagLines(params({ fuelType: 'gas' }), fakeT).some((l) => l.startsWith('efficiency')),
    ).toBe(false);
    expect(
      buildBoilerTagLines(params({ seasonalEfficiencyPercent: 0 }), fakeT).some((l) =>
        l.startsWith('erp'),
      ),
    ).toBe(false);
  });

  // ─── Safety relief valve (Revit «Safety Relief Valve»), shown when the valve is fitted ─

  it('shows the relief-valve line with the default 3 bar when safetyReliefValve is set', () => {
    const lines = buildBoilerTagLines(params({ safetyReliefValve: true }), fakeT);
    expect(lines).toContain('reliefValve: 3 bar');
  });

  it('uses an explicit reliefValvePressureBar when present (incl. fractional)', () => {
    expect(
      buildBoilerTagLines(params({ safetyReliefValve: true, reliefValvePressureBar: 6 }), fakeT),
    ).toContain('reliefValve: 6 bar');
    expect(
      buildBoilerTagLines(params({ safetyReliefValve: true, reliefValvePressureBar: 2.5 }), fakeT),
    ).toContain('reliefValve: 2.5 bar');
  });

  it('omits the relief-valve line when the toggle is off', () => {
    const lines = buildBoilerTagLines(params({ reliefValvePressureBar: 4 }), fakeT);
    expect(lines.some((l) => l.startsWith('reliefValve'))).toBe(false);
  });

  // ─── Expansion vessel (Revit accessory, IFC IfcTank EXPANSION), shown when fitted ─────

  it('shows the expansion-vessel line with the default 12 L when expansionVessel is set', () => {
    const lines = buildBoilerTagLines(params({ expansionVessel: true }), fakeT);
    expect(lines).toContain('expansionVessel: 12 L');
  });

  it('uses an explicit expansionVesselVolumeL when present', () => {
    const lines = buildBoilerTagLines(
      params({ expansionVessel: true, expansionVesselVolumeL: 24 }),
      fakeT,
    );
    expect(lines).toContain('expansionVessel: 24 L');
  });

  it('omits the expansion-vessel line when the toggle is off', () => {
    const lines = buildBoilerTagLines(params({ expansionVesselVolumeL: 18 }), fakeT);
    expect(lines.some((l) => l.startsWith('expansionVessel'))).toBe(false);
  });

  // ─── Pressure gauge (Revit accessory, IFC IfcSensor PRESSURE), shown when fitted ──────

  it('shows the pressure-gauge line with the default 1.5 bar when pressureGauge is set', () => {
    const lines = buildBoilerTagLines(params({ pressureGauge: true }), fakeT);
    expect(lines).toContain('pressureGauge: 1.5 bar');
  });

  it('uses an explicit systemPressureBar when present (incl. fractional)', () => {
    expect(
      buildBoilerTagLines(params({ pressureGauge: true, systemPressureBar: 2 }), fakeT),
    ).toContain('pressureGauge: 2 bar');
    expect(
      buildBoilerTagLines(params({ pressureGauge: true, systemPressureBar: 1.2 }), fakeT),
    ).toContain('pressureGauge: 1.2 bar');
  });

  it('omits the pressure-gauge line when the toggle is off', () => {
    const lines = buildBoilerTagLines(params({ systemPressureBar: 1.2 }), fakeT);
    expect(lines.some((l) => l.startsWith('pressureGauge'))).toBe(false);
  });

  // ─── Modulation / turndown (Revit «Turndown Ratio»), shown for a modulating range ─────

  it('shows the modulation line (range + ratio) for a modulating boiler', () => {
    const lines = buildBoilerTagLines(
      params({ thermalOutputW: 24000, minThermalOutputW: 6000 }),
      fakeT,
    );
    expect(lines).toContain('modulation: 6–24 kWUnit (4:1)');
  });

  it('rounds a fractional turndown ratio to one decimal', () => {
    const lines = buildBoilerTagLines(
      params({ thermalOutputW: 24000, minThermalOutputW: 7000 }),
      fakeT,
    );
    expect(lines).toContain('modulation: 7–24 kWUnit (3.4:1)');
  });

  it('omits the modulation line when minThermalOutputW is absent (on/off appliance)', () => {
    const lines = buildBoilerTagLines(params({ thermalOutputW: 24000 }), fakeT);
    expect(lines.some((l) => l.startsWith('modulation'))).toBe(false);
  });

  it('omits the modulation line when min ≥ max (no genuine range)', () => {
    const lines = buildBoilerTagLines(
      params({ thermalOutputW: 24000, minThermalOutputW: 24000 }),
      fakeT,
    );
    expect(lines.some((l) => l.startsWith('modulation'))).toBe(false);
  });

  it('omits the modulation line when thermalOutputW is absent', () => {
    const lines = buildBoilerTagLines(params({ minThermalOutputW: 6000 }), fakeT);
    expect(lines.some((l) => l.startsWith('modulation'))).toBe(false);
  });
});
