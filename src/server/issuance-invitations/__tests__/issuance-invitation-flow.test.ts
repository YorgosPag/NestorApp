/**
 * @jest-environment node
 *
 * @fileoverview ADR-915 §28 — **ολόκληρη η ροή του συνδέσμου** πάνω στο fake Firestore, χωρίς mocks βάσης: πρόχειρο →
 *   προεπισκόπηση (καμία εγγραφή) → αποστολή (ανάθεση + σύνδεσμος σε ΜΙΑ συναλλαγή, μετά το email) → όψη (καμία πράξη) →
 *   απάντηση (ο ΙΔΙΟΣ γραφέας, ο ΙΔΙΟΣ μειωτής) → ειδοποίηση γραφείου. Μόνο το email και ο orchestrator είναι mocks —
 *   τα σύνορα με τον έξω κόσμο. Όλα τα δεδομένα είναι **συνθετικά**.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { issuanceSendBody, type IssuanceSendBody } from '@/lib/document-validity/issuance-request';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { issuanceAssignmentIdOf } from '@/services/document-registry/issuance-assignment-schema';
import { actOnIssuanceAssignment } from '@/services/document-registry/issuance-assignment.service';
import { answerIssuanceLink, unlockIssuanceLink, viewIssuanceLink } from '@/server/issuance-invitations/issuance-invitation-answer';
import { previewIssuanceMessage, sendIssuanceMessage } from '@/server/issuance-invitations/issuance-invitation-send';
import { applyIssuanceDeliveryEvent, IssuanceDeliveryNotReportedError } from '@/server/issuance-invitations/issuance-delivery-events';
import { announceDeliveryEvent } from '@/server/comms/email-delivery/delivery-event-consumers';
import type { EmailDeliveryEvent } from '@/types/email-delivery';

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('@/services/entity-audit.service', () => ({ EntityAuditService: { recordChange: jest.fn(async () => 'eaud_1') } }));
jest.mock('@/lib/workspace/workspace-catalog', () => ({ readWorkspaceName: jest.fn(async () => 'Γραφείο Άλφα') }));
jest.mock('@/server/notifications/notification-orchestrator', () => ({ dispatchNotification: jest.fn(async () => ({ skipped: false })) }));
jest.mock('@/server/invitations/invitation-notice', () => ({ deliverInvitationEmail: jest.fn() }));
/** Άγκιστρο ΑΝΑΜΕΣΑ στο πρόχειρο και τη συναλλαγή (η έκδοση του token) — για το σενάριο αγώνα. Πραγματικό token κατά τα άλλα. */
let beforeMint: (() => Promise<void>) | null = null;
jest.mock('@/server/invitations/invitation-token', () => {
  const actual = jest.requireActual('@/server/invitations/invitation-token');
  return {
    ...actual,
    mintInvitationToken: async (...args: Parameters<typeof actual.mintInvitationToken>) => {
      const hook = beforeMint;
      beforeMint = null;
      if (hook !== null) await hook();
      return actual.mintInvitationToken(...args);
    },
  };
});

/** §29 — άγκιστρο ΑΝΑΜΕΣΑ στον έλεγχο του κωδικού και τη σφράγιση (σενάριο αγώνα του κλειδώματος). */
let afterAccessCheck: (() => Promise<void>) | null = null;
jest.mock('@/server/issuance-invitations/issuance-link-access', () => {
  const actual = jest.requireActual('@/server/issuance-invitations/issuance-link-access');
  return {
    ...actual,
    checkIssuanceAccessCode: async (...args: Parameters<typeof actual.checkIssuanceAccessCode>) => {
      const verdict = await actual.checkIssuanceAccessCode(...args);
      const hook = afterAccessCheck;
      afterAccessCheck = null;
      if (hook !== null) await hook();
      return verdict;
    },
  };
});

/* eslint-disable @typescript-eslint/no-require-imports */
const { deliverInvitationEmail } = require('@/server/invitations/invitation-notice') as { deliverInvitationEmail: jest.Mock };
const { dispatchNotification } = require('@/server/notifications/notification-orchestrator') as { dispatchNotification: jest.Mock };
/* eslint-enable @typescript-eslint/no-require-imports */

interface Sent { readonly to: string; readonly kind: string; readonly subject: string; readonly text: string; readonly correlation?: { readonly purpose: string; readonly ref: string } }

const COMPANY = 'comp_alfa';
const NOW = new Date('2026-10-17T09:00:00.000Z');
const LATER = new Date('2026-10-17T10:00:00.000Z');
const OFFICE = { companyId: COMPANY, uid: 'user_1', name: 'agent@example.test' };
const TARGET = { propertyId: 'prop_1', documentKind: 'energy-certificate' } as const;

