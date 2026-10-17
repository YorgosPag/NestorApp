/**
 * @fileoverview ADR-915 §27 — **«Ανάθεση σε επαγγελματία»** στη σελίδα «Λήξεις εγγράφων», όπως τη βλέπει ο άνθρωπος:
 *   «Ανάθεση» πριν από το «Βρες» · «Ανατέθηκε» ΜΟΝΟ με απόφαση ιδιοκτήτη · η μπάλα με όνομα · το «Βρες» φεύγει όταν
 *   δεσμευτεί επαγγελματίας · πρόταση **αισιόδοξα** · επαναφορά με λόγο · απόφαση μόνο με υπεύθυνο.
 *
 * 🔴 **Διαβάζει ΑΠΟΔΟΣΗ**: αληθινά `DocumentRegistryContent` + `useIssuanceAssignment` + ο ΑΛΗΘΙΝΟΣ συναρμολογητής των
 *    αναθέσεων (μέσα από το fixture)· ψεύτικα μόνο το δίκτυο, το δικαίωμα και τα μηνύματα.
 */

import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { DocumentRegistryContent } from '../DocumentRegistryContent';
import { NEXT_STEP_KEYS } from '../document-registry-labels';
import {
  BALL_IN_COURT_KEYS,
  DECISION_KEYS,
  DELIVERY_HISTORY_KEYS,
  ISSUANCE_ERROR_KEYS,
  ISSUANCE_KEYS,
  ISSUANCE_STAGE_KEYS,
  LINK_HISTORY_KEYS,
  PROPOSE_KEYS,
  SEND_KEYS,
} from '../issuance-labels';
import { reduceIssuance, type IssuanceAction, type IssuanceAssignmentRecord } from '@/lib/document-validity/issuance-assignment';
import { withIssuanceDelivery } from '@/lib/document-validity/issuance-delivery';
import { planIssuanceReminders, withIssuanceReminderSent } from '@/lib/document-validity/issuance-reminder';
import type { IssuanceRosterEntry } from '@/lib/document-validity/issuance-candidates';
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
const preview = jest.fn();
const send = jest.fn();
jest.mock('@/services/document-registry/document-registry.client', () => ({
  saveObligorDesignation: jest.fn(),
  saveIssuanceAction: (...args: unknown[]) => save(...args),
  previewIssuanceMessage: (...args: unknown[]) => preview(...args),
  sendIssuanceMessage: (...args: unknown[]) => send(...args),
}));
// Η αναζήτηση επαφής φέρνει υπηρεσίες Firebase — εδώ αρκεί ότι ΔΕΝ χρειάζεται όταν υπάρχει γνωστός.
jest.mock('@/components/contacts/relationships/ContactSearchManager', () => ({ ContactSearchManager: () => null }));

let verdict = 'granted-by-role';
jest.mock('@/auth/hooks/useCapability', () => ({ useCapability: () => ({ verdict }) }));

const notifyError = jest.fn();
const notifySuccess = jest.fn();
const notifyWarning = jest.fn();
jest.mock('@/providers/NotificationProvider', () => ({
  useNotifications: () => ({ error: notifyError, success: notifySuccess, warning: notifyWarning }),
}));

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

const ACTOR = { kind: 'office', uid: 'uid_agent', nowIso: '2026-10-10T09:00:00.000Z' } as const;
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
const ACCEPTED = [PROPOSE, APPROVE, { kind: 'notify', channel: 'phone', invitationId: null, note: null, verification: null }, { kind: 'respond', outcome: 'accepted', note: null }] as IssuanceAction[];

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

