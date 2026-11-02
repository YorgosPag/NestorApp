/**
 * Το ευρετήριο αναζήτησης ενός SKU (ADR-923 §5.12): ό,τι μπαίνει, με ποια σειρά, και πότε αποδεικνύεται μπαγιάτικο.
 */

import { MFP_ATTRIBUTE_MAP, MFP_ATTRIBUTES, MFP_FAMILY } from '../../__tests__/fixtures/mfp-fan-coil.fixture';
import type { CatalogAttributeDefinition } from '../../types/attribute';
import type { CatalogFamilyDefinition, VariantScheme } from '../../types/family';
import type { CatalogValueHolder, ValueSlots } from '../../types/product';
import { resolveInheritedValues, type InheritanceLink } from '../../values/resolve-inherited';
import { CATALOG_LIMITS } from '../../vocabulary/catalog-limits';
import { catalogSearchIndexHash, catalogSearchIndexOf, isSearchIndexStale, searchableAttributeIdsOf } from '../search-index';
import { catalogSearchPlan, matchesCatalogSearch } from '../search-prefixes';

const NOTE = 'note';
const TAG = 'tag';

const textAttribute = (code: string, over: Partial<CatalogAttributeDefinition> = {}): CatalogAttributeDefinition => ({
  code, groupId: 'general', labels: { el: code }, description: {}, localizable: false, scopable: false, unique: false, orderKey: 'a0',
  mappings: MFP_ATTRIBUTES[0].mappings, type: 'text', config: { maxLength: null, pattern: null }, ...over,
} as CatalogAttributeDefinition);

const attributes = (note: Partial<CatalogAttributeDefinition> = { searchable: true }, tag: Partial<CatalogAttributeDefinition> = {}) =>
  new Map<string, CatalogAttributeDefinition>([[NOTE, textAttribute(NOTE, note)], [TAG, textAttribute(TAG, tag)]]);

const family: CatalogFamilyDefinition = {
  ...MFP_FAMILY,
  labels: { el: 'Μονάδα ανεμιστήρα', en: 'Fan coil' },
  attributes: [{ attributeId: NOTE, requiredChannels: [] }, { attributeId: TAG, requiredChannels: [] }],
  variantSchemes: [],
};

const text = (value: string) => ({ type: 'text' as const, text: value });
const unscoped = (value: string): ValueSlots => ({ '*': { '*': text(value) } });
const holder = (values: Record<string, ValueSlots>): CatalogValueHolder => ({ values, noValueReasons: {}, categoryIds: [] } as unknown as CatalogValueHolder);
const link = (values: Record<string, ValueSlots>): InheritanceLink => ({ id: 'p', kind: 'product', revision: 1, holder: holder(values) });

const NAMING = { label: 'Όνομα', identifier: 'FC-100' };
const indexOf = (values: Record<string, ValueSlots>, map = attributes(), target = family, naming = NAMING) =>
  catalogSearchIndexOf(resolveInheritedValues([link(values)], null), target, map, naming);

const finds = (index: ReturnType<typeof indexOf>, term: string): boolean => {
  const { seed, tokens } = catalogSearchPlan(term);
  return seed !== null && index.searchPrefixes.includes(seed) && matchesCatalogSearch(index.searchText, tokens);
};

