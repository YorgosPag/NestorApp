/**
 * ADR-408 Φ5 — legacy connector seeding tests.
 *
 * Asserts `seedDefaultConnectors` materialises the host type's default connector
 * onto a legacy host with none (fixture → `c1` power-in lighting, panel → `c1`
 * power-out), and is idempotent / referentially stable for hosts that already
 * carry connectors and for non-host entities.
 */

import type { Entity } from '../../../types/entities';
import { seedDefaultConnectors } from '../mep-connector-seed';
import {
  FIXTURE_POWER_CONNECTOR_ID,
  PANEL_OUT_CONNECTOR_ID,
} from '../../types/mep-connector-types';

const legacyFixture = (id = 'fx1'): Entity =>
  ({ type: 'mep-fixture', id, params: {} } as unknown as Entity);

const legacyPanel = (id = 'pnl1'): Entity =>
  ({ type: 'electrical-panel', id, params: {} } as unknown as Entity);

describe('seedDefaultConnectors', () => {
  it('seeds a legacy fixture with the default lighting power-in connector', () => {
    const seeded = seedDefaultConnectors(legacyFixture());
    const connectors = (seeded as { params: { connectors: Array<{ connectorId: string; flow: string; domain: string }> } }).params.connectors;
    expect(connectors).toHaveLength(1);
    expect(connectors[0].connectorId).toBe(FIXTURE_POWER_CONNECTOR_ID);
    expect(connectors[0].flow).toBe('in');
    expect(connectors[0].domain).toBe('electrical');
  });

  it('seeds a legacy electrical panel with the default power-out connector', () => {
    const seeded = seedDefaultConnectors(legacyPanel());
    const connectors = (seeded as { params: { connectors: Array<{ connectorId: string; flow: string }> } }).params.connectors;
    expect(connectors).toHaveLength(1);
    expect(connectors[0].connectorId).toBe(PANEL_OUT_CONNECTOR_ID);
    expect(connectors[0].flow).toBe('out');
  });

  it('is idempotent — same reference when the host already has a connector', () => {
    const fixture = {
      type: 'mep-fixture',
      id: 'fx1',
      params: { connectors: [{ connectorId: 'c1', domain: 'electrical', flow: 'in', localPosition: { x: 0, y: 0 } }] },
    } as unknown as Entity;
    expect(seedDefaultConnectors(fixture)).toBe(fixture);
  });

  it('returns the same reference for a non-host entity', () => {
    const wall = { type: 'wall', id: 'w1', params: {} } as unknown as Entity;
    expect(seedDefaultConnectors(wall)).toBe(wall);
  });

  it('does not mutate the input entity (pure)', () => {
    const fixture = legacyFixture();
    seedDefaultConnectors(fixture);
    expect((fixture as { params: { connectors?: unknown } }).params.connectors).toBeUndefined();
  });
});
