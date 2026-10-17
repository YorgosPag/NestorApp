/**
 * @jest-environment node
 *
 * @fileoverview ADR-915 §31 — **οι υπενθυμίσεις του συνδέσμου** πάνω στο fake Firestore, χωρίς mocks βάσης: αποστολή από το
 *   γραφείο → πρόγραμμα (μόνο αν το email έφυγε) → σάρωση (ώρες γραφείου · η ΙΔΙΑ κρίση με τη σελίδα) → νέος σύνδεσμος της
 *   ΙΔΙΑΣ πρόσκλησης → email χωρίς κωδικό → CAS. Μόνο το email και ο orchestrator είναι mocks. Όλα τα δεδομένα συνθετικά.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { IssuanceSendBody } from '@/lib/document-validity/issuance-request';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { issuanceAssignmentIdOf } from '@/services/document-registry/issuance-assignment-schema';
import { actOnIssuanceAssignment } from '@/services/document-registry/issuance-assignment.service';
import { answerIssuanceLink, viewIssuanceLink } from '@/server/issuance-invitations/issuance-invitation-answer';
import { sendIssuanceMessage } from '@/server/issuance-invitations/issuance-invitation-send';
import { sweepIssuanceInvitationReminders } from '@/server/issuance-invitations/issuance-invitation-reminder';
import { applyIssuanceDeliveryEvent } from '@/server/issuance-invitations/issuance-delivery-events';
import { ISSUANCE_LINK_REISSUE_CAP } from '@/server/issuance-invitations/issuance-invitation-kind';
import type { EmailDeliveryEvent } from '@/types/email-delivery';

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('@/services/entity-audit.service', () => ({ EntityAuditService: { recordChange: jest.fn(async () => 'eaud_1') } }));
jest.mock('@/lib/workspace/workspace-catalog', () => ({ readWorkspaceName: jest.fn(async () => 'Γραφείο Άλφα') }));
jest.mock('@/server/notifications/notification-orchestrator', () => ({ dispatchNotification: jest.fn(async () => ({ skipped: false })) }));
jest.mock('@/server/invitations/invitation-notice', () => ({ deliverInvitationEmail: jest.fn() }));

/* eslint-disable @typescript-eslint/no-require-imports */
const { deliverInvitationEmail } = require('@/server/invitations/invitation-notice') as { deliverInvitationEmail: jest.Mock };
/* eslint-enable @typescript-eslint/no-require-imports */

interface Sent { readonly to: string; readonly kind: string; readonly subject: string; readonly text: string; readonly correlation?: { readonly purpose: string; readonly ref: string } }

const COMPANY = 'comp_alfa';
/** Σάββατο 17/10, 12:00 Αθήνα — η αποστολή του γραφείου. */
const SENT_AT = new Date('2026-10-17T09:00:00.000Z');
/** Τρίτη 20/10, 13:00 Αθήνα — 72 ώρες + 1 μετά: η πρώτη υπενθύμιση οφείλεται, μέσα σε ώρες γραφείου. */
const FIRST_DUE = new Date('2026-10-20T10:00:00.000Z');
/** Παρασκευή 23/10, 13:00 Αθήνα — την παραμονή της λήξης (24/10 12:00). */
const SECOND_DUE = new Date('2026-10-23T10:00:00.000Z');
const OFFICE = { companyId: COMPANY, uid: 'user_1', name: 'agent@example.test' };
const TARGET = { propertyId: 'prop_1', documentKind: 'energy-certificate' } as const;

let fake: FakeFirestore;
let sent: Sent[];
let outcome: 'accepted' | 'failed';
const db = (): AdminFirestore => fake as unknown as AdminFirestore;
const assignment = () => fake.getAllDocs(COLLECTIONS.DOCUMENT_ISSUANCE_ASSIGNMENTS)[issuanceAssignmentIdOf(COMPANY, 'prop_1', 'energy-certificate')] as {
  approvalRequest: { reminders: { dueAt: string | null; sentAt: string[] } | null } | null;
};
const invitations = () => Object.values(fake.getAllDocs(COLLECTIONS.DOCUMENT_ISSUANCE_INVITATIONS)) as { id: string; reissuedNonceHashes?: string[]; accessCode: Record<string, unknown> | null }[];
const reminders = () => assignment().approvalRequest?.reminders ?? null;
const reminderEmails = () => sent.filter((message) => message.kind === 'document-issuance-reminder');

