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
  blockersOf,
  blockingDayOf,
  documentExpiryHref,
  needsRegistryAction,
  REGISTRY_PICKER_VIEWS,
  REGISTRY_VIEWS,
  registryGroupingOf,
  registryRowOfDocParam,
  registryTabOf,
  registryTabTally,
  rowsOfActionTab,
  toggledRegistryView,
  registryViewOf,
  registryViewTally,
  rowsOfRegistryView,
  undeterminedBlockersOf,
} from '../document-registry-view';
import { DOCUMENT_EXPIRY_ROUTE } from '../document-registry-routes';
import type { DocumentRequirement } from '../document-requirement';
import { issuanceKeyOf } from '../issuance-assignment';
import { FIXTURE_AS_OF, FIXTURE_DOCUMENTS, fixtureResponse } from './registry-fixture';

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

// =============================================================================
// ADR-915 §41.5 — καρτέλες · «Χρειάζονται ενέργεια» · `?doc=`
// =============================================================================

const paramsOf = (href: string): URLSearchParams => new URL(href, 'https://synthetic.invalid').searchParams;

describe('§41.5 η καρτέλα στη διεύθυνση — και οι παλιοί σύνδεσμοι προσγειώνονται εκεί που έδειχναν', () => {
  it('ρητή έγκυρη καρτέλα κερδίζει· καμία ⇒ «Χρειάζονται ενέργεια»', () => {
    expect(registryTabOf(null, null)).toBe('action');
    expect(registryTabOf('decisions', 'blocking')).toBe('decisions');
    expect(registryTabOf('no-such-tab', null)).toBe('action');
  });

  it('`?view=` χωρίς καρτέλα (ειδοποίηση Φ5) ⇒ «Όλα»· άγνωστη προβολή ⇒ προεπιλογή', () => {
    expect(registryTabOf(null, 'blocking')).toBe('all');
    expect(registryTabOf(null, 'expired')).toBe('all');
    expect(registryTabOf(null, 'no-such-view')).toBe('action');
  });

  it('η διεύθυνση γράφει μόνο ό,τι δεν θα έβγαζε μόνη της', () => {
    expect(documentExpiryHref('all', { tab: 'action' })).toBe(DOCUMENT_EXPIRY_ROUTE);
    expect(paramsOf(documentExpiryHref('blocking', { tab: 'all' })).has('tab')).toBe(false);
    expect(paramsOf(documentExpiryHref('all', { tab: 'decisions' })).get('tab')).toBe('decisions');
    expect(paramsOf(documentExpiryHref(undefined, { doc: 'missing:p6:energy-certificate' })).get('doc')).toBe('missing:p6:energy-certificate');
  });

  it('ομαδοποίηση: ανεκτικός αναγνώστης', () => {
    expect(registryGroupingOf(null)).toBe('state');
    expect(registryGroupingOf('property')).toBe('property');
    expect(registryGroupingOf('colour')).toBe('state');
  });
});

describe('§41.5 «Χρειάζονται ενέργεια» — κατά το ΠΟΤΕ ΜΠΛΟΚΑΡΕΙ, όχι κατά λήξη', () => {
  it('μέλη: έληξε · λήγει · λείπει-και-μπλοκάρει — όχι το «λείπει» που δεν μπλοκάρει (αγγελία `warn`), όχι έγκυρο/αντικατεστημένο', () => {
    const shown = ids(rowsOfActionTab(rows, FIXTURE_AS_OF));
    expect(shown).toContain('missing:p6:energy-certificate');
    expect(shown).not.toContain('missing:ownp_7:energy-certificate');
    expect(shown).not.toContain('f-valid');
    expect(shown).not.toContain('f-old');
    expect([...shown].sort()).toEqual(ids(rows.filter(needsRegistryAction)).sort());
  });

  it('σειρά: μπλοκάρει ήδη (κενό p6) · μπλοκάρει στις 2027-03-01 (υπογραφή p2) · μετά όσα δεν μπλοκάρουν, στη σειρά του διακομιστή', () => {
    expect(ids(rowsOfActionTab(rows, FIXTURE_AS_OF))).toEqual(['missing:p6:energy-certificate', 'f-expiring', 'f-expired', 'f-soon']);
  });

  it('μέρα μπλοκαρίσματος: λείπει ⇒ σήμερα · υπογραφή ⇒ η μέρα της · τίποτα ⇒ `null` · ίδιο κριτήριο με τον πυρήνα', () => {
    const byId = (id: string) => rows.find((row) => registryRowIdOf(row) === id)!;
    expect(blockingDayOf(byId('missing:p6:energy-certificate'), FIXTURE_AS_OF)).toBe(FIXTURE_AS_OF);
    expect(blockingDayOf(byId('f-expiring'), FIXTURE_AS_OF)).toBe('2027-03-01');
    expect(blockingDayOf(byId('f-valid'), FIXTURE_AS_OF)).toBeNull();
    for (const row of rows) expect(blockingDayOf(row, FIXTURE_AS_OF) !== null).toBe(row.blocking);
  });

  it('μετρητής καρτελών από τις ΙΔΙΕΣ γραμμές', () => {
    expect(registryTabTally(rows, 3)).toEqual({ action: rowsOfActionTab(rows, FIXTURE_AS_OF).length, all: rows.length, decisions: 3 });
  });
});

