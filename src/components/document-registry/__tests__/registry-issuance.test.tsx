/**
 * @fileoverview ADR-915 §27 — **«Ανάθεση σε επαγγελματία»** στη σελίδα «Λήξεις εγγράφων», όπως τη βλέπει ο άνθρωπος:
 *   «Ανάθεση» πριν από το «Βρες» · «Ανατέθηκε» ΜΟΝΟ με απόφαση ιδιοκτήτη · η μπάλα με όνομα · το «Βρες» φεύγει όταν
 *   δεσμευτεί επαγγελματίας · πρόταση **αισιόδοξα** · επαναφορά με λόγο · απόφαση μόνο με υπεύθυνο.
 *
 * 🔴 **Διαβάζει ΑΠΟΔΟΣΗ**: αληθινά `DocumentRegistryContent` + `useIssuanceAssignment` + ο ΑΛΗΘΙΝΟΣ συναρμολογητής των
 *    αναθέσεων (μέσα από το fixture)· ψεύτικα μόνο το δίκτυο, το δικαίωμα και τα μηνύματα.
 */

import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { DocumentRegistryContent } from '../DocumentRegistryContent';
import { NEXT_STEP_KEYS } from '../document-registry-labels';
import {
  BALL_IN_COURT_KEYS,
  DECISION_KEYS,
  ISSUANCE_ERROR_KEYS,
  ISSUANCE_KEYS,
  ISSUANCE_STAGE_KEYS,
  PROPOSE_KEYS,
} from '../issuance-labels';
import {
  reduceIssuance,
  type IssuanceAction,
  type IssuanceAssignmentRecord,
  type IssuanceRosterEntry,
} from '@/lib/document-validity/issuance-assignment';
import type { ObligorLead } from '@/lib/document-validity/obligor-lead';
import { FIXTURE_DOCUMENTS, FIXTURE_REQUIREMENTS, fixtureResponse } from '@/lib/document-validity/__tests__/registry-fixture';
import type { DocumentRegistryResponse } from '@/services/document-registry/document-registry.types';
import type { ObligorDesignationSave } from '@/services/document-registry/document-registry.client';

const revalidate = jest.fn(async () => undefined);
let registry: DocumentRegistryResponse;
jest.mock('@/hooks/document-registry/useDocumentRegistry', () => ({
  useDocumentRegistry: () => ({ view: { state: 'ready', registry }, reload: jest.fn(), revalidate }),
}));

const save = jest.fn(async (..._args: unknown[]): Promise<ObligorDesignationSave> => ({ kind: 'saved' }));
jest.mock('@/services/document-registry/document-registry.client', () => ({
  saveObligorDesignation: jest.fn(),
  saveIssuanceAction: (...args: unknown[]) => save(...args),
}));
// Η αναζήτηση επαφής φέρνει υπηρεσίες Firebase — εδώ αρκεί ότι ΔΕΝ χρειάζεται όταν υπάρχει γνωστός.
jest.mock('@/components/contacts/relationships/ContactSearchManager', () => ({ ContactSearchManager: () => null }));

let verdict = 'granted-by-role';
jest.mock('@/auth/hooks/useCapability', () => ({ useCapability: () => ({ verdict }) }));

const notifyError = jest.fn();
jest.mock('@/providers/NotificationProvider', () => ({ useNotifications: () => ({ error: notifyError, success: jest.fn() }) }));

jest.mock('@/i18n/hooks/useTranslation', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => (params ? `${key} ${JSON.stringify(params)}` : key),
  }),
}));

jest.mock('@/lib/workspace/navigation', () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
  useRouter: () => ({ replace: jest.fn() }),
}));
jest.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams() }));

const ACTOR = { uid: 'uid_agent', nowIso: '2026-10-10T09:00:00.000Z' };
const INSPECTOR = { qualification: 'energy-inspector-registered', registryNumber: null } as const;
const MAJORITY: ObligorLead = { kind: 'designated', contactId: 'cont_alpha', basis: 'majority-share', sharePct: 60, staleContactId: null };

function recordOf(actions: readonly IssuanceAction[]): IssuanceAssignmentRecord {
  return actions.reduce<IssuanceAssignmentRecord | null>((record, action) => {
    const reduced = reduceIssuance('energy-certificate', record, null, action, ACTOR);
    if (!reduced.ok) throw new Error(reduced.refusal);
    return reduced.record;
  }, null) as IssuanceAssignmentRecord;
}

const PROPOSE: IssuanceAction = { kind: 'propose', professionalContactId: 'cont_client', credential: INSPECTOR };
const APPROVE: IssuanceAction = { kind: 'decide', outcome: 'approved', channel: 'phone', note: null, ownerContactId: 'cont_alpha' };
const ACCEPTED = [PROPOSE, APPROVE, { kind: 'notify', channel: 'phone' }, { kind: 'respond', outcome: 'accepted' }] as IssuanceAction[];