let fake: FakeFirestore;
let sent: Sent[];
let delivery: 'accepted' | 'failed';
const db = (): AdminFirestore => fake as unknown as AdminFirestore;
const assignment = () => fake.getAllDocs(COLLECTIONS.DOCUMENT_ISSUANCE_ASSIGNMENTS)[issuanceAssignmentIdOf(COMPANY, 'prop_1', 'energy-certificate')];
const invitations = () => Object.values(fake.getAllDocs(COLLECTIONS.DOCUMENT_ISSUANCE_INVITATIONS));

function seedProperty(shares: readonly (readonly [string, number])[]): void {
  fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', {
    companyId: COMPANY, name: 'Διαμέρισμα Α1', energy: { class: 'B', issuedOn: '2016-11-01', sourceFileId: null },
    commercial: { legalPhase: 'final_signed', owners: shares.map(([contactId, ownershipPct]) => ({ contactId, ownershipPct })) },
  });
}

function seedContact(id: string, firstName: string, email: string | null): void {
  fake.seed(COLLECTIONS.CONTACTS, id, {
    companyId: COMPANY, type: 'individual', firstName, lastName: 'Συνθετικός',
    emails: email === null ? [] : [{ email, isPrimary: true, type: 'personal' }],
  });
}

/** Το token, όπως θα το έβρισκε ο άνθρωπος στο email — από το **κείμενο** που έφυγε, ποτέ από τη βάση. */
function tokenIn(message: Sent): string {
  const match = /#t=([^\s]+)/.exec(message.text);
  if (match === null) throw new Error('no link in message');
  return decodeURIComponent(match[1]);
}

function body(overrides: Partial<IssuanceSendBody> = {}): IssuanceSendBody {
  return {
    ...TARGET, expectedStage: 'proposed', audience: 'owner', note: 'Παρακαλούμε μέχρι την Παρασκευή.',
    // Οι σενάριοι του §28 = σύνδεσμος χωρίς κωδικό· το §29 τον ζητά ρητά (`requireAccessCode: true`).
    // §31 — οι υπενθυμίσεις έχουν δική τους σουίτα (`issuance-invitation-reminder.test.ts`).
    expectedOwnerContactId: 'cont_a', informContactIds: ['cont_b'], requireAccessCode: false, sendReminders: false, ...overrides,
  };
}

beforeEach(async () => {
  process.env.ISSUANCE_INVITE_SECRET = 'test-secret-issuance-0123456789abcdef';
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.test';
  fake = new FakeFirestore();
  sent = [];
  delivery = 'accepted';
  deliverInvitationEmail.mockReset().mockImplementation(async (d: Pick<Sent, 'kind' | 'correlation'> & { inviteeEmail: string; compose: (l: string) => Promise<{ subject: string; text: string } | null> }) => {
    const email = await d.compose('el');
    if (email !== null) sent.push({ to: d.inviteeEmail, kind: d.kind, subject: email.subject, text: email.text, correlation: d.correlation });
    return delivery;
  });
  dispatchNotification.mockClear();
  seedProperty([['cont_a', 60], ['cont_b', 40]]);
  seedContact('cont_a', 'Άλφα', 'alfa@example.test');
  seedContact('cont_b', 'Βήτα', 'vita@example.test');
  seedContact('cont_pro', 'Επιθεωρητής', 'pro@example.test');
  await actOnIssuanceAssignment(db(), OFFICE, {
    action: 'propose', ...TARGET, expectedStage: null, professionalContactId: 'cont_pro', qualification: 'energy-inspector-registered', registryNumber: 'ΥΠΕΝ-7',
  }, NOW);
});

describe('ADR-915 §28 — πρόχειρο και προεπισκόπηση', () => {
  it('η προεπισκόπηση λέει ποιος, τι και ποιοι ενημερώνονται — και ΔΕΝ γράφει τίποτα, δεν στέλνει τίποτα', async () => {
    const result = await previewIssuanceMessage(db(), OFFICE, body(), NOW);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.preview.recipient).toEqual({ contactId: 'cont_a', name: 'Άλφα Συνθετικός', email: 'alfa@example.test' });
    expect(result.preview.text).toContain('Επιθεωρητής Συνθετικός');
    expect(result.preview.text).toContain('Παρακαλούμε μέχρι την Παρασκευή.');
    expect(result.preview.coOwners).toEqual([{ contactId: 'cont_b', name: 'Βήτα Συνθετικός', reachable: true }]);
    expect(result.preview.coOwnerMessage?.text).toContain('Άλφα Συνθετικός');
    expect(invitations()).toEqual([]);
    expect(assignment()).toMatchObject({ approvalRequest: null });
    expect(deliverInvitationEmail).not.toHaveBeenCalled();
  });

  it('🔴 ο πελάτης δεν βάζει ξένο συνιδιοκτήτη, ούτε τον ίδιο τον υπεύθυνο, στους «ενημερωμένους»', async () => {
    for (const informContactIds of [['cont_stranger'], ['cont_a']]) {
      expect(await sendIssuanceMessage(db(), OFFICE, body({ informContactIds }), NOW)).toEqual({ ok: false, refusal: 'co-owner-unknown' });
    }
    expect(invitations()).toEqual([]);
  });

  it('παραλήπτης χωρίς email ⇒ `no-email`, τίποτα δεν γράφεται', async () => {
    seedContact('cont_a', 'Άλφα', null);
    expect(await sendIssuanceMessage(db(), OFFICE, body(), NOW)).toEqual({ ok: false, refusal: 'no-email' });
    expect(invitations()).toEqual([]);
  });

  it('λείπει το μυστικό ⇒ `secret-missing`, ΚΑΜΙΑ εγγραφή και κανένα email', async () => {
    delete process.env.ISSUANCE_INVITE_SECRET;
    expect(await sendIssuanceMessage(db(), OFFICE, body(), NOW)).toEqual({ ok: false, refusal: 'secret-missing' });
    expect(invitations()).toEqual([]);
    expect(deliverInvitationEmail).not.toHaveBeenCalled();
  });
});

