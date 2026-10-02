/**
 * ADR-898 Φ3β-2 · Φ3β-3 — **η ενότητα «Αντικειμενική αξία»** (ιδιώτης ΚΑΙ γραφείο), από άκρη σε άκρη πάνω στις
 * πραγματικές μηχανές (προβολή · αντικειμενική · ουρά): στελέχη μόνο ο server (γραφή + προεπισκόπηση) και η ζώνη.
 *
 * Τι αποδεικνύει: (1) coaching — τρεις ανοιχτές τη φορά, πρώτη αυτή που ξεκλειδώνει · (2) η απάντηση φαίνεται
 * **αμέσως**, πριν απαντήσει ο server · (3) αποτυχία ⇒ επιστροφή στην αλήθεια + «Δοκιμάστε ξανά» · (4) απόκρυψη =
 * **μία** διόρθωση `display`, με προεπισκόπηση «αυτό βλέπει ο αγοραστής».
 */

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

import type { ListingPreviewState } from '@/hooks/listings/useListingPreview';
import type { ValueZoneVerdict } from '@/lib/market/value-zone-at-point';
import type { ObjectiveValueImproveSubject } from '@/lib/objective-value/objective-value-improve-subject';
import { validOwnerProperty } from '@/lib/owner-property/__tests__/owner-property-fixtures';
import { placeKnowledgeFromOwnerProperty, projectableFromOwnerProperty } from '@/lib/owner-property/owner-property-projection';
import { projectListingShape } from '@/services/listings/public-listing-projection';
import type { OwnerListingResult } from '@/services/owner-property/owner-property.service';
import type { OwnerProperty } from '@/types/owner-property';
import type { PublicListing } from '@/types/public-listing';

import { ObjectiveValueImproveSection } from '../ObjectiveValueImproveSection';
import { useOwnerImproveSubject } from '../owner-improve-subject';

jest.mock('@/i18n/hooks/useTranslation', () => {
  const t = (key: string, params?: Record<string, unknown>) => (params ? `${key}::${JSON.stringify(params)}` : key);
  const stable = { t, i18n: { language: 'el' }, ready: true, currentLanguage: 'el' };
  return { useTranslation: () => stable };
});

const READY: ValueZoneVerdict = {
  kind: 'ready',
  zone: { id: 'z1', name: 'Β', price: 1200, validFrom: '2022-01-01' },
  nearEdge: false,
  fronts: [],
};

jest.mock('@/hooks/market/useValueZoneAt', () => ({
  useValueZoneAt: () => ({ kind: 'answered', verdict: READY }),
}));

/** Ο server απαντά όταν του πούμε. */
const pending: { patch: unknown; answer: (result: OwnerListingResult) => void }[] = [];
jest.mock('@/services/owner-property/owner-property.service', () => ({
  setOwnerListingObjectiveValue: (_id: string, patch: unknown) =>
    new Promise<OwnerListingResult>((resolve) => {
      pending.push({ patch, answer: resolve });
    }),
}));

/** Η βάση «όπως θα τη δει ο αγοραστής» — ο server τη συνθέτει· εδώ η ΙΔΙΑ καθαρή προβολή + ό,τι δένει ο γραφέας. */
let preview: ListingPreviewState = { kind: 'loading' };
jest.mock('@/hooks/listings/useListingPreview', () => ({
  useListingPreview: () => preview,
}));

const AT = '2026-10-02T09:00:00.000Z';

function serverListingOf(owner: OwnerProperty, facts: Partial<PublicListing> = {}): PublicListing {
  return {
    ...projectListingShape(projectableFromOwnerProperty(owner, AT), placeKnowledgeFromOwnerProperty(owner, AT), AT),
    ...facts,
  };
}

const property = validOwnerProperty({ floor: 4, areaSqm: 90 });

beforeEach(() => {
  pending.length = 0;
  preview = { kind: 'ready', listing: serverListingOf(property) };
});

/** Ο ιδιώτης ως κάτοχος — ο ίδιος προσαρμογέας με την οθόνη. */
function OwnerSection({ owner }: { readonly owner: OwnerProperty }) {
  return <ObjectiveValueImproveSection subject={useOwnerImproveSubject(owner)} />;
}

function answer(result: OwnerListingResult) {
  return act(async () => {
    pending[pending.length - 1]?.answer(result);
    await Promise.resolve();
  });
}

