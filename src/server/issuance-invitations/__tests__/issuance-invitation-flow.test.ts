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
import type { IssuanceSendBody } from '@/lib/document-validity/issuance-request';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { issuanceAssignmentIdOf } from '@/services/document-registry/issuance-assignment-schema';
import { actOnIssuanceAssignment } from '@/services/document-registry/issuance-assignment.service';
import { answerIssuanceLink, viewIssuanceLink } from '@/server/issuance-invitations/issuance-invitation-answer';
import { previewIssuanceMessage, sendIssuanceMessage } from '@/server/issuance-invitations/issuance-invitation-send';

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

/* eslint-disable @typescript-eslint/no-require-imports */
const { deliverInvitationEmail } = require('@/server/invitations/invitation-notice') as { deliverInvitationEmail: jest.Mock };
const { dispatchNotification } = require('@/server/notifications/notification-orchestrator') as { dispatchNotification: jest.Mock };
/* eslint-enable @typescript-eslint/no-require-imports */

interface Sent { readonly to: string; readonly kind: string; readonly subject: string; readonly text: string }

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
    expectedOwnerContactId: 'cont_a', informContactIds: ['cont_b'], ...overrides,
  };
}

beforeEach(async () => {
  process.env.ISSUANCE_INVITE_SECRET = 'test-secret-issuance-0123456789abcdef';
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.test';
  fake = new FakeFirestore();
  sent = [];
  delivery = 'accepted';
  deliverInvitationEmail.mockReset().mockImplementation(async (d: { inviteeEmail: string; kind: string; compose: (l: string) => Promise<{ subject: string; text: string } | null> }) => {
    const email = await d.compose('el');
    if (email !== null) sent.push({ to: d.inviteeEmail, kind: d.kind, subject: email.subject, text: email.text });
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
    expect(result).toEqual({ ok: true, stage: 'proposed', delivery: { recipient: 'accepted', coOwners: { cont_b: 'accepted' } } });
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
    expect(result).toEqual({ ok: true, stage: 'proposed', delivery: { recipient: 'failed', coOwners: {} } });
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
    expect(view.view).toMatchObject({
      audience: 'owner', recipientName: 'Άλφα Συνθετικός', officeName: 'Γραφείο Άλφα', documentKind: 'energy-certificate',
      professional: { name: 'Επιθεωρητής Συνθετικός', qualification: 'energy-inspector-registered', registryNumber: 'ΥΠΕΝ-7' },
      note: 'Παρακαλούμε μέχρι την Παρασκευή.',
    });
    expect(invitations()[0]).toMatchObject({ state: 'pending', openedAt: null });
    expect(assignment()).toMatchObject({ decision: null });
  });

  it('«Εγκρίνω» ⇒ απόφαση με βάση τον σύνδεσμο, σφραγισμένη πρόσκληση, ειδοποίηση στο γραφείο — δεύτερο κλικ ⇒ `already-used`', async () => {
    const token = await sendAndToken();
    expect(await answerIssuanceLink(db(), token, { answer: 'approve', note: null }, LATER)).toEqual({ kind: 'answered', answer: 'approve' });
    const [invitation] = invitations();
    expect(assignment()).toMatchObject({ decision: { basis: 'owner-link-approval', invitationId: invitation?.id, ownerContactId: 'cont_a', outcome: 'approved' } });
    expect(invitation).toMatchObject({ state: 'accepted', resolvedByUid: null });
    expect(dispatchNotification).toHaveBeenCalledTimes(1);
    expect(dispatchNotification.mock.calls[0]?.[0]).toMatchObject({
      eventType: 'properties.documentIssuanceAnswered', recipientId: 'user_1', tenantId: COMPANY,
      eventId: `document-issuance:${issuanceAssignmentIdOf(COMPANY, 'prop_1', 'energy-certificate')}:${invitation?.id}:user_1`,
    });
    expect(await answerIssuanceLink(db(), token, { answer: 'approve', note: null }, LATER)).toEqual({ kind: 'refused', reason: 'already-used' });
  });

  it('🔴 «Αναλαμβάνω» σε σύνδεσμο έγκρισης ⇒ `answer-mismatch`, τίποτα δεν γράφεται', async () => {
    const token = await sendAndToken();
    expect(await answerIssuanceLink(db(), token, { answer: 'accept', note: null }, LATER)).toEqual({ kind: 'refused', reason: 'answer-mismatch' });
    expect(invitations()[0]).toMatchObject({ state: 'pending' });
  });

  it('🔴 επαναποστολή ⇒ ο ΠΑΛΙΟΣ σύνδεσμος δεν απαντά πια — ανακλήθηκε ΚΑΙ δεν είναι ο τρέχων', async () => {
    const old = await sendAndToken();
    await sendIssuanceMessage(db(), OFFICE, body({ informContactIds: [] }), LATER);
    expect(await answerIssuanceLink(db(), old, { answer: 'approve', note: null }, LATER)).toMatchObject({ kind: 'refused' });
    expect(assignment()).toMatchObject({ decision: null });
  });

  it('🔴 ο υπεύθυνος άλλαξε μετά την αποστολή ⇒ ο παλιός δεν αποφασίζει (`lead-changed`)', async () => {
    const token = await sendAndToken();
    seedProperty([['cont_a', 40], ['cont_b', 60]]);
    expect(await viewIssuanceLink(db(), token, LATER)).toEqual({ kind: 'refused', reason: 'lead-changed' });
    expect(await answerIssuanceLink(db(), token, { answer: 'approve', note: null }, LATER)).toEqual({ kind: 'refused', reason: 'lead-changed' });
  });

  it('η καταγραφή του γραφείου κλείνει τον σύνδεσμο ⇒ `superseded`', async () => {
    const token = await sendAndToken();
    await actOnIssuanceAssignment(db(), OFFICE, {
      action: 'decide', ...TARGET, expectedStage: 'proposed', outcome: 'approved', channel: 'phone', note: null, expectedOwnerContactId: 'cont_a',
    }, LATER);
    expect(await answerIssuanceLink(db(), token, { answer: 'reject', note: null }, LATER)).toEqual({ kind: 'refused', reason: 'superseded' });
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
    expect(await answerIssuanceLink(db(), token, { answer: 'decline', note: 'Εκτός περιοχής.' }, LATER)).toEqual({ kind: 'answered', answer: 'decline' });
    expect(assignment()).toMatchObject({ response: { basis: 'professional-link', outcome: 'declined', note: 'Εκτός περιοχής.' } });
  });
});
