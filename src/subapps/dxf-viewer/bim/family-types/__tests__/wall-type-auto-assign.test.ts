/**
 * Tests for the wall auto-typing policy (ADR-412 / ADR-414).
 * Verifies the non-destructive match-gate: default walls → built-in id,
 * manual/customised walls → undefined (stay ad-hoc).
 */

import { resolveAutoWallTypeId } from '../wall-type-auto-assign';
import { getBuiltInWallTypeId } from '../built-in-types';
import {
  getDefaultDnaForCategory,
  createExterior25EpsDna,
  createExterior20Dna,
} from '../../types/wall-dna-types';
import type { WallCategory } from '../../types/wall-types';

const CATEGORIES: readonly WallCategory[] = [
  'exterior',
  'interior',
  'partition',
  'parapet',
  'fence',
];

/** A default (category-matching) param triple. */
function defaultParams(category: WallCategory) {
  const dna = getDefaultDnaForCategory(category);
  return { category, thickness: dna.totalThickness, dna };
}

describe('resolveAutoWallTypeId', () => {
  it.each(CATEGORIES)(
    'returns the built-in id for a default %s wall',
    (category) => {
      expect(resolveAutoWallTypeId(defaultParams(category))).toBe(
        getBuiltInWallTypeId(category),
      );
    },
  );

  it('returns undefined for a manual wall (no dna)', () => {
    expect(
      resolveAutoWallTypeId({ category: 'exterior', thickness: 300, dna: undefined }),
    ).toBeUndefined();
  });

  it('returns undefined when the thickness deviates from the default', () => {
    const dna = getDefaultDnaForCategory('interior');
    expect(
      resolveAutoWallTypeId({ category: 'interior', thickness: dna.totalThickness + 50, dna }),
    ).toBeUndefined();
  });

  it('returns undefined for a customised dna (different layer composition)', () => {
    const dna = getDefaultDnaForCategory('exterior');
    const customised = {
      ...dna,
      layers: dna.layers.map((l, i) =>
        i === 0 ? { ...l, thickness: l.thickness + 10 } : l,
      ),
    };
    expect(
      resolveAutoWallTypeId({ category: 'exterior', thickness: dna.totalThickness, dna: customised }),
    ).toBeUndefined();
  });

  // ── ADR-447 — multi-type-per-category: variant DNAs link to their own built-in ──
  it('links a «25cm με θερμοπρόσοψη» wall (EPS DNA) to the exterior-eps built-in', () => {
    const dna = createExterior25EpsDna();
    expect(
      resolveAutoWallTypeId({ category: 'exterior', thickness: dna.totalThickness, dna }),
    ).toBe(getBuiltInWallTypeId('exterior-eps'));
  });

  it('links a «20cm» exterior wall to the exterior-20 built-in', () => {
    const dna = createExterior20Dna();
    expect(
      resolveAutoWallTypeId({ category: 'exterior', thickness: dna.totalThickness, dna }),
    ).toBe(getBuiltInWallTypeId('exterior-20'));
  });

  it('returns undefined when category is missing (legacy params)', () => {
    const dna = getDefaultDnaForCategory('exterior');
    expect(
      resolveAutoWallTypeId({
        category: undefined as unknown as WallCategory,
        thickness: dna.totalThickness,
        dna,
      }),
    ).toBeUndefined();
  });
});
