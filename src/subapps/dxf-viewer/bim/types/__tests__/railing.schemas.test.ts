/**
 * ADR-407 Φ1 — railing Zod schema unit tests.
 */

import {
  RailingParamsSchema,
  RailingEntitySchema,
  RailingTypeSchema,
} from '../railing.schemas';
import { DEFAULT_RAILING_TYPE } from '../railing-types';

const validParams = {
  type: DEFAULT_RAILING_TYPE,
  pathSource: { kind: 'sketch', path: [{ x: 0, y: 0 }, { x: 1000, y: 0 }] },
  totalHeightMm: 1000,
  baseElevationMm: 0,
};

describe('RailingTypeSchema', () => {
  it('accepts the built-in default type', () => {
    expect(RailingTypeSchema.safeParse(DEFAULT_RAILING_TYPE).success).toBe(true);
  });

  it('rejects an unknown predefinedType', () => {
    expect(RailingTypeSchema.safeParse({ ...DEFAULT_RAILING_TYPE, predefinedType: 'fence' }).success).toBe(false);
  });
});

describe('RailingParamsSchema', () => {
  it('accepts valid sketch params', () => {
    expect(RailingParamsSchema.safeParse(validParams).success).toBe(true);
  });

  it('accepts hosted path source', () => {
    const hosted = { ...validParams, pathSource: { kind: 'hosted', hostId: 'stair_1', hostType: 'stair', side: 'inner' } };
    expect(RailingParamsSchema.safeParse(hosted).success).toBe(true);
  });

  it('rejects non-positive total height', () => {
    expect(RailingParamsSchema.safeParse({ ...validParams, totalHeightMm: 0 }).success).toBe(false);
  });

  it('rejects an unknown path-source kind', () => {
    expect(RailingParamsSchema.safeParse({ ...validParams, pathSource: { kind: 'orbit', path: [] } }).success).toBe(false);
  });

  it('rejects extra fields (strict)', () => {
    expect(RailingParamsSchema.safeParse({ ...validParams, bogus: 1 }).success).toBe(false);
  });
});

describe('RailingEntitySchema', () => {
  it('accepts a well-formed entity', () => {
    const entity = {
      id: 'ral_abc',
      type: 'railing',
      kind: 'railing',
      params: validParams,
      ifcGuid: '0123456789ABCDEFabcdef',
      ifcType: 'IfcRailing',
    };
    expect(RailingEntitySchema.safeParse(entity).success).toBe(true);
  });

  it('rejects the wrong ifcType literal', () => {
    const entity = {
      id: 'ral_abc',
      type: 'railing',
      kind: 'railing',
      params: validParams,
      ifcGuid: '0123456789ABCDEFabcdef',
      ifcType: 'IfcLightFixture',
    };
    expect(RailingEntitySchema.safeParse(entity).success).toBe(false);
  });
});
