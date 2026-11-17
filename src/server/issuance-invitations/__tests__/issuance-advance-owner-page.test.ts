/**
 * @jest-environment node
 *
 * @fileoverview ADR-943 Φ5β — **η σελίδα προκαταβολής του ιδιοκτήτη** πάνω στο fake Firestore, χωρίς mocks βάσης: ποιος
 *   είναι ο πληρωτής (Ζ-2) · ο σύνδεσμος `advance` (Ζ-1: νέος σε κάθε email, φραγμένος, δεμένος στην απόφαση, ζωή χρημάτων)
 *   · ο κωδικός §29 του φακέλου (DocuSign) · η αντίρρηση (Ζ-3) · το αίτημα πληρωμής του γραφείου (§8 #11). Μόνο το email
 *   και ο orchestrator είναι mocks — τα σύνορα με τον έξω κόσμο. Τα γεγονότα χρημάτων γράφονται κατευθείαν στην ανάθεση
 *   (τα γράφει ο πάροχος — έχει δική του σουίτα). Όλα τα δεδομένα είναι **συνθετικά**.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { IssuanceLinkAnswerBody, IssuanceSendBody, QuoteTermsBody } from '@/lib/document-validity/issuance-request';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { issuanceAssignmentIdOf } from '@/services/document-registry/issuance-assignment-schema';
import { actOnIssuanceAssignment } from '@/services/document-registry/issuance-assignment.service';
import { objectToIssuanceAdvance } from '@/server/issuance-invitations/issuance-advance-objection';
import { requestAdvancePaymentFromOffice } from '@/server/issuance-invitations/issuance-advance-payment-request';
import { answerIssuanceLink, unlockIssuanceLink, viewIssuanceLink } from '@/server/issuance-invitations/issuance-invitation-answer';
import { sendIssuanceMessage } from '@/server/issuance-invitations/issuance-invitation-send';

jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('@/services/entity-audit.service', () => ({ EntityAuditService: { recordChange: jest.fn(async () => 'eaud_1') } }));
jest.mock('@/lib/workspace/workspace-catalog', () => ({ readWorkspaceName: jest.fn(async () => 'Γραφείο Άλφα') }));
jest.mock('@/server/notifications/notification-orchestrator', () => ({ dispatchNotification: jest.fn(async () => ({ skipped: false })) }));
jest.mock('@/server/invitations/invitation-notice', () => ({ deliverInvitationEmail: jest.fn() }));
jest.mock('@/server/issuance-invitations/issuance-space-invite', () => ({ engageApprovedProfessional: jest.fn(async () => undefined) }));

/* eslint-disable @typescript-eslint/no-require-imports */
const { deliverInvitationEmail } = require('@/server/invitations/invitation-notice') as { deliverInvitationEmail: jest.Mock };
const { dispatchNotification } = require('@/server/notifications/notification-orchestrator') as { dispatchNotification: jest.Mock };
/* eslint-enable @typescript-eslint/no-require-imports */

interface Sent { readonly to: string; readonly kind: string; readonly text: string }

const COMPANY = 'comp_alfa';
const DAY = 86_400_000;
const NOW = new Date('2026-10-17T09:00:00.000Z');
const LATER = new Date('2026-10-17T10:00:00.000Z');
const AFTER_WINDOW = new Date('2026-10-19T09:00:00.000Z');
const OFFICE = { companyId: COMPANY, uid: 'user_1', name: 'agent@example.test' };
const TARGET = { propertyId: 'prop_1', documentKind: 'energy-certificate' } as const;
const ASSIGNMENTS = COLLECTIONS.DOCUMENT_ISSUANCE_ASSIGNMENTS;
const ASSIGNMENT_ID = issuanceAssignmentIdOf(COMPANY, 'prop_1', 'energy-certificate');
const ADVANCE_LINK = 'document-issuance-advance-link';

let fake: FakeFirestore;
let sent: Sent[];
const db = (): AdminFirestore => fake as unknown as AdminFirestore;
type Stored = Record<string, unknown>;
const assignment = (): Stored => fake.getAllDocs(ASSIGNMENTS)[ASSIGNMENT_ID] as Stored;
const invitations = (): Stored[] => Object.values(fake.getAllDocs(COLLECTIONS.DOCUMENT_ISSUANCE_INVITATIONS)) as Stored[];
const advanceLinks = () => invitations().filter((doc) => (doc.purpose as { kind: string } | undefined)?.kind === 'advance');

