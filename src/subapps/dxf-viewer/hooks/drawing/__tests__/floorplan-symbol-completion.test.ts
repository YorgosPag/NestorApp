/**
 * ADR-415 Φ1 — Floorplan symbol completion (builders) unit tests.
 */

import {
  buildDefaultFloorplanSymbolParams,
  buildFloorplanSymbolEntity,
} from '../floorplan-symbol-completion';

describe('buildDefaultFloorplanSymbolParams', () => {
  it('resolves category + kind + footprint from the catalog default (WC)', () => {
    const p = buildDefaultFloorplanSymbolParams({ x: 100, y: 200 });
    expect(p.category).toBe('sanitary');
    expect(p.kind).toBe('wc');
    expect(p.assetId).toBe('wc_standard_01');
    expect(p.widthMm).toBeGreaterThan(0);
    expect(p.depthMm).toBeGreaterThan(0);
    expect(p.position).toEqual({ x: 100, y: 200, z: 0 });
  });

  it('applies overrides on top of catalog defaults', () => {
    const p = buildDefaultFloorplanSymbolParams({ x: 0, y: 0 }, { rotationDeg: 90, widthMm: 420 });
    expect(p.rotationDeg).toBe(90);
    expect(p.widthMm).toBe(420);
  });
});

describe('buildFloorplanSymbolEntity', () => {
  it('builds a valid floorplan-symbol entity (IfcSanitaryTerminal)', () => {
    const params = buildDefaultFloorplanSymbolParams({ x: 0, y: 0 });
    const result = buildFloorplanSymbolEntity(params, 'lyr_test');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entity.type).toBe('floorplan-symbol');
      expect(result.entity.kind).toBe('wc');
      expect(result.entity.ifcType).toBe('IfcSanitaryTerminal');
      expect(result.entity.geometry.footprint.vertices).toHaveLength(4);
    }
  });

  it('refuses creation on a hard validation error (zero width)', () => {
    const params = buildDefaultFloorplanSymbolParams({ x: 0, y: 0 }, { widthMm: 0 });
    const result = buildFloorplanSymbolEntity(params, 'lyr_test');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.hardErrors.length).toBeGreaterThan(0);
    }
  });
});