describe('§43 — ΤΙ μπλοκάρει · άγνωστη λήξη που θέλει προσοχή', () => {
  const byId = (list: readonly RegistryRow[], id: string) => list.find((row) => registryRowIdOf(row) === id)!;
  const unknownBlocked: DocumentRequirement = {
    documentKind: 'energy-certificate', subject: { propertyId: 'p3', party: null }, process: { kind: 'conveyance', caseId: 'case-k' },
    neededOn: { kind: 'on', day: '2027-03-01' }, policy: 'block', warnWindowDays: 15,
    basis: { kind: 'checklist-item', itemId: 'energy_certificate', verifiedAt: null }, presence: 'required', attestation: null,
  };

  it('`blockersOf`: οι διαδικασίες με τη μέρα τους · το `blockingDayOf` είναι η ΝΩΡΙΤΕΡΗ τους (μία πηγή)', () => {
    const expiring = blockersOf(byId(rows, 'f-expiring'), FIXTURE_AS_OF);
    expect(expiring.map(({ dependent, day }) => [dependent.requirement.process.kind, day])).toEqual([['conveyance', '2027-03-01']]);
    for (const row of rows) expect(blockingDayOf(row, FIXTURE_AS_OF)).toBe(blockersOf(row, FIXTURE_AS_OF)[0]?.day ?? null);
    expect(blockersOf(byId(rows, 'f-valid'), FIXTURE_AS_OF)).toEqual([]);
  });

  it('άγνωστη λήξη χωρίς διαδικασία `block` ⇒ ΟΧΙ στο «Χρειάζονται ενέργεια» (κανείς δεν περιμένει)', () => {
    expect(undeterminedBlockersOf(byId(rows, 'f-unknown'))).toEqual([]);
    expect(needsRegistryAction(byId(rows, 'f-unknown'))).toBe(false);
  });

  it('άγνωστη λήξη που τη ζητά διαδικασία `block` ⇒ θέλει ενέργεια, αλλά ΔΕΝ «μπλοκάρει» (η μεταβίβαση τη δέχεται)', () => {
    const local = fixtureResponse({}, FIXTURE_DOCUMENTS, [unknownBlocked]).rows;
    const unknown = byId(local, 'f-unknown');
    expect(undeterminedBlockersOf(unknown).map((d) => d.requirement.process)).toEqual([{ kind: 'conveyance', caseId: 'case-k' }]);
    expect(needsRegistryAction(unknown)).toBe(true);
    expect(unknown.blocking).toBe(false);
    expect(blockingDayOf(unknown, FIXTURE_AS_OF)).toBeNull();
    // Μετά όσα μπλοκάρουν (`null` μέρα ⇒ στο τέλος) — και ο μετρητής τη μετρά.
    expect(ids(rowsOfActionTab(local, FIXTURE_AS_OF))).toContain('f-unknown');
    expect(registryTabTally(local, 0).action).toBe(rowsOfActionTab(local, FIXTURE_AS_OF).length);
  });

  it('`warn` δεν αρκεί: άγνωστη λήξη που τη ζητά μόνο αγγελία `warn` ⇒ καμία ενέργεια', () => {
    const warnOnly: DocumentRequirement = { ...unknownBlocked, policy: 'warn' };
    const unknown = byId(fixtureResponse({}, FIXTURE_DOCUMENTS, [warnOnly]).rows, 'f-unknown');
    expect(needsRegistryAction(unknown)).toBe(false);
  });
});

describe('§41.5 `?doc=` — ταυτότητα γραμμής ή κλειδί υποκειμένου', () => {
  it('ταυτότητα γραμμής ⇒ αυτή η γραμμή (και η αντικατεστημένη)', () => {
    expect(registryRowOfDocParam(rows, 'f-old')?.state).toBe('superseded');
    expect(registryRowOfDocParam(rows, 'missing:p6:energy-certificate')?.kind).toBe('gap');
  });

  it('κλειδί υποκειμένου ⇒ η ΤΡΕΧΟΥΣΑ γραμμή: ληγμένο έγγραφο ή κενό — ποτέ η αντικατεστημένη', () => {
    expect(registryRowIdOf(registryRowOfDocParam(rows, issuanceKeyOf('p1', 'energy-certificate'))!)).toBe('f-expired');
    expect(registryRowIdOf(registryRowOfDocParam(rows, issuanceKeyOf('p6', 'energy-certificate'))!)).toBe('missing:p6:energy-certificate');
    expect(registryRowIdOf(registryRowOfDocParam(rows, issuanceKeyOf('p4', 'energy-certificate'))!)).toBe('f-valid');
  });

  it('άγνωστο ή κενό ⇒ `null` (το πάνελ μένει κλειστό)', () => {
    expect(registryRowOfDocParam(rows, 'f-nowhere')).toBeNull();
    expect(registryRowOfDocParam(rows, '')).toBeNull();
    expect(registryRowOfDocParam(rows, null)).toBeNull();
  });
});