function seedContact(id: string, firstName: string, email: string | null): void {
  fake.seed(COLLECTIONS.CONTACTS, id, {
    companyId: COMPANY, type: 'individual', firstName, lastName: 'Συνθετικός',
    emails: email === null ? [] : [{ email, isPrimary: true, type: 'personal' }],
  });
}

/** Το token, όπως θα το έβρισκε ο άνθρωπος στο email — από το **κείμενο** που έφυγε, ποτέ από τη βάση. */
function tokenIn(message: Sent | undefined): string {
  const match = message === undefined ? null : /#t=([^\s]+)/.exec(message.text);
  if (match === null) throw new Error('no link in message');
  return decodeURIComponent(match[1]);
}
const lastOfKind = (kind: string): Sent | undefined => [...sent].reverse().find((message) => message.kind === kind);

/** 100,00 € + 24% = 124,00 € · προκαταβολή 40,00 €, μέτρια πολιτική. */
const QUOTE_TERMS: QuoteTermsBody = {
  basis: 'firm', amountMinor: 10_000, vatRatePercent: 24, vatIncluded: false, validUntil: '2026-12-31', scope: ['issuance'],
  deliveryBusinessDays: 5, advance: { amountMinor: 4_000, policy: 'moderate', inspectionValueMinor: 1_500 },
};
const SEND: IssuanceSendBody = {
  ...TARGET, expectedStage: 'quoted', audience: 'owner', note: null, expectedOwnerContactId: 'cont_a', informContactIds: [],
  requireAccessCode: false, sendReminders: false,
};
const approveWith = (accessCode: string | null): IssuanceLinkAnswerBody => ({ answer: 'approve', note: null, accessCode, quoteRevision: 1, ownerAttestation: null });

/** Ο ιδιοκτήτης εγκρίνει **με τον σύνδεσμό του** ⇒ `{ approvalToken, code }` (code μόνο αν ζητήθηκε, §29). */
async function approvedByOwnerLink(requireAccessCode = false): Promise<{ readonly approvalToken: string; readonly code: string | null }> {
  const result = await sendIssuanceMessage(db(), OFFICE, { ...SEND, requireAccessCode }, NOW);
  if (!result.ok) throw new Error(`send: ${result.refusal}`);
  const approvalToken = tokenIn(lastOfKind('document-issuance'));
  const answered = await answerIssuanceLink(db(), approvalToken, approveWith(result.accessCode), NOW);
  if (answered.kind !== 'answered') throw new Error(`answer: ${answered.kind}`);
  return { approvalToken, code: result.accessCode };
}

/** Τα χρήματα όπως θα τα έγραφε ο πάροχος: πληρώθηκαν, και (προαιρετικά) δηλώθηκε αυτοψία στο `NOW`. */
function seedMoney(events: readonly ('funded' | 'started' | 'released')[]): void {
  const at = NOW.toISOString();
  const advanceEvents = events.map((event) => {
    switch (event) {
      case 'funded': return { kind: 'funded', amountMinor: 4_000, paymentReference: 'pmt_1', withdrawalWaiverAt: at, at };
      case 'started': return { kind: 'work-started', at, byUid: 'uid_pro', engagementId: 'eng_1' };
      case 'released': return { kind: 'released', amountMinor: 4_000, transferReference: 'tra_1', basis: 'window-elapsed', at };
    }
  });
  fake.seed(ASSIGNMENTS, ASSIGNMENT_ID, { ...assignment(), advanceEvents });
}

const officeRequest = (at: Date, requireAccessCode = false) =>
  requestAdvancePaymentFromOffice(db(), { companyId: COMPANY, uid: 'user_1' }, { ...TARGET, requireAccessCode }, at);