describe('ADR-915 §28 — αποστολή με σύνδεσμο: πρόχειρο → προεπισκόπηση → ΕΝΑ πάτημα', () => {
  const REQUEST: IssuanceAction = { kind: 'request-approval', invitationId: 'diin_1', ownerContactId: 'cont_alpha', note: null, verification: 'link' };
  const PREVIEW = {
    audience: 'owner', recipient: { contactId: 'cont_alpha', name: 'Άλφα', email: 'alfa@example.test' },
    subject: 'Θέμα προεπισκόπησης', text: 'Κείμενο προεπισκόπησης',
    coOwners: [{ contactId: 'cont_beta', name: 'Βήτα', reachable: true }, { contactId: 'cont_gamma', name: 'Γάμμα', reachable: false }],
    coOwnerMessage: null,
  };

  beforeEach(() => {
    preview.mockReset().mockResolvedValue({ kind: 'ok', data: { preview: PREVIEW } });
    send.mockReset().mockResolvedValue({ kind: 'ok', data: { stage: 'proposed', delivery: { recipient: 'accepted', coOwners: {} }, accessCode: null } });
    notifySuccess.mockClear();
    notifyWarning.mockClear();
  });

  async function openSend(): Promise<HTMLElement> {
    registry = withRoster([{ propertyId: 'p6', documentKind: 'energy-certificate', record: recordOf([PROPOSE]) }]);
    render(<DocumentRegistryContent />);
    await userEvent.setup().click(within(article()).getByRole('button', { name: SEND_KEYS.ownerTrigger }));
    return screen.findByRole('dialog');
  }

  it('🔴 ΤΙΠΟΤΑ δεν φεύγει πριν το πάτημα: ο διάλογος δείχνει την προεπισκόπηση του διακομιστή, όχι αποστολή', async () => {
    const dialog = await openSend();
    expect(await within(dialog).findByText('Θέμα προεπισκόπησης', {}, { timeout: 2000 })).toBeTruthy();
    expect(preview).toHaveBeenCalledWith(expect.objectContaining({ audience: 'owner', expectedStage: 'proposed', expectedOwnerContactId: 'cont_alpha' }));
    expect(send).not.toHaveBeenCalled();
    expect(within(dialog).getByText(SEND_KEYS.never)).toBeTruthy();
  });

  it('συνιδιοκτήτες: προεπιλογή ΝΑΙ μόνο όσοι έχουν email· ένα πάτημα ⇒ ΜΙΑ αποστολή με ό,τι προεπισκοπήθηκε', async () => {
    const dialog = await openSend();
    await within(dialog).findByText('Θέμα προεπισκόπησης', {}, { timeout: 2000 });
    const [beta, gamma] = within(dialog).getAllByRole('checkbox');
    expect(gamma?.hasAttribute('disabled')).toBe(true);
    expect(beta?.getAttribute('aria-checked')).toBe('true');
    // Η προεπιλογή άλλαξε το πρόχειρο ⇒ νέα προεπισκόπηση· το κουμπί ανοίγει ΜΟΝΟ όταν είναι για το τρέχον πρόχειρο.
    const submit = within(dialog).getByRole('button', { name: SEND_KEYS.submit });
    await waitFor(() => expect(submit.hasAttribute('disabled')).toBe(false), { timeout: 2000 });
    expect(preview).toHaveBeenLastCalledWith(expect.objectContaining({ informContactIds: ['cont_beta'] }));
    await userEvent.setup().click(submit);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ audience: 'owner', informContactIds: ['cont_beta'] }));
    expect(notifySuccess).toHaveBeenCalledWith(SEND_KEYS.sent);
  });

  it('το email δεν έφυγε ⇒ η γραμμή το ΛΕΕΙ («δεν έφυγε — ξαναστείλτε»), και το κουμπί γίνεται «Ξαναστείλτε»', () => {
    const requested = recordOf([PROPOSE, REQUEST]);
    const failed = withIssuanceDelivery(requested, 'diin_1', { recipient: 'failed', coOwners: {} });
    registry = withRoster([{ propertyId: 'p6', documentKind: 'energy-certificate', record: failed ?? requested }]);
    render(<DocumentRegistryContent />);
    expect(within(article()).getByText(LINK_HISTORY_KEYS.notDelivered)).toBeTruthy();
    expect(within(article()).getByRole('button', { name: SEND_KEYS.ownerResend })).toBeTruthy();
  });

  it('§30 — γεγονότα του παρόχου: «παραδόθηκε» ήσυχα · «επέστρεψε» / «ανεπιθύμητο» ως συναγερμός · επιστροφή συνιδιοκτήτη ΔΕΝ μετρά', () => {
    const requested = recordOf([PROPOSE, REQUEST]);
    const cases = [
      [{ recipient: 'delivered', coOwners: { cont_beta: 'delivered' } }, DELIVERY_HISTORY_KEYS.delivered, false],
      [{ recipient: 'bounced', coOwners: { cont_beta: 'bounced' } }, DELIVERY_HISTORY_KEYS.bounced, true],
      [{ recipient: 'complained', coOwners: {} }, DELIVERY_HISTORY_KEYS.complained, true],
    ] as const;
    for (const [delivery, key, alarm] of cases) {
      const record = withIssuanceDelivery(requested, 'diin_1', delivery) ?? requested;
      registry = withRoster([{ propertyId: 'p6', documentKind: 'energy-certificate', record }]);
      const { unmount } = render(<DocumentRegistryContent />);
      expect(within(article()).getByText(key).className.includes('text-destructive')).toBe(alarm);
      expect(within(article()).queryByText(LINK_HISTORY_KEYS.notDelivered)).toBeNull();
      // «Ενημερώθηκαν Ν»: όποιος έλαβε το μήνυμα μετρά· όποιου επέστρεψε, όχι.
      const informed = within(article()).queryByText(`${LINK_HISTORY_KEYS.informed} ${JSON.stringify({ count: '1' })}`);
      expect(informed !== null).toBe(delivery.coOwners.cont_beta === 'delivered');
      unmount();
    }
  });
});

