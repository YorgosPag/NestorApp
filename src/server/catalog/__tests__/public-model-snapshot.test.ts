/**
 * Το στιγμιότυπο της προβολής (ADR-923 §5.13 Σ3): ρίζες, θέση ανά SKU, πόρτα των μέσων.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { CATALOG_RENDITION_RECIPE_VERSION } from '@/subapps/catalog/renditions/catalog-renditions';
import { readPublicModelSnapshot } from '../public/public-model-snapshot.server';

let mockFake: FakeFirestore;
jest.mock('@/lib/firebaseAdmin', () => ({ getAdminFirestore: () => mockFake }));

const COMPANY = 'comp-a';
const ROOT = 'cpmod_1';
const NOW = Date.parse('2026-11-02T10:00:00.000Z');
const LIVE = { companyId: COMPANY, isDeleted: false, revision: 1 };
const EMPTY = { values: {}, noValueReasons: {} };
const READY = { status: 'ready', recipe: CATALOG_RENDITION_RECIPE_VERSION, sourceGeneration: '1' };
const OPEN_RIGHTS = { license: { purpose: 'catalog-publication', term: { kind: 'perpetual' } } };

const put = (collection: string, id: string, data: object) => mockFake.collection(collection).doc(id).set({ id, ...data });

const productWith = (id: string, categoryIds: readonly string[], modelId: string | null = ROOT) => put(COLLECTIONS.CATALOG_PRODUCTS, id, {
  ...LIVE,
  ...EMPTY,
  categoryIds,
  modelId,
  familyId: 'fam',
  derived: { identifier: `ID-${id}`, label: `L-${id}` },
});

async function seedTree(): Promise<void> {
  await put(COLLECTIONS.CATALOG_FAMILIES, 'fam', { ...LIVE, code: 'fam', labels: {}, attributes: [], variantSchemes: [] });
  await put(COLLECTIONS.CATALOG_CATEGORIES, 'cat1', { ...LIVE, ancestorIds: ['top'] });
  await put(COLLECTIONS.CATALOG_CATEGORIES, 'cat2', { ...LIVE, ancestorIds: [] });
  await put(COLLECTIONS.CATALOG_PRODUCT_MODELS, ROOT, {
    ...LIVE,
    ...EMPTY,
    categoryIds: [],
    code: 'M-1',
    familyId: 'fam',
    variantSchemeCode: 'v',
    parentId: null,
    derived: { descendants: { cprod_a: { kind: 'product', parentId: ROOT }, cprod_b: { kind: 'product', parentId: ROOT } } },
  });
  await productWith('cprod_a', ['cat1']);
  await productWith('cprod_b', ['cat2']);
}

const read = (id = ROOT) => readPublicModelSnapshot(COMPANY, id, NOW);

beforeEach(() => {
  mockFake = new FakeFirestore();
});

describe('readPublicModelSnapshot', () => {
  it('ρίζα μοντέλου: όλα τα SKU, με τον κωδικό και την ετικέτα τους', async () => {
    await seedTree();
    const snapshot = await read();
    expect(snapshot?.projection).toMatchObject({ rootId: ROOT, kind: 'productModel', code: 'M-1', companyId: COMPANY });
    expect(snapshot?.projection.variants.map((variant) => [variant.id, variant.code, variant.label])).toEqual([
      ['cprod_a', 'ID-cprod_a', 'L-cprod_a'],
      ['cprod_b', 'ID-cprod_b', 'L-cprod_b'],
    ]);
  });

  it('🔒 η θέση κάθε SKU έχει μόνο τις δικές του κατηγορίες, όχι των αδελφών', async () => {
    await seedTree();
    const snapshot = await read();
    const depthsOf = (id: string) => snapshot?.projection.variants.find((variant) => variant.id === id)?.ancestry.categoryDepths;
    expect(depthsOf('cprod_a')).toEqual({ top: 0, cat1: 1 });
    expect(depthsOf('cprod_b')).toEqual({ cat2: 0 });
  });

  it('απλό προϊόν είναι ρίζα του εαυτού του', async () => {
    await seedTree();
    await productWith('cprod_solo', [], null);
    await expect(read('cprod_solo')).resolves.toMatchObject({ projection: { kind: 'product', code: 'ID-cprod_solo', rootId: 'cprod_solo' } });
  });

  it.each([
    ['ανύπαρκτο', 'cpmod_x'],
    ['SKU με γονέα', 'cprod_a'],
  ])('%s ⇒ null, άρα απόσυρση', async (_name, id) => {
    await seedTree();
    await expect(read(id)).resolves.toBeNull();
  });

  it('υπο-μοντέλο ⇒ null: δεν έχει δικό του έγγραφο', async () => {
    await seedTree();
    await put(COLLECTIONS.CATALOG_PRODUCT_MODELS, 'cpmod_sub', { ...LIVE, ...EMPTY, categoryIds: [], parentId: ROOT, code: 'S', familyId: 'fam', variantSchemeCode: 'v' });
    await expect(read('cpmod_sub')).resolves.toBeNull();
  });

  it('ξένος χώρος ≡ ανύπαρκτος', async () => {
    await seedTree();
    await expect(readPublicModelSnapshot('comp-b', ROOT, NOW)).resolves.toBeNull();
  });

  describe('μέσα', () => {
    const asset = (id: string, fileId: string | null, rights: object = OPEN_RIGHTS) =>
      put(COLLECTIONS.CATALOG_ASSETS, id, { ...LIVE, code: id, kind: 'image', labels: { el: id }, rights, fileId });
    const file = (id: string, data: object) => put(COLLECTIONS.FILES, id, { companyId: COMPANY, storagePath: `c/${id}.jpg`, catalogRenditions: READY, ...data });

    async function seedWithAssets(ids: readonly string[]): Promise<void> {
      await seedTree();
      await put(COLLECTIONS.CATALOG_PRODUCTS, 'cprod_a', {
        ...LIVE,
        categoryIds: ['cat1'],
        noValueReasons: {},
        modelId: ROOT,
        familyId: 'fam',
        derived: { identifier: 'A', label: 'A' },
        values: { photo: { '*': { '*': { type: 'asset', assetIds: ids } } } },
      });
    }

    it('περνά μόνο το μέσο με άδεια, απόδοση και αρχείο του χώρου, και όχι από ξένο χώρο', async () => {
      await seedWithAssets(['ok', 'noRights', 'noFile', 'foreignFile', 'noRendition']);
      await asset('ok', 'f1');
      await file('f1', {});
      await asset('noRights', 'f2', { license: { purpose: 'listing-marketing', term: { kind: 'perpetual' } } });
      await file('f2', {});
      await asset('noFile', null);
      await asset('foreignFile', 'f3');
      await file('f3', { companyId: 'comp-b' });
      await asset('noRendition', 'f4');
      await file('f4', { catalogRenditions: { ...READY, status: 'failed' } });
      const snapshot = await read();
      expect([...(snapshot?.assets.keys() ?? [])]).toEqual(['ok']);
      expect(snapshot?.assets.get('ok')).toMatchObject({ assetId: 'ok', storagePath: 'c/f1.jpg', labels: { el: 'ok' } });
    });
  });
});