function tokenIn(message: Sent): string {
  const match = /#t=([^\s]+)/.exec(message.text);
  if (match === null) throw new Error('no link in message');
  return decodeURIComponent(match[1]);
}

function body(overrides: Partial<IssuanceSendBody> = {}): IssuanceSendBody {
  return {
    ...TARGET, expectedStage: 'proposed', audience: 'owner', note: 'Παρακαλούμε μέχρι την Παρασκευή.',
    expectedOwnerContactId: 'cont_a', informContactIds: [], requireAccessCode: true, sendReminders: true, ...overrides,
  };
}

async function send(overrides: Partial<IssuanceSendBody> = {}): Promise<{ readonly token: string; readonly code: string | null; readonly id: string }> {
  const result = await sendIssuanceMessage(db(), OFFICE, body(overrides), SENT_AT);
  if (!result.ok) throw new Error(`not sent: ${result.refusal}`);
  const message = sent.at(-1);
  const id = invitations().at(-1)?.id;
  if (message === undefined || id === undefined) throw new Error('no message');
  return { token: tokenIn(message), code: result.accessCode, id };
}

beforeEach(async () => {
  process.env.ISSUANCE_INVITE_SECRET = 'test-secret-issuance-0123456789abcdef';
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.test';
  fake = new FakeFirestore();
  sent = [];
  outcome = 'accepted';
  deliverInvitationEmail.mockReset().mockImplementation(async (d: Pick<Sent, 'kind' | 'correlation'> & { inviteeEmail: string; compose: (l: string) => Promise<{ subject: string; text: string } | null> }) => {
    const email = await d.compose('el');
    if (email !== null) sent.push({ to: d.inviteeEmail, kind: d.kind, subject: email.subject, text: email.text, correlation: d.correlation });
    return d.kind === 'document-issuance-reminder' ? outcome : 'accepted';
  });
  fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', {
    companyId: COMPANY, name: 'Διαμέρισμα Α1', energy: { class: 'B', issuedOn: '2016-11-01', sourceFileId: null },
    commercial: { legalPhase: 'final_signed', owners: [{ contactId: 'cont_a', ownershipPct: 100 }] },
  });
  for (const [id, firstName, email] of [['cont_a', 'Άλφα', 'alfa@example.test'], ['cont_pro', 'Επιθεωρητής', 'pro@example.test']] as const) {
    fake.seed(COLLECTIONS.CONTACTS, id, { companyId: COMPANY, type: 'individual', firstName, lastName: 'Συνθετικός', emails: [{ email, isPrimary: true, type: 'personal' }] });
  }
  await actOnIssuanceAssignment(db(), OFFICE, {
    action: 'propose', ...TARGET, expectedStage: null, professionalContactId: 'cont_pro', qualification: 'energy-inspector-registered', registryNumber: 'ΥΠΕΝ-7',
  }, SENT_AT);
});

describe('ADR-915 §31 — το πρόγραμμα γεννιέται ΜΟΝΟ από το χειροκίνητο μήνυμα που έφυγε', () => {
  it('72 ώρες μετά · την παραμονή της λήξης — γραμμένο στο μήνυμα, όχι υπολογισμένο στη σάρωση', async () => {
    await send();
    expect(reminders()).toEqual({ dueAt: '2026-10-20T09:00:00.000Z', sentAt: [] });
  });

  it('🔴 email που ΔΕΝ έφυγε ⇒ κανένα πρόγραμμα — ποτέ αυτόματη «πρώτη» αποστολή', async () => {
    deliverInvitationEmail.mockImplementationOnce(async () => 'failed');
    await sendIssuanceMessage(db(), OFFICE, body(), SENT_AT);
    expect(reminders()).toBeNull();
    expect(await sweepIssuanceInvitationReminders(db(), FIRST_DUE)).toMatchObject({ considered: 0, reminded: 0 });
    expect(sent).toEqual([]);
  });

  it('ο διακόπτης κλειστός ⇒ καμία υπενθύμιση', async () => {
    await send({ sendReminders: false });
    expect(reminders()).toBeNull();
  });
});

