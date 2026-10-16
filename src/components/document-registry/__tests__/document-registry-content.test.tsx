/**
 * @fileoverview ADR-915 Φ4γ — **η σελίδα «Λήξεις εγγράφων»**, όπως τη βλέπει ο άνθρωπος. Συνθετικά δεδομένα μόνο.
 *
 * 🔴 **Διαβάζει ΑΠΟΔΟΣΗ**: αποδίδεται το δέντρο και ελέγχεται τι γράφει η οθόνη — όχι ποιες συναρτήσεις κλήθηκαν.
 * 🔑 Οι γραμμές βγαίνουν από τον **αληθινό** πυρήνα (`registry-fixture`)· οι προσδοκίες των προβολών ρωτούν τον ΙΔΙΟ
 *    `matchesRegistryFilter`, ώστε ένας δεύτερος ταξινομητής στην οθόνη να **κοκκινίζει** εδώ.
 * 🔑 Το `t` επιστρέφει το κλειδί (+ τις παραμέτρους): η δοκιμή ρωτά «ποιο μήνυμα διάλεξε η οθόνη;».
 */

import { fireEvent, render, screen, within } from '@testing-library/react';
import React from 'react';

import { DocumentRegistryContent } from '../DocumentRegistryContent';
import {
  REGISTRY_KEYS,
  REGISTRY_STATE_LABEL_KEYS,
  REGISTRY_STATE_LOOK,
  TRUNCATED_SOURCE_KEYS,
} from '../document-registry-labels';
import {
  matchesRegistryFilter,
  REGISTRY_FILTERS,
  REGISTRY_ROW_STATES,
  registryRowIdOf,
  type RegistryRow,
} from '@/lib/document-validity/document-registry';
import type { DocumentRequirement } from '@/lib/document-validity/document-requirement';
import { mandateDetailHref } from '@/lib/mandate/mandate-routes';
import { listingDetailHref } from '@/lib/listings/listing-routes';
import { ENTITY_ROUTES } from '@/lib/routes/entityRoutes';
import type { DocumentRegistryState } from '@/hooks/document-registry/useDocumentRegistry';
import {
  FIXTURE_AS_OF,
  FIXTURE_DOCUMENTS,
  fixtureResponse,
} from '@/lib/document-validity/__tests__/registry-fixture';

const registryState = jest.fn<{ view: DocumentRegistryState; reload: () => void }, []>();
jest.mock('@/hooks/document-registry/useDocumentRegistry', () => ({
  useDocumentRegistry: () => registryState(),
}));

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
  }),
}));

const replace = jest.fn();
jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  useRouter: () => ({ replace }),
}));

let searchParams = new URLSearchParams();
jest.mock('next/navigation', () => ({ useSearchParams: () => searchParams }));

// Η κάρτα αποδίδεται ως τίτλος + τιμή + τόνος, και ως εναλλαγή: εδώ ελέγχεται ΤΙ δείχνει και ΤΙ κάνει, όχι το στυλ.
jest.mock('@/components/property-management/dashboard/StatsCard', () => ({
  StatsCard: ({ title, value, color, onClick, pressed }: {
    title: string; value: number; color: string; onClick?: () => void; pressed?: boolean;
  }) => (
    <button type="button" data-testid="tally-card" data-title={title} aria-pressed={pressed} onClick={onClick}>
      {`${title}=${value}:${color}`}
    </button>
  ),
}));

const reload = jest.fn();

/** Ταυτότητα κτιρίου που ζητά μεταβίβαση στο `p1` — συνθετική. */
const FIXTURE_REQUIREMENT_P1_IDENTITY: DocumentRequirement = {
  documentKind: 'building-identity', subject: { propertyId: 'p1' }, process: { kind: 'conveyance', caseId: 'case-9' },
  neededOn: { kind: 'unscheduled' }, policy: 'block', warnWindowDays: 15,
  basis: { kind: 'checklist-item', itemId: 'building_identity', verifiedAt: null }, presence: 'required', attestation: null,
};

function renderReady(response = fixtureResponse(), view?: string): void {
  searchParams = new URLSearchParams(view ? { view } : {});
  registryState.mockReturnValue({ view: { state: 'ready', registry: response }, reload });
  render(<DocumentRegistryContent />);
}

/** Το κείμενο που ΜΟΝΟ αυτή η γραμμή έχει: όνομα αρχείου για έγγραφο · όνομα ακινήτου για κενό (Φ4δ). */
function signatureOf(row: RegistryRow, response = fixtureResponse()): string {
  if (row.kind === 'gap') return response.properties[row.gap.propertyId]?.name ?? '?';
  return response.files[row.document.id]?.name ?? REGISTRY_KEYS.fileUnnamed;
}

