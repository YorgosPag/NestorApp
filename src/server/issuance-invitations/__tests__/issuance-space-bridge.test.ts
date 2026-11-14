/**
 * @jest-environment node
 *
 * @fileoverview ADR-915 §39 · ADR-862 §5.3.11 — **Η ΓΕΦΥΡΑ** από τον σύνδεσμο της ανάθεσης στον χώρο της, από άκρη σε
 *   άκρη πάνω στο fake Firestore: «Αναλαμβάνω» (σύνδεσμος χωρίς λογαριασμό) → πρόσκληση σε λογαριασμό στην ΙΔΙΑ
 *   συναλλαγή → εξαργύρωση (ενεργή συμμετοχή `document_issuer`) · επαναποστολή (supersede) · πόρτες μεταβίβασης.
 *
 * - **Γ1** — accept ⇒ **ακριβώς μία** πρόσκληση, στην ίδια συναλλαγή με την απάντηση· δεύτερο κλικ ⇒ καμία δεύτερη.
 * - **Γ2** — ακίνητο χωρίς έργο ⇒ η ανάληψη γράφεται, **καμία** πρόσκληση (`no-project`).
 * - **Γ3** — επαναποστολή ⇒ ο παλιός σύνδεσμος `revoked`, νέο email με τον νέο σύνδεσμο.
 * - **Γ4** — εξαργύρωση ⇒ `active` `document_issuer`, μητρώο ΥΠΕΝ, **χωρίς** σύλλογο· μετά, επαναποστολή ⇒ `entered`.
 * - **Γ5** — συμμετοχή ανάθεσης στις πόρτες μεταβίβασης ⇒ `not-found` (ξένη ≡ ανύπαρκτη).
 * - **Σ**  — έγγραφο πρόσκλησης μεταβίβασης **παλιού σχήματος** διαβάζεται και ξαναγράφεται αμετάβλητο.
 * - **Μ**  — ο συνθέτης email ανά είδος: ίδιος σύνδεσμος χώρου, άλλα λόγια.
 *
 * 🔑 Ρολόι = **πραγματικό** (`Date.now()`): η εξαργύρωση κρίνει τη λήξη με το ρολόι τοίχου. Δεδομένα **συνθετικά**.
 */

jest.mock('server-only', () => ({}));
jest.mock('@/lib/telemetry', () => ({
  createModuleLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
}));
jest.mock('@/services/entity-audit.service', () => ({ EntityAuditService: { recordChange: jest.fn(async () => 'eaud_1') } }));
jest.mock('@/lib/workspace/workspace-catalog', () => ({ readWorkspaceName: jest.fn(async () => 'Γραφείο Άλφα') }));
jest.mock('@/server/notifications/notification-orchestrator', () => ({ dispatchNotification: jest.fn(async () => ({ skipped: false })) }));
jest.mock('@/server/invitations/invitation-notice', () => ({ deliverInvitationEmail: jest.fn() }));
jest.mock('@/server/auth/mailbox-proof-custody', () => ({ settleProvenMailbox: jest.fn() }));
jest.mock('@/lib/auth/workspace-membership', () => ({
  ...jest.requireActual('@/lib/auth/workspace-membership'),
  listOwnWorkspaces: jest.fn(async () => ({ outcome: 'ok', reachable: [], belonging: [] })),
}));
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminAuth: () => ({
    getUserByEmail: async () => { throw Object.assign(new Error('not found'), { code: 'auth/user-not-found' }); },
  }),
}));

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { engagementInvitationFromDocument, engagementInvitationToDocument } from '@/lib/auth/engagement-invitation-schema';
import { caseInvitationHref } from '@/lib/conveyance/conveyance-routes';
import type { IssuanceSendBody } from '@/lib/document-validity/issuance-request';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { composeEngagementInvitationEmail } from '@/server/engagement-invitations/engagement-invitation-mail';
import { respondToEngagementInvitation } from '@/server/engagement-invitations/engagement-invitation-redeem';
import { answerIssuanceLink } from '@/server/issuance-invitations/issuance-invitation-answer';
import { sendIssuanceMessage } from '@/server/issuance-invitations/issuance-invitation-send';
import { inviteIssuanceProfessionalToSpace } from '@/server/issuance-invitations/issuance-space-invite';
import { issuanceAssignmentIdOf } from '@/services/document-registry/issuance-assignment-schema';
import { actOnIssuanceAssignment } from '@/services/document-registry/issuance-assignment.service';
import { resolveEngagedCase, respondToCaseEngagement } from '@/services/conveyance/conveyance-engagement-access.service';

