/**
 * ADR-923 §5.6.1 — άγκυρες της πρώτης έκδοσης στην παραγωγή (2026-11-01). Δύο ελαττώματα πέρασαν όλες τις πύλες:
 * το `publicationWords` καλούσε εισαγωγή που δεν υπήρχε ποτέ, γιατί κανένα test δεν εκτελούσε τον κώδικά του,
 * και η κενή φόρμα έστελνε τιμή που το zod αρνιόταν. Εδώ τρέχει ο πραγματικός κώδικας, χωρίς mock στο κείμενο.
 */
import { emptyRecipe, GRID_COLUMN_LIMITS } from '@/components/catalog/publishing/publication-draft';
import { HUMAN_LANGUAGES } from '@/i18n/languages';
import { PUBLICATION_LIMITS } from '@/subapps/catalog/publishing/publication-vocabulary';
import { createPublicationRecipeBodySchema } from '@/subapps/catalog/schema/zod/publication.schema';
import { publicationWords, readPublicationSnapshot } from '../publication-snapshot.server';
import type { CatalogTx } from '../../catalog-store.server';

jest.mock('../../catalog-library-reads.server', () => ({ readActiveByIds: jest.fn(), readMeasurementRegistry: jest.fn(async () => new Map()) }));
jest.mock('../publication-prices.server', () => ({
  PublicationRunError: class extends Error {},
  readPublicationPriceSheet: jest.fn(async () => ({ priceOf: null, audienceKey: 'none', refs: [], edition: null, changes: [] })),
}));

describe('readPublicationSnapshot: η πραγματική διαδρομή ως τον έλεγχο εύρους', () => {
  it('χωρίς περιεχόμενο καταλήγει στη δηλωμένη άρνηση, όχι σε σφάλμα προγράμματος', async () => {
    const query = { where: () => query };
    const scope = { ctx: { companyId: 'comp_test' }, db: { collection: () => query }, tx: { get: async () => ({ docs: [] }) } } as unknown as CatalogTx;
    await expect(readPublicationSnapshot(scope, { ...emptyRecipe('el'), code: 'tech_2026', title: { el: 'Κατάλογος' } }, { links: async () => new Map() })).rejects.toThrow('emptyScope');
  });
});

describe('publicationWords: το κείμενο του χρήστη στο έντυπο', () => {
  it('διαλέγει τη γλώσσα της έκδοσης', () => {
    expect(publicationWords('en').text({ el: 'Ψύξη', en: 'Cooling' })).toBe('Cooling');
  });

  it('πέφτει στην προεπιλεγμένη γλώσσα όταν λείπει η μετάφραση', () => {
    expect(publicationWords('en').text({ el: 'Ψύξη' })).toBe('Ψύξη');
  });

  it('το κενό κείμενο δίνει την εφεδρεία του καλούντα', () => {
    expect(publicationWords('el').text(undefined, 'κωδικός')).toBe('κωδικός');
    expect(publicationWords('el').text({ el: '   ' }, 'κωδικός')).toBe('κωδικός');
  });
});

describe('η κενή συνταγή περνά το σύνορο', () => {
  it.each(HUMAN_LANGUAGES)('%s: οι προεπιλογές της φόρμας αποθηκεύονται αυτούσιες', (language) => {
    const definition = { ...emptyRecipe(language), code: 'tech_2026', title: { [language]: 'Κατάλογος' } };
    expect(createPublicationRecipeBodySchema.safeParse({ definition }).success).toBe(true);
  });

  it('η οθόνη και το zod έχουν το ίδιο όριο στηλών', () => {
    const accepts = (gridColumns: number): boolean => {
      const base = { ...emptyRecipe('el'), code: 'tech_2026', title: { el: 'Κατάλογος' } };
      return createPublicationRecipeBodySchema.safeParse({ definition: { ...base, templates: { ...base.templates, gridColumns } } }).success;
    };
    expect(GRID_COLUMN_LIMITS).toEqual({ min: PUBLICATION_LIMITS.minGridColumns, max: PUBLICATION_LIMITS.maxGridColumns });
    expect(accepts(GRID_COLUMN_LIMITS.min)).toBe(true);
    expect(accepts(GRID_COLUMN_LIMITS.max)).toBe(true);
    expect(accepts(GRID_COLUMN_LIMITS.min - 1)).toBe(false);
    expect(accepts(GRID_COLUMN_LIMITS.max + 1)).toBe(false);
  });
});