describe('τι μπαίνει στο ευρετήριο', () => {
  it('κωδικός, ετικέτα και το όνομα της οικογένειας σε κάθε γλώσσα', () => {
    const index = indexOf({});
    expect(finds(index, 'FC-100')).toBe(true);
    expect(finds(index, 'όνομα')).toBe(true);
    expect(finds(index, 'fan coil')).toBe(true);
    expect(finds(index, 'ανεμιστηρα')).toBe(true);
  });

  it('🔴 κλειστή προεπιλογή: ιδιότητα χωρίς σημαία δεν μπαίνει', () => {
    expect(finds(indexOf({ [NOTE]: unscoped('Ξενοδοχείο') }, attributes({})), 'ξενοδοχειο')).toBe(false);
  });

  it('με σημαία μπαίνει, και μόνο αυτή', () => {
    const index = indexOf({ [NOTE]: unscoped('Ξενοδοχείο'), [TAG]: unscoped('Μυστικό') });
    expect(finds(index, 'ξενοδοχειο')).toBe(true);
    expect(finds(index, 'μυστικο')).toBe(false);
  });

  it('🔴 η τιμή του μοντέλου φτάνει στο SKU: κρίνονται οι συγχωνευμένες τιμές', () => {
    const scheme: VariantScheme = { code: 's', labels: {}, levels: [{ axisAttributeIds: [], attributeIds: [TAG] }] };
    const model: InheritanceLink = { id: 'm', kind: 'productModel', revision: 1, holder: holder({ [NOTE]: unscoped('Τετραπλή κασέτα') }) };
    const sku: InheritanceLink = { id: 'p', kind: 'product', revision: 1, holder: holder({ [TAG]: unscoped('Μικρή') }) };
    const index = catalogSearchIndexOf(resolveInheritedValues([model, sku], scheme), family, attributes(), NAMING);
    expect(finds(index, 'τετραπλη κασετα')).toBe(true);
  });

  it('🔴 όλες οι γλώσσες μιας localizable ιδιότητας', () => {
    const slots: ValueSlots = { '*': { el: text('Οροφής'), en: text('Ceiling') } };
    const index = indexOf({ [NOTE]: slots }, attributes({ searchable: true, localizable: true }));
    expect(finds(index, 'οροφησ')).toBe(true);
    expect(finds(index, 'ceiling')).toBe(true);
  });

  it('🔴 scopable δεν ευρετηριάζεται ποτέ, ακόμη κι αν η σημαία έμεινε γραμμένη', () => {
    const map = attributes({ searchable: true, scopable: true });
    expect(searchableAttributeIdsOf(family, map)).toEqual([]);
    expect(finds(indexOf({ [NOTE]: { print: { '*': text('Εκτύπωση') } } as ValueSlots }, map), 'εκτυπωση')).toBe(false);
  });

  it('🔴 τιμή σε θέση καναλιού δεν μπαίνει, ακόμη κι αν η ιδιότητα δεν είναι πια scopable', () => {
    const slots = { print: { '*': text('Εκτύπωση') }, '*': { '*': text('Κοινή') } } as ValueSlots;
    const index = indexOf({ [NOTE]: slots });
    expect(finds(index, 'κοινη')).toBe(true);
    expect(finds(index, 'εκτυπωση')).toBe(false);
  });

  it('🔴 η σειρά των γλωσσών στο έγγραφο δεν αλλάζει το ευρετήριο', () => {
    const map = attributes({ searchable: true, localizable: true });
    const first: ValueSlots = { '*': { el: text('Οροφής'), en: text('Ceiling') } };
    const second: ValueSlots = { '*': { en: text('Ceiling'), el: text('Οροφής') } };
    expect(indexOf({ [NOTE]: second }, map)).toEqual(indexOf({ [NOTE]: first }, map));
  });

  it('🔴 σημαία σε μη κειμενικό τύπο δεν ευρετηριάζεται', () => {
    const map = attributes({ searchable: true, type: 'richText', config: { maxLength: null } } as Partial<CatalogAttributeDefinition>);
    expect(searchableAttributeIdsOf(family, map)).toEqual([]);
  });

  it('ιδιότητα που λείπει από τη βιβλιοθήκη αγνοείται', () => {
    expect(searchableAttributeIdsOf(family, new Map())).toEqual([]);
  });
});

describe('🔴 ό,τι βρίσκει το πρόθεμα το δέχεται και η κρίση', () => {
  it('κάθε πρόθεμα ανήκει στο ίδιο κείμενο', () => {
    const { searchPrefixes, searchText } = indexOf({ [NOTE]: unscoped('Fan-coil δαπέδου 2 σωλήνων') });
    expect(searchPrefixes.length).toBeGreaterThan(0);
    for (const prefix of searchPrefixes) expect(matchesCatalogSearch(searchText, [prefix])).toBe(true);
  });

  it('ίδια είσοδος ⇒ ίδιο ευρετήριο: ο επανυπολογισμός δεν γράφει χωρίς λόγο', () => {
    const swapped: CatalogFamilyDefinition = { ...family, labels: { en: 'Fan coil', el: 'Μονάδα ανεμιστήρα' } };
    expect(indexOf({}, attributes(), swapped)).toEqual(indexOf({}));
  });

  it('ίδιο όνομα σε δύο γλώσσες γράφεται μία φορά', () => {
    const same: CatalogFamilyDefinition = { ...family, labels: { el: 'Fan coil', en: 'FAN COIL' } };
    expect(indexOf({}, attributes(), same).searchText).toBe('fc-100 ονομα fan coil');
  });
});