/** Οι γραμμές που δείχνει η οθόνη, με τη σειρά τους (κάθε γραμμή είναι `<article>`). */
const shownArticles = () => screen.queryAllByRole('article');
const shownFiles = (): string[] => {
  const { rows } = fixtureResponse();
  return shownArticles().map((article) => {
    const row = rows.find((candidate) => within(article).queryByText(signatureOf(candidate)) !== null);
    return row === undefined ? '?' : registryRowIdOf(row);
  });
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('κάρτες σύνοψης', () => {
  it('μία κάρτα ανά κατάσταση, ΚΑΙ οι μηδενικές, με τιμή από το `tally` του διακομιστή', () => {
    const onlyValid = fixtureResponse({}, FIXTURE_DOCUMENTS.filter((document) => document.id === 'f-valid'));
    renderReady(onlyValid);
    const cards = screen.getAllByTestId('tally-card').map((card) => card.textContent);
    expect(cards).toEqual(REGISTRY_ROW_STATES.map((state) =>
      `${REGISTRY_STATE_LABEL_KEYS[state]}=${onlyValid.tally[state]}:${onlyValid.tally[state] === 0 ? 'gray' : REGISTRY_STATE_LOOK[state].tone}`));
    expect(onlyValid.tally.valid).toBe(1);
    expect(onlyValid.tally.expired).toBe(0);
  });
});

describe('προβολές — ΑΚΡΙΒΩΣ ό,τι λέει ο ΕΝΑΣ ταξινομητής', () => {
  it.each(REGISTRY_FILTERS)('%s', (filter) => {
    const response = fixtureResponse();
    renderReady(response, filter);
    const expected = response.rows.filter((row) => matchesRegistryFilter(row, filter, response.asOf)).map(registryRowIdOf);
    expect(shownFiles().sort()).toEqual([...expected].sort());
    expect(shownFiles()).not.toContain('f-old');
  });

  it('«Όλα» δείχνει και την αντικατεστημένη, με το ποιο την αντικατέστησε', () => {
    renderReady();
    expect(shownFiles().sort()).toEqual(fixtureResponse().rows.map(registryRowIdOf).sort());
    expect(shownFiles()).not.toContain('?');
    expect(screen.getByText(`${REGISTRY_KEYS.supersededBy} ${JSON.stringify({ name: 'synthetic-new.pdf' })}`)).toBeTruthy();
  });

  it('άγνωστη παράμετρος ⇒ «Όλα» (ο παλιός σύνδεσμος δεν σπάει)', () => {
    renderReady(fixtureResponse(), 'no-such-view');
    expect(shownArticles()).toHaveLength(fixtureResponse().rows.length);
  });

  it('η επιλογή προβολής αλλάζει τη διεύθυνση με `replace`', () => {
    renderReady();
    fireEvent.click(screen.getByRole('radio', { name: new RegExp(REGISTRY_KEYS.filterOption.replace('.', '\\.') + '.*blocking') }));
    expect(replace).toHaveBeenCalledWith('/document-expiry?view=blocking', { scroll: false });
  });
});

describe('κάρτα = φίλτρο κατάστασης', () => {
  const card = (state: (typeof REGISTRY_ROW_STATES)[number]): HTMLElement =>
    screen.getAllByTestId('tally-card').find((element) => element.dataset.title === REGISTRY_STATE_LABEL_KEYS[state])!;

  it.each(REGISTRY_ROW_STATES)('η κάρτα «%s» ανοίγει την προβολή της με `replace`', (state) => {
    renderReady();
    fireEvent.click(card(state));
    expect(replace).toHaveBeenCalledWith(`/document-expiry?view=${state}`, { scroll: false });
  });

  it.each(REGISTRY_ROW_STATES)('προβολή «%s» ⇒ η κάρτα της πατημένη, οι γραμμές = ΑΚΡΙΒΩΣ της κατάστασης', (state) => {
    renderReady(fixtureResponse(), state);
    for (const other of REGISTRY_ROW_STATES) {
      expect(card(other).getAttribute('aria-pressed')).toBe(String(other === state));
    }
    const expected = fixtureResponse().rows.filter((row) => row.state === state).map(registryRowIdOf);
    expect(shownFiles().sort()).toEqual(expected.sort());
  });

  it('ξαναπατημένη κάρτα ⇒ «Όλα» (χωρίς παράμετρο)', () => {
    renderReady(fixtureResponse(), 'expired');
    fireEvent.click(card('expired'));
    expect(replace).toHaveBeenCalledWith('/document-expiry', { scroll: false });
  });

  it('ο αριθμός της κάρτας = οι γραμμές που ανοίγει (η ίδια πηγή: η κατάσταση του διακομιστή)', () => {
    const response = fixtureResponse();
    for (const state of REGISTRY_ROW_STATES) {
      expect(response.rows.filter((row) => row.state === state)).toHaveLength(response.tally[state]);
    }
  });
});

describe('γραμμή', () => {
  const articleOf = (fileName: string) => screen.getByText(fileName).closest('article') as HTMLElement;

  it('η κατάσταση διαβάζεται χωρίς χρώμα: λέξη σε κάθε γραμμή', () => {
    const response = fixtureResponse();
    renderReady(response);
    for (const row of response.rows) {
      expect(within(articleOf(signatureOf(row, response))).getByText(REGISTRY_STATE_LABEL_KEYS[row.state])).toBeTruthy();
    }
  });

  // ⚠️ `asOf` ΔΙΑΦΟΡΕΤΙΚΟ από κάθε πιθανό «σήμερα» του υπολογιστή: με το `asOf` του fixture (που μπορεί να συμπέσει με
  //    την ημερομηνία εκτέλεσης) μια οθόνη που μετρά με το ρολόι θα περνούσε — μετρημένο στη μετάλλαξη.
  it('«σε N ημέρες» μετρά από το `asOf` της απόκρισης, ποτέ από το ρολόι (λήξη 2026-12-01, asOf 2000-11-01)', () => {
    renderReady(fixtureResponse({ asOf: '2000-11-01' }));
    const days = `${REGISTRY_KEYS.daysLeft} ${JSON.stringify({ count: 9526 })}`;
    expect(within(articleOf('synthetic-expiring.pdf')).getByText(days, { exact: false })).toBeTruthy();
  });

  it('η ασυμφωνία της Α4 φαίνεται στη γραμμή', () => {
    renderReady();
    expect(within(articleOf('synthetic-new.pdf')).getByText(new RegExp(REGISTRY_KEYS.discrepancy.replace('.', '\\.')))).toBeTruthy();
  });

  it('«τι σταματά»: μεταβίβαση ⇒ ακίνητο + «μπλοκάρει τώρα»· αγγελία ⇒ σελίδα αγγελίας, χωρίς μπλοκάρισμα', () => {
    renderReady();
    const blocking = articleOf('synthetic-expiring.pdf');
    expect(within(blocking).getByText(REGISTRY_KEYS.blockingNow)).toBeTruthy();
    expect(within(blocking).getByText(REGISTRY_KEYS.openProperty).getAttribute('href')).toBe(ENTITY_ROUTES.properties.withId('p2'));
    const listed = articleOf('synthetic-new.pdf');
    expect(within(listed).queryByText(REGISTRY_KEYS.blockingNow)).toBeNull();
    expect(within(listed).getByText(REGISTRY_KEYS.openListing).getAttribute('href')).toBe(listingDetailHref('p4'));
  });

  it('χωρίς όνομα ⇒ ρητή λέξη, ποτέ ωμή ταυτότητα', () => {
    renderReady();
    const unknown = articleOf(REGISTRY_KEYS.fileUnnamed);
    expect(within(unknown).getByText(REGISTRY_KEYS.propertyUnnamed)).toBeTruthy();
    expect(within(unknown).queryByText('f-unknown')).toBeNull();
  });
});

describe('Φ4δ — ό,τι ΛΕΙΠΕΙ', () => {
  const articleWith = (text: string) => screen.getByText(text).closest('article') as HTMLElement;
  const withParams = (key: string, params: Record<string, unknown>) => `${key} ${JSON.stringify(params)}`;

  it('κενό σε ακίνητο εταιρείας: «λείπει» · «ποιος το ζητά» · μπλοκάρει · δρόμος στα έγγραφα του ακινήτου', () => {
    renderReady();
    const gap = articleWith('Συνθετικό Ζ6');
    expect(within(gap).getByText(REGISTRY_STATE_LABEL_KEYS.missing)).toBeTruthy();
    expect(within(gap).getByText(REGISTRY_KEYS.missingDocument)).toBeTruthy();
    expect(within(gap).getByText(REGISTRY_KEYS.missingHeading)).toBeTruthy();
    expect(within(gap).queryByText(REGISTRY_KEYS.dependentsHeading)).toBeNull();
    expect(within(gap).getByText(REGISTRY_KEYS.blockingNow)).toBeTruthy();
    expect(within(gap).getByText('document-registry:dependents.absent')).toBeTruthy();
    expect(within(gap).getByText(REGISTRY_KEYS.openDocuments).getAttribute('href')).toBe(ENTITY_ROUTES.properties.withTab('p6', 'documents'));
  });

  it('κενό σε αγγελία εντολής (Ε10): ΕΝΑΣ σύνδεσμος, προς την ΕΝΤΟΛΗ — όχι προς ακίνητο εταιρείας · `warn` δεν μπλοκάρει', () => {
    renderReady();
    const gap = articleWith('Συνθετική εντολή Η7');
    expect(within(gap).getByText('Συνθετική εντολή Η7').getAttribute('href')).toBe(mandateDetailHref('ownp_7'));
    expect(within(gap).queryByText(REGISTRY_KEYS.openDocuments)).toBeNull();
    expect(within(gap).queryByText(REGISTRY_KEYS.blockingNow)).toBeNull();
  });

  it('έγκριση ελέγχου χωρίς αρχείο (Ε8) ⇒ γραμμή με ρητή λέξη, όχι «λείπει»', () => {
    const attested = { ...FIXTURE_REQUIREMENT_P1_IDENTITY, attestation: { fileId: null, issuedOn: '2026-09-01', printedValidUntil: null } };
    renderReady(fixtureResponse({}, [], [attested]));
    expect(screen.getByText(REGISTRY_KEYS.attested)).toBeTruthy();
    expect(screen.queryByText(REGISTRY_STATE_LABEL_KEYS.missing)).toBeNull();
  });

  it('το όριο έχει ΑΡΙΘΜΟ: αγγελίες με το όνομα του γραφείου εκτός θεματοφυλακής', () => {
    renderReady(fixtureResponse({ unscopedListings: 3 }));
    expect(screen.getByText(withParams(REGISTRY_KEYS.unscopedListings, { count: 3 }))).toBeTruthy();
  });

  it('`truncated` ονομάζει και τις νέες πηγές (εντολές · αγγελίες)', () => {
    renderReady(fixtureResponse({ truncated: true, truncatedSources: ['owner-properties', 'listings'] }));
    const body = screen.getByText(new RegExp(REGISTRY_KEYS.truncatedBody.replace('.', '\\.'))).textContent ?? '';
    expect(body).toContain(TRUNCATED_SOURCE_KEYS['owner-properties']);
    expect(body).toContain(TRUNCATED_SOURCE_KEYS.listings);
  });
});

describe('ειλικρίνεια της οθόνης', () => {
  it('`truncated` ⇒ ορατή ειδοποίηση που ονομάζει τις πηγές', () => {
    renderReady(fixtureResponse({ truncated: true, truncatedSources: ['files', 'cases'] }));
    expect(screen.getByText(REGISTRY_KEYS.truncatedTitle)).toBeTruthy();
    const body = screen.getByText(new RegExp(REGISTRY_KEYS.truncatedBody.replace('.', '\\.'))).textContent ?? '';
    expect(body).toContain(TRUNCATED_SOURCE_KEYS.files);
    expect(body).toContain(TRUNCATED_SOURCE_KEYS.cases);
  });

  it('χωρίς `truncated` ⇒ καμία ειδοποίηση', () => {
    renderReady();
    expect(screen.queryByText(REGISTRY_KEYS.truncatedTitle)).toBeNull();
  });

  it('κενό μητρώο ⇒ κενή κατάσταση με δρόμο προς τα ακίνητα — και οι κάρτες μένουν (μηδενικές)', () => {
    renderReady(fixtureResponse({}, [], []));
    expect(screen.getByText(REGISTRY_KEYS.emptyTitle)).toBeTruthy();
    expect(screen.getByText(REGISTRY_KEYS.emptyAction).getAttribute('href')).toBe(ENTITY_ROUTES.properties.list);
    expect(screen.getAllByTestId('tally-card')).toHaveLength(REGISTRY_ROW_STATES.length);
  });

  it('τα όρια Δ2/Δ3 λέγονται πάντα', () => {
    renderReady();
    expect(screen.getByText(REGISTRY_KEYS.scopeNote)).toBeTruthy();
  });

  it('η κεφαλίδα δείχνει το `asOf` της απόκρισης', () => {
    renderReady();
    expect(screen.getByText(new RegExp(REGISTRY_KEYS.asOf.replace('.', '\\.'))).closest('time')?.getAttribute('dateTime')).toBe(FIXTURE_AS_OF);
  });

  it('αποτυχία ⇒ μήνυμα ΚΑΙ κουμπί που ξαναρωτά', () => {
    registryState.mockReturnValue({ view: { state: 'failed' }, reload });
    render(<DocumentRegistryContent />);
    fireEvent.click(screen.getByRole('button', { name: REGISTRY_KEYS.retry }));
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('φόρτωση ⇒ «φορτώνει», καμία κάρτα', () => {
    registryState.mockReturnValue({ view: { state: 'loading' }, reload });
    render(<DocumentRegistryContent />);
    expect(screen.getByText(REGISTRY_KEYS.loading)).toBeTruthy();
    expect(screen.queryAllByTestId('tally-card')).toHaveLength(0);
  });
});