describe('ADR-915 §28 — αποστολή για έγκριση', () => {
  it('ΜΙΑ συναλλαγή: η ανάθεση θυμάται τον σύνδεσμο που γράφτηκε· το email φεύγει μετά, ένα ανά πρόσωπο, ποτέ cc', async () => {
    const result = await sendIssuanceMessage(db(), OFFICE, body(), NOW);
    expect(result).toEqual({ ok: true, stage: 'proposed', delivery: { recipient: 'accepted', coOwners: { cont_b: 'accepted' } }, accessCode: null });
    const [invitation] = invitations();
    expect(invitation).toMatchObject({ state: 'pending', audience: 'owner', contactId: 'cont_a', inviteeEmail: 'alfa@example.test', companyId: COMPANY });
    expect(assignment()).toMatchObject({
      approvalRequest: { invitationId: invitation?.id, ownerContactId: 'cont_a', delivery: { recipient: 'accepted', coOwners: { cont_b: 'accepted' } } },
    });
    expect(sent.map((message) => [message.to, message.kind])).toEqual([
      ['alfa@example.test', 'document-issuance'],
      ['vita@example.test', 'document-issuance-notice'],
    ]);
    expect(sent[0]?.text).toContain('https://app.example.test/document-request#t=');
    expect(sent[1]?.text).not.toContain('document-request');
  });

  it('το email δεν έφυγε ⇒ η πράξη ΜΕΝΕΙ (ο σύνδεσμος υπάρχει) και η αποτυχία ΛΕΓΕΤΑΙ', async () => {
    delivery = 'failed';
    const result = await sendIssuanceMessage(db(), OFFICE, body({ informContactIds: [] }), NOW);
    expect(result).toEqual({ ok: true, stage: 'proposed', delivery: { recipient: 'failed', coOwners: {} }, accessCode: null });
    expect(assignment()).toMatchObject({ approvalRequest: { delivery: { recipient: 'failed' } } });
  });

  it('🔴 αγώνας: το γραφείο ακύρωσε ΑΝΑΜΕΣΑ στο πρόχειρο και τη συναλλαγή ⇒ `stale` — κανένας σύνδεσμος, κανένα email', async () => {
    beforeMint = async () => {
      await actOnIssuanceAssignment(db(), OFFICE, { action: 'cancel', ...TARGET, expectedStage: 'proposed' }, NOW);
    };
    expect(await sendIssuanceMessage(db(), OFFICE, body(), NOW)).toEqual({ ok: false, refusal: 'stale' });
    expect(invitations()).toEqual([]);
    expect(deliverInvitationEmail).not.toHaveBeenCalled();
  });

  it('🔴 CAS: οθόνη που είδε άλλο στάδιο ⇒ καμία αποστολή· υπεύθυνος που άλλαξε ⇒ `lead-changed`', async () => {
    expect(await sendIssuanceMessage(db(), OFFICE, body({ expectedStage: null }), NOW)).toEqual({ ok: false, refusal: 'transition-refused' });
    expect(await sendIssuanceMessage(db(), OFFICE, body({ expectedOwnerContactId: 'cont_b' }), NOW)).toEqual({ ok: false, refusal: 'lead-changed' });
    expect(deliverInvitationEmail).not.toHaveBeenCalled();
  });
});

