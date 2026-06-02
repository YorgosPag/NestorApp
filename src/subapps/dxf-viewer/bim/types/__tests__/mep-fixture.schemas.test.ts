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
});
