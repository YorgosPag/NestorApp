/**
 * ADR-923 §5.6.1 — το φίλτρο ως εύρος έκδοσης: σχήμα αποθήκευσης, κανονική μορφή, κλειδί ιδεμποτίας, κρίση ίδια με την οθόνη.
 */
import { createHash } from 'node:crypto';

import { canonicalJson } from '@/lib/legal/canonical-json';
import { emptyRecipe } from '@/components/catalog/publishing/publication-draft';
import { keysMatchSelection } from '../../list/catalog-list-query';
import { publicationRecipeDefinitionSchema } from '../../schema/zod/publication.schema';
import type { CatalogAttributeDefinition } from '../../types/attribute';
import type { CatalogFamilyDefinition } from '../../types/family';
import type { PublicationFilter, PublicationRecipeDefinition } from '../../types/publication';
import { canonicalRecipeScope, facetSelectionOf, filterWithSelection, productPassesFilter, unknownFilterKeys } from '../publication-filter';
import { publicationInputHash } from '../publication-input-hash';

const filter = (groups: readonly (readonly string[])[], familyId: string | null = 'fam'): PublicationFilter => ({ familyId, facetGroups: groups.map((keys) => ({ keys })) });
const recipe = (scope: PublicationRecipeDefinition['scope']): PublicationRecipeDefinition => ({ ...emptyRecipe('el'), code: 'tech', title: { el: 'Τ' }, scope });
const hashOf = (definition: PublicationRecipeDefinition) => publicationInputHash({ companyId: 'c', recipe: definition, data: [], audienceKey: 'a', pricing: [], renderVersion: 'r', links: [] });

describe('σχήμα αποθήκευσης', () => {
  it('🔴 κανένας πίνακας μέσα σε πίνακα: η Firestore τον αρνείται', () => {
    const stored = filterWithSelection(filter([]), [['b=1'], ['a=1']]);
    const nested = (value: unknown): boolean => Array.isArray(value) ? value.some(Array.isArray) || value.some(nested) : typeof value === 'object' && value !== null && Object.values(value).some(nested);
    expect(nested(stored)).toBe(false);
  });

  it('η μετατροπή διατηρεί την επιλογή της οθόνης', () => {
    expect(facetSelectionOf(filterWithSelection(filter([]), [['a=1', 'a=2'], ['b=1']]))).toEqual([['a=1', 'a=2'], ['b=1']]);
  });

  it('το zod δέχεται το φίλτρο και αρνείται άδεια ομάδα και ξένο πεδίο', () => {
    const parse = (value: unknown) => publicationRecipeDefinitionSchema.safeParse(recipe({ kind: 'filter', filter: value as PublicationFilter })).success;
    expect(parse(filter([['a=1']]))).toBe(true);
    expect(parse(filter([[]]))).toBe(false);
    expect(parse({ ...filter([]), sort: 'label' })).toBe(false);
  });
});

describe('κανονική μορφή', () => {
  it('άδεια ομάδα φεύγει: αλλιώς θα απέκλειε τα πάντα', () => {
    expect(filterWithSelection(filter([]), [[], ['a=1']]).facetGroups).toEqual([{ keys: ['a=1'] }]);
  });

  it('🔑 άλλη σειρά κλικ ⇒ ίδιο hash, άρα ίδιο αρχείο', () => {
    const first = recipe({ kind: 'filter', filter: filter([['b=2', 'b=1'], ['a=1']]) });
    const second = recipe({ kind: 'filter', filter: filter([['a=1'], ['b=1', 'b=2']]) });
    expect(hashOf(first)).toBe(hashOf(second));
  });

  it('🔴 άλλο φίλτρο ⇒ άλλο hash · ίδιο κλειδί, άλλη ομαδοποίηση ⇒ άλλο hash', () => {
    const scope = (groups: readonly (readonly string[])[]) => recipe({ kind: 'filter', filter: filter(groups) });
    expect(hashOf(scope([['a=1']]))).not.toBe(hashOf(scope([['a=2']])));
    expect(hashOf(scope([['a=1', 'b=1']]))).not.toBe(hashOf(scope([['a=1'], ['b=1']])));
    expect(hashOf(recipe({ kind: 'filter', filter: filter([], 'one') }))).not.toBe(hashOf(recipe({ kind: 'filter', filter: filter([], 'two') })));
  });

  it('🔴 παλιές συνταγές: ίδιο αντικείμενο και ίδιο hash με πριν από το φίλτρο', () => {
    for (const scope of [{ kind: 'all' }, { kind: 'categories', categoryIds: ['c'] }, { kind: 'selection', entries: [{ kind: 'product', id: 'p' }] }] as const) {
      const definition = recipe(scope);
      expect(canonicalRecipeScope(definition)).toBe(definition);
      const before = canonicalJson({ companyId: 'c', recipe: definition, data: [], audienceKey: 'a', pricing: [], renderVersion: 'r', links: [] });
      expect(hashOf(definition)).toBe(createHash('sha256').update(before).digest('hex'));
    }
  });
});

describe('productPassesFilter', () => {
  const product = (familyId: string, facetKeys?: readonly string[]) => ({ familyId, derived: { facetKeys } });

  it('🔴 ίδια κρίση με την οθόνη προϊόντων, στο ίδιο SKU', () => {
    const keys = ['a=1', 'b=2'];
    for (const groups of [[['a=1']], [['a=2']], [['a=1', 'a=2'], ['b=2']], [['a=2'], ['b=2']]]) {
      expect(productPassesFilter(product('fam', keys), filter(groups))).toBe(keysMatchSelection(keys, groups));
    }
  });

  it('άλλη οικογένεια δεν περνά ποτέ', () => {
    expect(productPassesFilter(product('other', ['a=1']), filter([['a=1']]))).toBe(false);
    expect(productPassesFilter(product('other'), filter([]))).toBe(false);
  });

  it('έγγραφο χωρίς `facetKeys` κρίνεται σαν άδειο', () => {
    expect(productPassesFilter(product('fam'), filter([]))).toBe(true);
    expect(productPassesFilter(product('fam'), filter([['a=1']]))).toBe(false);
  });
});

describe('unknownFilterKeys', () => {
  const family = { attributes: [{ attributeId: 'colour' }, { attributeId: 'stocked' }, { attributeId: 'gone' }] } as unknown as CatalogFamilyDefinition;
  const attributes = new Map([
    ['colour', { type: 'select', code: 'colour', labels: {}, config: { options: [{ code: 'red', labels: {} }] } }],
    ['stocked', { type: 'boolean', code: 'stocked', labels: {} }],
  ]) as unknown as ReadonlyMap<string, CatalogAttributeDefinition>;

  it('κρατά μόνο ό,τι η οικογένεια δεν προσφέρει πια', () => {
    expect(unknownFilterKeys(filter([['colour=red', 'colour=blue'], ['stocked:true'], ['gone=1']]), family, attributes)).toEqual(['colour=blue', 'gone=1']);
  });
});