describe('ADR-915 §28 — ο σύνδεσμος, από την πλευρά του ιδιοκτήτη', () => {
  async function sendAndToken(): Promise<string> {
    await sendIssuanceMessage(db(), OFFICE, body(), NOW);
    const message = sent.find((candidate) => candidate.kind === 'document-issuance');
    if (message === undefined) throw new Error('not sent');
    return tokenIn(message);
  }

  it('η όψη ονομάζει παραλήπτη, γραφείο, επαγγελματία — και ΔΕΝ αλλάζει τίποτα', async () => {
    const token = await sendAndToken();
    const view = await viewIssuanceLink(db(), token, LATER);
    expect(view.kind).toBe('view');
    if (view.kind !== 'view') return;
    expect(view.landing).toMatchObject({ access: 'open', view: {
      audience: 'owner', recipientName: 'Άλφα Συνθετικός', officeName: 'Γραφείο Άλφα', documentKind: 'energy-certificate',
      professional: { name: 'Επιθεωρητής Συνθετικός', qualification: 'energy-inspector-registered', registryNumber: 'ΥΠΕΝ-7' },
      note: 'Παρακαλούμε μέχρι την Παρασκευή.',
    } });
    expect(invitations()[0]).toMatchObject({ state: 'pending', openedAt: null });
    expect(assignment()).toMatchObject({ decision: null });
  });

  it('«Εγκρίνω» ⇒ απόφαση με βάση τον σύνδεσμο, σφραγισμένη πρόσκληση, ειδοποίηση στο γραφείο — δεύτερο κλικ ⇒ `already-used`', async () => {
    const token = await sendAndToken();
    expect(await answerIssuanceLink(db(), token, { answer: 'approve', note: null, accessCode: null }, LATER)).toEqual({ kind: 'answered', answer: 'approve' });
    const [invitation] = invitations();
    expect(assignment()).toMatchObject({ decision: { basis: 'owner-link-approval', invitationId: invitation?.id, ownerContactId: 'cont_a', outcome: 'approved' } });
    expect(invitation).toMatchObject({ state: 'accepted', resolvedByUid: null });
    expect(dispatchNotification).toHaveBeenCalledTimes(1);
    expect(dispatchNotification.mock.calls[0]?.[0]).toMatchObject({
      eventType: 'properties.documentIssuanceAnswered', recipientId: 'user_1', tenantId: COMPANY,
      eventId: `document-issuance:${issuanceAssignmentIdOf(COMPANY, 'prop_1', 'energy-certificate')}:${invitation?.id}:user_1`,
    });
    expect(await answerIssuanceLink(db(), token, { answer: 'approve', note: null, accessCode: null }, LATER)).toEqual({ kind: 'refused', reason: 'already-used' });
  });

  it('🔴 «Αναλαμβάνω» σε σύνδεσμο έγκρισης ⇒ `answer-mismatch`, τίποτα δεν γράφεται', async () => {
    const token = await sendAndToken();
    expect(await answerIssuanceLink(db(), token, { answer: 'accept', note: null, accessCode: null }, LATER)).toEqual({ kind: 'refused', reason: 'answer-mismatch' });
    expect(invitations()[0]).toMatchObject({ state: 'pending' });
  });

  it('🔴 επαναποστολή ⇒ ο ΠΑΛΙΟΣ σύνδεσμος δεν απαντά πια — ανακλήθηκε ΚΑΙ δεν είναι ο τρέχων', async () => {
    const old = await sendAndToken();
    await sendIssuanceMessage(db(), OFFICE, body({ informContactIds: [] }), LATER);
    expect(await answerIssuanceLink(db(), old, { answer: 'approve', note: null, accessCode: null }, LATER)).toMatchObject({ kind: 'refused' });
    expect(assignment()).toMatchObject({ decision: null });
  });

  it('🔴 ο υπεύθυνος άλλαξε μετά την αποστολή ⇒ ο παλιός δεν αποφασίζει (`lead-changed`)', async () => {
    const token = await sendAndToken();
    seedProperty([['cont_a', 40], ['cont_b', 60]]);
    expect(await viewIssuanceLink(db(), token, LATER)).toEqual({ kind: 'refused', reason: 'lead-changed' });
    expect(await answerIssuanceLink(db(), token, { answer: 'approve', note: null, accessCode: null }, LATER)).toEqual({ kind: 'refused', reason: 'lead-changed' });
  });

  it('η καταγραφή του γραφείου κλείνει τον σύνδεσμο ⇒ `superseded`', async () => {
    const token = await sendAndToken();
    await actOnIssuanceAssignment(db(), OFFICE, {
      action: 'decide', ...TARGET, expectedStage: 'proposed', outcome: 'approved', channel: 'phone', note: null, expectedOwnerContactId: 'cont_a',
    }, LATER);
    expect(await answerIssuanceLink(db(), token, { answer: 'reject', note: null, accessCode: null }, LATER)).toEqual({ kind: 'refused', reason: 'superseded' });
  });
});

describe('ADR-915 §28 — ο σύνδεσμος, από την πλευρά του επαγγελματία', () => {
  it('μετά την έγκριση: αποστολή στον επαγγελματία ⇒ «Δεν αναλαμβάνω» με σχόλιο ⇒ `declined`, η μπάλα στο γραφείο', async () => {
    await actOnIssuanceAssignment(db(), OFFICE, {
      action: 'decide', ...TARGET, expectedStage: 'proposed', outcome: 'approved', channel: 'phone', note: null, expectedOwnerContactId: 'cont_a',
    }, NOW);
    const result = await sendIssuanceMessage(db(), OFFICE, body({ audience: 'professional', expectedStage: 'ownerApproved', expectedOwnerContactId: null, informContactIds: [] }), NOW);
    expect(result).toMatchObject({ ok: true, stage: 'sent' });
    const message = sent.find((candidate) => candidate.to === 'pro@example.test');
    if (message === undefined) throw new Error('not sent');
    const token = tokenIn(message);
    expect(await answerIssuanceLink(db(), token, { answer: 'decline', note: 'Εκτός περιοχής.', accessCode: null }, LATER)).toEqual({ kind: 'answered', answer: 'decline' });
    expect(assignment()).toMatchObject({ response: { basis: 'professional-link', outcome: 'declined', note: 'Εκτός περιοχής.' } });
  });
});

