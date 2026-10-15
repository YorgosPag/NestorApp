/**
 * ADR-915 Φ4γ — οι ΠΡΟΒΟΛΕΣ της σελίδας: πάνω στον ΕΝΑ ταξινομητή, με το `asOf` της απόκρισης. Συνθετικά δεδομένα.
 */

import { matchesRegistryFilter, REGISTRY_FILTERS, registryRowIdOf, type RegistryRow } from '../document-registry';
import {
  documentExpiryHref,
  REGISTRY_VIEWS,
  registryViewOf,
  registryViewTally,
  rowsOfRegistryView,
} from '../document-registry-view';
import { DOCUMENT_EXPIRY_ROUTE } from '../document-registry-routes';
import { FIXTURE_AS_OF, fixtureResponse } from './registry-fixture';

const { rows } = fixtureResponse();
const ids = (list: readonly RegistryRow[]): string[] => list.map(registryRowIdOf);

describe('κάθε προβολή = ΑΚΡΙΒΩΣ ό,τι λέει ο `matchesRegistryFilter` (κανένας δεύτερος ταξινομητής)', () => {
  it.each(REGISTRY_FILTERS)('%s', (filter) => {
    const expected = rows.filter((row) => matchesRegistryFilter(row, filter, FIXTURE_AS_OF));
    expect(ids(rowsOfRegistryView(rows, filter, FIXTURE_AS_OF))).toEqual(ids(expected));
  });

  it('το fixture δεν είναι τετριμμένο: κάθε φίλτρο έχει τουλάχιστον μία γραμμή', () => {
    const tally = registryViewTally(rows, FIXTURE_AS_OF);
    for (const filter of REGISTRY_FILTERS) expect(tally[filter]).toBeGreaterThan(0);
  });

  it('«Όλα» = όλες οι γραμμές, και οι αντικατεστημένες, στη σειρά του διακομιστή', () => {
    expect(ids(rowsOfRegistryView(rows, 'all', FIXTURE_AS_OF))).toEqual(ids(rows));
  });

  it('η αντικατεστημένη γραμμή δεν εμφανίζεται σε ΚΑΝΕΝΑ φίλτρο', () => {
    for (const filter of REGISTRY_FILTERS) {
      expect(ids(rowsOfRegistryView(rows, filter, FIXTURE_AS_OF))).not.toContain('f-old');
    }
  });

  it('η «σήμερα» είναι το `asOf` που δίνεται, όχι το ρολόι: άλλη μέρα ⇒ άλλο παράθυρο', () => {
    const later = '2027-06-01';
    const withinNow = ids(rowsOfRegistryView(rows, 'within-window', FIXTURE_AS_OF));
    const withinLater = ids(rowsOfRegistryView(rows, 'within-window', later));
    expect(withinLater).toEqual(ids(rows.filter((row) => matchesRegistryFilter(row, 'within-window', later))));
    expect(withinLater).not.toEqual(withinNow);
  });
});

describe('μετρητής ανά προβολή', () => {
  it('έχει ΚΑΘΕ προβολή, και τις μηδενικές', () => {
    const empty = registryViewTally([], FIXTURE_AS_OF);
    expect(Object.keys(empty).sort()).toEqual([...REGISTRY_VIEWS].sort());
    expect(Object.values(empty).every((count) => count === 0)).toBe(true);
  });

  it('ισούται με το μήκος της προβολής', () => {
    const tally = registryViewTally(rows, FIXTURE_AS_OF);
    for (const view of REGISTRY_VIEWS) expect(tally[view]).toBe(rowsOfRegistryView(rows, view, FIXTURE_AS_OF).length);
  });
});

describe('η προβολή στη διεύθυνση', () => {
  it('ανεκτικός αναγνώστης: άγνωστη/κενή ⇒ «Όλα»', () => {
    expect(registryViewOf(null)).toBe('all');
    expect(registryViewOf('')).toBe('all');
    expect(registryViewOf('expired-everything')).toBe('all');
    expect(registryViewOf('blocking')).toBe('blocking');
  });

  it('το «Όλα» δεν γράφει παράμετρο· τα φίλτρα γράφουν `?view=`', () => {
    expect(documentExpiryHref()).toBe(DOCUMENT_EXPIRY_ROUTE);
    expect(documentExpiryHref('all')).toBe(DOCUMENT_EXPIRY_ROUTE);
    expect(documentExpiryHref('blocking')).toBe(`${DOCUMENT_EXPIRY_ROUTE}?view=blocking`);
  });

  it('κάθε διεύθυνση διαβάζεται πίσω στην ίδια προβολή', () => {
    for (const view of REGISTRY_VIEWS) {
      const param = new URL(documentExpiryHref(view), 'https://synthetic.invalid').searchParams.get('view');
      expect(registryViewOf(param)).toBe(view);
    }
  });
});