describe('όρια', () => {
  const words = (word: string, count: number): string => Array.from({ length: count }, () => word).join(' ');

  it('🔴 κοπή τιμής σε όριο λέξης: μισή λέξη δεν γίνεται πρόθεμα', () => {
    const index = indexOf({ [NOTE]: unscoped(`${words('αβγδ', 40)} τελος`) });
    expect(index.searchText).not.toContain('τελος');
    expect(index.searchText.split(' ').every((word) => word === 'αβγδ' || ['fc-100', 'ονομα', 'μοναδα', 'ανεμιστηρα', 'fan', 'coil'].includes(word))).toBe(true);
  });

  it('🔴 το όριο ανά τιμή: μακριά περιγραφή δεν στερεί χώρο από την επόμενη ιδιότητα', () => {
    const map = attributes({ searchable: true }, { searchable: true });
    const index = indexOf({ [NOTE]: unscoped(words('αβγδ', 200)), [TAG]: unscoped('Δεύτερη') }, map);
    expect(finds(index, 'δευτερη')).toBe(true);
    expect(index.searchText.length).toBeLessThanOrEqual(CATALOG_LIMITS.maxSearchTextLength);
  });

  it('🔴 ο κωδικός δεν εκτοπίζεται ποτέ από τις τιμές, ούτε από μακριά ετικέτα', () => {
    const index = indexOf({}, attributes(), family, { label: words('αβγδ', 200), identifier: 'FC-100' });
    expect(index.searchText.startsWith('fc-100 ')).toBe(true);
    expect(index.searchText.length).toBeLessThanOrEqual(CATALOG_LIMITS.maxSearchTextLength);
  });

  it('το συνολικό όριο τηρείται με πολλές ιδιότητες', () => {
    const many = Array.from({ length: 8 }, (_, index) => `a${index}`);
    const map = new Map(many.map((code) => [code, textAttribute(code, { searchable: true })]));
    const wide: CatalogFamilyDefinition = { ...family, attributes: many.map((attributeId) => ({ attributeId, requiredChannels: [] })) };
    const values = Object.fromEntries(many.map((code, index) => [code, unscoped(words(`τιμη${index}`, 30))]));
    expect(indexOf(values, map, wide).searchText.length).toBeLessThanOrEqual(CATALOG_LIMITS.maxSearchTextLength);
  });
});

describe('το αποτύπωμα σχήματος', () => {
  const hash = catalogSearchIndexHash(family, attributes());

  it('ίδιο σχήμα ⇒ φρέσκο · χωρίς αποτύπωμα ⇒ μπαγιάτικο', () => {
    expect(isSearchIndexStale(hash, family, attributes())).toBe(false);
    expect(isSearchIndexStale(null, family, attributes())).toBe(true);
  });

  it.each([
    ['όνομα οικογένειας', { ...family, labels: { el: 'Άλλο' } }, attributes()],
    ['ιδιότητα ονόματος', { ...family, labelAttributeId: TAG }, attributes()],
    ['σημαία σε άλλη ιδιότητα', family, attributes({}, { searchable: true })],
    ['σβήσιμο σημαίας', family, attributes({})],
  ])('🔴 αλλαγή: %s', (_name, nextFamily, nextAttributes) => {
    expect(isSearchIndexStale(hash, nextFamily, nextAttributes)).toBe(true);
  });

  it('🔴 περιγραφή οικογένειας δεν στέλνει προϊόντα σε επανυπολογισμό', () => {
    expect(isSearchIndexStale(hash, { ...family, description: { el: 'Νέα' } }, attributes())).toBe(false);
  });

  it('το MFP χωρίς σημαίες έχει μόνο το όνομα της οικογένειας', () => {
    expect(searchableAttributeIdsOf(MFP_FAMILY, MFP_ATTRIBUTE_MAP)).toEqual([]);
  });
});