beforeEach(async () => {
  process.env.ISSUANCE_INVITE_SECRET = 'test-secret-issuance-0123456789abcdef';
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.test';
  fake = new FakeFirestore();
  sent = [];
  deliverInvitationEmail.mockReset().mockImplementation(async (d: { kind: string; inviteeEmail: string; compose: (l: string) => Promise<{ text: string } | null> }) => {
    const email = await d.compose('el');
    if (email !== null) sent.push({ to: d.inviteeEmail, kind: d.kind, text: email.text });
    return 'accepted';
  });
  dispatchNotification.mockClear();
  fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', {
    companyId: COMPANY, name: 'Διαμέρισμα Α1', energy: { class: 'B', issuedOn: '2016-11-01', sourceFileId: null },
    commercial: { legalPhase: 'final_signed', owners: [{ contactId: 'cont_a', ownershipPct: 100 }] },
  });
  seedContact('cont_a', 'Άλφα', 'alfa@example.test');
  seedContact('cont_pro', 'Επιθεωρητής', 'pro@example.test');
  await actOnIssuanceAssignment(db(), OFFICE, {
    action: 'propose', ...TARGET, expectedStage: null, professionalContactId: 'cont_pro', qualification: 'energy-inspector-registered', registryNumber: 'ΥΠΕΝ-7',
  }, NOW);
  await actOnIssuanceAssignment(db(), OFFICE, { action: 'notify', ...TARGET, expectedStage: 'proposed', channel: 'phone' }, NOW);
  await actOnIssuanceAssignment(db(), OFFICE, { action: 'record-quote', ...TARGET, expectedStage: 'sent', terms: QUOTE_TERMS, note: null }, NOW);
});

describe('ADR-943 Φ5β Ζ-1/Ζ-2 — ο σύνδεσμος προκαταβολής και ο πληρωτής', () => {
  it('αίτημα πληρωμής ⇒ νέος σύνδεσμος `advance` δεμένος στην απόφαση· οδηγεί στη σελίδα προκαταβολής, ΠΟΤΕ στη φόρμα απάντησης', async () => {
    await approvedByOwnerLink();
    const result = await officeRequest(LATER);
    expect(result).toMatchObject({ ok: true, delivery: 'accepted', accessCode: null });
    const [link] = advanceLinks();
    const decision = assignment().decision as { at: string; invitationId: string };
    expect(link).toMatchObject({ state: 'pending', contactId: 'cont_a', purpose: { kind: 'advance', decidedAt: decision.at, codeHolderId: decision.invitationId } });
    const message = lastOfKind(ADVANCE_LINK);
    expect(message?.to).toBe('alfa@example.test');
    const token = tokenIn(message);
    const view = await viewIssuanceLink(db(), token, LATER);
    expect(view).toMatchObject({ kind: 'view', landing: { access: 'advance', advance: { state: 'awaiting-payment', canObject: false, releaseAt: null } } });
    expect(await answerIssuanceLink(db(), token, approveWith(null), LATER)).toEqual({ kind: 'refused', reason: 'answer-mismatch' });
  });

  it('η υπογραφή ζει 120 ημέρες· ο εγκεκριμένος σύνδεσμος (7 ημέρες) ΔΕΝ', async () => {
    await approvedByOwnerLink();
    await officeRequest(LATER);
    const [link] = advanceLinks();
    expect(Date.parse(String(link?.expiresAt)) - LATER.getTime()).toBe(120 * DAY);
  });

  it('έγκριση που ΚΑΤΕΓΡΑΨΕ το γραφείο ⇒ ο ιδιοκτήτης της απόφασης πληρώνει με τον σύνδεσμο προκαταβολής (§8 #11)', async () => {
    await actOnIssuanceAssignment(db(), OFFICE, {
      action: 'decide', ...TARGET, expectedStage: 'quoted', outcome: 'approved', channel: 'phone', note: null, expectedOwnerContactId: 'cont_a', quoteRevision: 1,
    }, NOW);
    expect(await officeRequest(LATER)).toMatchObject({ ok: true });
    expect(advanceLinks()[0]).toMatchObject({ purpose: { codeHolderId: null } });
    const view = await viewIssuanceLink(db(), tokenIn(lastOfKind(ADVANCE_LINK)), LATER);
    expect(view).toMatchObject({ kind: 'view', landing: { access: 'advance' } });
  });

  it('νέα απόφαση ⇒ ο σύνδεσμος της παλιάς είναι `superseded`, από κατασκευή', async () => {
    await approvedByOwnerLink();
    await officeRequest(LATER);
    const token = tokenIn(lastOfKind(ADVANCE_LINK));
    fake.seed(ASSIGNMENTS, ASSIGNMENT_ID, { ...assignment(), decision: { ...(assignment().decision as Stored), at: LATER.toISOString() } });
    expect(await viewIssuanceLink(db(), token, LATER)).toEqual({ kind: 'refused', reason: 'superseded' });
  });

  it('φραγμένοι ζωντανοί: ο 4ος σύνδεσμος ανακαλεί τον παλαιότερο — οι 3 νεότεροι ζουν', async () => {
    await approvedByOwnerLink();
    const tokens: string[] = [];
    for (let minute = 1; minute <= 4; minute += 1) {
      await officeRequest(new Date(LATER.getTime() + minute * 60_000));
      tokens.push(tokenIn(lastOfKind(ADVANCE_LINK)));
    }
    expect(advanceLinks().map((link) => link.state).sort()).toEqual(['pending', 'pending', 'pending', 'revoked']);
    const at = new Date(LATER.getTime() + 5 * 60_000);
    expect(await viewIssuanceLink(db(), tokens[0] ?? '', at)).toMatchObject({ kind: 'refused', reason: 'revoked' });
    expect(await viewIssuanceLink(db(), tokens[3] ?? '', at)).toMatchObject({ kind: 'view', landing: { access: 'advance' } });
  });

  it('η σελίδα ζει ως 30 ημέρες μετά το τέλος των χρημάτων', async () => {
    await approvedByOwnerLink();
    seedMoney(['funded', 'started']);
    await officeRequest(LATER);
    const token = tokenIn(lastOfKind(ADVANCE_LINK));
    seedMoney(['funded', 'started', 'released']);
    expect(await viewIssuanceLink(db(), token, new Date(NOW.getTime() + 29 * DAY))).toMatchObject({ kind: 'view', landing: { access: 'advance' } });
    expect(await viewIssuanceLink(db(), token, new Date(NOW.getTime() + 30 * DAY))).toEqual({ kind: 'refused', reason: 'expired' });
  });
});

