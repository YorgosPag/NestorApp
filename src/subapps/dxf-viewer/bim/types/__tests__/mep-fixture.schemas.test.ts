/**
 * ADR-406 — MEP fixture Zod schema unit tests.
 */

import {
  MepFixtureParamsSchema,
  MepFixtureEntitySchema,
} from '../mep-fixture.schemas';

const validParams = {
  kind: 'light-fixture',
  shape: 'rectangular',
  position: { x: 0, y: 0 },
  rotation: 0,
  width: 600,
  length: 600,
  bodyHeightMm: 80,
  mountingElevationMm: 2700,
};

describe('MepFixtureParamsSchema', () => {
  it('accepts valid params', () => {
    expect(MepFixtureParamsSchema.safeParse(validParams).success).toBe(true);
  });

  it('rejects non-positive width', () => {
    expect(MepFixtureParamsSchema.safeParse({ ...validParams, width: 0 }).success).toBe(false);
  });

  it('rejects unknown shape', () => {
    expect(MepFixtureParamsSchema.safeParse({ ...validParams, shape: 'hexagon' }).success).toBe(false);
  });

  it('rejects extra fields (strict)', () => {
    expect(MepFixtureParamsSchema.safeParse({ ...validParams, bogus: 1 }).success).toBe(false);
  });
});

describe('MepFixtureEntitySchema', () => {
  it('accepts a well-formed entity', () => {
    const entity = {
      id: 'mepfix_abc',
      type: 'mep-fixture',
      kind: 'light-fixture',
      params: validParams,
      ifcGuid: '0123456789ABCDEFabcdef',
      ifcType: 'IfcLightFixture',
    };
    expect(MepFixtureEntitySchema.safeParse(entity).success).toBe(true);
  });

  it('rejects the wrong ifcType literal', () => {
    const entity = {
      id: 'mepfix_abc',
      type: 'mep-fixture',
      kind: 'light-fixture',
      params: validParams,
      ifcGuid: '0123456789ABCDEFabcdef',
      ifcType: 'IfcColumn',
    };
    expect(MepFixtureEntitySchema.safeParse(entity).success).toBe(false);
  });

  // ADR-408 Φ14 — a floor drain validates with kind 'floor-drain' + the
  // IfcSanitaryTerminal class. Without the schema enum widening this round-trip
  // would be silently rejected at persistence (the #5 φρεάτιο lesson).
  it('accepts a floor-drain entity (IfcSanitaryTerminal)', () => {
    const entity = {
      id: 'mepfix_drain',
      type: 'mep-fixture',
      kind: 'floor-drain',
      params: { ...validParams, kind: 'floor-drain', width: 150, length: 150, bodyHeightMm: 100, mountingElevationMm: 0 },
      ifcGuid: '0123456789ABCDEFabcdef',
      ifcType: 'IfcSanitaryTerminal',
    };
    expect(MepFixtureEntitySchema.safeParse(entity).success).toBe(true);
  });
});