describe('ADR-915 §29 — κωδικός πρόσβασης σε δεύτερο κανάλι', () => {
  async function sendWithCode(overrides: Partial<IssuanceSendBody> = {}): Promise<{ readonly token: string; readonly code: string }> {
    const result = await sendIssuanceMessage(db(), OFFICE, body({ requireAccessCode: true, informContactIds: [], ...overrides }), NOW);
    if (!result.ok || result.accessCode === null) throw new Error('not sent with code');
    const message = sent.filter((candidate) => candidate.kind === 'document-issuance').at(-1);
    if (message === undefined) throw new Error('not sent');
    return { token: tokenIn(message), code: result.accessCode };
  }
  const wrongOf = (code: string): string => (code === '000000' ? '111111' : '000000');
  const storedCode = () => (invitations().at(-1) as { accessCode: { failures: number; lockedAt: string | null; verifier: string } }).accessCode;

  it('η αποστολή δίνει τον κωδικό ΜΙΑ φορά στο γραφείο· στη βάση μόνο HMAC· το email λέει «θα σας τον πουν», ΠΟΤΕ τον κωδικό', async () => {
    const { code } = await sendWithCode();
    expect(code).toMatch(/^\d{6}$/);
    expect(storedCode()).toMatchObject({ channel: 'office-relay', failures: 0, lockedAt: null });
    expect(storedCode().verifier).not.toContain(code);
    expect(assignment()).toMatchObject({ approvalRequest: { verification: 'access-code' } });
    const email = sent.find((candidate) => candidate.kind === 'document-issuance');
    expect(email?.text).toContain('6ψήφιος κωδικός');
    expect(email?.text).not.toContain(code);
  });

  it('η όψη πριν τον κωδικό: μόνο «Για» και γραφείο — τίποτα για ακίνητο, έγγραφο, επαγγελματία· καμία προσπάθεια δεν χρεώνεται', async () => {
    const { token } = await sendWithCode();
    const view = await viewIssuanceLink(db(), token, LATER);
    expect(view).toMatchObject({ kind: 'view', landing: { access: 'code-required' } });
    if (view.kind !== 'view' || view.landing.access !== 'code-required') return;
    expect(view.landing.gate).toEqual({ audience: 'owner', recipientName: 'Άλφα Συνθετικός', officeName: 'Γραφείο Άλφα', attemptsLeft: 5 });
    expect(storedCode().failures).toBe(0);
  });

  it('λάθος κωδικός ⇒ `code-wrong` + προσπάθειες που μένουν· σωστός (και με κενό υπαγόρευσης) ⇒ πλήρης όψη', async () => {
    const { token, code } = await sendWithCode();
    expect(await unlockIssuanceLink(db(), token, wrongOf(code), LATER)).toEqual({ kind: 'refused', reason: 'code-wrong', remaining: 4 });
    const spoken = `${code.slice(0, 3)} ${code.slice(3)}`;
    expect(await unlockIssuanceLink(db(), token, spoken, LATER)).toMatchObject({ kind: 'view', view: { documentKind: 'energy-certificate' } });
    expect(storedCode().failures).toBe(1);
  });

  it('🔴 απάντηση ΧΩΡΙΣ κωδικό ⇒ `code-required`, τίποτα δεν γράφεται· ΜΕ κωδικό ⇒ απόφαση `verifiedBy: access-code`', async () => {
    const { token, code } = await sendWithCode();
    expect(await answerIssuanceLink(db(), token, { answer: 'approve', note: null, accessCode: null }, LATER)).toEqual({ kind: 'refused', reason: 'code-required', remaining: 5 });
    expect(assignment()).toMatchObject({ decision: null });
    expect(await answerIssuanceLink(db(), token, { answer: 'approve', note: null, accessCode: code }, LATER)).toEqual({ kind: 'answered', answer: 'approve' });
    expect(assignment()).toMatchObject({ decision: { basis: 'owner-link-approval', verifiedBy: 'access-code', outcome: 'approved' } });
  });

  it('🔴 5ο λάθος ⇒ μόνιμο κλείδωμα + ΜΙΑ ειδοποίηση στο γραφείο· μετά ούτε ο σωστός κωδικός, ούτε η όψη', async () => {
    const { token, code } = await sendWithCode();
    for (const remaining of [4, 3, 2, 1]) {
      expect(await unlockIssuanceLink(db(), token, wrongOf(code), LATER)).toEqual({ kind: 'refused', reason: 'code-wrong', remaining });
    }
    expect(await unlockIssuanceLink(db(), token, wrongOf(code), LATER)).toEqual({ kind: 'refused', reason: 'code-locked', remaining: 0 });
    expect(dispatchNotification).toHaveBeenCalledTimes(1);
    expect(dispatchNotification.mock.calls[0]?.[0]).toMatchObject({ titleKey: 'documentIssuanceAnswered.locked', eventId: expect.stringMatching(/:locked$/) });
    expect(await answerIssuanceLink(db(), token, { answer: 'approve', note: null, accessCode: code }, LATER)).toEqual({ kind: 'refused', reason: 'code-locked', remaining: 0 });
    expect(await viewIssuanceLink(db(), token, LATER)).toEqual({ kind: 'refused', reason: 'code-locked', remaining: 0 });
    expect(dispatchNotification).toHaveBeenCalledTimes(1);
    expect(assignment()).toMatchObject({ decision: null });
  });

  it('🔴 ασφαλής προεπιλογή: σώμα χωρίς `requireAccessCode` (παλιός πελάτης) ⇒ ΖΗΤΑ κωδικό', () => {
    const { requireAccessCode: _omitted, ...legacy } = body();
    expect(issuanceSendBody.parse(legacy).requireAccessCode).toBe(true);
  });

  it('🔴 αγώνας: ο σύνδεσμος κλείδωσε ΑΝΑΜΕΣΑ στον έλεγχο και τη σφράγιση ⇒ καμία απάντηση (ο φραγμός μέσα στη συναλλαγή)', async () => {
    const { token, code } = await sendWithCode();
    afterAccessCheck = async () => {
      const [invitation] = invitations() as { id: string; accessCode: Record<string, unknown> }[];
      if (invitation === undefined) throw new Error('no invitation');
      await fake.collection(COLLECTIONS.DOCUMENT_ISSUANCE_INVITATIONS).doc(invitation.id).update({ accessCode: { ...invitation.accessCode, lockedAt: NOW.toISOString() } });
    };
    expect(await answerIssuanceLink(db(), token, { answer: 'approve', note: null, accessCode: code }, LATER)).toMatchObject({ kind: 'refused', reason: 'code-locked' });
    expect(assignment()).toMatchObject({ decision: null });
    expect(invitations()[0]).toMatchObject({ state: 'pending' });
  });

  it('🔴 αγώνας: δύο ταυτόχρονα λάθη ⇒ ΔΥΟ αποτυχίες (καμία δεν «ξεχνιέται»)', async () => {
    const { token, code } = await sendWithCode();
    await Promise.all([unlockIssuanceLink(db(), token, wrongOf(code), LATER), unlockIssuanceLink(db(), token, wrongOf(code), LATER)]);
    expect(storedCode().failures).toBe(2);
  });

  it('🔴 ο κωδικός είναι δεμένος στο αίτημα: ο κωδικός της ΠΑΛΙΑΣ αποστολής δεν ανοίγει τη νέα', async () => {
    const first = await sendWithCode();
    const second = await sendWithCode();
    if (first.code === second.code) return; // 1 στο 10⁶ — δεν αποδεικνύει τίποτα, ούτε διαψεύδει
    expect(await unlockIssuanceLink(db(), second.token, first.code, LATER)).toMatchObject({ kind: 'refused', reason: 'code-wrong' });
  });
});

