/**
 * ADR-432 Slice 0a — duct-network domain foundation tests.
 *
 * The keystone HVAC work: a `duct-network` MepSystem (mirror of the Φ9 pipe-network)
 * plus the air-terminal / AHU duct connectors. These pure types/builders/schemas are
 * what the headless engine (Slice 1) and the commit (Slice 2) stand on, so they are
 * unit-tested in isolation before any engine exists.
 */

import {
  buildDefaultDuctNetworkParams,
  buildDefaultPipeNetworkParams,
  buildDefaultCircuitParams,
  isDuctSystemParams,
  isPipeSystemParams,
  isElectricalSystemParams,
} from '../mep-system-types';
import {
  buildAirTerminalSupplyConnector,
  buildAhuSupplyAirConnector,
  AIR_TERMINAL_SUPPLY_CONNECTOR_ID,
  AHU_SUPPLY_CONNECTOR_ID,
} from '../mep-connector-types';
import { MepSystemParamsSchema } from '../mep-system.schemas';
import { MepConnectorSchema } from '../mep-connector.schemas';

describe('buildDefaultDuctNetworkParams (ADR-432)', () => {
  it('builds a duct-network arm with the air classification + source', () => {
    const params = buildDefaultDuctNetworkParams(
      'Προσαγωγή 1',
      'supply-air',
      'ahu-1',
      AHU_SUPPLY_CONNECTOR_ID,
    );
    expect(params.systemType).toBe('duct-network');
    expect(params.systemClassification).toBe('supply-air');
    expect(params.sourceEntityId).toBe('ahu-1');
    expect(params.sourceConnectorId).toBe(AHU_SUPPLY_CONNECTOR_ID);
    expect(params.members).toEqual([]);
  });

  it('threads members + colour when supplied', () => {
    const members = [{ entityId: 'seg-1', connectorId: 'seg-start' }];
    const params = buildDefaultDuctNetworkParams('x', 'supply-air', 'ahu-1', 'c', members, '#38bdf8');
    expect(params.members).toEqual(members);
    expect(params.color).toBe('#38bdf8');
  });
});

describe('isDuctSystemParams (discriminated union narrowing)', () => {
  const duct = buildDefaultDuctNetworkParams('d', 'supply-air', 'ahu-1', 'c');
  const pipe = buildDefaultPipeNetworkParams('p', 'domestic-cold-water', 'm-1', 'c');
  const circuit = buildDefaultCircuitParams('e', 'pnl-1', 'c');

  it('narrows ONLY the duct arm (the other guards reject it)', () => {
    expect(isDuctSystemParams(duct)).toBe(true);
    expect(isPipeSystemParams(duct)).toBe(false);
    expect(isElectricalSystemParams(duct)).toBe(false);
  });

  it('rejects pipe + electrical params (zero regression for the existing arms)', () => {
    expect(isDuctSystemParams(pipe)).toBe(false);
    expect(isDuctSystemParams(circuit)).toBe(false);
  });
});

describe('air-terminal + AHU duct connectors (ADR-432)', () => {
  it('air terminal exposes a supply-air INLET (it receives air from the duct)', () => {
    const c = buildAirTerminalSupplyConnector({ x: 0, y: 0, z: 0 }, 160);
    expect(c.connectorId).toBe(AIR_TERMINAL_SUPPLY_CONNECTOR_ID);
    expect(c.domain).toBe('duct');
    expect(c.flow).toBe('in');
    expect(c.duct?.systemClassification).toBe('supply-air');
    expect(c.duct?.diameterMm).toBe(160);
  });

  it('AHU exposes a supply-air OUTLET (it sources the supply network)', () => {
    const c = buildAhuSupplyAirConnector({ x: 0, y: 0, z: 0 }, 250);
    expect(c.connectorId).toBe(AHU_SUPPLY_CONNECTOR_ID);
    expect(c.domain).toBe('duct');
    expect(c.flow).toBe('out');
    expect(c.duct?.systemClassification).toBe('supply-air');
  });
});

describe('zod schema round-trips (persisted shape)', () => {
  it('accepts a duct-network system (discriminated union 3rd arm)', () => {
    const params = buildDefaultDuctNetworkParams('Προσαγωγή 1', 'supply-air', 'ahu-1', 'ahu-supply', [
      { entityId: 'seg-1', connectorId: 'seg-start' },
    ]);
    const parsed = MepSystemParamsSchema.parse(params);
    expect(parsed.systemType).toBe('duct-network');
  });

  it('accepts an air-terminal duct connector', () => {
    const c = buildAirTerminalSupplyConnector({ x: 1, y: 2, z: 0 }, 160);
    expect(() => MepConnectorSchema.parse(c)).not.toThrow();
  });
});
