/**
 * ADR-923 §5.6.1 — ο γραφέας συνταγών ξανακρίνει ό,τι προσφέρει η φόρμα: λογότυπο που τυπώνεται και επιλογές που υπάρχουν.
 * Η μηχανή του καταλόγου είναι ψεύτικη: εδώ κρίνονται οι αναφορές της συνταγής, όχι η συναλλαγή.
 */
import type { AuthContext } from '@/lib/auth';
import { emptyRecipe } from '@/components/catalog/publishing/publication-draft';
import type { PublicationRecipeDefinition } from '@/subapps/catalog/types/publication';
import { createPublicationRecipe } from '../publication-recipe-writer.server';

const mockAssets = new Map<string, unknown>();
const mockModels = new Set<string>();
const mockProducts = new Set<string>();
const mockFiles = new Map<string, Record<string, unknown>>();
const mockFamilies = new Map<string, unknown>();
const mockAttributes = new Map<string, unknown>();

jest.mock('@/lib/files/file-custody', () => ({ FILE_COLLECTION: { company: 'FILES' } }));
jest.mock('@/config/firestore-collections', () => ({ COLLECTIONS: { FILES: 'files' } }));
jest.mock('../publication-prices.server', () => ({ assertPublicationPricing: jest.fn() }));
jest.mock('../../catalog-library-reads.server', () => ({
  readActiveByIds: jest.fn(async (_scope: unknown, kind: string, ids: readonly string[]) => {
    if (kind === 'family') return new Map(ids.flatMap((id) => (mockFamilies.has(id) ? [[id, mockFamilies.get(id)]] : [])) as [string, unknown][]);
    if (kind === 'attribute') return new Map(ids.flatMap((id) => (mockAttributes.has(id) ? [[id, mockAttributes.get(id)]] : [])) as [string, unknown][]);
    const has = (id: string) => (kind === 'asset' ? mockAssets.has(id) : kind === 'productModel' ? mockModels.has(id) : kind === 'product' ? mockProducts.has(id) : true);
    return new Map(ids.filter(has).map((id) => [id, mockAssets.get(id) ?? { id }]));
  }),
}));
jest.mock('../../catalog-store.server', () => {
  const doc = (id: string) => id;
  const get = async (id: string) => ({ exists: mockFiles.has(id), data: () => mockFiles.get(id) });
  return {
    assertCodeUnchanged: jest.fn(),
    assertRevision: jest.fn(),
    readForCreate: jest.fn(async () => ({})),
    readOwned: jest.fn(),
    runCatalogTransaction: (_ctx: unknown, work: (scope: unknown) => Promise<unknown>) => work({ tx: { get }, db: { collection: () => ({ doc }) } }),
    stageCreate: jest.fn(async (_scope: unknown, _kind: string, _target: unknown, definition: unknown) => definition),
    stageReplace: jest.fn(),
    stageSoftDelete: jest.fn(),
  };
});

const ctx = { companyId: 'comp_test', uid: 'u' } as unknown as AuthContext;
const base: PublicationRecipeDefinition = { ...emptyRecipe('el'), code: 'tech_2026', title: { el: 'Κατάλογος' } };
const withLogo = (logoAssetId: string): PublicationRecipeDefinition => ({ ...base, theme: { ...base.theme, logoAssetId } });

const issuesOf = async (definition: PublicationRecipeDefinition): Promise<readonly { readonly code: string; readonly path: string }[]> => {
  try {
    await createPublicationRecipe(ctx, definition);
    return [];
  } catch (cause) {
    return (cause as { readonly issues: readonly { readonly code: string; readonly path: string }[] }).issues;
  }
};

