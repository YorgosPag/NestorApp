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
import { RegistryIssuerValue } from '../RegistryIssuerValue';
import { RegistryNextStep } from '../RegistryNextStep';
import {
  APPOINTED_BY_LABEL_KEYS,
  ISSUER_AUTHORITY_LABEL_KEYS,
  ISSUER_KEYS,
  ISSUER_QUALIFICATION_LABEL_KEYS,
  LICENCE_REGISTRY_LABEL_KEYS,
  NEXT_STEP_KEYS,
  OBLIGOR_LABEL_KEYS,
  REGISTRY_KEYS,
  REGISTRY_STATE_LABEL_KEYS,
  REGISTRY_STATE_LOOK,
  SELF_SERVICE_PATH_KEYS,
  TRUNCATED_SOURCE_KEYS,
} from '../document-registry-labels';
import { documentIssuerSearchHref } from '@/components/mandate/agency-directory-route';
import { AUTHORITY_SERVICE_SPECS } from '@/config/document-validity/document-issuers';
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
  FIXTURE_AREA_ID,
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
  documentKind: 'building-identity', subject: { propertyId: 'p1', party: null }, process: { kind: 'conveyance', caseId: 'case-9' },
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

describe('ADR-915 §15 — «δεν κρίνεται» λέει την ΑΛΗΘΙΝΗ αιτία', () => {
  const articleOf = (text: string) => screen.getByText(text).closest('article') as HTMLElement;
  const conveyanceOn = (propertyId: string, caseId: string, neededOn: DocumentRequirement['neededOn']): DocumentRequirement => ({
    documentKind: 'energy-certificate', subject: { propertyId, party: null }, process: { kind: 'conveyance', caseId },
    neededOn, policy: 'block', warnWindowDays: 15,
    basis: { kind: 'checklist-item', itemId: 'energy_certificate', verifiedAt: null }, presence: 'required', attestation: null,
  });
  const documents = FIXTURE_DOCUMENTS.filter((document) => document.id === 'f-valid' || document.id === 'f-unknown');

  it('γνωστή λήξη, υπογραφή χωρίς μέρα ⇒ «δεν ορίστηκε η μέρα υπογραφής», ΟΧΙ «η λήξη είναι άγνωστη»', () => {
    renderReady(fixtureResponse({}, documents, [conveyanceOn('p4', 'case-u', { kind: 'unscheduled' })]));
    const row = articleOf('synthetic-new.pdf');
    expect(within(row).getByText(REGISTRY_KEYS.undeterminedDay)).toBeTruthy();
    expect(within(row).queryByText('document-registry:dependents.undetermined')).toBeNull();
  });

  it('άγνωστη λήξη, γνωστή μέρα ⇒ «η λήξη είναι άγνωστη»', () => {
    renderReady(fixtureResponse({}, documents, [conveyanceOn('p3', 'case-k', { kind: 'on', day: '2027-03-01' })]));
    const row = articleOf(REGISTRY_KEYS.fileUnnamed);
    expect(within(row).getByText('document-registry:dependents.undetermined')).toBeTruthy();
    expect(within(row).queryByText(REGISTRY_KEYS.undeterminedDay)).toBeNull();
  });
});

describe('ADR-915 §18 — «Εκδίδει · Το φέρνει»', () => {
  it('κενό: η γραμμή λέει ποιος το εκδίδει και ποιος το φέρνει', () => {
    renderReady();
    const gap = screen.getByText('Συνθετικό Ζ6').closest('article') as HTMLElement;
    expect(within(gap).getByText(ISSUER_KEYS.heading)).toBeTruthy();
    expect(within(gap).getByText(ISSUER_KEYS.obligorHeading)).toBeTruthy();
    expect(within(gap).getByText(OBLIGOR_LABEL_KEYS.owner)).toBeTruthy();
  });

  it('ΠΕΑ ⇒ προσόν με ΜΗΤΡΩΟ + «τον ορίζει ο ιδιοκτήτης» · φορολογική ⇒ ΑΑΔΕ ηλεκτρονικά, χωρίς «ορίζει»', () => {
    const { container } = render(
      <dl>
        <RegistryIssuerValue kind="energy-certificate" obligors={{ kind: 'unknown' }} />
      </dl>,
    );
    const registered = `${ISSUER_KEYS.registered} ${JSON.stringify({
      qualification: ISSUER_QUALIFICATION_LABEL_KEYS['energy-inspector-registered'],
      registry: LICENCE_REGISTRY_LABEL_KEYS['energy-inspector'],
    })}`;
    expect(within(container).getByText(registered)).toBeTruthy();
    expect(within(container).getByText(APPOINTED_BY_LABEL_KEYS.owner)).toBeTruthy();

    const tax = render(
      <dl>
        <RegistryIssuerValue kind="tax-clearance" obligors={{ kind: 'unknown' }} />
      </dl>,
    );
    const selfService = `${ISSUER_KEYS.selfService} ${JSON.stringify({ authority: ISSUER_AUTHORITY_LABEL_KEYS.aade })}`;
    expect(within(tax.container).getByText(selfService)).toBeTruthy();
    expect(within(tax.container).queryByText(APPOINTED_BY_LABEL_KEYS.owner)).toBeNull();
  });
});