describe('ADR-915 §31 — η σάρωση', () => {
  it('πριν την ώρα ⇒ τίποτα· στην ώρα ⇒ ΜΙΑ υπενθύμιση, ίδια συσχέτιση, ΧΩΡΙΣ τον κωδικό· η επανάληψη δεν ξαναστέλνει', async () => {
    const { id, code } = await send();
    expect(await sweepIssuanceInvitationReminders(db(), new Date('2026-10-19T10:00:00.000Z'))).toMatchObject({ considered: 0 });
    expect(await sweepIssuanceInvitationReminders(db(), FIRST_DUE)).toMatchObject({ considered: 1, reminded: 1, failed: 0 });
    const [reminder] = reminderEmails();
    expect(reminder?.to).toBe('alfa@example.test');
    expect(reminder?.subject.startsWith('Υπενθύμιση: ')).toBe(true);
    expect(reminder?.text).toContain('Χρησιμοποιήστε τον κωδικό που σας είπε το γραφείο');
    expect(reminder?.text).toContain('«Δεν εγκρίνω»');
    expect(reminder?.text).toContain('Παρακαλούμε μέχρι την Παρασκευή.');
    expect(reminder?.text).not.toContain(code ?? 'no-code');
    expect(reminder?.correlation).toEqual({ purpose: 'document-issuance-invitation', ref: id });
    expect(reminders()).toEqual({ dueAt: '2026-10-23T09:00:00.000Z', sentAt: [FIRST_DUE.toISOString()] });
    expect(await sweepIssuanceInvitationReminders(db(), FIRST_DUE)).toMatchObject({ considered: 0 });
    expect(reminderEmails()).toHaveLength(1);
  });

  it('🔴 ΚΑΙ ο σύνδεσμος του αρχικού email ΚΑΙ της υπενθύμισης δουλεύουν, με τον ΙΔΙΟ κωδικό — μίας χρήσης ΑΘΡΟΙΣΤΙΚΑ', async () => {
    const { token: original, code } = await send();
    await sweepIssuanceInvitationReminders(db(), FIRST_DUE);
    const [reminder] = reminderEmails();
    if (reminder === undefined) throw new Error('no reminder');
    const fresh = tokenIn(reminder);
    expect(fresh).not.toBe(original);
    expect(await viewIssuanceLink(db(), original, FIRST_DUE)).toMatchObject({ kind: 'view' });
    expect(await viewIssuanceLink(db(), fresh, FIRST_DUE)).toMatchObject({ kind: 'view' });
    expect(await answerIssuanceLink(db(), fresh, { answer: 'approve', note: null, accessCode: code }, FIRST_DUE)).toEqual({ kind: 'answered', answer: 'approve' });
    expect(await answerIssuanceLink(db(), original, { answer: 'reject', note: null, accessCode: code }, FIRST_DUE)).toMatchObject({ kind: 'refused', reason: 'already-used' });
  });

  it('απάντησε ⇒ η επόμενη αποσύρεται, κανένα email', async () => {
    const { token, code } = await send();
    await answerIssuanceLink(db(), token, { answer: 'approve', note: null, accessCode: code }, SENT_AT);
    expect(await sweepIssuanceInvitationReminders(db(), FIRST_DUE)).toMatchObject({ considered: 1, retired: 1, reminded: 0 });
    expect(reminders()?.dueAt).toBeNull();
    expect(reminderEmails()).toEqual([]);
  });

  it('🔴 το email επέστρεψε ⇒ καμία υπενθύμιση (και ούτε μετά το «ανεπιθύμητο»)', async () => {
    const { id } = await send();
    const bounce: EmailDeliveryEvent = {
      provider: 'mailgun', providerEventId: 'evt_1', occurredAt: SENT_AT.toISOString(), recipient: 'alfa@example.test', kind: 'failed',
      evidence: 'mailbox-absent', providerReason: null, smtpCode: null, enhancedCode: null, providerMessageId: null, purpose: 'document-issuance-invitation', ref: id,
    };
    await applyIssuanceDeliveryEvent(db(), bounce);
    expect(await sweepIssuanceInvitationReminders(db(), FIRST_DUE)).toMatchObject({ retired: 1, reminded: 0 });
    expect(reminderEmails()).toEqual([]);
  });

  it('ακύρωση ανάθεσης ⇒ αποσύρεται, κανένα email', async () => {
    await send();
    await actOnIssuanceAssignment(db(), OFFICE, { action: 'cancel', ...TARGET, expectedStage: 'proposed' }, SENT_AT);
    expect(await sweepIssuanceInvitationReminders(db(), FIRST_DUE)).toMatchObject({ retired: 1, reminded: 0 });
    expect(reminderEmails()).toEqual([]);
  });

  it('κλειδωμένος σύνδεσμος (5 λάθη κωδικού) ⇒ αποσύρεται, κανείς δεν τον ξανανοίγει', async () => {
    const { id } = await send();
    const [invitation] = invitations();
    await fake.collection(COLLECTIONS.DOCUMENT_ISSUANCE_INVITATIONS).doc(id).update({ accessCode: { ...invitation?.accessCode, lockedAt: SENT_AT.toISOString() } });
    expect(await sweepIssuanceInvitationReminders(db(), FIRST_DUE)).toMatchObject({ retired: 1, reminded: 0 });
  });

  it('έξω από τις ώρες γραφείου (Σάββατο · 23:00) ⇒ δεν κοιτά καν', async () => {
    await send();
    expect(await sweepIssuanceInvitationReminders(db(), new Date('2026-10-24T09:00:00.000Z'))).toMatchObject({ outsideOfficeHours: true, considered: 0 });
    expect(await sweepIssuanceInvitationReminders(db(), new Date('2026-10-20T20:00:00.000Z'))).toMatchObject({ outsideOfficeHours: true });
    expect(reminderEmails()).toEqual([]);
  });

  it('δεύτερη και τελευταία την παραμονή της λήξης — μετά τίποτα', async () => {
    await send();
    await sweepIssuanceInvitationReminders(db(), FIRST_DUE);
    expect(await sweepIssuanceInvitationReminders(db(), SECOND_DUE)).toMatchObject({ reminded: 1 });
    expect(reminders()).toEqual({ dueAt: null, sentAt: [FIRST_DUE.toISOString(), SECOND_DUE.toISOString()] });
    expect(reminderEmails()).toHaveLength(2);
  });

  it('ο πάροχος αρνήθηκε την υπενθύμιση ⇒ το πρόγραμμα μένει, ξαναδοκιμάζει — φραγμένα από το όριο επανέκδοσης', async () => {
    await send();
    outcome = 'failed';
    for (let hour = 0; hour < ISSUANCE_LINK_REISSUE_CAP; hour += 1) {
      expect(await sweepIssuanceInvitationReminders(db(), new Date(FIRST_DUE.getTime() + hour * 3_600_000))).toMatchObject({ failed: 1 });
    }
    expect(invitations()[0]?.reissuedNonceHashes).toHaveLength(ISSUANCE_LINK_REISSUE_CAP);
    expect(await sweepIssuanceInvitationReminders(db(), new Date(FIRST_DUE.getTime() + 5 * 3_600_000))).toMatchObject({ retired: 1, failed: 0 });
  });

  it('νέα αποστολή ⇒ το νέο μήνυμα έχει ΔΙΚΟ του πρόγραμμα· ο παλιός σύνδεσμος δεν υπενθυμίζεται', async () => {
    await send();
    await send({ expectedStage: 'proposed' });
    expect(invitations()).toHaveLength(2);
    expect(await sweepIssuanceInvitationReminders(db(), FIRST_DUE)).toMatchObject({ reminded: 1 });
    const [reminder] = reminderEmails();
    expect(reminder?.correlation?.ref).toBe(invitations()[1]?.id);
  });
});