describe('γραφέας συνταγών: αναφορές', () => {
  beforeEach(() => {
    mockAssets.clear();
    mockModels.clear();
    mockProducts.clear();
    mockFiles.clear();
    mockFamilies.clear();
    mockAttributes.clear();
  });

  it('δέχεται λογότυπο με ρόλο logo και εικόνα που αποδίδεται', async () => {
    mockAssets.set('a1', { id: 'a1', role: 'logo', kind: 'image', fileId: 'f1' });
    mockFiles.set('f1', { ext: 'png', contentType: 'image/png' });
    await expect(issuesOf(withLogo('a1'))).resolves.toEqual([]);
  });

  it('απορρίπτει SVG και ξένο ρόλο με το ίδιο εύρημα στο πεδίο του λογότυπου', async () => {
    mockAssets.set('svg', { id: 'svg', role: 'logo', kind: 'image', fileId: 'f2' });
    mockFiles.set('f2', { ext: 'svg', contentType: 'image/svg+xml' });
    mockAssets.set('photo', { id: 'photo', role: 'photo', kind: 'image', fileId: 'f1' });
    mockFiles.set('f1', { ext: 'png', contentType: 'image/png' });
    const refused = [{ code: 'publicationLogoNotEligible', path: 'theme.logoAssetId' }];
    await expect(issuesOf(withLogo('svg'))).resolves.toEqual(refused);
    await expect(issuesOf(withLogo('photo'))).resolves.toEqual(refused);
  });

  it('απορρίπτει μέσο που το αρχείο του έχει σβηστεί', async () => {
    mockAssets.set('a1', { id: 'a1', role: 'logo', kind: 'image', fileId: 'gone' });
    await expect(issuesOf(withLogo('a1'))).resolves.toEqual([{ code: 'publicationLogoNotEligible', path: 'theme.logoAssetId' }]);
  });

  it('ξένο ή ανύπαρκτο μέσο ≡ ανύπαρκτη αναφορά', async () => {
    await expect(issuesOf(withLogo('foreign'))).resolves.toEqual([{ code: 'unknownReference', path: 'theme.logoAssetId' }]);
  });

  it('κάθε επιλογή του εύρους κρίνεται με το είδος της, με τη δική της διαδρομή', async () => {
    mockModels.add('m1');
    mockProducts.add('p1');
    const entries = [
      { kind: 'productModel', id: 'm1' },
      { kind: 'product', id: 'm1' },
      { kind: 'product', id: 'p1' },
      { kind: 'productModel', id: 'gone' },
    ] as const;
    await expect(issuesOf({ ...base, scope: { kind: 'selection', entries } })).resolves.toEqual([
      { code: 'unknownReference', path: 'scope.entries[1]' },
      { code: 'unknownReference', path: 'scope.entries[3]' },
    ]);
  });

  describe('εύρος `filter`', () => {
    const withFilter = (familyId: string | null, groups: readonly (readonly string[])[]): PublicationRecipeDefinition => ({
      ...base,
      scope: { kind: 'filter', filter: { familyId, facetGroups: groups.map((keys) => ({ keys })) } },
    });

    beforeEach(() => {
      mockFamilies.set('fam', { id: 'fam', attributes: [{ attributeId: 'colour' }] });
      mockAttributes.set('colour', { type: 'select', code: 'colour', labels: {}, config: { options: [{ code: 'red', labels: {} }] } });
    });

    it('δέχεται οικογένεια του χώρου με τιμές που προσφέρει', async () => {
      await expect(issuesOf(withFilter('fam', [['colour=red']]))).resolves.toEqual([]);
      await expect(issuesOf(withFilter('fam', []))).resolves.toEqual([]);
    });

    it('🔴 ξένη ή σβησμένη οικογένεια ≡ ανύπαρκτη', async () => {
      await expect(issuesOf(withFilter('foreign', []))).resolves.toEqual([{ code: 'unknownReference', path: 'scope.filter.familyId' }]);
    });

    it('🔴 τιμή που η οικογένεια δεν προσφέρει κρίνεται στη δική της διαδρομή', async () => {
      await expect(issuesOf(withFilter('fam', [['colour=red', 'colour=blue']]))).resolves.toEqual([
        { code: 'unknownReference', path: 'scope.filter.facetGroups[0].keys[1]' },
      ]);
    });

    it('χωρίς οικογένεια αρνείται η ίδια επικύρωση με τη φόρμα', async () => {
      await expect(issuesOf(withFilter(null, []))).resolves.toEqual([{ code: 'publicationScopeEmpty', path: 'scope.filter.familyId' }]);
    });
  });
});