/* eslint-disable @typescript-eslint/no-require-imports */
const { deliverInvitationEmail } = require('@/server/invitations/invitation-notice') as { deliverInvitationEmail: jest.Mock };
/* eslint-enable @typescript-eslint/no-require-imports */

interface Sent { readonly to: string; readonly kind: string; readonly subject: string; readonly text: string }

const COMPANY = 'comp_alfa';
const ORIGIN = 'https://app.example.test';
const PRO_EMAIL = 'pro@example.test';
const NOW = new Date();
const LATER = new Date(NOW.getTime() + 60 * 60 * 1000);
const OFFICE = { companyId: COMPANY, uid: 'user_1', name: 'agent@example.test' };
const TARGET = { propertyId: 'prop_1', documentKind: 'energy-certificate' } as const;
const ASSIGNMENT_ID = issuanceAssignmentIdOf(COMPANY, 'prop_1', 'energy-certificate');

let fake: FakeFirestore;
let sent: Sent[];
const db = (): AdminFirestore => fake as unknown as AdminFirestore;
const assignment = () => fake.getAllDocs(COLLECTIONS.DOCUMENT_ISSUANCE_ASSIGNMENTS)[ASSIGNMENT_ID];
const spaceInvitations = () => Object.entries(fake.getAllDocs(COLLECTIONS.ENGAGEMENT_INVITATIONS)).map(([id, data]) => ({ id, data }));

function seedProperty(projectId: string | null): void {
  fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', {
    companyId: COMPANY, name: 'Διαμέρισμα Α1', type: 'apartment', ...(projectId === null ? {} : { projectId, buildingId: 'bld_1' }),
    energy: { class: 'B', issuedOn: '2016-11-01', sourceFileId: null },
    commercial: { legalPhase: 'final_signed', owners: [{ contactId: 'cont_a', ownershipPct: 100 }] },
  });
}

function seedContact(id: string, firstName: string, email: string): void {
  fake.seed(COLLECTIONS.CONTACTS, id, {
    companyId: COMPANY, type: 'individual', firstName, lastName: 'Συνθετικός', emails: [{ email, isPrimary: true, type: 'personal' }],
  });
}

/** Το token, όπως θα το έβρισκε ο άνθρωπος στο email — από το **κείμενο** που έφυγε, ποτέ από τη βάση. */
function linkTokenIn(message: Sent): string {
  const match = /#t=([^\s]+)/.exec(message.text);
  if (match === null) throw new Error('no link in message');
  return decodeURIComponent(match[1]);
}

/** Το token του χώρου από τη σχετική διεύθυνση της σελίδας (`/…/<token>`). */
function spaceTokenOf(href: string): string {
  return decodeURIComponent(href.slice(href.lastIndexOf('/') + 1));
}

function professionalBody(): IssuanceSendBody {
  return {
    ...TARGET, expectedStage: 'ownerApproved', audience: 'professional', note: null, expectedOwnerContactId: null,
    informContactIds: [], requireAccessCode: false, sendReminders: false,
  };
}