describe('ADR-943 Φ5β — ο κωδικός §29 του ΦΑΚΕΛΟΥ (DocuSign), όχι του email', () => {
  it('ο σύνδεσμος προκαταβολής ζητά τον ΙΔΙΟ κωδικό της έγκρισης· τα λάθη μετρούν στον κάτοχο', async () => {
    const { code } = await approvedByOwnerLink(true);
    await officeRequest(LATER);
    const token = tokenIn(lastOfKind(ADVANCE_LINK));
    expect(lastOfKind(ADVANCE_LINK)?.text).not.toContain(code ?? '¬');
    expect(await viewIssuanceLink(db(), token, LATER)).toMatchObject({ kind: 'view', landing: { access: 'code-required' } });
    const wrong = code === '000000' ? '111111' : '000000';
    expect(await unlockIssuanceLink(db(), token, wrong, LATER)).toEqual({ kind: 'refused', reason: 'code-wrong', remaining: 4 });
    const holderId = (assignment().decision as { invitationId: string }).invitationId;
    expect(fake.getAllDocs(COLLECTIONS.DOCUMENT_ISSUANCE_INVITATIONS)[holderId]).toMatchObject({ accessCode: { failures: 1 } });
    expect(await unlockIssuanceLink(db(), token, code ?? '', LATER)).toMatchObject({ kind: 'advance' });
  });

  it('το γραφείο ζητά ΝΕΟ κωδικό ⇒ ωμός μία φορά· γίνεται ο κάτοχος και για το επόμενο email', async () => {
    await approvedByOwnerLink();
    const first = await officeRequest(LATER, true);
    expect(first.ok && typeof first.accessCode === 'string').toBe(true);
    const owner = advanceLinks()[0];
    expect(owner).toMatchObject({ purpose: { codeHolderId: owner?.id } });
    await officeRequest(new Date(LATER.getTime() + 60_000));
    const next = advanceLinks().find((link) => link.id !== owner?.id);
    expect(next).toMatchObject({ purpose: { codeHolderId: owner?.id }, accessCode: null });
  });
});