describe('ADR-915 §29 — κωδικός πρόσβασης: ο διακόπτης, η ΜΙΑ εμφάνιση, οι γραμμές ιστορικού', () => {
  const PREVIEW = {
    audience: 'owner', recipient: { contactId: 'cont_alpha', name: 'Άλφα', email: 'alfa@example.test' },
    subject: 'Θέμα προεπισκόπησης', text: 'Κείμενο προεπισκόπησης', coOwners: [], coOwnerMessage: null,
  };

  beforeEach(() => {
    preview.mockReset().mockResolvedValue({ kind: 'ok', data: { preview: PREVIEW } });
    send.mockReset().mockResolvedValue({ kind: 'ok', data: { stage: 'proposed', delivery: { recipient: 'accepted', coOwners: {} }, accessCode: '042917' } });
  });

  async function openSend(): Promise<HTMLElement> {
    registry = withRoster([{ propertyId: 'p6', documentKind: 'energy-certificate', record: recordOf([PROPOSE]) }]);
    render(<DocumentRegistryContent />);
    await userEvent.setup().click(within(article()).getByRole('button', { name: SEND_KEYS.ownerTrigger }));
    return screen.findByRole('dialog');
  }

  async function submitWhenReady(dialog: HTMLElement): Promise<void> {
    await within(dialog).findByText('Θέμα προεπισκόπησης', {}, { timeout: 2000 });
    const submit = within(dialog).getByRole('button', { name: SEND_KEYS.submit });
    await waitFor(() => expect(submit.hasAttribute('disabled')).toBe(false), { timeout: 2000 });
    await userEvent.setup().click(submit);
  }

  it('🔴 ενεργός από προεπιλογή: η προεπισκόπηση και η αποστολή ζητούν κωδικό', async () => {
    const dialog = await openSend();
    expect(within(dialog).getByRole('switch', { name: SEND_KEYS.accessCodeLabel }).getAttribute('aria-checked')).toBe('true');
    await submitWhenReady(dialog);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ requireAccessCode: true }));
  });

  it('μετά την αποστολή ο κωδικός φαίνεται ΜΙΑ φορά, σε ομάδες υπαγόρευσης — ο διάλογος ΔΕΝ κλείνει μόνος του', async () => {
    const dialog = await openSend();
    await submitWhenReady(dialog);
    expect(await within(dialog).findByText('042 917')).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: SEND_KEYS.codeCopy })).toBeTruthy();
    await userEvent.setup().click(within(dialog).getByRole('button', { name: SEND_KEYS.codeDone }));
    await waitFor(() => expect(screen.queryByText('042 917')).toBeNull());
  });

  it('διακόπτης κλειστός ⇒ αποστολή χωρίς κωδικό', async () => {
    send.mockResolvedValue({ kind: 'ok', data: { stage: 'proposed', delivery: { recipient: 'accepted', coOwners: {} }, accessCode: null } });
    const dialog = await openSend();
    await userEvent.setup().click(within(dialog).getByRole('switch', { name: SEND_KEYS.accessCodeLabel }));
    await waitFor(() => expect(preview).toHaveBeenLastCalledWith(expect.objectContaining({ requireAccessCode: false })), { timeout: 2000 });
    await submitWhenReady(dialog);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ requireAccessCode: false }));
  });

  it('ιστορικό: «με κωδικό πρόσβασης» στο αίτημα· «επιβεβαιώθηκε με τον κωδικό» στην απόφαση', () => {
    const requested = recordOf([PROPOSE, { kind: 'request-approval', invitationId: 'diin_1', ownerContactId: 'cont_alpha', note: null, verification: 'access-code' }]);
    const decided: IssuanceAssignmentRecord = {
      ...requested,
      decision: { basis: 'owner-link-approval', invitationId: 'diin_1', verifiedBy: 'access-code', outcome: 'approved', ownerContactId: 'cont_alpha', note: null, at: '2026-10-11T09:00:00.000Z' },
    };
    registry = withRoster([{ propertyId: 'p6', documentKind: 'energy-certificate', record: decided }]);
    render(<DocumentRegistryContent />);
    expect(within(article()).getByText(LINK_HISTORY_KEYS.withAccessCode)).toBeTruthy();
    expect(within(article()).getByText(LINK_HISTORY_KEYS.verifiedByCode)).toBeTruthy();
  });
});

