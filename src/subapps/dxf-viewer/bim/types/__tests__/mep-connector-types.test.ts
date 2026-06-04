/**
 * ADR-408 Φ1 — MepConnector world-position derivation tests.
 *
 * Asserts `connectorWorldPosition` mirrors the host transform convention used by
 * `transformFootprint` (mep-fixture-geometry): CCW rotation about the host
 * origin, then translate to the host position — so connectors move/rotate with
 * the host for free, in both mm and metre scenes.
 */

import {
  buildDefaultLightingConnector,
  buildManifoldInletConnector,
  buildManifoldOutletConnector,
  connectorWorldPosition,
  FIXTURE_POWER_CONNECTOR_ID,
  MANIFOLD_INLET_CONNECTOR_ID,
  MANIFOLD_OUTLET_CONNECTOR_ID_PREFIX,
  type MepConnector,
} from '../mep-connector-types';

const at = (x: number, y: number, z = 0): MepConnector => ({
  connectorId: 'c1',
  domain: 'electrical',
  flow: 'in',
  localPosition: { x, y, z },
});

describe('connectorWorldPosition', () => {
  it('identity at host origin, zero offset, zero rotation', () => {
    const w = connectorWorldPosition(at(0, 0), { x: 100, y: 200, z: 50 }, 0);
    expect(w).toEqual({ x: 100, y: 200, z: 50 });
  });

  it('translates a non-zero offset (no rotation)', () => {
    const w = connectorWorldPosition(at(10, -5), { x: 100, y: 200, z: 0 }, 0);
    expect(w.x).toBeCloseTo(110);
    expect(w.y).toBeCloseTo(195);
  });

  it('rotates 90° CCW about the host origin', () => {
    // (10, 0) rotated +90° → (0, 10), then translated to (100, 200)
    const w = connectorWorldPosition(at(10, 0), { x: 100, y: 200, z: 0 }, 90);
    expect(w.x).toBeCloseTo(100);
    expect(w.y).toBeCloseTo(210);
  });

  it('rotates 180° about the host origin', () => {
    const w = connectorWorldPosition(at(10, 5), { x: 0, y: 0, z: 0 }, 180);
    expect(w.x).toBeCloseTo(-10);
    expect(w.y).toBeCloseTo(-5);
  });

  it('adds local z to host elevation', () => {
    const w = connectorWorldPosition(at(0, 0, 30), { x: 0, y: 0, z: 2700 }, 0);
    expect(w.z).toBeCloseTo(2730);
  });

  it('metre-scene parity — offset scales with caller-supplied units (pure, unit-agnostic)', () => {
    // localPosition is already host-frame canvas units; a metre-scene caller
    // passes small numbers, derivation stays linear.
    const w = connectorWorldPosition(at(0.6, 0), { x: 1.5, y: 2.0, z: 0 }, 0);
    expect(w.x).toBeCloseTo(2.1);
    expect(w.y).toBeCloseTo(2.0);
  });
});

describe('buildDefaultLightingConnector', () => {
  it('is an electrical lighting power-in connector at the host origin', () => {
    const c = buildDefaultLightingConnector();
    expect(c.connectorId).toBe(FIXTURE_POWER_CONNECTOR_ID);
    expect(c.domain).toBe('electrical');
    expect(c.flow).toBe('in');
    expect(c.localPosition).toEqual({ x: 0, y: 0, z: 0 });
    expect(c.electrical?.systemClassification).toBe('lighting');
    expect(c.systemId).toBeUndefined();
  });
});

describe('manifold connector classification (ADR-408 Φ-heating)', () => {
  const pos = { x: -1, y: 0, z: 0 };

  it('inlet defaults to domestic-cold-water (back-compat)', () => {
    const c = buildManifoldInletConnector(pos, 25);
    expect(c.connectorId).toBe(MANIFOLD_INLET_CONNECTOR_ID);
    expect(c.domain).toBe('pipe');
    expect(c.flow).toBe('in');
    expect(c.pipe?.systemClassification).toBe('domestic-cold-water');
  });

  it('inlet carries an explicit heating classification', () => {
    const c = buildManifoldInletConnector(pos, 25, 'hydronic-supply');
    expect(c.pipe?.systemClassification).toBe('hydronic-supply');
    expect(c.pipe?.diameterMm).toBe(25);
  });

  it('outlet defaults to domestic-cold-water and indexes its id', () => {
    const c = buildManifoldOutletConnector(2, pos, 16);
    expect(c.connectorId).toBe(`${MANIFOLD_OUTLET_CONNECTOR_ID_PREFIX}2`);
    expect(c.flow).toBe('out');
    expect(c.pipe?.systemClassification).toBe('domestic-cold-water');
  });

  it('outlet carries an explicit heating classification', () => {
    const c = buildManifoldOutletConnector(0, pos, 16, 'hydronic-return');
    expect(c.pipe?.systemClassification).toBe('hydronic-return');
  });
});