/** Το p6 (κενό ΠΕΑ) με υπεύθυνο, και ο κατάλογος του γραφείου. */
function withRoster(roster: readonly IssuanceRosterEntry[], lead: ObligorLead = MAJORITY): DocumentRegistryResponse {
  const base = fixtureResponse({}, FIXTURE_DOCUMENTS, FIXTURE_REQUIREMENTS, roster);
  return { ...base, properties: { ...base.properties, p6: { ...base.properties.p6, obligorLead: lead } } };
}

const article = () => screen.getByText('Συνθετικό Ζ6').closest('article') as HTMLElement;

beforeEach(() => {
  verdict = 'granted-by-role';
  save.mockClear();
  revalidate.mockClear();
  notifyError.mockClear();
});

describe('ADR-915 §27 — η ανάθεση πάνω στη γραμμή', () => {
  it('καμία ανάθεση ⇒ «Ανάθεση σε επαγγελματία» ΠΡΙΝ από το «Βρες», και κανένα στάδιο', () => {
    registry = withRoster([]);
    render(<DocumentRegistryContent />);
    const assign = within(article()).getByRole('button', { name: ISSUANCE_KEYS.assign });
    const find = within(article()).getByRole('link', { name: NEXT_STEP_KEYS.findProfessional });
    expect(assign.compareDocumentPosition(find) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(article()).queryByText(ISSUANCE_STAGE_KEYS.proposed)).toBeNull();
  });

  it('🔴 πρόταση χωρίς απόφαση ⇒ «αναμένει απόφαση» — ΠΟΤΕ «Ανατέθηκε» — και η μπάλα στον υπεύθυνο, με όνομα', () => {
    registry = withRoster([{ propertyId: 'p6', documentKind: 'energy-certificate', record: recordOf([PROPOSE]) }]);
    render(<DocumentRegistryContent />);
    expect(within(article()).getByText(ISSUANCE_STAGE_KEYS.proposed)).toBeTruthy();
    expect(within(article()).queryByText(ISSUANCE_STAGE_KEYS.accepted)).toBeNull();
    const ball = within(article()).getByText(`${ISSUANCE_KEYS.ballInCourt} ${JSON.stringify({ party: BALL_IN_COURT_KEYS.owner })}`);
    expect(within(ball.parentElement as HTMLElement).getByRole('link').textContent).toBe('Συνθετικός Άλφα');
    expect(within(article()).getByRole('button', { name: ISSUANCE_KEYS.recordDecision })).toBeTruthy();
    expect(within(article()).getByRole('link', { name: NEXT_STEP_KEYS.findProfessional })).toBeTruthy();
  });

  it('🔴 «ποτέ δύο»: δεσμευμένος επαγγελματίας ⇒ «Ανατέθηκε», μπάλα στον επαγγελματία, και το «Βρες» ΦΕΥΓΕΙ', () => {
    registry = withRoster([{ propertyId: 'p6', documentKind: 'energy-certificate', record: recordOf(ACCEPTED) }]);
    render(<DocumentRegistryContent />);
    expect(within(article()).getByText(ISSUANCE_STAGE_KEYS.accepted)).toBeTruthy();
    expect(within(article()).getByText(`${ISSUANCE_KEYS.ballInCourt} ${JSON.stringify({ party: BALL_IN_COURT_KEYS.professional })}`)).toBeTruthy();
    expect(within(article()).queryByRole('link', { name: NEXT_STEP_KEYS.findProfessional })).toBeNull();
  });

  it('κατάλογος μη αναγνώσιμος ⇒ ΚΑΝΕΝΑΣ ισχυρισμός «καμία ανάθεση»: ούτε κουμπί, ρητό μήνυμα', () => {
    // Η ΣΗΜΑΙΑ νικά — ακόμη κι αν κάποια εγγραφή «φαίνεται» άδεια ανάθεση.
    registry = { ...withRoster([]), issuanceKnown: false };
    render(<DocumentRegistryContent />);
    expect(within(article()).queryByRole('button', { name: ISSUANCE_KEYS.assign })).toBeNull();
    expect(within(article()).getByText(ISSUANCE_KEYS.unavailable)).toBeTruthy();
  });

  it('χωρίς δικαίωμα ⇒ η κατάσταση λέγεται, τα κουμπιά ΟΧΙ', () => {
    verdict = 'denied-permission';
    registry = withRoster([{ propertyId: 'p6', documentKind: 'energy-certificate', record: recordOf([PROPOSE]) }]);
    render(<DocumentRegistryContent />);
    expect(within(article()).getByText(ISSUANCE_STAGE_KEYS.proposed)).toBeTruthy();
    expect(within(article()).queryByRole('button', { name: ISSUANCE_KEYS.recordDecision })).toBeNull();
  });
});

