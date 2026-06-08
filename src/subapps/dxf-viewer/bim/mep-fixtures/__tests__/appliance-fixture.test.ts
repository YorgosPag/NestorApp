/**
 * ADR-408 Δρόμος B — appliance fixture: connector set, mesh catalog, kind-derived
 * SSoT resolvers (IFC class / V/G category / mesh category).
 *
 * A washing machine is a connectable mep-fixture: cold-water inlet + sanitary-drainage
 * outlet (cold-only, no hot — EU machine heats its own water), an IfcElectricAppliance,
 * V/G-grouped with the sanitary fixtures, mesh in the `appliance` Storage folder.
 */

import { buildSanitaryFixtureConnectors } from '../sanitary-fixture-connectors';
import {
  SANITARY_DRAIN_CONNECTOR_ID,
  SANITARY_COLD_CONNECTOR_ID,
  SANITARY_HOT_CONNECTOR_ID,
} from '../../types/mep-connector-types';
import {
  APPLIANCE_MESH_CATALOG,
  resolveApplianceFixtureAsset,
  applianceMeshPresetsForKind,
} from '../appliance-fixture-mesh-catalog';
import {
  resolveFixtureIfcType,
  resolveFixtureMeshCategory,
  resolveFixtureBimCategory,
} from '../../types/mep-fixture-types';
import type { MepFixtureParams } from '../../types/mep-fixture-types';

describe('appliance fixture connectors', () => {
  it("washing-machine → drain + cold, no hot", () => {
    const cs = buildSanitaryFixtureConnectors('washing-machine', 'mm');
    const ids = cs.map((c) => c.connectorId);
    expect(ids).toContain(SANITARY_DRAIN_CONNECTOR_ID);
    expect(ids).toContain(SANITARY_COLD_CONNECTOR_ID);
    expect(ids).not.toContain(SANITARY_HOT_CONNECTOR_ID);
    expect(cs).toHaveLength(2);

    const drain = cs.find((c) => c.connectorId === SANITARY_DRAIN_CONNECTOR_ID)!;
    expect(drain.flow).toBe('out');
    expect(drain.pipe?.systemClassification).toBe('sanitary-drainage');
    expect(drain.pipe?.diameterMm).toBe(50);

    const cold = cs.find((c) => c.connectorId === SANITARY_COLD_CONNECTOR_ID)!;
    expect(cold.flow).toBe('in');
    expect(cold.pipe?.systemClassification).toBe('domestic-cold-water');
    expect(cold.pipe?.diameterMm).toBe(15);
  });

  it('cold stub is a distinct back-centre position from the drain origin', () => {
    const cs = buildSanitaryFixtureConnectors('washing-machine', 'mm');
    const drain = cs.find((c) => c.connectorId === SANITARY_DRAIN_CONNECTOR_ID)!;
    const cold = cs.find((c) => c.connectorId === SANITARY_COLD_CONNECTOR_ID)!;
    expect(drain.localPosition).toEqual({ x: 0, y: 0, z: 0 });
    expect(cold.localPosition.x).toBe(0); // cold-only → back-centre stub
    expect(cold.localPosition.y).toBeGreaterThan(0);
  });
});

describe('appliance mesh catalog', () => {
  it('washing_machine_01 carries the measured CC-BY dims', () => {
    const preset = resolveApplianceFixtureAsset('washing_machine_01');
    expect(preset).toBeDefined();
    expect(preset!.kind).toBe('washing-machine');
    expect(preset!.widthMm).toBe(597);
    expect(preset!.depthMm).toBe(587);
    expect(preset!.heightMm).toBe(850);
    expect(preset!.mountingElevationMm).toBe(0);
    expect(preset!.source).toMatch(/CC-?BY/i);
  });

  it('presets filter by kind; unknown id → undefined', () => {
    expect(applianceMeshPresetsForKind('washing-machine')).toHaveLength(
      APPLIANCE_MESH_CATALOG.filter((p) => p.kind === 'washing-machine').length,
    );
    expect(resolveApplianceFixtureAsset('nope')).toBeUndefined();
  });
});

describe('appliance kind-derived SSoT resolvers', () => {
  const params = { kind: 'washing-machine' } as MepFixtureParams;

  it('IFC class = IfcElectricAppliance (distinct from sanitary terminal)', () => {
    expect(resolveFixtureIfcType('washing-machine')).toBe('IfcElectricAppliance');
    expect(resolveFixtureIfcType('wc')).toBe('IfcSanitaryTerminal');
  });

  it("mesh category = 'appliance'; V/G category groups with sanitary", () => {
    expect(resolveFixtureMeshCategory('washing-machine')).toBe('appliance');
    expect(resolveFixtureBimCategory(params)).toBe('sanitary');
  });
});
