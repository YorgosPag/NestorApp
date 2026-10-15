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
  TRUNCATED_SOURCE_KEYS,
} from '../document-registry-labels';
import { matchesRegistryFilter, REGISTRY_FILTERS, REGISTRY_ROW_STATES } from '@/lib/document-validity/document-registry';
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

// Η κάρτα αποδίδεται ως τίτλος + τιμή + τόνος: εδώ ελέγχεται ΤΙ δείχνει, όχι το στυλ της.
jest.mock('@/components/property-management/dashboard/StatsCard', () => ({
  StatsCard: ({ title, value, color }: { title: string; value: number; color: string }) => (
    <p data-testid="tally-card">{`${title}=${value}:${color}`}</p>
  ),
}));

const reload = jest.fn();

function renderReady(response = fixtureResponse(), view?: string): void {
  searchParams = new URLSearchParams(view ? { view } : {});
  registryState.mockReturnValue({ view: { state: 'ready', registry: response }, reload });
  render(<DocumentRegistryContent />);
}

/** Τα αρχεία που δείχνει η οθόνη, με τη σειρά τους (κάθε γραμμή είναι `<article>`). */
const shownArticles = () => screen.queryAllByRole('article');
const shownFiles = (): string[] => {
  const names = fixtureResponse().files;
  return shownArticles().map((article) => {
    const id = FIXTURE_DOCUMENTS.find((document) => {
      const name = names[document.id]?.name ?? REGISTRY_KEYS.fileUnnamed;
      return within(article).queryByText(name) !== null;
    })?.id;
    return id ?? '?';
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
      `${REGISTRY_STATE_LABEL_KEYS[state]}=${onlyValid.tally[state]}:${state === 'valid' ? 'green' : 'gray'}`));
  });
});

describe('προβολές — ΑΚΡΙΒΩΣ ό,τι λέει ο ΕΝΑΣ ταξινομητής', () => {
  it.each(REGISTRY_FILTERS)('%s', (filter) => {
    const response = fixtureResponse();
    renderReady(response, filter);
    const expected = response.rows.filter((row) => matchesRegistryFilter(row, filter, response.asOf)).map((row) => row.document.id);
    expect(shownFiles().sort()).toEqual([...expected].sort());
    expect(shownFiles()).not.toContain('f-old');
  });

  it('«Όλα» δείχνει και την αντικατεστημένη, με το ποιο την αντικατέστησε', () => {
    renderReady();
    expect(shownFiles().sort()).toEqual(FIXTURE_DOCUMENTS.map((document) => document.id).sort());
    expect(screen.getByText(`${REGISTRY_KEYS.supersededBy} ${JSON.stringify({ name: 'synthetic-new.pdf' })}`)).toBeTruthy();
  });

  it('άγνωστη παράμετρος ⇒ «Όλα» (ο παλιός σύνδεσμος δεν σπάει)', () => {
    renderReady(fixtureResponse(), 'no-such-view');
    expect(shownArticles()).toHaveLength(FIXTURE_DOCUMENTS.length);
  });

  it('η επιλογή προβολής αλλάζει τη διεύθυνση με `replace`', () => {
    renderReady();
    fireEvent.click(screen.getByRole('radio', { name: new RegExp(REGISTRY_KEYS.filterOption.replace('.', '\\.') + '.*blocking') }));
    expect(replace).toHaveBeenCalledWith('/document-expiry?view=blocking', { scroll: false });
  });
});

describe('γραμμή', () => {
  const articleOf = (fileName: string) => screen.getByText(fileName).closest('article') as HTMLElement;

  it('η κατάσταση διαβάζεται χωρίς χρώμα: λέξη σε κάθε γραμμή', () => {
    const response = fixtureResponse();
    renderReady(response);
    for (const row of response.rows) {
      const name = response.files[row.document.id]?.name ?? REGISTRY_KEYS.fileUnnamed;
      expect(within(articleOf(name)).getByText(REGISTRY_STATE_LABEL_KEYS[row.state])).toBeTruthy();
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
    renderReady(fixtureResponse({}, []));
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
