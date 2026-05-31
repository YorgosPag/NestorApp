/**
 * ADR-401 — WallParamsSchema attach refinement tests (top + base).
 *
 * Καλύπτει το superRefine του `WallParamsSchema`:
 *   - topBinding='attached'  ⇔ μη-κενό attachTopToIds.
 *   - baseBinding='attached' ⇔ μη-κενό attachBaseToIds (ADR-401 γ).
 * Τα fixtures είναι ελάχιστα έγκυρα WallParams (strict schema).
 *
 * @see ../wall.schemas
 */

import { WallParamsSchema } from '../wall.schemas';

/** Ελάχιστα έγκυρα WallParams (storey-floor / storey-ceiling defaults). */
function base(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    category: 'exterior',
    start: { x: 0, y: 0, z: 0 },
    end: { x: 4000, y: 0, z: 0 },
    height: 3000,
    thickness: 250,
    flip: false,
    baseBinding: 'storey-floor',
    topBinding: 'storey-ceiling',
    baseOffset: 0,
    topOffset: 0,
    ...overrides,
  };
}

const issuePaths = (data: Record<string, unknown>): string[] => {
  const r = WallParamsSchema.safeParse(data);
  return r.success ? [] : r.error.issues.map((i) => i.path.join('.'));
};

describe('WallParamsSchema — default bindings', () => {
  it('accepts the minimal storey-floor / storey-ceiling wall', () => {
    expect(WallParamsSchema.safeParse(base()).success).toBe(true);
  });
});

describe('WallParamsSchema — top attach refinement (ADR-401)', () => {
  it('rejects topBinding="attached" without attachTopToIds', () => {
    expect(issuePaths(base({ topBinding: 'attached' }))).toContain('attachTopToIds');
  });

  it('rejects topBinding="attached" with an empty attachTopToIds', () => {
    expect(issuePaths(base({ topBinding: 'attached', attachTopToIds: [] }))).toContain('attachTopToIds');
  });

  it('accepts topBinding="attached" with ≥1 host id', () => {
    expect(WallParamsSchema.safeParse(base({ topBinding: 'attached', attachTopToIds: ['beam_1'] })).success).toBe(true);
  });

  it('rejects attachTopToIds when topBinding is not "attached"', () => {
    expect(issuePaths(base({ attachTopToIds: ['beam_1'] }))).toContain('attachTopToIds');
  });
});

describe('WallParamsSchema — base attach refinement (ADR-401 γ)', () => {
  it('rejects baseBinding="attached" without attachBaseToIds', () => {
    expect(issuePaths(base({ baseBinding: 'attached' }))).toContain('attachBaseToIds');
  });

  it('rejects baseBinding="attached" with an empty attachBaseToIds', () => {
    expect(issuePaths(base({ baseBinding: 'attached', attachBaseToIds: [] }))).toContain('attachBaseToIds');
  });

  it('accepts baseBinding="attached" with ≥1 host id', () => {
    expect(
      WallParamsSchema.safeParse(base({ baseBinding: 'attached', attachBaseToIds: ['foundation_1'] })).success,
    ).toBe(true);
  });

  it('rejects attachBaseToIds when baseBinding is not "attached"', () => {
    expect(issuePaths(base({ attachBaseToIds: ['foundation_1'] }))).toContain('attachBaseToIds');
  });

  it('accepts a wall attached BOTH top and base (independent constraints)', () => {
    const r = WallParamsSchema.safeParse(
      base({
        topBinding: 'attached',
        attachTopToIds: ['beam_1'],
        baseBinding: 'attached',
        attachBaseToIds: ['foundation_1'],
      }),
    );
    expect(r.success).toBe(true);
  });
});
