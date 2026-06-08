/**
 * ADR-408 Δρόμος B — appliance-symbol-spec SSoT.
 *
 * Verifies the appliance family discriminator, tool-id round-trip, the measured
 * washing-machine spec (cold-only supply + drain), and that the 2D drawer emits
 * non-empty strokes from a footprint basis.
 */

import {
  APPLIANCE_KINDS,
  APPLIANCE_SPEC,
  APPLIANCE_DRAWERS,
  isApplianceKind,
  applianceFixtureToolId,
  applianceFixtureToolKind,
} from '../appliance-symbol-spec';
import type { FootprintBasis } from '../../floorplan-symbols/symbol-vector-helpers';

describe('appliance-symbol-spec', () => {
  it('isApplianceKind recognises only appliance kinds', () => {
    expect(isApplianceKind('washing-machine')).toBe(true);
    expect(isApplianceKind('wc')).toBe(false);
    expect(isApplianceKind('light-fixture')).toBe(false);
    expect(isApplianceKind('floor-drain')).toBe(false);
  });

  it('tool-id round-trips (mep-<kind>) and rejects foreign tools', () => {
    for (const kind of APPLIANCE_KINDS) {
      const toolId = applianceFixtureToolId(kind);
      expect(toolId).toBe(`mep-${kind}`);
      expect(applianceFixtureToolKind(toolId)).toBe(kind);
    }
    expect(applianceFixtureToolKind('mep-wc')).toBeNull();
    expect(applianceFixtureToolKind('mep-fixture')).toBeNull();
    expect(applianceFixtureToolKind('furniture')).toBeNull();
  });

  it('washing-machine spec carries the measured dims + cold-only supply + drain', () => {
    const spec = APPLIANCE_SPEC['washing-machine'];
    expect(spec.widthMm).toBe(597);
    expect(spec.depthMm).toBe(587);
    expect(spec.drainDiameterMm).toBe(50);
    expect(spec.supply.cold).toBe(true);
    expect(spec.supply.hot).toBe(false);
    expect(spec.supply.diameterMm).toBe(15);
    expect(spec.labelKey).toBe('mepFixture.appliance.washingMachine');
  });

  it('every appliance kind has a drawer that emits strokes', () => {
    const fp: FootprintBasis = [
      { x: 0, y: 0, z: 0 },
      { x: 1, y: 0, z: 0 },
      { x: 1, y: 1, z: 0 },
      { x: 0, y: 1, z: 0 },
    ];
    for (const kind of APPLIANCE_KINDS) {
      const strokes = APPLIANCE_DRAWERS[kind](fp);
      expect(strokes.length).toBeGreaterThan(0);
      for (const s of strokes) expect(s.length).toBeGreaterThan(1);
    }
  });
});
