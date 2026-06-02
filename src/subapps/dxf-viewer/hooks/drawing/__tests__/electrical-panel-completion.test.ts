/**
 * ADR-408 Φ3 — electrical panel completion builders unit tests.
 */

import {
  buildDefaultElectricalPanelParams,
  buildElectricalPanelEntity,
} from '../electrical-panel-completion';

describe('buildDefaultElectricalPanelParams', () => {
  it('places the panel at the clicked point with industry defaults', () => {
    const p = buildDefaultElectricalPanelParams({ x: 500, y: 800 });
    expect(p.position).toEqual({ x: 500, y: 800, z: 0 });
    expect(p.kind).toBe('distribution-board');
    expect(p.shape).toBe('rectangular');
    expect(p.width).toBe(600);
    expect(p.length).toBe(150);
    expect(p.mountingElevationMm).toBe(1500);
  });

  it('carries a default power-OUT connector (circuit source)', () => {
    const p = buildDefaultElectricalPanelParams({ x: 0, y: 0 });
    expect(p.connectors).toHaveLength(1);
    const c = p.connectors![0];
    expect(c.flow).toBe('out');
    expect(c.domain).toBe('electrical');
    expect(c.electrical?.systemClassification).toBe('power');
  });

  it('applies overrides', () => {
    const p = buildDefaultElectricalPanelParams({ x: 0, y: 0 }, { width: 400, mountingElevationMm: 1200 });
    expect(p.width).toBe(400);
    expect(p.mountingElevationMm).toBe(1200);
  });
});

describe('buildElectricalPanelEntity', () => {
  it('builds a valid entity with computed geometry', () => {
    const params = buildDefaultElectricalPanelParams({ x: 100, y: 200 });
    const result = buildElectricalPanelEntity(params, 'layer-0');
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entity.type).toBe('electrical-panel');
      expect(result.entity.ifcType).toBe('IfcElectricDistributionBoard');
      expect(result.entity.geometry.footprint.vertices).toHaveLength(4);
    }
  });

  it('refuses creation on invalid params', () => {
    const params = buildDefaultElectricalPanelParams({ x: 0, y: 0 }, { width: 0 });
    const result = buildElectricalPanelEntity(params, 'layer-0');
    expect(result.ok).toBe(false);
  });
});
