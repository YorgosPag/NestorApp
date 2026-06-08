/**
 * ADR-408 — buildSanitaryFixtureConnectors (plumbing-fixture connect to water network).
 *
 * Verifies the per-kind connector set (drain + cold + optional hot), the fixed
 * hydraulic classifications/flow, distinct unit-safe positions, and the WC cold-only
 * rule.
 */

import { buildSanitaryFixtureConnectors } from '../sanitary-fixture-connectors';
import { SANITARY_KINDS, SANITARY_SPEC } from '../../sanitary/sanitary-symbol-spec';
import {
  SANITARY_DRAIN_CONNECTOR_ID,
  SANITARY_COLD_CONNECTOR_ID,
  SANITARY_HOT_CONNECTOR_ID,
} from '../../types/mep-connector-types';

describe('buildSanitaryFixtureConnectors', () => {
  for (const kind of SANITARY_KINDS) {
    const spec = SANITARY_SPEC[kind];
    it(`'${kind}' → drain + cold${spec.supply.hot ? ' + hot' : ''}`, () => {
      const cs = buildSanitaryFixtureConnectors(kind, 'mm');
      const ids = cs.map((c) => c.connectorId);
      expect(ids).toContain(SANITARY_DRAIN_CONNECTOR_ID);
      expect(ids).toContain(SANITARY_COLD_CONNECTOR_ID);
      expect(ids.includes(SANITARY_HOT_CONNECTOR_ID)).toBe(spec.supply.hot);
      expect(cs).toHaveLength(2 + (spec.supply.hot ? 1 : 0));

      const cold = cs.find((c) => c.connectorId === SANITARY_COLD_CONNECTOR_ID)!;
      expect(cold.domain).toBe('pipe');
      expect(cold.flow).toBe('in');
      expect(cold.pipe?.systemClassification).toBe('domestic-cold-water');
      expect(cold.pipe?.diameterMm).toBe(spec.supply.diameterMm);
    });
  }

  it('drain stays at the origin; supply stubs are offset to distinct positions', () => {
    const cs = buildSanitaryFixtureConnectors('washbasin', 'mm');
    const drain = cs.find((c) => c.connectorId === SANITARY_DRAIN_CONNECTOR_ID)!;
    const cold = cs.find((c) => c.connectorId === SANITARY_COLD_CONNECTOR_ID)!;
    const hot = cs.find((c) => c.connectorId === SANITARY_HOT_CONNECTOR_ID)!;
    expect(drain.localPosition).toEqual({ x: 0, y: 0, z: 0 });
    expect(cold.localPosition.y).toBeGreaterThan(0); // back edge
    expect(hot.localPosition.y).toBeGreaterThan(0);
    expect(cold.localPosition.x).toBeLessThan(0); // cold left, hot right
    expect(hot.localPosition.x).toBeGreaterThan(0);
    const keys = cs.map((c) => `${c.localPosition.x},${c.localPosition.y},${c.localPosition.z}`);
    expect(new Set(keys).size).toBe(cs.length); // none coincide
  });

  it('positions are unit-safe: a meters scene scales offsets by 0.001, diameters stay mm', () => {
    const mm = buildSanitaryFixtureConnectors('washbasin', 'mm');
    const m = buildSanitaryFixtureConnectors('washbasin', 'm');
    const coldMm = mm.find((c) => c.connectorId === SANITARY_COLD_CONNECTOR_ID)!;
    const coldM = m.find((c) => c.connectorId === SANITARY_COLD_CONNECTOR_ID)!;
    expect(coldM.localPosition.y).toBeCloseTo(coldMm.localPosition.y * 0.001, 9);
    expect(coldM.pipe?.diameterMm).toBe(coldMm.pipe?.diameterMm);
  });

  it('WC is cold-only (no hot connector), single back-centre stub', () => {
    const cs = buildSanitaryFixtureConnectors('wc', 'mm');
    expect(cs.map((c) => c.connectorId)).not.toContain(SANITARY_HOT_CONNECTOR_ID);
    const cold = cs.find((c) => c.connectorId === SANITARY_COLD_CONNECTOR_ID)!;
    expect(cold.localPosition.x).toBe(0);
  });
});