describe('ObjectiveValueImproveSection — ADR-898 Φ3β-2', () => {
  it('coaching: τρεις ανοιχτές τη φορά — πρώτη η άδεια (χωρίς αυτήν δεν βγαίνει ποσό) — και «ακόμη Ν»', () => {
    render(<OwnerSection owner={property} />);
    const suggested = screen.getByRole('region', { name: 'objective-value:improve.suggested' });
    const items = within(suggested).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(within(items[0] as HTMLElement).getByText('objective-value:questions.ageYears.label')).toBeInTheDocument();
    expect(within(items[0] as HTMLElement).getByText('objective-value:improve.impact.unblocks')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /objective-value:improve\.more/ })).toBeInTheDocument();
  });

  it('η απάντηση φαίνεται ΑΜΕΣΩΣ (αισιόδοξα) και φεύγει ως ΜΙΑ μερική διόρθωση', () => {
    render(<OwnerSection owner={property} />);
    const heating = screen.getByRole('radiogroup', { name: 'objective-value:questions.hasCentralHeating.label' });
    fireEvent.click(within(heating).getByRole('radio', { name: 'objective-value:questions.yes' }));
    expect(pending.map((call) => call.patch)).toEqual([{ hasCentralHeating: true }]);
    // Ο server δεν απάντησε ακόμη — η οθόνη δείχνει ήδη την απάντηση.
    expect(screen.getByRole('radio', { name: 'objective-value:questions.yes', checked: true })).toBeInTheDocument();
  });

  it('αποτυχία δικτύου ⇒ η οθόνη γυρίζει στην αλήθεια και προσφέρει «Δοκιμάστε ξανά», που ξαναστέλνει το ίδιο', async () => {
    render(<OwnerSection owner={property} />);
    const heating = screen.getByRole('radiogroup', { name: 'objective-value:questions.hasCentralHeating.label' });
    fireEvent.click(within(heating).getByRole('radio', { name: 'objective-value:questions.yes' }));
    await answer({ kind: 'failed', message: 'δίκτυο' });
    expect(within(heating).queryByRole('radio', { checked: true })).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent('objective-value:improve.failed');
    fireEvent.click(screen.getByRole('button', { name: 'objective-value:improve.retry' }));
    expect(pending.map((call) => call.patch)).toEqual([{ hasCentralHeating: true }, { hasCentralHeating: true }]);
  });

  it('μελλοντική ημερομηνία άδειας ΔΕΝ φεύγει καν (ο ίδιος κανόνας με τον server)', () => {
    render(<OwnerSection owner={property} />);
    fireEvent.change(screen.getByLabelText('objective-value:questions.ageYears.label'), { target: { value: '2999-01-01' } });
    expect(pending).toHaveLength(0);
    expect(screen.getByRole('alert')).toHaveTextContent('objective-value:improve.rejected.permitDateInFuture');
  });

  it('απόκρυψη = ΜΙΑ διόρθωση `display`· η προεπισκόπηση λέει ότι ο αγοραστής δεν βλέπει τίποτα', () => {
    render(<OwnerSection owner={property} />);
    fireEvent.click(screen.getByRole('switch', { name: 'objective-value:improve.visibility.label' }));
    expect(pending.map((call) => call.patch)).toEqual([{ display: 'hidden' }]);
    expect(screen.getByText('objective-value:improve.visibility.hiddenPreview')).toBeInTheDocument();
  });
});

describe('ObjectiveValueImproveSection — ADR-898 Φ3β-3 (βάση από τον server · γραφείο)', () => {
  it('🔴 η βάση είναι η αγγελία ΤΟΥ SERVER: με έτος κατασκευής η άδεια προσεγγίζεται — δεν «ξεκλειδώνει» τίποτα', () => {
    // Η καθαρή προβολή γράφει `constructionYear: null`· το δένει μόνο ο γραφέας. Με βάση στον browser η οθόνη θα
    // ζητούσε την άδεια ως «ξεκλειδώνει», ενώ η δημόσια αγγελία δείχνει ήδη εύρος.
    preview = {
      kind: 'ready',
      listing: serverListingOf(property, { constructionYear: { provenance: 'declared', value: 1990, at: AT } }),
    };
    render(<OwnerSection owner={property} />);
    expect(screen.queryByText('objective-value:improve.impact.unblocks')).toBeNull();
  });

  it('όσο η βάση φορτώνει ⇒ μήνυμα αναμονής, καμία ερώτηση· αποτυχία ⇒ μήνυμα αποτυχίας', () => {
    preview = { kind: 'loading' };
    const { rerender } = render(<OwnerSection owner={property} />);
    expect(screen.getByText('objective-value:improve.zone.loading')).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup')).toBeNull();
    preview = { kind: 'failed' };
    rerender(<OwnerSection owner={{ ...property }} />);
    expect(screen.getByText('objective-value:improve.zone.failed')).toBeInTheDocument();
  });

  it('γραφείο: ΙΔΙΟ component, άλλη πόρτα γραφής· άρνηση κλειδώματος ⇒ ο λόγος, χωρίς «Δοκιμάστε ξανά»', async () => {
    const writes: unknown[] = [];
    const subject: ObjectiveValueImproveSubject = {
      id: 'prop_1',
      declarations: undefined,
      revision: 'r1',
      write: async (patch) => {
        writes.push(patch);
        return { kind: 'rejected', reasons: ['locked'] };
      },
    };
    render(<ObjectiveValueImproveSection subject={subject} />);
    const heating = screen.getByRole('radiogroup', { name: 'objective-value:questions.hasCentralHeating.label' });
    await act(async () => {
      fireEvent.click(within(heating).getByRole('radio', { name: 'objective-value:questions.yes' }));
      await Promise.resolve();
    });
    expect(writes).toEqual([{ hasCentralHeating: true }]);
    expect(screen.getByRole('alert')).toHaveTextContent('objective-value:improve.rejected.locked');
    expect(screen.queryByRole('button', { name: 'objective-value:improve.retry' })).toBeNull();
  });
});
