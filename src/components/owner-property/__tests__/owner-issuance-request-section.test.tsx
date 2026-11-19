/**
 * @fileoverview ΑΓΚΥΡΑ — **η ενότητα «Εκδόσεις εγγράφων» του ιδιώτη** (ADR-945 §7.6).
 * @related components/owner-property/OwnerIssuanceRequestSection.tsx · OwnerIssuanceBidList.tsx
 *
 *   Ε1 · χωρίς αίτημα ⇒ «Βρες επαγγελματία» προς τον κατάλογο ανοιχτό ΓΙΑ το ακίνητο και το έγγραφο (ένας δημιουργός).
 *   Ε2 · `canAct === false` ⇒ μόνο ανάγνωση: καμία πράξη, ο λόγος γραμμένος.
 *   Ε3 · τιμή προς απόφαση ⇒ «Επιλογή» · φωνή ιδιώτη («Σειρά σου») · ΕΠΙΒΕΒΑΙΩΣΗ πριν από την αποστολή, με CAS
 *        κύκλου + ΟΛΩΝ των σταδίων και την αναθεώρηση της τιμής που ΕΙΔΕ ο άνθρωπος.
 *   Ε4 · «Ακύρωση αιτήματος» ⇒ επιβεβαίωση ⇒ σώμα `cancel` · «Όχι, κράτησέ το» ⇒ τίποτα δεν φεύγει.
 *   Ε5 · `proposed` ⇒ ΟΧΙ «Σειρά σου» (η ειδοποίηση είναι της πλατφόρμας, Δ3) · άρνηση με κωδικό ⇒ το μήνυμά της.
 *   Ε6 · αποτυχία φόρτωσης ⇒ `alert`, ποτέ σιωπηλή κενή ενότητα.
 *
 * Συνθετικά δεδομένα — κανένα δεδομένο πελάτη.
 */

import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import '@testing-library/jest-dom';

import { DOCUMENT_KIND_LABEL_KEYS } from '@/components/document-registry/document-registry-labels';
import { documentIssuerSearchHref } from '@/components/mandate/agency-directory-route';
import type { DocumentKind } from '@/config/document-validity/document-validity';
import type { IssuanceRequestState } from '@/hooks/document-registry/useIssuanceRequest';
import type { IssuanceRequestActionApi } from '@/hooks/document-registry/useIssuanceRequestAction';
import { reduceIssuance, type IssuanceAction, type IssuanceAssignmentRecord } from '@/lib/document-validity/issuance-assignment';
import type { IssuanceRequestRecord } from '@/lib/document-validity/issuance-bidding';
import type { IssuanceBiddingResponse, IssuanceBidView, IssuanceRequestBody } from '@/lib/document-validity/issuance-bidding-request';
import type { IssuanceStage } from '@/lib/document-validity/issuance-stage';

import { OwnerIssuanceRequestSection } from '../OwnerIssuanceRequestSection';
import { OWNER_BALL_KEYS, OWNER_ISSUANCE_CONFIRM_KEYS, OWNER_ISSUANCE_ERROR_KEYS, OWNER_ISSUANCE_KEYS, OWNER_STAGE_KEYS } from '../owner-issuance-labels';

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) => (values ? `${key}:${JSON.stringify(values)}` : key),
    i18n: { language: 'el' },
    isNamespaceReady: true,
  }),
}));

jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

jest.mock('@/services/realtime/hooks/usePublicAgencies', () => ({
  usePublicAgency: (companyId: string | null) =>
    companyId === null ? { state: 'loading' } : { state: 'found', showcase: { displayName: `Γραφείο ${companyId}` } },
}));

/** Στέλεχος του διαλόγου: ανοιχτός ⇒ τίτλος + τα δύο κουμπιά του (η συμπεριφορά του Radix δεν κρίνεται εδώ). */
jest.mock('@/components/ui/ConfirmDialog', () => ({
  ConfirmDialog: (props: {
    open: boolean; title: string; confirmText: string; cancelText: string;
    onConfirm: () => void; onOpenChange: (open: boolean) => void;
  }) =>
    props.open ? (
      <section role="dialog" aria-label={props.title}>
        <button type="button" onClick={() => props.onConfirm()}>{props.confirmText}</button>
        <button type="button" onClick={() => props.onOpenChange(false)}>{props.cancelText}</button>
      </section>
    ) : null,
}));

const mockViews = new Map<DocumentKind, IssuanceRequestState>();
jest.mock('@/hooks/document-registry/useIssuanceRequest', () => ({
  useIssuanceRequest: (_propertyId: string, kind: DocumentKind) => ({
    view: mockViews.get(kind) ?? { state: 'unavailable' },
    revalidate: async () => undefined,
  }),
}));