/** Ο ιδιοκτήτης ενέκρινε (τηλεφωνικά) → ο σύνδεσμος φεύγει στον επαγγελματία → το token του. */
async function professionalLinkToken(): Promise<string> {
  await actOnIssuanceAssignment(db(), OFFICE, {
    action: 'decide', ...TARGET, expectedStage: 'proposed', outcome: 'approved', channel: 'phone', note: null, expectedOwnerContactId: 'cont_a',
  }, NOW);
  const result = await sendIssuanceMessage(db(), OFFICE, professionalBody(), NOW);
  if (!result.ok) throw new Error(result.refusal);
  const message = sent.find((candidate) => candidate.to === PRO_EMAIL && candidate.kind === 'document-issuance');
  if (message === undefined) throw new Error('not sent');
  return linkTokenIn(message);
}

/** «Αναλαμβάνω» στον σύνδεσμο ⇒ το token του χώρου (από την όψη της σελίδας). */
async function acceptAndSpaceToken(): Promise<string> {
  const answer = await answerIssuanceLink(db(), await professionalLinkToken(), { answer: 'accept', note: null, accessCode: null }, LATER);
  if (answer.kind !== 'answered' || answer.space.kind !== 'invited') throw new Error(`no space: ${JSON.stringify(answer)}`);
  return spaceTokenOf(answer.space.href);
}

const professional = { uid: 'u_pro', email: PRO_EMAIL, emailVerified: true, secondFactorEnrolled: false };
const redeem = (token: string) => respondToEngagementInvitation(db(), {
  action: 'accept', token, identity: professional, credential: { number: 'ΥΠΕΝ-7', chapter: null }, acting: { active: null, requested: null },
});

beforeEach(async () => {
  process.env.ISSUANCE_INVITE_SECRET = 'test-secret-issuance-0123456789abcdef';
  process.env.ENGAGEMENT_INVITE_SECRET = 'test-secret-engagement-0123456789abcdef';
  process.env.NEXT_PUBLIC_APP_URL = ORIGIN;
  fake = new FakeFirestore();
  sent = [];
  deliverInvitationEmail.mockReset().mockImplementation(async (d: { kind: string; inviteeEmail: string; compose: (l: string) => Promise<{ subject: string; text: string } | null> }) => {
    const email = await d.compose('el');
    if (email !== null) sent.push({ to: d.inviteeEmail, kind: d.kind, subject: email.subject, text: email.text });
    return 'accepted';
  });
  seedProperty('proj_1');
  fake.seed(COLLECTIONS.PROJECTS, 'proj_1', { companyId: COMPANY, linkedCompanyId: null, landownerContactIds: [] });
  seedContact('cont_a', 'Άλφα', 'alfa@example.test');
  seedContact('cont_pro', 'Επιθεωρητής', PRO_EMAIL);
  await actOnIssuanceAssignment(db(), OFFICE, {
    action: 'propose', ...TARGET, expectedStage: null, professionalContactId: 'cont_pro', qualification: 'energy-inspector-registered', registryNumber: 'ΥΠΕΝ-7',
  }, NOW);
});

