/**
 * ADR-923 §5.10.4 Β2 — το σχέδιο ερωτήματος της ενιαίας λίστας + **άγκυρα δεικτών**.
 *
 * Το CHECK 3.15 δεν βλέπει ερωτήματα χτισμένα με συνθήκες, και ο emulator **δεν** επιβάλλει σύνθετους δείκτες (τους
 * φτιάχνει μόνος του) ⇒ κανένα από τα δύο δεν θα έπιανε δείκτη που λείπει. Εδώ: **κάθε** σχήμα που μπορεί να ζητήσει
 * η λίστα πρέπει να έχει δείκτη στο `firestore.indexes.json` — αλλιώς `FAILED_PRECONDITION` στην παραγωγή.
 */
import fs from 'fs';
import path from 'path';

import { catalogListQueryPlan, everyCatalogListPlan, type CatalogListHolder, type CatalogListQueryPlan } from '../catalog-list-query';

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
  const containsOk = plan.arrayContains === null ? contains.length === 0 : contains.length === 1 && contains[0] === plan.arrayContains[0];
  return containsOk && equal.length === wanted.size && equal.every((field) => wanted.has(field));
}

describe('catalogListQueryPlan', () => {
  it('ριζικά μοντέλα (parentId == null) · απλά SKU (modelId == null) · πάντα !isDeleted', () => {
    expect(catalogListQueryPlan('model', { familyId: null, facetKey: null, sort: 'updated' })).toEqual({
      equalities: [['isDeleted', false], ['parentId', null]],
      arrayContains: null,
      orderBy: ['updatedAt', 'desc'],
    });
    expect(catalogListQueryPlan('product', { familyId: 'fam', facetKey: 'a=b', sort: 'label' })).toEqual({
      equalities: [['isDeleted', false], ['familyId', 'fam'], ['modelId', null]],
      arrayContains: ['derived.facetKeys', 'a=b'],
      orderBy: ['derived.sortKey', 'asc'],
    });
  });

  it('facet ΧΩΡΙΣ οικογένεια αγνοείται (τα facets είναι δεμένα σε ιδιότητες της οικογένειας)', () => {
    expect(catalogListQueryPlan('model', { familyId: null, facetKey: 'a=b', sort: 'label' }).arrayContains).toBeNull();
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
