/**
 * ADR-584 — `family-type-ui-helpers` cross-category wiring parity.
 *
 * The four per-category helper sets are now ONE generic body
 * (`makeFamilyTypeHelpers`) plus per-category instantiations. That body's
 * BEHAVIOUR is proven once by the wall suite (`family-type-ui-helpers.test.ts`),
 * so re-testing it per category would only re-test the same lines.
 *
 * What is NOT compiler-proven is the WIRING of the 20 named exports: the
 * category/keys/resolver triples are type-checked against each other (`C` derives
 * the param payload via `BimTypeParamsByCategory`, so `'slab'` + wall keys +
 * roof resolver cannot compile), but nothing stops
 * `export const asRoofFamilyType = slabHelpers.asFamilyType` — a copy-paste slip
 * across 20 assignments that infers cleanly and would silently hand slabs to the
 * roof widgets.
 *
 * These tests pin exactly that: every category's exports narrow/slice to THEIR
 * OWN category and nothing else. Before ADR-584 slab/roof/opening had no
 * coverage at all — the wall suite was the only net.
 */

import {
  asOpeningFamilyType,
  asRoofFamilyType,
  asSlabFamilyType,
  asWallFamilyType,
  listOpeningTypes,
  listRoofTypes,
  listSlabTypes,
  listWallTypes,
  normaliseOpeningOverrides,
  normaliseOverrides,
  normaliseRoofOverrides,
  normaliseSlabOverrides,
  OPENING_OVERRIDABLE_KEYS,
  ROOF_OVERRIDABLE_KEYS,
  SLAB_OVERRIDABLE_KEYS,
  WALL_OVERRIDABLE_KEYS,
} from '../family-type-ui-helpers';
import {
  getAllBuiltInTypes,
  getBuiltInOpeningTypes,
  getBuiltInRoofTypes,
  getBuiltInSlabTypes,
  getBuiltInWallTypes,
} from '../built-in-types';
import type { BimFamilyType } from '../../types/bim-family-type';

const CO = 'company_test';

/**
 * One category's public surface, type-erased to the category-agnostic contract.
 * Each field is bound at construction where the category is concrete, so the
 * table needs no casts.
 */
interface WiringCase {
  readonly label: string;
  readonly category: string;
  readonly builtIns: (companyId: string) => readonly BimFamilyType[];
  readonly asFamilyType: (t: BimFamilyType | null | undefined) => BimFamilyType | null;
  readonly listTypes: (types: readonly BimFamilyType[]) => readonly BimFamilyType[];
  readonly overridableKeys: readonly string[];
  /** `normalise{X}Overrides({})` — category-agnostic, must collapse to undefined. */
  readonly normaliseEmpty: () => unknown;
}

const CASES: readonly WiringCase[] = [
  {
    label: 'wall',
    category: 'wall',
    builtIns: getBuiltInWallTypes,
    asFamilyType: asWallFamilyType,
    listTypes: listWallTypes,
    overridableKeys: WALL_OVERRIDABLE_KEYS,
    normaliseEmpty: () => normaliseOverrides({}),
  },
  {
    label: 'slab',
    category: 'slab',
    builtIns: getBuiltInSlabTypes,
    asFamilyType: asSlabFamilyType,
    listTypes: listSlabTypes,
    overridableKeys: SLAB_OVERRIDABLE_KEYS,
    normaliseEmpty: () => normaliseSlabOverrides({}),
  },
  {
    label: 'roof',
    category: 'roof',
    builtIns: getBuiltInRoofTypes,
    asFamilyType: asRoofFamilyType,
    listTypes: listRoofTypes,
    overridableKeys: ROOF_OVERRIDABLE_KEYS,
    normaliseEmpty: () => normaliseRoofOverrides({}),
  },
  {
    label: 'opening',
    category: 'opening',
    builtIns: getBuiltInOpeningTypes,
    asFamilyType: asOpeningFamilyType,
    listTypes: listOpeningTypes,
    overridableKeys: OPENING_OVERRIDABLE_KEYS,
    normaliseEmpty: () => normaliseOpeningOverrides({}),
  },
];

describe('family-type helpers — cross-category wiring parity (ADR-584)', () => {
  it('0. the fixture catalog actually spans every category under test', () => {
    // Guards the suite itself: if a built-in catalog ever went empty, every
    // «rejects foreign» assertion below would pass vacuously.
    const categories = new Set(getAllBuiltInTypes(CO).map((t) => t.category));
    for (const c of CASES) {
      expect(categories.has(c.category)).toBe(true);
      expect(c.builtIns(CO).length).toBeGreaterThan(0);
    }
  });

  describe.each(CASES)('$label', (c: WiringCase) => {
    it('asFamilyType narrows its own category', () => {
      for (const own of c.builtIns(CO)) {
        expect(c.asFamilyType(own)).toBe(own);
      }
    });

    it('asFamilyType rejects every foreign category', () => {
      const foreign = getAllBuiltInTypes(CO).filter((t) => t.category !== c.category);
      expect(foreign.length).toBeGreaterThan(0); // the discriminating fixture exists
      for (const other of foreign) {
        expect(c.asFamilyType(other)).toBeNull();
      }
    });

    it('asFamilyType is null-safe', () => {
      expect(c.asFamilyType(null)).toBeNull();
      expect(c.asFamilyType(undefined)).toBeNull();
    });

    it('listTypes slices exactly its own category out of the full catalog', () => {
      const sliced = c.listTypes(getAllBuiltInTypes(CO));
      // Anti-brittle: derive the expected count from the dedicated built-in
      // getter rather than a literal (new built-ins must not break this).
      expect(sliced.length).toBe(c.builtIns(CO).length);
      expect(sliced.every((t) => t.category === c.category)).toBe(true);
    });

    it('exposes a non-empty overridable-key list', () => {
      expect(c.overridableKeys.length).toBeGreaterThan(0);
    });

    it('normalise{X}Overrides collapses an empty patch to undefined', () => {
      expect(c.normaliseEmpty()).toBeUndefined();
    });
  });

  it('every category slices a DISJOINT set (no list export cross-wired)', () => {
    // Catches a cross-wired `list{X}Types` specifically: two categories would
    // then claim the same catalog entries. (It does NOT cover `as{X}FamilyType`
    // — `listTypes` closes over the factory's own internal narrower, so the
    // exported `as{X}FamilyType` binding is not on this path. That binding is
    // pinned by the per-category narrowing tests above; mutation-verified.)
    const all = getAllBuiltInTypes(CO);
    const slices = CASES.map((c) => ({ label: c.label, ids: c.listTypes(all).map((t) => t.id) }));

    for (const a of slices) {
      for (const b of slices) {
        if (a.label === b.label) continue;
        const overlap = a.ids.filter((id) => b.ids.includes(id));
        expect(overlap).toEqual([]);
      }
    }
  });
});
