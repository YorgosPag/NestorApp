/**
 * ADR-923 §5.6 · §5.14.1 — ο ένας αναγνώστης «όλος ο κατάλογος του χώρου», που τον καλούν ο εκδότης και η εξαγωγή xChange.
 * Τρέχει πάνω σε FakeFirestore: ξένος χώρος και διαγραμμένη εγγραφή δεν διαβάζονται, κάθε συλλογή πάει στο δικό της πεδίο.
 */
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import type { CatalogReadScope } from '../catalog-store.server';

const fake = new FakeFirestore();
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: (): Firestore => fake as unknown as Firestore }));

/* eslint-disable import/first -- το mock πρέπει να δηλωθεί πριν φορτωθεί ο αναγνώστης */
import { readCatalogDataSet } from '../catalog-dataset-reads.server';
/* eslint-enable import/first */

const OWN = 'comp-own';
const FOREIGN = 'comp-foreign';

const FIELD_OF = {
  categories: COLLECTIONS.CATALOG_CATEGORIES,
  families: COLLECTIONS.CATALOG_FAMILIES,
  attributes: COLLECTIONS.CATALOG_ATTRIBUTES,
  models: COLLECTIONS.CATALOG_PRODUCT_MODELS,
  products: COLLECTIONS.CATALOG_PRODUCTS,
} as const;

function seedEach(): void {
  for (const [field, collection] of Object.entries(FIELD_OF)) {
    fake.seed(collection, `${field}_own`, { id: `${field}_own`, companyId: OWN, isDeleted: false });
    fake.seed(collection, `${field}_deleted`, { id: `${field}_deleted`, companyId: OWN, isDeleted: true });
    fake.seed(collection, `${field}_foreign`, { id: `${field}_foreign`, companyId: FOREIGN, isDeleted: false });
  }
}

const read = (companyId: string) => fake.runTransaction((tx) => {
  const scope = { db: fake as unknown as Firestore, tx: tx as unknown as Transaction, ctx: { companyId }, now: '2026-11-03T00:00:00.000Z' } satisfies CatalogReadScope;
  return readCatalogDataSet(scope);
});

const idsOf = (records: readonly { readonly id: string }[]) => records.map((record) => record.id);

describe('readCatalogDataSet: ο κατάλογος του χώρου, ολόκληρος', () => {
  beforeEach(() => {
    fake.reset();
    seedEach();
  });

  it.each(Object.keys(FIELD_OF) as (keyof typeof FIELD_OF)[])('%s: μόνο οι ενεργές εγγραφές του χώρου, στο δικό τους πεδίο', async (field) => {
    expect(idsOf((await read(OWN))[field])).toEqual([`${field}_own`]);
  });

  it('ο ξένος χώρος βλέπει μόνο τα δικά του', async () => {
    const data = await read(FOREIGN);
    expect(idsOf(data.products)).toEqual(['products_foreign']);
    expect(idsOf(data.families)).toEqual(['families_foreign']);
  });

  it('χώρος χωρίς κατάλογο: κενά σύνολα και μητρώο μονάδων της πλατφόρμας', async () => {
    const data = await read('comp-empty');
    expect([data.categories, data.families, data.attributes, data.models, data.products].every((records) => records.length === 0)).toBe(true);
    expect(data.registry).toBeDefined();
  });
});