describe('ADR-915 §25 — «Το φέρνει: Ο ιδιοκτήτης · <ποιος>»', () => {
  const articleOf = (name: string) => screen.getByText(name).closest('article') as HTMLElement;
  const obligorCell = (article: HTMLElement) => within(article).getByText(OBLIGOR_LABEL_KEYS.owner).closest('dd') as HTMLElement;

  it('ο ρόλος ΚΑΙ ο άνθρωπος: το όνομα είναι σύνδεσμος στην κάρτα της επαφής', () => {
    renderReady();
    const cell = obligorCell(articleOf('Συνθετικό Α1'));
    const link = within(cell).getByRole('link', { name: 'Συνθετικός Άλφα' });
    expect(link.getAttribute('href')).toBe(ENTITY_ROUTES.contacts.withId('cont_alpha'));
    expect(within(cell).getByText(OBLIGOR_LABEL_KEYS.owner)).toBeTruthy();
  });

  it('ρωτήθηκε και κανείς δεν ορίστηκε ⇒ το λέει· ΔΕΝ ρωτήθηκε ⇒ μόνο ο ρόλος, κανένας ισχυρισμός', () => {
    renderReady();
    expect(within(obligorCell(articleOf('Συνθετικό Β2'))).getByText(ISSUER_KEYS.obligorNone)).toBeTruthy();
    const unknown = obligorCell(articleOf('synthetic-new.pdf'));
    expect(within(unknown).queryByText(ISSUER_KEYS.obligorNone)).toBeNull();
    expect(within(unknown).queryByRole('list')).toBeNull();
  });

  it('πολλοί ιδιοκτήτες (και σε κενό) ⇒ οι 3 πρώτοι + «+2 ακόμη»· μη διαθέσιμη επαφή χωρίς σύνδεσμο· χωρίς όνομα το λέει', () => {
    renderReady();
    const cell = obligorCell(articleOf('Συνθετικό Ζ6'));
    const list = within(cell).getByRole('list', { name: ISSUER_KEYS.obligorPeople });
    expect(within(list).getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      ISSUER_KEYS.obligorUnavailable, ISSUER_KEYS.obligorUnnamed, 'Συνθετικός Άλφα', `${ISSUER_KEYS.obligorMore} {"count":2}`,
    ]);
    expect(within(list).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      ENTITY_ROUTES.contacts.withId('cont_unnamed'), ENTITY_ROUTES.contacts.withId('cont_alpha'),
    ]);
  });

  it('εντολή ιδιώτη ⇒ ο πελάτης της εντολής', () => {
    renderReady();
    const cell = obligorCell(articleOf('Συνθετική εντολή Η7'));
    expect(within(cell).getByRole('link', { name: 'Συνθετική Πελάτισσα' }).getAttribute('href'))
      .toBe(ENTITY_ROUTES.contacts.withId('cont_client'));
  });

  it('αντικατεστημένη γραμμή ⇒ κανένα «Το φέρνει» (δεν ζητά τίποτα από κανέναν)', () => {
    renderReady();
    const old = articleOf('synthetic-old.pdf');
    expect(within(old).queryByText(ISSUER_KEYS.obligorHeading)).toBeNull();
  });
});