describe('ADR-915 §31 — αυτόματες υπενθυμίσεις: ο διακόπτης και οι γραμμές ιστορικού', () => {
  const PREVIEW = {
    audience: 'owner', recipient: { contactId: 'cont_alpha', name: 'Άλφα', email: 'alfa@example.test' },
    subject: 'Θέμα προεπισκόπησης', text: 'Κείμενο προεπισκόπησης', coOwners: [], coOwnerMessage: null,
  };
  /** Το αίτημα στάλθηκε `ACTOR.nowIso` (10/10) ⇒ ο σύνδεσμος λήγει 7 ημέρες μετά. */
  const EXPIRES = '2026-10-17T09:00:00.000Z';
  const REQUEST: IssuanceAction = { kind: 'request-approval', invitationId: 'diin_1', ownerContactId: 'cont_alpha', note: null, verification: 'link' };

  beforeEach(() => {
    preview.mockReset().mockResolvedValue({ kind: 'ok', data: { preview: PREVIEW } });
    send.mockReset().mockResolvedValue({ kind: 'ok', data: { stage: 'proposed', delivery: { recipient: 'accepted', coOwners: {} }, accessCode: null } });
  });

  async function openSend(): Promise<HTMLElement> {
    registry = withRoster([{ propertyId: 'p6', documentKind: 'energy-certificate', record: recordOf([PROPOSE]) }]);
    render(<DocumentRegistryContent />);
    await userEvent.setup().click(within(article()).getByRole('button', { name: SEND_KEYS.ownerTrigger }));
    return screen.findByRole('dialog');
  }

  async function submitWhenReady(dialog: HTMLElement): Promise<void> {
    await within(dialog).findByText('Θέμα προεπισκόπησης', {}, { timeout: 2000 });
    const submit = within(dialog).getByRole('button', { name: SEND_KEYS.submit });
    await waitFor(() => expect(submit.hasAttribute('disabled')).toBe(false), { timeout: 2000 });
    await userEvent.setup().click(submit);
  }

  /** Αίτημα που έφυγε, με πρόγραμμα, και (προαιρετικά) μία υπενθύμιση που ήδη στάλθηκε. */
  function requestWithReminders(sentOne: boolean): IssuanceAssignmentRecord {
    const requested = recordOf([PROPOSE, REQUEST]);
    const delivered = withIssuanceDelivery(requested, 'diin_1', { recipient: 'accepted', coOwners: {} }) ?? requested;
    const planned = planIssuanceReminders(delivered, 'diin_1', EXPIRES) ?? delivered;
    const dueAt = planned.approvalRequest?.reminders?.dueAt ?? '';
    return sentOne ? withIssuanceReminderSent(planned, 'diin_1', { dueAt, sentAt: dueAt, expiresAt: EXPIRES }) ?? planned : planned;
  }

  const startsWith = (key: string) => (content: string) => content.startsWith(key);

  it('🔴 ενεργές από προεπιλογή, οι ημέρες από την ΠΟΛΙΤΙΚΗ — η αποστολή τις ζητά', async () => {
    const dialog = await openSend();
    expect(within(dialog).getByRole('switch', { name: SEND_KEYS.remindersLabel }).getAttribute('aria-checked')).toBe('true');
    expect(within(dialog).getByText(`${SEND_KEYS.remindersHint} ${JSON.stringify({ days: 3 })}`)).toBeTruthy();
    await submitWhenReady(dialog);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ sendReminders: true }));
  });

  it('διακόπτης κλειστός ⇒ αποστολή χωρίς υπενθυμίσεις', async () => {
    const dialog = await openSend();
    await userEvent.setup().click(within(dialog).getByRole('switch', { name: SEND_KEYS.remindersLabel }));
    await waitFor(() => expect(preview).toHaveBeenLastCalledWith(expect.objectContaining({ sendReminders: false })), { timeout: 2000 });
    await submitWhenReady(dialog);
    expect(send).toHaveBeenCalledWith(expect.objectContaining({ sendReminders: false }));
  });

  it('ιστορικό: «στάλθηκε υπενθύμιση» για όσες έφυγαν + «επόμενη» ΜΟΝΟ όσο περιμένουμε απάντηση', () => {
    registry = withRoster([{ propertyId: 'p6', documentKind: 'energy-certificate', record: requestWithReminders(true) }]);
    const { unmount } = render(<DocumentRegistryContent />);
    expect(within(article()).getAllByText(startsWith(LINK_HISTORY_KEYS.reminderSent))).toHaveLength(1);
    expect(within(article()).getAllByText(startsWith(LINK_HISTORY_KEYS.reminderNext))).toHaveLength(1);
    unmount();

    const answered: IssuanceAssignmentRecord = {
      ...requestWithReminders(true),
      decision: { basis: 'owner-link-approval', invitationId: 'diin_1', verifiedBy: 'link', outcome: 'approved', ownerContactId: 'cont_alpha', note: null, at: '2026-10-11T09:00:00.000Z' },
    };
    registry = withRoster([{ propertyId: 'p6', documentKind: 'energy-certificate', record: answered }]);
    render(<DocumentRegistryContent />);
    expect(within(article()).getAllByText(startsWith(LINK_HISTORY_KEYS.reminderSent))).toHaveLength(1);
    expect(within(article()).queryByText(startsWith(LINK_HISTORY_KEYS.reminderNext))).toBeNull();
  });
});
