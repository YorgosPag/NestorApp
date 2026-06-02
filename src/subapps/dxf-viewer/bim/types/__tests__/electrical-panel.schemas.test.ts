/**
 * ADR-408 Φ3 — electrical panel Zod schema unit tests.
 */

import {
  ElectricalPanelParamsSchema,
  ElectricalPanelEntitySchema,
} from '../electrical-panel.schemas';

const validParams = {
  kind: 'distribution-board' as const,
  shape: 'rectangular' as const,
  position: { x: 1, y: 2, z: 0 },
  rotation: 0,
  width: 600,
  length: 150,
  bodyHeightMm: 700,
  mountingElevationMm: 1500,
  sceneUnits: 'mm',
  connectors: [
    {
      connectorId: 'c1',
      domain: 'electrical' as const,
      flow: 'out' as const,
      localPosition: { x: 0, y: 0, z: 0 },
      electrical: { systemClassification: 'power' as const },
    },
  ],
};

describe('ElectricalPanelParamsSchema', () => {
  it('accepts valid params with an embedded connector', () => {
    expect(ElectricalPanelParamsSchema.safeParse(validParams).success).toBe(true);
  });

  it('rejects non-positive width', () => {
    expect(ElectricalPanelParamsSchema.safeParse({ ...validParams, width: 0 }).success).toBe(false);
  });

  it('rejects an unknown shape', () => {
    expect(ElectricalPanelParamsSchema.safeParse({ ...validParams, shape: 'circular' }).success).toBe(false);
  });
});

describe('ElectricalPanelEntitySchema', () => {
  it('accepts a well-formed entity', () => {
    const entity = {
      id: 'elecpnl_abc',
      type: 'electrical-panel' as const,
      kind: 'distribution-board' as const,
      params: validParams,
      ifcGuid: '0123456789abcdefABCDEF',
      ifcType: 'IfcElectricDistributionBoard' as const,
    };
    expect(ElectricalPanelEntitySchema.safeParse(entity).success).toBe(true);
  });

  it('rejects a wrong ifcType', () => {
    const entity = {
      id: 'elecpnl_abc',
      type: 'electrical-panel' as const,
      kind: 'distribution-board' as const,
      params: validParams,
      ifcGuid: '0123456789abcdefABCDEF',
      ifcType: 'IfcLightFixture',
    };
    expect(ElectricalPanelEntitySchema.safeParse(entity).success).toBe(false);
  });
});