describe('Γ — «Αναλαμβάνω» ⇒ πρόσκληση στον χώρο της ανάθεσης', () => {
  it('Γ1 — ακριβώς ΜΙΑ πρόσκληση, δεμένη στη διεύθυνση της ανάθεσης· δεύτερο κλικ ⇒ `already-used`, καμία δεύτερη', async () => {
    const linkToken = await professionalLinkToken();
    const answer = await answerIssuanceLink(db(), linkToken, { answer: 'accept', note: null, accessCode: null }, LATER);
    expect(answer).toMatchObject({ kind: 'answered', answer: 'accept', space: { kind: 'invited' } });
    expect(assignment()).toMatchObject({ response: { basis: 'professional-link', outcome: 'accepted' } });
    const [invitation, ...rest] = spaceInvitations();
    expect(rest).toEqual([]);
    expect(invitation?.data).toMatchObject({
      state: 'pending', hostCompanyId: COMPANY, projectId: 'proj_1', propertyId: 'prop_1', inviteeEmail: PRO_EMAIL, contactId: 'cont_pro',
      subject: { kind: 'document_issuance', assignmentId: ASSIGNMENT_ID }, role: 'document_issuer',
      documentKind: 'energy-certificate', qualification: 'energy-inspector-registered', consents: [],
      credentialHint: { number: 'ΥΠΕΝ-7', chapter: null }, invitedByUid: OFFICE.uid,
    });
    expect(await answerIssuanceLink(db(), linkToken, { answer: 'accept', note: null, accessCode: null }, LATER)).toMatchObject({ kind: 'refused', reason: 'already-used' });
    expect(spaceInvitations()).toHaveLength(1);
  });

  it('Γ2 — ακίνητο ΧΩΡΙΣ έργο ⇒ η ανάληψη γράφεται, καμία πρόσκληση (`no-project`)', async () => {
    seedProperty(null);
    const answer = await answerIssuanceLink(db(), await professionalLinkToken(), { answer: 'accept', note: null, accessCode: null }, LATER);
    expect(answer).toEqual({ kind: 'answered', answer: 'accept', space: { kind: 'no-project' } });
    expect(assignment()).toMatchObject({ response: { outcome: 'accepted' } });
    expect(spaceInvitations()).toEqual([]);
  });

  it('Γ3 — επαναποστολή ⇒ ο παλιός σύνδεσμος `revoked`, ο νέος `pending`, και το email φέρει τον ΝΕΟ', async () => {
    const oldToken = await acceptAndSpaceToken();
    const outcome = await inviteIssuanceProfessionalToSpace(db(), OFFICE, TARGET, new Date(LATER.getTime() + 1000));
    expect(outcome).toMatchObject({ ok: true, delivery: 'accepted' });
    const states = spaceInvitations().map((doc) => doc.data.state).sort();
    expect(states).toEqual(['pending', 'revoked']);
    const mail = sent.filter((message) => message.kind === 'engagement').at(-1);
    if (mail === undefined) throw new Error('no space email');
    expect(mail.to).toBe(PRO_EMAIL);
    expect(mail.text).not.toContain(encodeURIComponent(oldToken));
    expect((await redeem(oldToken)).kind).not.toBe('accepted');
    expect(spaceInvitations().map((doc) => doc.data.state).sort()).toEqual(['pending', 'revoked']);
  });

  it('Γ4 — εξαργύρωση ⇒ ενεργή συμμετοχή `document_issuer`, μητρώο ΥΠΕΝ, χωρίς σύλλογο· μετά, επαναποστολή ⇒ `entered`', async () => {
    const outcome = await redeem(await acceptAndSpaceToken());
    expect(outcome).toMatchObject({ kind: 'accepted', effect: { state: 'active', uid: 'u_pro', role: 'document_issuer' } });
    if (outcome.kind !== 'accepted') throw new Error('unreachable');
    expect(outcome.effect.subject).toEqual({ kind: 'document_issuance', assignmentId: ASSIGNMENT_ID });
    expect(outcome.effect.declaredCredential).toMatchObject({ authority: 'ypen', number: 'ΥΠΕΝ-7', chapter: null, assurance: 'declared' });
    expect(await inviteIssuanceProfessionalToSpace(db(), OFFICE, TARGET, new Date(LATER.getTime() + 1000))).toEqual({ ok: false, refusal: 'entered' });
  });

  it('Γ5 — η συμμετοχή ανάθεσης στις πόρτες ΜΕΤΑΒΙΒΑΣΗΣ ⇒ `not-found` (ξένη ≡ ανύπαρκτη)', async () => {
    const outcome = await redeem(await acceptAndSpaceToken());
    if (outcome.kind !== 'accepted') throw new Error(`not accepted: ${outcome.kind}`);
    const engagementId = outcome.effect.id;
    expect(await resolveEngagedCase(db(), 'u_pro', engagementId, Date.now())).toEqual({ ok: false, rejection: 'not-found' });
    expect(await respondToCaseEngagement(db(), { uid: 'u_pro', email: PRO_EMAIL, active: null }, engagementId, { action: 'decline' }, Date.now()))
      .toEqual({ ok: false, rejection: 'not-found' });
  });
});

