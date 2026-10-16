/**
 * ADR-915 Φ4γ — οι ΠΡΟΒΟΛΕΣ της σελίδας: πάνω στον ΕΝΑ ταξινομητή, με το `asOf` της απόκρισης. Συνθετικά δεδομένα.
 */

import {
  matchesRegistryFilter,
  REGISTRY_FILTERS,
  REGISTRY_ROW_STATES,
  registryRowIdOf,
  type RegistryRow,
} from '../document-registry';
import {
  documentExpiryHref,
  REGISTRY_PICKER_VIEWS,
  REGISTRY_VIEWS,
  toggledRegistryView,
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

describe('προβολή κατάστασης (η κάρτα σύνοψης ως φίλτρο)', () => {
  it('ΚΑΘΕ κατάσταση είναι προβολή — νέα κατάσταση χωρίς προβολή κοκκινίζει εδώ', () => {
    for (const state of REGISTRY_ROW_STATES) expect(registryViewOf(state)).toBe(state);
  });

  it.each(REGISTRY_ROW_STATES)('«%s» = ΑΚΡΙΒΩΣ οι γραμμές με αυτή την κατάσταση (ίδια πηγή με τον αριθμό της κάρτας)', (state) => {
    expect(ids(rowsOfRegistryView(rows, state, FIXTURE_AS_OF))).toEqual(ids(rows.filter((row) => row.state === state)));
  });

  it('τα τσιπ ΔΕΝ πολλαπλασιάζονται: ο επιλογέας κρατά «Όλα» + τα φίλτρα', () => {
    expect([...REGISTRY_PICKER_VIEWS]).toEqual(['all', ...REGISTRY_FILTERS]);
  });

  it('εναλλαγή: άλλη κάρτα ⇒ η προβολή της· η ίδια ⇒ «Όλα»', () => {
    expect(toggledRegistryView('all', 'expired')).toBe('expired');
    expect(toggledRegistryView('blocking', 'valid')).toBe('valid');
    expect(toggledRegistryView('expired', 'expired')).toBe('all');
    expect(toggledRegistryView('missing', 'missing')).toBe('all');
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