describe('ADR-915 §30 — απόδειξη απάντησης στη διεύθυνση του συνδέσμου', () => {
  const receipts = () => sent.filter((message) => message.kind === 'document-issuance-receipt');

  async function ownerToken(overrides: Partial<IssuanceSendBody> = {}): Promise<{ readonly token: string; readonly code: string | null }> {
    const result = await sendIssuanceMessage(db(), OFFICE, body({ informContactIds: [], ...overrides }), NOW);
    const message = sent.filter((candidate) => candidate.kind === 'document-issuance').at(-1);
    if (!result.ok || message === undefined) throw new Error('not sent');
    return { token: tokenIn(message), code: result.accessCode };
  }

  it('«Εγκρίνω» ⇒ ΜΙΑ απόδειξη στη διεύθυνση της πρόσκλησης: τι, πότε, πώς, «δεν ήσασταν εσείς;» — χωρίς σύνδεσμο', async () => {
    const { token } = await ownerToken();
    await answerIssuanceLink(db(), token, { answer: 'approve', note: null, accessCode: null }, LATER);
    expect(receipts().map((message) => message.to)).toEqual(['alfa@example.test']);
    const [receipt] = receipts();
    expect(receipt?.subject).toContain('Καταγράψαμε την απάντησή σας');
    expect(receipt?.text).toContain('Εγκρίνατε την ανάθεση');
    expect(receipt?.text).toContain('Επιθεωρητής Συνθετικός');
    expect(receipt?.text).toContain('Δεν ήσασταν εσείς;');
    expect(receipt?.text).toContain('Γραφείο Άλφα');
    expect(receipt?.text).toContain('Με τον σύνδεσμο που στάλθηκε σε αυτή τη διεύθυνση');
    expect(receipt?.text).not.toContain('document-request');
    expect(receipt?.text).not.toContain('#t=');
  });

  it('🔴 δεύτερο κλικ (`already-used`) ⇒ καμία δεύτερη απόδειξη· λάθος απάντηση (`answer-mismatch`) ⇒ καμία', async () => {
    const { token } = await ownerToken();
    expect(await answerIssuanceLink(db(), token, { answer: 'accept', note: null, accessCode: null }, LATER)).toMatchObject({ kind: 'refused' });
    expect(receipts()).toEqual([]);
    await answerIssuanceLink(db(), token, { answer: 'reject', note: null, accessCode: null }, LATER);
    await answerIssuanceLink(db(), token, { answer: 'reject', note: null, accessCode: null }, LATER);
    expect(receipts()).toHaveLength(1);
    expect(receipts()[0]?.text).toContain('Δεν εγκρίνατε');
  });

  it('με κωδικό ⇒ «με τον κωδικό πρόσβασης» — ο ίδιος ο κωδικός ΠΟΤΕ στην απόδειξη', async () => {
    const { token, code } = await ownerToken({ requireAccessCode: true });
    if (code === null) throw new Error('no code');
    await answerIssuanceLink(db(), token, { answer: 'approve', note: null, accessCode: code }, LATER);
    expect(receipts()[0]?.text).toContain('Με τον σύνδεσμο και τον κωδικό πρόσβασης');
    expect(receipts()[0]?.text).not.toContain(code);
  });

  it('ο επαγγελματίας αρνείται με σχόλιο ⇒ η απόδειξη πάει σε ΕΚΕΙΝΟΝ και του επιστρέφει το σχόλιό του', async () => {
    await actOnIssuanceAssignment(db(), OFFICE, {
      action: 'decide', ...TARGET, expectedStage: 'proposed', outcome: 'approved', channel: 'phone', note: null, expectedOwnerContactId: 'cont_a',
    }, NOW);
    await sendIssuanceMessage(db(), OFFICE, body({ audience: 'professional', expectedStage: 'ownerApproved', expectedOwnerContactId: null, informContactIds: [] }), NOW);
    const message = sent.find((candidate) => candidate.to === 'pro@example.test');
    if (message === undefined) throw new Error('not sent');
    await answerIssuanceLink(db(), tokenIn(message), { answer: 'decline', note: 'Εκτός περιοχής.', accessCode: null }, LATER);
    expect(receipts().map((receipt) => receipt.to)).toEqual(['pro@example.test']);
    expect(receipts()[0]?.text).toContain('Αρνηθήκατε την έκδοση');
    expect(receipts()[0]?.text).toContain('Εκτός περιοχής.');
  });
});