/** Η αποθηκευμένη πρόσκληση ανάθεσης, ξαναγραμμένη στο σχήμα της μεταβίβασης (όπως γράφεται ΠΑΝΤΑ: χωρίς `subject`). */
function legacyConveyanceDocOf(stored: Record<string, unknown>): Record<string, unknown> {
  const { subject: _subject, documentKind: _kind, qualification: _qualification, ...base } = stored;
  return { ...base, caseId: 'case_1', role: 'notary' };
}

describe('Σ — το σχήμα της πρόσκλησης: η μεταβίβαση όπως ήταν πάντα', () => {
  it('έγγραφο μεταβίβασης ΠΑΛΙΟΥ σχήματος ⇒ διαβάζεται με παραγόμενο `subject`, και ξαναγράφεται ΑΜΕΤΑΒΛΗΤΟ', async () => {
    await acceptAndSpaceToken();
    const [stored] = spaceInvitations();
    if (stored === undefined) throw new Error('no invitation');
    const legacy = legacyConveyanceDocOf(stored.data);
    const parsed = engagementInvitationFromDocument(legacy, stored.id);
    expect(parsed).toMatchObject({ id: stored.id, subject: { kind: 'conveyance_case', caseId: 'case_1' }, role: 'notary' });
    if (parsed === null) throw new Error('unreachable');
    const written = engagementInvitationToDocument(parsed);
    expect(written).not.toHaveProperty('subject');
    expect(written).toEqual(legacy);
  });

  it('`subject` ξένου είδους, ή ούτε `subject` ούτε `caseId` ⇒ `null` (ποτέ «περίπου»)', async () => {
    await acceptAndSpaceToken();
    const [stored] = spaceInvitations();
    if (stored === undefined) throw new Error('no invitation');
    const legacy = legacyConveyanceDocOf(stored.data);
    const { caseId: _caseId, ...orphan } = legacy;
    expect(engagementInvitationFromDocument({ ...legacy, subject: { kind: 'conveyance_case', caseId: 'case_1' } }, 'x')).toBeNull();
    expect(engagementInvitationFromDocument({ ...stored.data, subject: { kind: 'tour_capture', assignmentId: 'a' } }, 'x')).toBeNull();
    expect(engagementInvitationFromDocument(orphan, 'x')).toBeNull();
  });
});

describe('Μ — ο συνθέτης του email, ανά είδος', () => {
  it('ανάθεση και μεταβίβαση: ΙΔΙΟΣ απόλυτος σύνδεσμος χώρου, ΑΛΛΑ λόγια', async () => {
    await acceptAndSpaceToken();
    const [stored] = spaceInvitations();
    if (stored === undefined) throw new Error('no invitation');
    const issuance = engagementInvitationFromDocument(stored.data, stored.id);
    const conveyance = engagementInvitationFromDocument(legacyConveyanceDocOf(stored.data), stored.id);
    if (issuance === null || conveyance === null) throw new Error('unparsable');
    const link = `${ORIGIN}${caseInvitationHref('tok_1')}`;
    const [issuanceMail, conveyanceMail] = await Promise.all([
      composeEngagementInvitationEmail(db(), issuance, 'tok_1', 'el'),
      composeEngagementInvitationEmail(db(), conveyance, 'tok_1', 'el'),
    ]);
    expect(issuanceMail?.text).toContain(link);
    expect(conveyanceMail?.text).toContain(link);
    expect(issuanceMail?.subject).not.toEqual(conveyanceMail?.subject);
  });

  it('ανάθεση χωρίς δημόσια διεύθυνση ⇒ `null` (ποτέ σύνδεσμος που δεν οδηγεί πουθενά)', async () => {
    await acceptAndSpaceToken();
    const [stored] = spaceInvitations();
    const issuance = stored === undefined ? null : engagementInvitationFromDocument(stored.data, stored.id);
    if (issuance === null) throw new Error('unparsable');
    delete process.env.NEXT_PUBLIC_APP_URL;
    expect(await composeEngagementInvitationEmail(db(), issuance, 'tok_1', 'el')).toBeNull();
  });
});