describe('ADR-915 §27 — πράξεις από την οθόνη', () => {
  /** Ο Πελάτισσα έβγαλε ΠΕΑ στο p1 με έγκριση ⇒ γνωστή, πρώτη, με το προσόν της. */
  const KNOWN: IssuanceRosterEntry = { propertyId: 'p1', documentKind: 'energy-certificate', record: recordOf([PROPOSE, APPROVE]) };

  async function proposeKnown(): Promise<void> {
    const user = userEvent.setup();
    await user.click(within(article()).getByRole('button', { name: ISSUANCE_KEYS.assign }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('radio', { name: /Συνθετική Πελάτισσα/ }).getAttribute('aria-checked')).toBe('true');
    expect(within(dialog).getByText((text) => text.startsWith(PROPOSE_KEYS.previously))).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: PROPOSE_KEYS.submit }));
  }

  it('αισιόδοξα: ο γνωστός προτείνεται, το στάδιο φαίνεται ΑΜΕΣΩΣ («Αποθηκεύεται…»), μετά ξαναδιαβάζεται', async () => {
    registry = withRoster([KNOWN]);
    let resolve: (value: ObligorDesignationSave) => void = () => undefined;
    save.mockImplementationOnce(() => new Promise((done) => { resolve = done; }));
    render(<DocumentRegistryContent />);
    await proposeKnown();
    expect(save).toHaveBeenCalledWith({
      action: 'propose', propertyId: 'p6', documentKind: 'energy-certificate', expectedStage: null,
      professionalContactId: 'cont_client', qualification: 'energy-inspector-registered', registryNumber: null,
    });
    expect(within(article()).getByText(ISSUANCE_STAGE_KEYS.proposed)).toBeTruthy();
    expect(within(article()).getByRole('status').textContent).toBe(ISSUANCE_KEYS.saving);
    await act(async () => { resolve({ kind: 'saved' }); });
    expect(revalidate).toHaveBeenCalledTimes(1);
    expect(within(article()).queryByRole('status')).toBeNull();
  });

  it('άρνηση (`STALE`) ⇒ η γραμμή γυρίζει πίσω ΚΑΙ ο άνθρωπος μαθαίνει γιατί — και το μητρώο ξαναδιαβάζεται', async () => {
    registry = withRoster([KNOWN]);
    save.mockResolvedValueOnce({ kind: 'failed', code: 'STALE' });
    render(<DocumentRegistryContent />);
    await proposeKnown();
    expect(await within(article()).findByRole('button', { name: ISSUANCE_KEYS.assign })).toBeTruthy();
    expect(within(article()).queryByText(ISSUANCE_STAGE_KEYS.proposed)).toBeNull();
    expect(notifyError).toHaveBeenCalledWith(ISSUANCE_ERROR_KEYS.STALE);
    expect(revalidate).toHaveBeenCalledTimes(1);
  });

  it('🔴 χωρίς υπεύθυνο ⇒ ο διάλογος απόφασης ΔΕΝ δίνει φόρμα: «ορίστε πρώτα υπεύθυνο»', async () => {
    registry = withRoster(
      [{ propertyId: 'p6', documentKind: 'energy-certificate', record: recordOf([PROPOSE]) }],
      { kind: 'undesignated', reason: 'no-majority', staleContactId: null },
    );
    render(<DocumentRegistryContent />);
    const user = userEvent.setup();
    await user.click(within(article()).getByRole('button', { name: ISSUANCE_KEYS.recordDecision }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(DECISION_KEYS.needsLead)).toBeTruthy();
    expect(within(dialog).queryByRole('radio')).toBeNull();
  });

  it('απόφαση ⇒ στέλνει τον υπεύθυνο που ΕΙΔΕ η οθόνη (CAS) και το στάδιο που είδε', async () => {
    registry = withRoster([{ propertyId: 'p6', documentKind: 'energy-certificate', record: recordOf([PROPOSE]) }]);
    render(<DocumentRegistryContent />);
    const user = userEvent.setup();
    await user.click(within(article()).getByRole('button', { name: ISSUANCE_KEYS.recordDecision }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('radio', { name: new RegExp(DECISION_KEYS.approved) }));
    await user.click(within(dialog).getAllByRole('radio')[3]);
    await user.click(within(dialog).getByRole('button', { name: DECISION_KEYS.submit }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({
      action: 'decide', expectedStage: 'proposed', outcome: 'approved', expectedOwnerContactId: 'cont_alpha', note: null,
    }));
  });
});
