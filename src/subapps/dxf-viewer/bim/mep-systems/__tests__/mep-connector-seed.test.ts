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
  SEGMENT_START_CONNECTOR_ID,
  SEGMENT_END_CONNECTOR_ID,
} from '../../types/mep-connector-types';

const legacyFixture = (id = 'fx1'): Entity =>
  ({ type: 'mep-fixture', id, params: {} } as unknown as Entity);

const legacyPanel = (id = 'pnl1'): Entity =>
  ({ type: 'electrical-panel', id, params: {} } as unknown as Entity);

const legacySegment = (domain: 'duct' | 'pipe' = 'pipe', id = 'seg1'): Entity =>
  ({ type: 'mep-segment', id, params: { domain } } as unknown as Entity);

const legacySanitary = (kind = 'washbasin', id = 'wb1'): Entity =>
  ({ type: 'mep-fixture', id, params: { kind, sceneUnits: 'mm' } } as unknown as Entity);

const classesOf = (seeded: Entity): Array<string | undefined> =>
  (seeded as unknown as { params: { connectors: Array<{ pipe?: { systemClassification: string } }> } })
    .params.connectors.map((c) => c.pipe?.systemClassification);

describe('seedDefaultConnectors', () => {
  it('seeds a legacy fixture with the default lighting power-in connector', () => {
    const seeded = seedDefaultConnectors(legacyFixture());
    const connectors = (seeded as unknown as { params: { connectors: Array<{ connectorId: string; flow: string; domain: string }> } }).params.connectors;
    expect(connectors).toHaveLength(1);
    expect(connectors[0].connectorId).toBe(FIXTURE_POWER_CONNECTOR_ID);
    expect(connectors[0].flow).toBe('in');
    expect(connectors[0].domain).toBe('electrical');
  });

  it('self-heals a legacy sanitary fixture with drain + cold + hot connectors', () => {
    const classes = classesOf(seedDefaultConnectors(legacySanitary('washbasin')));
    expect(classes).toContain('sanitary-drainage');
    expect(classes).toContain('domestic-cold-water');
    expect(classes).toContain('domestic-hot-water'); // a washbasin mixes hot water
  });

  it('self-heals a legacy WC cold-only (no hot connector)', () => {
    const classes = classesOf(seedDefaultConnectors(legacySanitary('wc', 'wc1')));
    expect(classes).toContain('domestic-cold-water');
    expect(classes).not.toContain('domestic-hot-water');
  });

  it('seeds a legacy electrical panel with the default power-out connector', () => {
    const seeded = seedDefaultConnectors(legacyPanel());
    const connectors = (seeded as unknown as { params: { connectors: Array<{ connectorId: string; flow: string }> } }).params.connectors;
    expect(connectors).toHaveLength(1);
    expect(connectors[0].connectorId).toBe(PANEL_OUT_CONNECTOR_ID);
    expect(connectors[0].flow).toBe('out');
  });

  it('seeds a legacy pipe segment with start + end endpoint connectors', () => {
    const seeded = seedDefaultConnectors(legacySegment('pipe'));
    const connectors = (seeded as unknown as { params: { connectors: Array<{ connectorId: string; flow: string; domain: string }> } }).params.connectors;
    expect(connectors).toHaveLength(2);
    expect(connectors.map((c) => c.connectorId)).toEqual([
      SEGMENT_START_CONNECTOR_ID,
      SEGMENT_END_CONNECTOR_ID,
    ]);
    // A segment is a conduit (not a source/load) → bidirectional, domain mirrors segment.
    expect(connectors.every((c) => c.flow === 'bidirectional')).toBe(true);
    expect(connectors.every((c) => c.domain === 'pipe')).toBe(true);
  });

  it('seeds a duct segment with connector domain "duct"', () => {
    const seeded = seedDefaultConnectors(legacySegment('duct'));
    const connectors = (seeded as unknown as { params: { connectors: Array<{ domain: string }> } }).params.connectors;
    expect(connectors.every((c) => c.domain === 'duct')).toBe(true);
  });

  it('is idempotent for a segment that already carries connectors', () => {
    const segment = {
      type: 'mep-segment',
      id: 'seg1',
      params: { domain: 'pipe', connectors: [{ connectorId: SEGMENT_START_CONNECTOR_ID, domain: 'pipe', flow: 'bidirectional', localPosition: { x: 0, y: 0 } }] },
    } as unknown as Entity;
    expect(seedDefaultConnectors(segment)).toBe(segment);
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