describe('ADR-915 §24 — «Επόμενο βήμα» μέσα στη γραμμή', () => {
  const articleOf = (name: string) => screen.getByText(name).closest('article') as HTMLElement;

  it('ΠΕΑ που έληξε ⇒ «Βρες επαγγελματία» στον κατάλογο φιλτραρισμένο σε έγγραφο ΚΑΙ δήμο', () => {
    renderReady();
    const row = articleOf('Συνθετικό Α1');
    const link = within(row).getByRole('link', { name: NEXT_STEP_KEYS.findProfessional });
    expect(link.getAttribute('href')).toBe(documentIssuerSearchHref('energy-certificate', FIXTURE_AREA_ID));
    expect(link.getAttribute('href')).toBe('/pro?occupation=document%3Aenergy-certificate&area=municipality%3A0501');
    expect(within(row).getByText(NEXT_STEP_KEYS.findProfessionalNear)).toBeTruthy();
  });

  it('κενό χωρίς αποδεδειγμένο δήμο ⇒ κατάλογος ΧΩΡΙΣ περιοχή, και η οθόνη το λέει', () => {
    renderReady();
    const gap = articleOf('Συνθετικό Ζ6');
    const link = within(gap).getByRole('link', { name: NEXT_STEP_KEYS.findProfessional });
    expect(link.getAttribute('href')).toBe('/pro?occupation=document%3Aenergy-certificate');
    expect(within(gap).getByText(NEXT_STEP_KEYS.findProfessionalAnywhere)).toBeTruthy();
  });

  it('έγκυρο ή άγνωστης λήξης ⇒ καμία μπάρα «Επόμενο βήμα»', () => {
    renderReady();
    expect(within(articleOf('synthetic-new.pdf')).queryByText(NEXT_STEP_KEYS.heading)).toBeNull();
    expect(within(articleOf(REGISTRY_KEYS.fileUnnamed)).queryByText(NEXT_STEP_KEYS.heading)).toBeNull();
  });

  it('φορολογική που έληξε ⇒ «Έκδοση από ΑΑΔΕ» στην επίσημη είσοδο, νέα καρτέλα, διαδρομή — ΚΑΝΕΝΑ «Βρες»', () => {
    render(<RegistryNextStep kind="tax-clearance" state="expired" areaId={FIXTURE_AREA_ID} />);
    const name = `${NEXT_STEP_KEYS.selfService} ${JSON.stringify({ authority: ISSUER_AUTHORITY_LABEL_KEYS.aade })}`;
    const link = screen.getByRole('link', { name });
    expect(link.getAttribute('href')).toBe(AUTHORITY_SERVICE_SPECS['aade-tax-clearance'].entryUrl);
    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noopener noreferrer');
    expect(screen.getByText(SELF_SERVICE_PATH_KEYS['aade-tax-clearance'])).toBeTruthy();
    expect(screen.queryByText(NEXT_STEP_KEYS.findProfessional)).toBeNull();
  });
});

describe('ADR-915 §25 (5γ) — γραμμή ΠΡΟΣΩΠΟΥ: «Το φέρνει» λέει ΑΥΤΟ το πρόσωπο', () => {
  const taxOf = (key: string, contactId: string | null): DocumentRequirement => ({
    documentKind: 'tax-clearance', subject: { propertyId: 'p1', party: { key, contactId } }, process: { kind: 'conveyance', caseId: 'case-7' },
    neededOn: { kind: 'unscheduled' }, policy: 'block', warnWindowDays: 15,
    basis: { kind: 'checklist-item', itemId: `seller_tax_clearance@${key}`, verifiedAt: null }, presence: 'required', attestation: null,
  });

  it('δύο κενά φορολογικής στο ίδιο ακίνητο ⇒ το καθένα με το ΔΙΚΟ του όνομα — όχι τους ιδιοκτήτες του ακινήτου', () => {
    renderReady(fixtureResponse({}, [], [taxOf('cont_gamma', 'cont_gamma'), taxOf('cont_delta', 'cont_delta')]));
    const cells = screen.getAllByText(OBLIGOR_LABEL_KEYS.owner).map((label) => label.closest('dd') as HTMLElement);
    expect(cells.map((cell) => within(cell).getAllByRole('link').map((link) => link.textContent)).sort())
      .toEqual([['Συνθετικός Γάμμα'], ['Συνθετικός Δέλτα']]);
  });

  it('πωλητής χωρίς επαφή ⇒ «δεν έχει οριστεί», ποτέ οι ιδιοκτήτες του ακινήτου στη θέση του', () => {
    renderReady(fixtureResponse({}, [], [taxOf('seller', null)]));
    const cell = screen.getByText(OBLIGOR_LABEL_KEYS.owner).closest('dd') as HTMLElement;
    expect(within(cell).getByText(ISSUER_KEYS.obligorNone)).toBeTruthy();
    expect(within(cell).queryByRole('link')).toBeNull();
  });
});
