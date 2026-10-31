/**
 * ADR-923 §5.10.4 Β2 — το σχέδιο ερωτήματος της ενιαίας λίστας + **άγκυρα δεικτών**.
 *
 * Το CHECK 3.15 δεν βλέπει ερωτήματα χτισμένα με συνθήκες, και ο emulator **δεν** επιβάλλει σύνθετους δείκτες (τους
 * φτιάχνει μόνος του) ⇒ κανένα από τα δύο δεν θα έπιανε δείκτη που λείπει. Εδώ: **κάθε** σχήμα που μπορεί να ζητήσει
 * η λίστα πρέπει να έχει δείκτη στο `firestore.indexes.json` — αλλιώς `FAILED_PRECONDITION` στην παραγωγή.
 */
import fs from 'fs';
import path from 'path';

import {
  ARRAY_CONTAINS_ANY_LIMIT,
  catalogListQueryPlan,
  everyCatalogListPlan,
  keysMatchSelection,
  serverFacetKeys,
  type CatalogListHolder,
  type CatalogListQueryPlan,
} from '../catalog-list-query';

interface IndexField { readonly fieldPath: string; readonly order?: string; readonly arrayConfig?: string }
interface CompositeIndex { readonly collectionGroup: string; readonly queryScope: string; readonly fields: readonly IndexField[] }

const INDEXES: readonly CompositeIndex[] = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), 'firestore.indexes.json'), 'utf8'),
).indexes;

const COLLECTION: Readonly<Record<CatalogListHolder, string>> = { model: 'catalog_product_models', product: 'catalog_products' };

/** Ταιριάζει δείκτης: ισότητες ως **σύνολο** + array-contains + το `orderBy` **τελευταίο**, με κατεύθυνση. */
function covers(index: CompositeIndex, holder: CatalogListHolder, plan: CatalogListQueryPlan): boolean {
  if (index.collectionGroup !== COLLECTION[holder] || index.queryScope !== 'COLLECTION') return false;
  const last = index.fields[index.fields.length - 1];
  const [orderField, direction] = plan.orderBy;
  if (last.fieldPath !== orderField || last.order !== (direction === 'asc' ? 'ASCENDING' : 'DESCENDING')) return false;
  const rest = index.fields.slice(0, -1);
  const wanted = new Set(['companyId', ...plan.equalities.map(([field]) => field)]);
  const contains = rest.filter((field) => field.arrayConfig === 'CONTAINS').map((field) => field.fieldPath);
  const equal = rest.filter((field) => field.arrayConfig === undefined).map((field) => field.fieldPath);
  const containsOk = plan.arrayContainsAny === null ? contains.length === 0 : contains.length === 1 && contains[0] === plan.arrayContainsAny[0];
  return containsOk && equal.length === wanted.size && equal.every((field) => wanted.has(field));
}

describe('catalogListQueryPlan', () => {
  it('ριζικά μοντέλα (parentId == null) · απλά SKU (modelId == null) · πάντα !isDeleted', () => {
    expect(catalogListQueryPlan('model', { familyId: null, facetKeys: null, sort: 'updated' })).toEqual({
      equalities: [['isDeleted', false], ['parentId', null]],
      arrayContainsAny: null,
      orderBy: ['updatedAt', 'desc'],
    });
    expect(catalogListQueryPlan('product', { familyId: 'fam', facetKeys: ['a=b', 'a=c'], sort: 'label' })).toEqual({
      equalities: [['isDeleted', false], ['familyId', 'fam'], ['modelId', null]],
      arrayContainsAny: ['derived.facetKeys', ['a=b', 'a=c']],
      orderBy: ['derived.sortKey', 'asc'],
    });
  });

  it('facet ΧΩΡΙΣ οικογένεια αγνοείται (τα facets είναι δεμένα σε ιδιότητες της οικογένειας)', () => {
    expect(catalogListQueryPlan('model', { familyId: null, facetKeys: ['a=b'], sort: 'label' }).arrayContainsAny).toBeNull();
  });

  it('άδεια ομάδα ΔΕΝ φτάνει στο ερώτημα (η Firestore απορρίπτει `array-contains-any` με κενό πίνακα)', () => {
    expect(catalogListQueryPlan('model', { familyId: 'fam', facetKeys: [], sort: 'label' }).arrayContainsAny).toBeNull();
  });
});

describe('επιλογή facets: OR μέσα στην ιδιότητα, AND ανάμεσα (3η)', () => {
  it('στο ερώτημα πάει η στενότερη ομάδα, ταξινομημένη', () => {
    expect(serverFacetKeys([['h=2', 'h=1'], ['c=x']])).toEqual(['c=x']);
    expect(serverFacetKeys([['h=2', 'h=1']])).toEqual(['h=1', 'h=2']);
    expect(serverFacetKeys([])).toBeNull();
  });

  it('🔴 ομάδα πάνω από το όριο της Firestore δεν φτάνει ποτέ στο ερώτημα', () => {
    const wide = Array.from({ length: ARRAY_CONTAINS_ANY_LIMIT + 1 }, (_, index) => `h=${index}`);
    expect(serverFacetKeys([wide])).toBeNull();
    expect(serverFacetKeys([wide, ['c=x', 'c=y']])).toEqual(['c=x', 'c=y']);
  });

  it('OR μέσα στην ομάδα · AND ανάμεσα · κενή επιλογή περνά τα πάντα', () => {
    expect(keysMatchSelection(['h=1', 'c=x'], [['h=1', 'h=2'], ['c=x']])).toBe(true);
    expect(keysMatchSelection(['h=2'], [['h=1', 'h=2']])).toBe(true);
    expect(keysMatchSelection(['h=1'], [['h=1'], ['c=x']])).toBe(false);
    expect(keysMatchSelection([], [])).toBe(true);
  });
});

describe('🔴 άγκυρα δεικτών — κάθε σχήμα της λίστας έχει δείκτη', () => {
  it.each(everyCatalogListPlan().map(({ holder, plan }) => [holder, JSON.stringify(plan), holder, plan] as const))(
    '%s · %s',
    (_h, _p, holder, plan) => {
      expect(INDEXES.some((index) => covers(index, holder, plan))).toBe(true);
    },
  );
});
