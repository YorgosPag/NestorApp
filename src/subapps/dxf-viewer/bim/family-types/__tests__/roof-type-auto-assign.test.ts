/**
 * Tests for the roof auto-typing policy (ADR-417 §10 #3). Mirror of
 * `slab-type-auto-assign.test.ts`. Verifies the non-destructive match-gate:
 * built-up-matching roofs → built-in id, bare/customised roofs → undefined.
 */

import { resolveAutoRoofTypeId } from '../roof-type-auto-assign';
import { getBuiltInRoofTypeId } from '../built-in-types';
import { getRoofBuildupForKey, ROOF_BUILDUP_KEYS } from '../../types/roof-buildup';

/** A default (build-up-matching) param pair for a build-up key. */
function defaultParams(key: (typeof ROOF_BUILDUP_KEYS)[number]) {
  const dna = getRoofBuildupForKey(key);
  return { thickness: dna.totalThickness, dna };
}

describe('resolveAutoRoofTypeId', () => {
  it.each(ROOF_BUILDUP_KEYS)(
    'returns the built-in id for a default %s roof',
    (key) => {
      expect(resolveAutoRoofTypeId(defaultParams(key))).toBe(
        getBuiltInRoofTypeId(key),
      );
    },
  );

  it('returns undefined for a bare monolithic roof (no dna)', () => {
    expect(
      resolveAutoRoofTypeId({ thickness: 200, dna: undefined }),
    ).toBeUndefined();
  });

  it('returns undefined when the thickness deviates from the build-up default', () => {
    const dna = getRoofBuildupForKey('tiled');
    expect(
      resolveAutoRoofTypeId({ thickness: dna.totalThickness + 50, dna }),
    ).toBeUndefined();
  });

  it('returns undefined for a customised dna (different layer composition)', () => {
    const dna = getRoofBuildupForKey('tiled');
    const customised = {
      ...dna,
      layers: dna.layers.map((l, i) =>
        i === 0 ? { ...l, thickness: l.thickness + 10 } : l,
      ),
    };
    expect(
      resolveAutoRoofTypeId({ thickness: dna.totalThickness, dna: customised }),
    ).toBeUndefined();
  });
});
