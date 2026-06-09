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
      params({ fuelType: 'oil', thermalOutputW: 30000, flueDiameterMm: 130 }),
      fakeT,
    );
    expect(lines).toContain('flue: Ø dnPrefix130');
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
});