const mockSubmit = jest.fn<Promise<boolean>, [IssuanceRequestBody]>(async () => true);
let mockActionError: IssuanceRequestActionApi['error'] = null;
jest.mock('@/hooks/document-registry/useIssuanceRequestAction', () => {
  const actual = jest.requireActual('@/hooks/document-registry/useIssuanceRequestAction');
  return {
    issuanceActionKeyOf: actual.issuanceActionKeyOf,
    useIssuanceRequestAction: () => ({ submit: mockSubmit, busyKey: null, error: mockActionError }),
  };
});

const PROPERTY = 'ownp_test';
const KIND: DocumentKind = 'energy-certificate';
const AT = '2026-11-19T09:00:00.000Z';

const INSPECTOR = { qualification: 'energy-inspector-registered', registryNumber: 'ΥΠΕΝ-1' } as const;
const ACTIONS: readonly IssuanceAction[] = [
  { kind: 'propose', professional: { kind: 'workspace', companyId: 'comp_a' }, credential: INSPECTOR },
  { kind: 'notify', channel: 'email', invitationId: null, note: null, verification: null },
  {
    kind: 'quote',
    terms: {
      basis: 'firm', amountMinor: 12_000, vatRatePercent: 24, vatIncluded: false,
      validUntil: '2026-12-31', scope: ['issuance'], note: null, deliveryBusinessDays: 5, advance: null,
    },
  },
];

/** Μια προσφορά με τιμή — από τον ΙΔΙΟ μειωτή που γράφει στον διακομιστή, όχι χειροποίητο σχήμα. */
function quotedRecord(): IssuanceAssignmentRecord {
  let record: IssuanceAssignmentRecord | null = null;
  for (const action of ACTIONS) {
    const reduced = reduceIssuance(KIND, record, null, action, { kind: 'office', uid: 'uid_owner', nowIso: AT });
    if (!reduced.ok) throw new Error(`${action.kind}: ${reduced.refusal}`);
    record = reduced.record;
  }
  if (record === null) throw new Error('no record');
  return record;
}

function requestOf(companies: readonly string[]): IssuanceRequestRecord {
  return {
    cycle: 3,
    bids: companies.map((companyId) => ({
      bidId: `bid_${companyId}`, professional: { kind: 'workspace', companyId }, invitedAt: AT, invitedByUid: 'uid_owner',
    })),
    award: null,
    closure: null,
  };
}

function ready(response: IssuanceBiddingResponse): IssuanceRequestState {
  return { state: 'ready', response };
}

function bidView(companyId: string, stage: IssuanceStage | null, record: IssuanceAssignmentRecord | null = null): IssuanceBidView {
  return { bidId: `bid_${companyId}`, stage, record };
}

/** Η γραμμή του είδους ΠΕΑ — όπως τη βρίσκει ο άνθρωπος, από τον τίτλο της. */
function kindRow(): HTMLElement {
  const heading = screen.getByRole('heading', { name: DOCUMENT_KIND_LABEL_KEYS[KIND] });
  const row = heading.closest('li');
  if (row === null) throw new Error('no row');
  return row;
}

beforeEach(() => {
  mockViews.clear();
  mockSubmit.mockClear();
  mockActionError = null;
});

