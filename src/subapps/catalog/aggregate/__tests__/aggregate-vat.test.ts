/**
 * Ο καθαρός πυρήνας του φράκτη Χ4 στο σύνολο (ADR-923 §5.13 Σ6, 3ος γύρος ανασκόπησης): ποια SKU άλλαξαν **αλυσίδα κατηγοριών**
 * (και άρα χρειάζονται ανάγνωση κατηγοριών) και ποια άλλαξαν **ενεργό ΦΠΑ**. Η συνήθης εγγραφή (τιμές ιδιοτήτων) δεν πρέπει να
 * πληρώνει καμία ανάγνωση.
 */

import type { CategoryVatHolder } from '../../schema/category-vat';
import type { CatalogProductDefinition } from '../../types/product';
import type { CatalogAggregate, ProductMember } from '../aggregate-model';
import { aggregateVatShifts, chainCategoryIdsOf, skusWithChangedChains } from '../aggregate-vat';

const definition = (categoryIds: readonly string[], values: CatalogProductDefinition['values'] = {}): CatalogProductDefinition =>
  ({ modelId: null, familyId: 'fam', categoryIds, noValueReasons: {}, values, brand: null, gtin: null, mpn: null, noGtinReason: null });

// Το `derived` δεν το διαβάζει κανείς εδώ· το σχήμα του είναι της μηχανής παραγώγων.
const stored = (holder: CatalogProductDefinition): ProductMember['before'] =>
  ({ ...holder, revision: 1, derived: {} } as unknown as ProductMember['before']);

function sku(id: string, before: CatalogProductDefinition | null, after: CatalogProductDefinition | null): ProductMember {
  return { kind: 'product', id, before: before === null ? null : stored(before), after, revisionAfter: 2, changed: true };
}

const aggregateOf = (...members: ProductMember[]): CatalogAggregate => ({ rootId: null, members: new Map(members.map((member) => [member.id, member])) });

const byId = new Map<string, CategoryVatHolder>([
  ['food', { id: 'food', vatRate: 13, ancestorIds: [] }],
  ['tools', { id: 'tools', vatRate: 24, ancestorIds: [] }],
  ['bare', { id: 'bare', vatRate: null, ancestorIds: [] }],
]);

describe('skusWithChangedChains — καμία ανάγνωση όταν οι αλυσίδες μένουν ίδιες', () => {
  it('αλλαγή μόνο τιμών ιδιοτήτων ⇒ κανένα SKU · η ίδια λίστα με άλλη σειρά ⇒ κανένα', () => {
    const values = sku('p1', definition(['food', 'bare']), definition(['bare', 'food'], { attr: [] }));
    expect(skusWithChangedChains(aggregateOf(values))).toEqual([]);
    expect(chainCategoryIdsOf(aggregateOf(values), [])).toEqual([]);
  });

  it('νέο ή διαγραμμένο SKU δεν κρίνεται · αλλαγή κατηγοριών ⇒ το SKU και οι κατηγορίες των δύο πλευρών', () => {
    const moved = sku('p1', definition(['food']), definition(['tools']));
    const aggregate = aggregateOf(moved, sku('p2', null, definition(['tools'])), sku('p3', definition(['food']), null));
    expect(skusWithChangedChains(aggregate)).toEqual(['p1']);
    expect([...chainCategoryIdsOf(aggregate, ['p1'])].sort()).toEqual(['food', 'tools']);
  });
});

describe('aggregateVatShifts — ο ενεργός ΦΠΑ, όχι το αν γράφτηκε κατηγορία', () => {
  it('13 → 24 μετατοπίζεται · 13 → 13 (άλλη κατηγορία, ίδιος ενεργός) όχι · αδήλωτο → αδήλωτο όχι', () => {
    const aggregate = aggregateOf(
      sku('shift', definition(['food']), definition(['tools'])),
      sku('same', definition(['food']), definition(['food', 'bare'])),
      sku('none', definition(['bare']), definition([])),
    );
    expect(aggregateVatShifts(aggregate, byId)).toEqual(['shift']);
  });
});
