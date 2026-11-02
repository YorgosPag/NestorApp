/**
 * ADR-923 §5.6.1 — «τι άλλαξε»: η διαφορά της Φ3, με τις τιμές του κοινού, μέσα στο εύρος της έκδοσης.
 */
import { diffPriceVersions } from '../../pricing/diff-price-versions';
import type { PriceListLineDefinition } from '../../types/price-list';
import { composePublication, type PublicationCompositionInput } from '../compose-publication';
import { emptyRecipe } from '@/components/catalog/publishing/publication-draft';
import type { LayoutTable } from '../layout-model';
import { validatePublicationRecipe } from '../validate-publication-recipe';
import { priceChangesEntry, publicationPriceChanges, type PriceChangeWords, type PublicationPriceChange, type PublicationQuoter } from '../publication-price-changes';

const line = (variantId: string, netPrice: number, priceQuantity = 1): PriceListLineDefinition => ({
  versionId: 'v', subject: { kind: 'variant', variantId }, netPrice, priceQuantity, unitCode: 'pc', discountGroupId: null, breakdown: null,
} as PriceListLineDefinition);
const quoterOf = (lines: readonly PriceListLineDefinition[], factor = 1): PublicationQuoter => (variantId) => {
  const found = lines.find((candidate) => candidate.subject.kind === 'variant' && candidate.subject.variantId === variantId);
  return found ? { netPrice: found.netPrice * factor, priceQuantity: found.priceQuantity } : null;
};
const changesOf = (before: readonly PriceListLineDefinition[], after: readonly PriceListLineDefinition[], factor = 1) =>
  publicationPriceChanges(diffPriceVersions(before, after), quoterOf(before, factor), quoterOf(after, factor));

const words: PriceChangeWords = {
  title: 'Τι άλλαξε', groups: { added: 'Νέα', removed: 'Καταργήσεις', raised: 'Αυξήσεις', lowered: 'Μειώσεις' }, before: 'Πριν', after: 'Τώρα', change: 'Μεταβολή', noPrice: 'Ζητήστε προσφορά',
};
const names = new Map([['a', { code: 'A-10', label: 'Άλφα' }], ['b', { code: 'A-9', label: 'Βήτα' }], ['c', { code: 'C', label: 'C' }]]);
const entryOf = (changes: readonly PublicationPriceChange[], known = names) => priceChangesEntry({ changes, names: known, words, language: 'el' });

describe('publicationPriceChanges', () => {
  it('🔴 αύξηση, μείωση, νέο, κατάργηση', () => {
    const changes = changesOf([line('a', 1000), line('b', 1000), line('gone', 500)], [line('a', 1100), line('b', 900), line('new', 300)]);
    expect(changes.map(({ kind, variantId }) => [kind, variantId])).toEqual(expect.arrayContaining([['raised', 'a'], ['lowered', 'b'], ['removed', 'gone'], ['added', 'new']]));
    expect(changes).toHaveLength(4);
  });

  it('🔴 η μεταβολή μετριέται ανά μονάδα: 84 € ανά 100 → 0,90 € ανά 1 είναι αύξηση', () => {
    expect(changesOf([line('a', 8400, 100)], [line('a', 90, 1)])[0]).toMatchObject({ kind: 'raised', changeBp: 714 });
  });

  it('🔒 τα ποσά είναι του κοινού, όχι της γραμμής', () => {
    expect(changesOf([line('a', 1000)], [line('a', 1100)], 0.5)[0]).toMatchObject({ before: { netPrice: 500 }, after: { netPrice: 550 } });
  });

  it('🔴 αλλαγή που δεν φτάνει στην τιμή δεν τυπώνεται', () => {
    const grouped = { ...line('a', 1000), discountGroupId: 'g' };
    expect(changesOf([line('a', 1000)], [grouped])).toEqual([]);
  });

  it('🔴 από μηδέν: αύξηση, χωρίς ποσοστό, και μέσα στον φράχτη', () => {
    expect(changesOf([line('a', 0)], [line('a', 500)])[0]).toMatchObject({ kind: 'raised', changeBp: null, fenced: true });
  });

  it('γραμμή κόστους δεν τυπώνεται', () => {
    const cost = { ...line('x', 100), subject: { kind: 'costItem', costItemId: 'c' } } as unknown as PriceListLineDefinition;
    expect(changesOf([], [cost])).toEqual([]);
  });
});

describe('priceChangesEntry', () => {
  it('🔴 ό,τι είναι έξω από το εύρος δεν τυπώνεται, και τίποτα ⇒ καμία σελίδα', () => {
    expect(entryOf(changesOf([line('z', 100)], [line('z', 200)]))).toBeNull();
  });

  it('ομάδες με σταθερή σειρά, φυσική ταξινόμηση κωδικών, ποσοστό με πρόσημο', () => {
    const entry = entryOf(changesOf([line('a', 1000), line('b', 1000)], [line('a', 1100), line('b', 1200)]));
    expect(entry?.groups.map((group) => group.id)).toEqual(['raised']);
    expect(entry?.groups[0].rows.map((row) => row.id)).toEqual(['b', 'a']);
    expect(entry?.groups[0].rows[1].cells).toEqual(['10,00', '11,00', '+10,0%']);
  });

  it('ίδιος κωδικός και όνομα γράφεται μία φορά', () => {
    expect(entryOf(changesOf([], [line('c', 100)]))?.groups[0].rows[0].label).toBe('C');
  });
});

describe('🔑 στον συνθέτη', () => {
  const recipe = { language: 'el', theme: { fontCode: 'liberationSans', logoAssetId: null, primary: { rgb: '#000000', cmyk: [0, 0, 0, 0] }, accent: { rgb: '#000000', cmyk: [0, 0, 0, 0] } }, templates: { enabled: ['chapterDivider', 'codeIndex'], groupStyle: 'band', gridColumns: 3 } };
  const compose = (entry: NonNullable<ReturnType<typeof entryOf>>) => composePublication({
    recipe, title: 'T', footer: '', chapters: [{ id: entry.id, title: entry.title, entries: [entry] }],
    words: { contents: 'c', codeIndex: 'i', tablePart: () => '' },
  } as unknown as PublicationCompositionInput);

  it('🔴 πίνακες με τα υπάρχοντα μπλοκ, χωρίς σελίδα διαχωριστικού και χωρίς κωδικούς στο ευρετήριο', () => {
    const entry = entryOf(changesOf([line('a', 1000)], [line('a', 1100), line('b', 100)]));
    if (!entry) throw new Error('entry');
    const { sections } = compose(entry);
    expect(sections.map((section) => section.template)).toEqual(['family']);
    const tables = sections[0].blocks.flatMap((block) => (block.kind === 'table' ? [block.table as LayoutTable] : []));
    expect(tables.map((table) => [table.columnCount, table.rows[0].header])).toEqual([[2, true], [4, true]]);
  });
});

describe('validatePublicationRecipe', () => {
  it('🔴 σύγκριση έκδοσης με τον εαυτό της αρνείται', () => {
    const pricing = { kind: 'priced', priceListId: 'l', priceListVersionId: 'v', audience: { kind: 'anonymous' } } as const;
    const codes = (compareVersionId: string) => validatePublicationRecipe({ ...emptyRecipe('el'), pricing: { ...pricing, compareVersionId } }).map((issue) => issue.code);
    expect(codes('v')).toContain('publicationCompareInvalid');
    expect(codes('older')).not.toContain('publicationCompareInvalid');
  });
});