describe('ADR-915 §30 — γεγονότα παράδοσης του παρόχου (Mailgun) πάνω στο ΙΔΙΟ μήνυμα', () => {
  let eventSeq = 0;
  function event(kind: EmailDeliveryEvent['kind'], ref: string | null, recipient = 'alfa@example.test'): EmailDeliveryEvent {
    eventSeq += 1;
    return {
      provider: 'mailgun', providerEventId: `evt_${eventSeq}`, occurredAt: LATER.toISOString(), recipient, kind,
      evidence: kind === 'failed' ? 'mailbox-absent' : null, providerReason: null, smtpCode: null, enhancedCode: null,
      providerMessageId: null, purpose: 'document-issuance-invitation', ref,
    };
  }
  const requestDelivery = () => (assignment() as { approvalRequest: { delivery: unknown } }).approvalRequest.delivery;
  const bounceNotices = () => dispatchNotification.mock.calls.filter(([notice]) => String(notice.eventId).endsWith(':bounced'));

  async function sendForApproval(): Promise<string> {
    await sendIssuanceMessage(db(), OFFICE, body(), NOW);
    const id = invitations()[0]?.id;
    if (typeof id !== 'string') throw new Error('not sent');
    return id;
  }

  it('κάθε μήνυμα ταξιδεύει με συσχέτιση ΤΑΥΤΟΤΗΤΑΣ (ποτέ token, ποτέ διεύθυνση) — παραλήπτης και συνιδιοκτήτης σε ΔΙΚΗ τους θέση', async () => {
    const id = await sendForApproval();
    expect(sent.map((message) => message.correlation)).toEqual([
      { purpose: 'document-issuance-invitation', ref: id },
      { purpose: 'document-issuance-invitation', ref: `${id}/cont_b` },
    ]);
    expect(await applyIssuanceDeliveryEvent(db(), event('delivered', id))).toBe('recorded');
    expect(await applyIssuanceDeliveryEvent(db(), event('failed', `${id}/cont_b`, 'vita@example.test'))).toBe('recorded');
    expect(requestDelivery()).toEqual({ recipient: 'delivered', coOwners: { cont_b: 'bounced' } });
    expect(bounceNotices()).toEqual([]);
  });

  it('🔴 ιδεμποτής + ανεξάρτητος από τη σειρά: επιστροφή μετά το «παραδόθηκε» μένει, ένα καθυστερημένο «παραδόθηκε» δεν τη σβήνει', async () => {
    const id = await sendForApproval();
    const delivered = event('delivered', id);
    expect(await applyIssuanceDeliveryEvent(db(), delivered)).toBe('recorded');
    expect(await applyIssuanceDeliveryEvent(db(), delivered)).toBe('unchanged');
    expect(await applyIssuanceDeliveryEvent(db(), event('failed', id))).toBe('recorded');
    expect(await applyIssuanceDeliveryEvent(db(), event('delivered', id))).toBe('unchanged');
    expect(requestDelivery()).toMatchObject({ recipient: 'bounced' });
  });

  it('επιστροφή στον παραλήπτη ⇒ ειδοποίηση στο γραφείο, με ΔΙΚΟ της ντετερμινιστικό κλειδί· η επανάληψη ζητά το ΙΔΙΟ κλειδί', async () => {
    const id = await sendForApproval();
    const bounce = event('failed', id);
    await applyIssuanceDeliveryEvent(db(), bounce);
    await applyIssuanceDeliveryEvent(db(), bounce);
    const keys = bounceNotices().map(([notice]) => notice.eventId);
    expect(keys).toEqual([`document-issuance:${issuanceAssignmentIdOf(COMPANY, 'prop_1', 'energy-certificate')}:${id}:user_1:bounced`, keys[0]]);
    expect(bounceNotices()[0]?.[0]).toMatchObject({ titleKey: 'documentIssuanceAnswered.bounced', bodyKey: 'documentIssuanceAnswered.bouncedBody', recipientId: 'user_1' });
  });

  it('ο αποστολέας είπε «δεν έφυγε» αλλά ο πάροχος το παρέδωσε ⇒ κερδίζει η αλήθεια του παρόχου', async () => {
    delivery = 'failed';
    const id = await sendForApproval();
    await applyIssuanceDeliveryEvent(db(), event('delivered', id));
    expect(requestDelivery()).toMatchObject({ recipient: 'delivered' });
  });

  it('🔴 αγώνας: το γεγονός ΠΡΟΛΑΒΑΙΝΕΙ την αναφορά του αποστολέα ⇒ πετά (ο πάροχος ξαναστέλνει) — καμία επινοημένη τιμή', async () => {
    const early: Promise<unknown>[] = [];
    const base = deliverInvitationEmail.getMockImplementation();
    deliverInvitationEmail.mockImplementation(async (d: { invitationId: string; kind: string }) => {
      if (d.kind === 'document-issuance') early.push(applyIssuanceDeliveryEvent(db(), event('delivered', d.invitationId)).catch((error: unknown) => error));
      return base?.(d);
    });
    const id = await sendForApproval();
    expect(await early[0]).toBeInstanceOf(IssuanceDeliveryNotReportedError);
    expect(requestDelivery()).toEqual({ recipient: 'accepted', coOwners: { cont_b: 'accepted' } });
    expect(await applyIssuanceDeliveryEvent(db(), event('delivered', id))).toBe('recorded');
    expect(requestDelivery()).toMatchObject({ recipient: 'delivered' });
  });

  it('παλιό μήνυμα (επαναποστολή) ⇒ `stale`· ξένη διεύθυνση ή ξένο σχήμα ⇒ `ignored` — τίποτα δεν γράφεται', async () => {
    const old = await sendForApproval();
    await sendIssuanceMessage(db(), OFFICE, body({ informContactIds: [] }), LATER);
    expect(await applyIssuanceDeliveryEvent(db(), event('failed', old))).toBe('stale');
    const current = invitations().find((invitation) => invitation.id !== old)?.id;
    if (typeof current !== 'string') throw new Error('not resent');
    expect(await applyIssuanceDeliveryEvent(db(), event('failed', current, 'intruder@example.test'))).toBe('ignored');
    for (const ref of [null, '', `${current}/`, `${current}/a/b`]) expect(await applyIssuanceDeliveryEvent(db(), event('failed', ref))).toBe('ignored');
    expect(await applyIssuanceDeliveryEvent(db(), event('deferred', current))).toBe('ignored');
    expect(requestDelivery()).toEqual({ recipient: 'accepted', coOwners: {} });
    expect(bounceNotices()).toEqual([]);
  });

  it('το μητρώο καταναλωτών δρομολογεί ΚΑΤΑ ΣΚΟΠΟ — χωρίς σκοπό ή ref, κανείς', async () => {
    const id = await sendForApproval();
    await announceDeliveryEvent(db(), { ...event('delivered', id), purpose: null });
    expect(requestDelivery()).toMatchObject({ recipient: 'accepted' });
    await announceDeliveryEvent(db(), event('delivered', id));
    expect(requestDelivery()).toMatchObject({ recipient: 'delivered' });
  });
});
