/**
 * ADR-412 Φ1 — BimFamilyTypeSchema / WallTypeParamsSchema / StairTypeParamsSchema
 * Zod schema unit tests.
 *
 * Covers:
 *   - A well-formed wall family type passes BimFamilyTypeSchema.
 *   - A well-formed stair family type passes BimFamilyTypeSchema.
 *   - Missing required base fields (id, name, companyId, ownerId) fail.
 *   - Wrong category discriminator value fails.
 *   - WallTypeParamsSchema is strict: instance-only fields (start/end/height) are
 *     rejected as unrecognised keys.
 *   - StairTypeParamsSchema is strict: instance-only fields (basePoint/direction)
 *     are rejected as unrecognised keys.
 *   - Mismatched category + typeParams (wall category with stair params) fails.
 *   - Scope and origin enum constraints validated.
 *   - WallTypeParamsSchema standalone: required field validation.
 *   - StairTypeParamsSchema standalone: required enum validation.
 *
 * @see ../bim-family-type.schemas
 * @see docs/centralized-systems/reference/adrs/ADR-412-bim-family-types.md
 */

import {
  BimFamilyTypeSchema,
  BimFamilyTypeScopeSchema,
  BimFamilyTypeOriginSchema,
  WallTypeParamsSchema,
  StairTypeParamsSchema,
} from '../bim-family-type.schemas';

// ─── Fixtures ────────────────────────────────────────────────────────────────

/** Minimal valid WallTypeParams. */
function wallTypeParams(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    category: 'exterior',
    thickness: 250,
    ...overrides,
  };
}

/**
 * Minimal valid StairTypeParams. All required scalar fields included.
 * Composite objects (variant, handrails) are opaque pass-through.
 */
function stairTypeParams(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    rise: 175,
    tread: 280,
    nosing: 20,
    nosingSide: 'front',
    width: 1000,
    stepCount: 16,
    totalRise: 2800,
    totalRun: 4480,
    pitch: 32,
    structureType: 'monolithic',
    riserType: 'closed',
    antiskidNosing: false,
    adaContrastStrip: false,
    variant: { kind: 'straight' },
    walklineOffset: 300,
    handrails: { inner: false, outer: true, height: 900 },
    upDirection: 'forward',
    treadNumberStart: 1,
    treadLabelDisplay: 'all',
    treadLabelRestartPerFlight: false,
    codeProfile: 'nok',
    ...overrides,
  };
}

/** Minimal valid base shape (shared tenant/meta fields). */
function baseShape(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'bimft_test00000000000001',
    name: 'Standard Exterior Wall',
    scope: 'company',
    origin: 'built-in',
    companyId: 'c1',
    ownerId: 'u1',
    ...overrides,
  };
}

/** Assembles a full wall family type doc. */
function wallDoc(
  baseOverrides: Record<string, unknown> = {},
  paramsOverrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...baseShape(baseOverrides),
    category: 'wall',
    typeParams: wallTypeParams(paramsOverrides),
  };
}

/** Assembles a full stair family type doc. */
function stairDoc(
  baseOverrides: Record<string, unknown> = {},
  paramsOverrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    ...baseShape(baseOverrides),
    category: 'stair',
    typeParams: stairTypeParams(paramsOverrides),
  };
}

// ─── BimFamilyTypeScopeSchema ─────────────────────────────────────────────────

describe('BimFamilyTypeScopeSchema', () => {
  it.each(['user', 'company', 'project'])('accepts %s', (scope) => {
    expect(BimFamilyTypeScopeSchema.safeParse(scope).success).toBe(true);
  });

  it('rejects an unknown scope', () => {
    expect(BimFamilyTypeScopeSchema.safeParse('global').success).toBe(false);
  });
});

// ─── BimFamilyTypeOriginSchema ────────────────────────────────────────────────

describe('BimFamilyTypeOriginSchema', () => {
  it.each(['built-in', 'user'])('accepts %s', (origin) => {
    expect(BimFamilyTypeOriginSchema.safeParse(origin).success).toBe(true);
  });

  it('rejects an unknown origin', () => {
    expect(BimFamilyTypeOriginSchema.safeParse('system').success).toBe(false);
  });
});

// ─── WallTypeParamsSchema — standalone ───────────────────────────────────────