describe('ADR-943 Φ5β Ζ-3 — η αντίρρηση του ιδιοκτήτη', () => {
  it('μέσα στο παράθυρο ⇒ `disputed`, δράστης `owner-link`· το γραφείο μαθαίνει την αιτιολογία', async () => {
    const { approvalToken } = await approvedByOwnerLink();
    seedMoney(['funded', 'started']);
    const outcome = await objectToIssuanceAdvance(db(), approvalToken, { reason: 'Δεν ήρθε κανείς', accessCode: null }, LATER);
    expect(outcome).toMatchObject({ kind: 'result', result: { status: 'objected', advance: { state: 'disputed', canObject: false, releaseAt: null } } });
    const events = assignment().advanceEvents as Stored[];
    const approvalId = (assignment().decision as { invitationId: string }).invitationId;
    expect(events.at(-1)).toMatchObject({ kind: 'start-objected', reason: 'Δεν ήρθε κανείς', objection: { by: 'owner-link', invitationId: approvalId } });
    const toOffice = dispatchNotification.mock.calls.map(([input]) => input as { recipientId: string; eventType: string; body: string })
      .find((input) => input.recipientId === 'user_1' && input.eventType === 'properties.documentIssuanceAdvanceObjected');
    expect(toOffice?.body).toContain('Δεν ήρθε κανείς');
  });

  it('δεύτερη αντίρρηση ή μετά το παράθυρο ⇒ `not-objectable`, κανένα νέο γεγονός', async () => {
    const { approvalToken } = await approvedByOwnerLink();
    seedMoney(['funded', 'started']);
    const late = await objectToIssuanceAdvance(db(), approvalToken, { reason: 'Αργά', accessCode: null }, AFTER_WINDOW);
    expect(late).toEqual({ kind: 'result', result: { status: 'refused', reason: 'not-objectable' } });
    await objectToIssuanceAdvance(db(), approvalToken, { reason: 'Πρώτη', accessCode: null }, LATER);
    const again = await objectToIssuanceAdvance(db(), approvalToken, { reason: 'Δεύτερη', accessCode: null }, LATER);
    expect(again).toEqual({ kind: 'result', result: { status: 'refused', reason: 'not-objectable' } });
    expect((assignment().advanceEvents as Stored[]).filter((event) => event.kind === 'start-objected')).toHaveLength(1);
  });

  it('σύνδεσμος με κωδικό ⇒ η αντίρρηση χωρίς κωδικό δεν γράφει τίποτα', async () => {
    const { approvalToken } = await approvedByOwnerLink(true);
    seedMoney(['funded', 'started']);
    const outcome = await objectToIssuanceAdvance(db(), approvalToken, { reason: 'Κάτι', accessCode: null }, LATER);
    expect(outcome).toMatchObject({ kind: 'refused', reason: 'code-required' });
    expect((assignment().advanceEvents as Stored[]).some((event) => event.kind === 'start-objected')).toBe(false);
  });
});

describe('ADR-943 Φ5β2 — το αίτημα πληρωμής του γραφείου στέλνει ΜΟΝΟ όταν υπάρχει κάτι να γίνει', () => {
  it('κρατημένα χρήματα χωρίς αυτοψία ⇒ `nothing-to-do`, κανένα email', async () => {
    await approvedByOwnerLink();
    seedMoney(['funded']);
    expect(await officeRequest(LATER)).toEqual({ ok: false, refusal: 'nothing-to-do' });
    expect(lastOfKind(ADVANCE_LINK)).toBeUndefined();
  });

  it('ιδιοκτήτης χωρίς email ⇒ `no-email`, κανένας σύνδεσμος', async () => {
    await approvedByOwnerLink();
    seedContact('cont_a', 'Άλφα', null);
    expect(await officeRequest(LATER)).toEqual({ ok: false, refusal: 'no-email' });
    expect(advanceLinks()).toEqual([]);
  });

  it('η αυτοψία λέει στο email ΠΟΤΕ φεύγουν τα χρήματα', async () => {
    await approvedByOwnerLink();
    seedMoney(['funded', 'started']);
    expect(await officeRequest(LATER)).toMatchObject({ ok: true });
    expect(lastOfKind(ADVANCE_LINK)?.text).toContain('Αποδεσμεύεται αυτόματα');
  });
});