describe('ADR-945 §7.6 — «Εκδόσεις εγγράφων» του ιδιώτη', () => {
  it('Ε1 · χωρίς αίτημα ⇒ «Βρες επαγγελματία» προς τον κατάλογο ΓΙΑ το ακίνητο (ο ΕΝΑΣ δημιουργός του `/pro`)', () => {
    mockViews.set(KIND, ready({ request: null, bids: [], canAct: true }));
    render(<OwnerIssuanceRequestSection propertyId={PROPERTY} />);
    const row = kindRow();
    expect(within(row).getByText(OWNER_ISSUANCE_KEYS.noRequest)).toBeInTheDocument();
    const link = within(row).getByRole('link', { name: OWNER_ISSUANCE_KEYS.findProfessional });
    expect(link.getAttribute('href')).toBe(documentIssuerSearchHref(KIND, null, PROPERTY));
  });

  it('Ε2 · `canAct === false` ⇒ μόνο ανάγνωση: καμία πράξη, ο λόγος γραμμένος', () => {
    mockViews.set(KIND, ready({ request: requestOf(['comp_a']), bids: [bidView('comp_a', 'quoted', quotedRecord())], canAct: false }));
    render(<OwnerIssuanceRequestSection propertyId={PROPERTY} />);
    const row = kindRow();
    expect(within(row).getByText(OWNER_ISSUANCE_KEYS.readOnly)).toBeInTheDocument();
    expect(within(row).queryByRole('button')).toBeNull();
    expect(within(row).queryByRole('link', { name: OWNER_ISSUANCE_KEYS.inviteMore })).toBeNull();
  });

  it('Ε3 · τιμή ⇒ «Σειρά σου» + «Επιλογή» ⇒ επιβεβαίωση ⇒ σώμα με CAS κύκλου, ΟΛΩΝ των σταδίων και της αναθεώρησης', async () => {
    const record = quotedRecord();
    mockViews.set(KIND, ready({
      request: requestOf(['comp_a', 'comp_b']),
      bids: [bidView('comp_a', 'quoted', record), bidView('comp_b', 'sent')],
      canAct: true,
    }));
    render(<OwnerIssuanceRequestSection propertyId={PROPERTY} />);
    const row = kindRow();
    expect(within(row).getByText(OWNER_STAGE_KEYS.quoted)).toBeInTheDocument();
    expect(within(row).getByText(OWNER_BALL_KEYS.owner)).toBeInTheDocument();
    expect(within(row).getByText(OWNER_STAGE_KEYS.sent)).toBeInTheDocument();

    fireEvent.click(within(row).getByRole('button', { name: OWNER_ISSUANCE_KEYS.award }));
    expect(mockSubmit).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog', { name: OWNER_ISSUANCE_CONFIRM_KEYS.awardTitle });
    fireEvent.click(within(dialog).getByRole('button', { name: OWNER_ISSUANCE_CONFIRM_KEYS.awardConfirm }));
    await Promise.resolve();

    expect(mockSubmit).toHaveBeenCalledWith({
      action: 'award', propertyId: PROPERTY, documentKind: KIND, bidId: 'bid_comp_a',
      expectedCycle: 3, quoteRevision: record.quote?.revision, expectedStages: { bid_comp_a: 'quoted', bid_comp_b: 'sent' },
    });
  });

  it('Ε4 · «Ακύρωση αιτήματος» ⇒ επιβεβαίωση· «Όχι, κράτησέ το» ⇒ τίποτα δεν φεύγει, «Ακύρωση» ⇒ σώμα `cancel`', async () => {
    mockViews.set(KIND, ready({ request: requestOf(['comp_a']), bids: [bidView('comp_a', 'sent')], canAct: true }));
    render(<OwnerIssuanceRequestSection propertyId={PROPERTY} />);
    const row = kindRow();

    fireEvent.click(within(row).getByRole('button', { name: OWNER_ISSUANCE_KEYS.cancelRequest }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: OWNER_ISSUANCE_CONFIRM_KEYS.keep }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mockSubmit).not.toHaveBeenCalled();

    fireEvent.click(within(row).getByRole('button', { name: OWNER_ISSUANCE_KEYS.cancelRequest }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: OWNER_ISSUANCE_CONFIRM_KEYS.cancelConfirm }));
    await Promise.resolve();
    expect(mockSubmit).toHaveBeenCalledWith({
      action: 'cancel', propertyId: PROPERTY, documentKind: KIND, expectedCycle: 3, expectedStages: { bid_comp_a: 'sent' },
    });
  });

  it('Ε5 · `proposed` ⇒ ΟΧΙ «Σειρά σου» (η ειδοποίηση είναι της πλατφόρμας) · άρνηση με κωδικό ⇒ το μήνυμά της', () => {
    mockActionError = { key: `${KIND}:cancel:`, reason: 'stale' };
    mockViews.set(KIND, ready({ request: requestOf(['comp_a']), bids: [bidView('comp_a', 'proposed')], canAct: true }));
    render(<OwnerIssuanceRequestSection propertyId={PROPERTY} />);
    const row = kindRow();
    expect(within(row).getByText(OWNER_STAGE_KEYS.proposed)).toBeInTheDocument();
    expect(within(row).queryByText(OWNER_BALL_KEYS.owner)).toBeNull();
    expect(within(row).getByText(OWNER_BALL_KEYS.professional)).toBeInTheDocument();
    expect(within(row).getByRole('alert')).toHaveTextContent(OWNER_ISSUANCE_ERROR_KEYS.stale);
  });

  it('Ε6 · αποτυχία φόρτωσης ⇒ `alert`, ποτέ σιωπηλή κενή ενότητα', () => {
    mockViews.set(KIND, { state: 'failed' });
    render(<OwnerIssuanceRequestSection propertyId={PROPERTY} />);
    expect(screen.getByRole('alert')).toHaveTextContent(OWNER_ISSUANCE_KEYS.loadFailed);
  });
});
