/**
 * ADR-923 §5.11 «3η» — εναλλαγή facets «σε λίστα»: πολλές τιμές ανά ιδιότητα, χωρίς άδεια ομάδα που θα απέκλειε τα πάντα.
 */
import type { FacetGroup } from '../product-facets';
import { isFacetSelected, toggleFacet } from '../product-facets';

const group = (attributeId: string, codes: readonly string[]): FacetGroup => ({
  attributeId,
  code: attributeId,
  labels: {} as FacetGroup['labels'],
  values: codes.map((code) => ({ kind: 'option' as const, key: `${attributeId}=${code}`, code, labels: {} as FacetGroup['labels'] })),
});

const height = group('h', ['1', '2']);
const colour = group('c', ['x']);

describe('toggleFacet', () => {
  it('δεύτερη τιμή της ίδιας ιδιότητας μπαίνει στην ΙΔΙΑ ομάδα (OR)', () => {
    expect(toggleFacet([['h=1']], height, 'h=2')).toEqual([['h=1', 'h=2']]);
  });

  it('άλλη ιδιότητα ανοίγει νέα ομάδα (AND)', () => {
    expect(toggleFacet([['h=1']], colour, 'c=x')).toEqual([['h=1'], ['c=x']]);
  });

  it('🔴 η τελευταία τιμή που βγαίνει παίρνει μαζί και την ομάδα', () => {
    expect(toggleFacet([['h=1'], ['c=x']], height, 'h=1')).toEqual([['c=x']]);
  });

  it('isFacetSelected κοιτά όλες τις ομάδες', () => {
    expect(isFacetSelected([['h=1'], ['c=x']], 'c=x')).toBe(true);
    expect(isFacetSelected([['h=1']], 'c=x')).toBe(false);
  });
});
