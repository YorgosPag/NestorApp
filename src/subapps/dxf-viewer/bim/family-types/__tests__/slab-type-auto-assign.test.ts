/**
 * Tests for the slab auto-typing policy (ADR-412). Mirror of
 * `wall-type-auto-assign.test.ts`. Verifies the non-destructive match-gate:
 * kind-default slabs → built-in id, bare/customised slabs → undefined (ad-hoc).
 */

import { resolveAutoSlabTypeId } from '../slab-type-auto-assign';
import { getBuiltInSlabTypeId } from '../built-in-types';
import { getDefaultSlabBuildupForKind } from '../../types/slab-dna-types';
import type { SlabKind } from '../../types/slab-types';

const KINDS: readonly SlabKind[] = [
  'floor',
  'ceiling',
  'roof',
  'ground',
  'foundation',
];

/** A default (kind-matching) param triple. */
function defaultParams(kind: SlabKind) {
  const dna = getDefaultSlabBuildupForKind(kind);
  return { kind, thickness: dna.totalThickness, dna };
}

describe('resolveAutoSlabTypeId', () => {
  it.each(KINDS)(
    'returns the built-in id for a default %s slab',
    (kind) => {
      expect(resolveAutoSlabTypeId(defaultParams(kind))).toBe(
        getBuiltInSlabTypeId(kind),
      );
    },
  );

  it('returns undefined for a bare single-material slab (no dna)', () => {
    expect(
      resolveAutoSlabTypeId({ kind: 'floor', thickness: 200, dna: undefined }),
    ).toBeUndefined();
  });

  it('returns undefined when the thickness deviates from the kind default', () => {
    const dna = getDefaultSlabBuildupForKind('floor');
    expect(
      resolveAutoSlabTypeId({ kind: 'floor', thickness: dna.totalThickness + 50, dna }),
    ).toBeUndefined();
  });

  it('returns undefined for a customised dna (different layer composition)', () => {
    const dna = getDefaultSlabBuildupForKind('roof');
    const customised = {
      ...dna,
      layers: dna.layers.map((l, i) =>
        i === 0 ? { ...l, thickness: l.thickness + 10 } : l,
      ),
    };
    expect(
      resolveAutoSlabTypeId({ kind: 'roof', thickness: dna.totalThickness, dna: customised }),
    ).toBeUndefined();
  });

  it('returns undefined when kind is missing (legacy params)', () => {
    const dna = getDefaultSlabBuildupForKind('floor');
    expect(
      resolveAutoSlabTypeId({
        kind: undefined as unknown as SlabKind,
        thickness: dna.totalThickness,
        dna,
      }),
    ).toBeUndefined();
  });
});
