/**
 * Tests — foundation.schemas.ts (ADR-436, Slice 0).
 *
 * Coverage:
 *   - FoundationParamsSchema accept/reject ανά kind (discriminated union)
 *   - superRefine: pad profile='stepped'/'sloped' απαιτεί το αντίστοιχο block
 *   - strict() απορρίπτει άγνωστα πεδία
 *   - FoundationEntitySchema accept/reject
 */

import {
  FoundationParamsSchema,
  FoundationEntitySchema,
} from '../foundation.schemas';
import { buildDefaultFoundationParams } from '../foundation-types';

// ─── Params: accept defaults ─────────────────────────────────────────────────

describe('FoundationParamsSchema — accept', () => {
  it('accepts default pad params', () => {
    expect(() => FoundationParamsSchema.parse(buildDefaultFoundationParams('pad'))).not.toThrow();
  });

  it('accepts default strip params', () => {
    expect(() => FoundationParamsSchema.parse(buildDefaultFoundationParams('strip'))).not.toThrow();
  });

  it('accepts default tie-beam params', () => {
    expect(() => FoundationParamsSchema.parse(buildDefaultFoundationParams('tie-beam'))).not.toThrow();
  });

  it('accepts stepped pad με stepped block', () => {
    const p = {
      ...buildDefaultFoundationParams('pad'),
      profile: 'stepped',
      stepped: { topWidth: 800, topLength: 800, stepThicknessMm: 300 },
    };
    expect(() => FoundationParamsSchema.parse(p)).not.toThrow();
  });

  it('accepts sloped pad με sloped block', () => {
    const p = {
      ...buildDefaultFoundationParams('pad'),
      profile: 'sloped',
      sloped: { topWidth: 600, topLength: 600 },
    };
    expect(() => FoundationParamsSchema.parse(p)).not.toThrow();
  });
});

// ─── Params: discriminated-union narrowing ───────────────────────────────────

describe('FoundationParamsSchema — discriminated union', () => {
  it('narrows pad correctly (keeps position)', () => {
    const parsed = FoundationParamsSchema.parse(buildDefaultFoundationParams('pad'));
    if (parsed.kind !== 'pad') throw new Error('narrowing');
    expect(parsed.position).toBeDefined();
  });

  it('rejects unknown kind', () => {
    const invalid = { ...buildDefaultFoundationParams('pad'), kind: 'mat' };
    expect(() => FoundationParamsSchema.parse(invalid)).toThrow();
  });

  it('rejects strip params χωρίς end (wrong shape για το kind)', () => {
    const base = buildDefaultFoundationParams('strip') as Record<string, unknown>;
    const { end: _omit, ...invalid } = base;
    void _omit;
    expect(() => FoundationParamsSchema.parse(invalid)).toThrow();
  });
});

// ─── Params: superRefine (pad profile ⇒ block) ───────────────────────────────

describe('FoundationParamsSchema — superRefine', () => {
  it("rejects profile='stepped' χωρίς stepped block", () => {
    const invalid = { ...buildDefaultFoundationParams('pad'), profile: 'stepped' };
    expect(() => FoundationParamsSchema.parse(invalid)).toThrow(/stepped/);
  });

  it("rejects profile='sloped' χωρίς sloped block", () => {
    const invalid = { ...buildDefaultFoundationParams('pad'), profile: 'sloped' };
    expect(() => FoundationParamsSchema.parse(invalid)).toThrow(/sloped/);
  });

  it("accepts profile='flat' χωρίς extra blocks", () => {
    expect(() => FoundationParamsSchema.parse({ ...buildDefaultFoundationParams('pad'), profile: 'flat' })).not.toThrow();
  });
});

// ─── Params: validation rules ────────────────────────────────────────────────

describe('FoundationParamsSchema — validation', () => {
  it('rejects non-positive thickness', () => {
    const invalid = { ...buildDefaultFoundationParams('pad'), thicknessMm: 0 };
    expect(() => FoundationParamsSchema.parse(invalid)).toThrow();
  });

  it('rejects negative width (pad)', () => {
    const invalid = { ...buildDefaultFoundationParams('pad'), width: -100 };
    expect(() => FoundationParamsSchema.parse(invalid)).toThrow();
  });

  it('rejects non-finite topElevationMm', () => {
    const invalid = { ...buildDefaultFoundationParams('strip'), topElevationMm: Number.POSITIVE_INFINITY };
    expect(() => FoundationParamsSchema.parse(invalid)).toThrow();
  });

  it('rejects unknown extra field (strict)', () => {
    const invalid = { ...buildDefaultFoundationParams('pad'), bogus: 1 };
    expect(() => FoundationParamsSchema.parse(invalid)).toThrow();
  });

  it('accepts below-grade (αρνητικό) topElevationMm', () => {
    const p = { ...buildDefaultFoundationParams('pad'), topElevationMm: -2500 };
    expect(() => FoundationParamsSchema.parse(p)).not.toThrow();
  });
});

// ─── Entity schema ────────────────────────────────────────────────────────────

describe('FoundationEntitySchema', () => {
  const validEntity = {
    id: 'fnd_test_1',
    type: 'foundation' as const,
    kind: 'pad' as const,
    params: buildDefaultFoundationParams('pad'),
    predefinedType: 'PAD_FOOTING' as const,
    ifcGuid: '0123456789ABCDEFGHIJKL',
    ifcType: 'IfcFooting' as const,
  };

  it('accepts valid entity', () => {
    expect(() => FoundationEntitySchema.parse(validEntity)).not.toThrow();
  });

  it("rejects type ≠ 'foundation'", () => {
    expect(() => FoundationEntitySchema.parse({ ...validEntity, type: 'slab' })).toThrow();
  });

  it("rejects ifcType ≠ 'IfcFooting'", () => {
    expect(() => FoundationEntitySchema.parse({ ...validEntity, ifcType: 'IfcSlab' })).toThrow();
  });

  it('rejects invalid predefinedType', () => {
    expect(() => FoundationEntitySchema.parse({ ...validEntity, predefinedType: 'BASESLAB' })).toThrow();
  });

  it('rejects invalid ifcGuid length', () => {
    expect(() => FoundationEntitySchema.parse({ ...validEntity, ifcGuid: 'SHORT' })).toThrow();
  });
});