describe('WallTypeParamsSchema', () => {
  it('accepts minimal valid wall type params', () => {
    expect(WallTypeParamsSchema.safeParse(wallTypeParams()).success).toBe(true);
  });

  it('accepts all optional fields', () => {
    const params = wallTypeParams({
      material: 'concrete',
      dna: { layers: [] },
    });
    expect(WallTypeParamsSchema.safeParse(params).success).toBe(true);
  });

  it('rejects missing category', () => {
    const { category: _removed, ...rest } = wallTypeParams() as { category: string; [k: string]: unknown };
    expect(WallTypeParamsSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects invalid category enum value', () => {
    expect(WallTypeParamsSchema.safeParse(wallTypeParams({ category: 'retaining' })).success).toBe(false);
  });

  it('rejects non-positive thickness', () => {
    expect(WallTypeParamsSchema.safeParse(wallTypeParams({ thickness: 0 })).success).toBe(false);
    expect(WallTypeParamsSchema.safeParse(wallTypeParams({ thickness: -10 })).success).toBe(false);
  });

  it('rejects missing thickness', () => {
    const { thickness: _removed, ...rest } = wallTypeParams() as { thickness: number; [k: string]: unknown };
    expect(WallTypeParamsSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects instance-only field "start" (strict schema)', () => {
    expect(
      WallTypeParamsSchema.safeParse(wallTypeParams({ start: { x: 0, y: 0, z: 0 } })).success,
    ).toBe(false);
  });

  it('rejects instance-only field "end" (strict schema)', () => {
    expect(
      WallTypeParamsSchema.safeParse(wallTypeParams({ end: { x: 4000, y: 0, z: 0 } })).success,
    ).toBe(false);
  });

  it('rejects instance-only field "height" (strict schema)', () => {
    expect(
      WallTypeParamsSchema.safeParse(wallTypeParams({ height: 3000 })).success,
    ).toBe(false);
  });

  it('rejects empty string material', () => {
    expect(WallTypeParamsSchema.safeParse(wallTypeParams({ material: '' })).success).toBe(false);
  });
});

// ─── StairTypeParamsSchema — standalone ──────────────────────────────────────

describe('StairTypeParamsSchema', () => {
  it('accepts minimal valid stair type params', () => {
    expect(StairTypeParamsSchema.safeParse(stairTypeParams()).success).toBe(true);
  });

  it('rejects missing required field "rise"', () => {
    const params = stairTypeParams();
    delete (params as Record<string, unknown>)['rise'];
    expect(StairTypeParamsSchema.safeParse(params).success).toBe(false);
  });

  it('rejects invalid structureType enum value', () => {
    expect(
      StairTypeParamsSchema.safeParse(stairTypeParams({ structureType: 'wooden-beam' })).success,
    ).toBe(false);
  });

  it('rejects invalid nosingSide enum value', () => {
    expect(
      StairTypeParamsSchema.safeParse(stairTypeParams({ nosingSide: 'back' })).success,
    ).toBe(false);
  });

  it('rejects invalid riserType enum value', () => {
    expect(
      StairTypeParamsSchema.safeParse(stairTypeParams({ riserType: 'half-open' })).success,
    ).toBe(false);
  });

  it('rejects invalid upDirection enum value', () => {
    expect(
      StairTypeParamsSchema.safeParse(stairTypeParams({ upDirection: 'left' })).success,
    ).toBe(false);
  });

  it('rejects invalid codeProfile enum value', () => {
    expect(
      StairTypeParamsSchema.safeParse(stairTypeParams({ codeProfile: 'osha' })).success,
    ).toBe(false);
  });

  it('rejects instance-only field "basePoint" (strict schema)', () => {
    expect(
      StairTypeParamsSchema.safeParse(stairTypeParams({ basePoint: { x: 0, y: 0 } })).success,
    ).toBe(false);
  });

  it('rejects instance-only field "direction" (strict schema)', () => {
    expect(
      StairTypeParamsSchema.safeParse(stairTypeParams({ direction: 0 })).success,
    ).toBe(false);
  });

  it('allows opaque composite fields (variant, handrails) as z.unknown()', () => {
    const params = stairTypeParams({
      variant: { kind: 'l-shaped', turn: 'left', landing: true },
      handrails: { inner: true, outer: true, height: 1000, customParam: 'x' },
    });
    expect(StairTypeParamsSchema.safeParse(params).success).toBe(true);
  });

  it('accepts optional fields (storeyId, offsetFromStorey)', () => {
    const params = stairTypeParams({ storeyId: 'storey_1', offsetFromStorey: 0 });
    expect(StairTypeParamsSchema.safeParse(params).success).toBe(true);
  });
});

// ─── BimFamilyTypeSchema — wall variant ──────────────────────────────────────

describe('BimFamilyTypeSchema — wall variant', () => {
  it('accepts a well-formed wall family type document', () => {
    expect(BimFamilyTypeSchema.safeParse(wallDoc()).success).toBe(true);
  });

  it('accepts optional fields (projectId, createdBy, updatedBy)', () => {
    const doc = wallDoc({
      scope: 'project',
      projectId: 'p1',
      createdBy: 'u1',
      updatedBy: 'u1',
    });
    expect(BimFamilyTypeSchema.safeParse(doc).success).toBe(true);
  });

  it('rejects missing required base field "id"', () => {
    const doc = wallDoc();
    delete (doc as Record<string, unknown>)['id'];
    expect(BimFamilyTypeSchema.safeParse(doc).success).toBe(false);
  });

  it('rejects empty string "name"', () => {
    expect(BimFamilyTypeSchema.safeParse(wallDoc({ name: '' })).success).toBe(false);
  });

  it('rejects missing "companyId"', () => {
    const doc = wallDoc();
    delete (doc as Record<string, unknown>)['companyId'];
    expect(BimFamilyTypeSchema.safeParse(doc).success).toBe(false);
  });

  it('rejects missing "ownerId"', () => {
    const doc = wallDoc();
    delete (doc as Record<string, unknown>)['ownerId'];
    expect(BimFamilyTypeSchema.safeParse(doc).success).toBe(false);
  });

  it('rejects invalid scope value', () => {
    expect(BimFamilyTypeSchema.safeParse(wallDoc({ scope: 'global' })).success).toBe(false);
  });

  it('rejects invalid origin value', () => {
    expect(BimFamilyTypeSchema.safeParse(wallDoc({ origin: 'catalog' })).success).toBe(false);
  });

  it('rejects extra top-level keys (strict schema)', () => {
    const doc = { ...wallDoc(), unknownField: 'oops' };
    expect(BimFamilyTypeSchema.safeParse(doc).success).toBe(false);
  });
});

// ─── BimFamilyTypeSchema — stair variant ─────────────────────────────────────

describe('BimFamilyTypeSchema — stair variant', () => {
  it('accepts a well-formed stair family type document', () => {
    expect(BimFamilyTypeSchema.safeParse(stairDoc()).success).toBe(true);
  });

  it('accepts user-scoped stair type', () => {
    const doc = stairDoc({ scope: 'user', origin: 'user' });
    expect(BimFamilyTypeSchema.safeParse(doc).success).toBe(true);
  });

  it('rejects missing required typeParams field "rise"', () => {
    const params = stairTypeParams();
    delete (params as Record<string, unknown>)['rise'];
    const doc = { ...stairDoc(), typeParams: params };
    expect(BimFamilyTypeSchema.safeParse(doc).success).toBe(false);
  });

  it('rejects instance-only field "basePoint" inside typeParams (strict stair schema)', () => {
    const doc = stairDoc({}, { basePoint: { x: 0, y: 0 } });
    expect(BimFamilyTypeSchema.safeParse(doc).success).toBe(false);
  });

  it('rejects instance-only field "direction" inside typeParams (strict stair schema)', () => {
    const doc = stairDoc({}, { direction: 90 });
    expect(BimFamilyTypeSchema.safeParse(doc).success).toBe(false);
  });
});

// ─── BimFamilyTypeSchema — discriminator guard ───────────────────────────────

describe('BimFamilyTypeSchema — discriminator', () => {
  it('rejects an unknown category discriminator', () => {
    const doc = {
      ...baseShape(),
      category: 'column',
      typeParams: wallTypeParams(),
    };
    expect(BimFamilyTypeSchema.safeParse(doc).success).toBe(false);
  });

  it('rejects wall category with stair typeParams (wrong discriminator branch)', () => {
    const doc = {
      ...baseShape(),
      category: 'wall',
      typeParams: stairTypeParams(),
    };
    // stairTypeParams has no `thickness` and has keys WallTypeParamsSchema rejects
    expect(BimFamilyTypeSchema.safeParse(doc).success).toBe(false);
  });

  it('rejects stair category with wall typeParams (wrong discriminator branch)', () => {
    const doc = {
      ...baseShape(),
      category: 'stair',
      typeParams: wallTypeParams(),
    };
    // wallTypeParams missing the many required stair fields
    expect(BimFamilyTypeSchema.safeParse(doc).success).toBe(false);
  });
});
