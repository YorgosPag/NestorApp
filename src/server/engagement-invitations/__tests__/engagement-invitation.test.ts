/**
 * @jest-environment node
 *
 * @fileoverview **Η ΠΡΟΣΚΛΗΣΗ ΥΠΟΘΕΣΗΣ ΜΕ EMAIL** (ADR-901 Φ3) — άγκυρες, από άκρη σε άκρη πάνω στο επαληθευμένο
 * fake Firestore: ορισμός → έκδοση (οικοδεσπότης) → εξαργύρωση (επαγγελματίας) → συμμετοχή → υπενθύμιση.
 *
 * - **Α1** — καμία γραφή εκτός πρόσκλησης/συμμετοχής: ποτέ μέλος χώρου, ποτέ claim.
 * - **Α2** — άλλο email στο Auth ⇒ `wrong-recipient`, **καμία** συμμετοχή.
 * - **Α3** — συμβολαιογράφος χωρίς δεύτερη συναίνεση ⇒ **καμία** πρόσκληση (κανένα email).
 * - **Ι**  — ιδεμποτησία: δεύτερη αποδοχή ⇒ `already-used`, μία συμμετοχή· επαναποστολή ανακαλεί την παλιά.
 * - **Θ**  — αρνήσεις του είδους (θέση πιασμένη · υπόθεση κλειστή) ⇒ καμία γραφή, η πρόσκληση μένει `pending`.
 * - **Υ**  — υπενθύμιση 3 ημερών: μία φορά· η ληγμένη κλείνει.
 *
 * 🔑 Κάθε άρνηση ελέγχει **και** τι **δεν** γράφτηκε. Κάθε κύκλος περνά **πραγματικό** token από την **πραγματική**
 * εξαργύρωση (μάθημα ADR-777 §8.33).
 */

jest.mock('server-only', () => ({}));
jest.mock('@/services/entity-audit.service', () => ({ EntityAuditService: { recordChange: jest.fn(async () => 'eaud_1') } }));

/** ADR-901 §15 (Γ1) — τα γραφεία όπου ΑΝΗΚΕΙ ο αποδεχόμενος· προεπιλογή: κανένα (ο νεογραμμένος δεν έχει γραφείο). */
const mockOwnWorkspaces = jest.fn(async (_uid: string, _active: unknown): Promise<unknown> => ({ outcome: 'ok', reachable: [], belonging: [] }));
jest.mock('@/lib/auth/workspace-membership', () => ({
  ...jest.requireActual('@/lib/auth/workspace-membership'),
  listOwnWorkspaces: (uid: string, active: unknown) => mockOwnWorkspaces(uid, active),
}));

const settleMock = jest.fn();
jest.mock('@/server/auth/mailbox-proof-custody', () => ({
  settleProvenMailbox: (...args: unknown[]) => settleMock(...args),
}));

/** Τα tokens που «έφυγαν» με email — ο μόνος τρόπος να φτάσει token στον επαγγελματία. */
const sentTokens: string[] = [];
jest.mock('../engagement-invitation-notice', () => ({
  notifyEngagementInvitation: jest.fn(async (_db: unknown, input: { token: string }) => {
    sentTokens.push(input.token);
    return 'accepted';
  }),
}));

const announced = { declined: jest.fn(), unanswered: jest.fn(), answered: jest.fn() };
jest.mock('@/services/conveyance/conveyance-engagement-notifier', () => ({
  announceEngagementChanged: jest.fn(async () => undefined),
  announceEngagementAnswered: (...args: unknown[]) => announced.answered(...args),
  announceInvitationDeclined: (...args: unknown[]) => announced.declined(...args),
  announceInvitationUnanswered: (...args: unknown[]) => announced.unanswered(...args),
}));

/** Λογαριασμοί της «πλατφόρμας»: κανένας για τους προσκεκλημένους — αυτό είναι όλο το νόημα της Φ3. */
jest.mock('@/lib/firebaseAdmin', () => ({
  getAdminAuth: () => ({
    getUserByEmail: async () => { throw Object.assign(new Error('not found'), { code: 'auth/user-not-found' }); },
  }),
}));

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';
import { openConveyanceCase, type ConveyanceActor } from '@/services/conveyance/conveyance-case.service';
import {
  cancelCaseInvitation,
  listCaseProfessionalSlots,
  offerCaseEngagement,
} from '@/services/conveyance/conveyance-engagement-host.service';
import type { ConveyanceCase } from '@/types/conveyance-case';

import { respondToEngagementInvitation } from '../engagement-invitation-redeem';
import { readViewRevision } from '@/services/conveyance/conveyance-view-signal.server';
import { previewEngagementInvitation } from '../engagement-invitation-preview';
import { reminderVerdict, sweepEngagementInvitationReminders } from '../engagement-invitation-reminder';

process.env.ENGAGEMENT_INVITE_SECRET ??= 'δοκιμαστικό-μυστικό-πρόσκλησης-υπόθεσης';

const host: ConveyanceActor = { uid: 'u_host', email: 'host@a.gr', companyId: 'comp_a' };
const NOTARY_EMAIL = 'notary@x.gr';
const INVITATIONS = COLLECTIONS.ENGAGEMENT_INVITATIONS;
const CREDENTIAL = { number: '1234', chapter: 'Αθηνών' };
let fake: FakeFirestore;
const db = () => fake as unknown as Firestore;

/** Ο συμβολαιογράφος, **σωστός σε όλα** — κάθε άρνηση αλλάζει ΕΝΑ πεδίο. */
const notary = (overrides: Record<string, unknown> = {}) => ({
  uid: 'u_notary', email: NOTARY_EMAIL, emailVerified: true, secondFactorEnrolled: false, ...overrides,
});

function seedWorld(): void {
  fake.seed(COLLECTIONS.PROPERTIES, 'prop_1', {
    companyId: 'comp_a', name: 'Δ3', type: 'apartment', buildingId: 'bld_1', projectId: 'proj_1',
    commercial: { owners: [{ contactId: 'cont_b' }], legalPhase: 'preliminary_signed' },
  });
  fake.seed(COLLECTIONS.PROJECTS, 'proj_1', { companyId: 'comp_a', linkedCompanyId: 'cont_s', landownerContactIds: [] });
  fake.seed(COLLECTIONS.CONTACT_LINKS, 'cl_n', {
    companyId: 'comp_a', sourceContactId: 'cont_n', targetEntityType: 'property', targetEntityId: 'prop_1', role: 'notary', status: 'active',
  });
  fake.seed(COLLECTIONS.CONTACTS, 'cont_n', {
    companyId: 'comp_a', emails: [{ email: NOTARY_EMAIL, isPrimary: true }],
    personas: [{ personaType: 'notary', status: 'active', notaryRegistryNumber: '1234', notaryDistrict: 'Αθηνών' }],
  });
}

async function openCase(): Promise<ConveyanceCase> {
  const opened = await openConveyanceCase(db(), host, 'prop_1');
  if (!opened.ok) throw new Error(opened.failure.kind);
  return opened.value.view.conveyanceCase;
}

async function invite(record: ConveyanceCase): Promise<string> {
  const outcome = await offerCaseEngagement(db(), host, record, { role: 'notary', attestedBasis: 'written_instruction', nowMs: Date.now() });
  if (!outcome.ok) throw new Error(outcome.rejection);
  const token = sentTokens.at(-1);
  if (!token) throw new Error('κανένα email δεν «έφυγε»');
  return token;
}

/** ADR-901 §15 (Γ1) — το αίτημα χώρου μιας αποδοχής· προεπιλογή: κανένα (ο νεογραμμένος δεν ζητά τίποτα). */
type ActingInput = { readonly active: null; readonly requested: { kind: 'org'; companyId: string } | { kind: 'personal' } | null };
const NO_ACTING: ActingInput = { active: null, requested: null };
const accept = (token: string, identity = notary(), acting: ActingInput = NO_ACTING) =>
  respondToEngagementInvitation(db(), { action: 'accept', token, identity, credential: CREDENTIAL, acting });

const engagementWrites = () => fake.writeLog().filter((w) => w.collection.endsWith('/engagements'));
const invitationDocs = () => Object.entries(fake.getAllDocs(INVITATIONS)).map(([id, data]) => ({ id, data }));
const invitationStates = () => invitationDocs().map((doc) => doc.data.state);

beforeEach(() => {
  fake = new FakeFirestore();
  seedWorld();
  sentTokens.length = 0;
  settleMock.mockReset();
  Object.values(announced).forEach((mock) => mock.mockReset());
});

describe('Π — ο παρονομαστής', () => {
  it('έκδοση → αποδοχή ⇒ ΕΝΕΡΓΗ συμμετοχή με τη δήλωση, και ο οικοδεσπότης την βλέπει «(δηλωμένο)»', async () => {
    const record = await openCase();
    const outcome = await accept(await invite(record));
    expect(outcome).toMatchObject({ kind: 'accepted', effect: { state: 'active', uid: 'u_notary', role: 'notary' } });
    if (outcome.kind !== 'accepted') throw new Error('unreachable');
    expect(outcome.effect.declaredCredential).toMatchObject({ authority: 'notary-association', number: '1234', chapter: 'Αθηνών', assurance: 'declared' });
    expect(outcome.effect.origin).toMatchObject({ contactId: 'cont_n', invitationId: outcome.invitation.id });
    const slot = (await listCaseProfessionalSlots(db(), record)).find((s) => s.role === 'notary');
    expect(slot?.engagement).toMatchObject({ state: 'active', declaredCredential: { number: '1234' } });
    expect(announced.answered).toHaveBeenCalledTimes(1);
  });

  it('η προσυμπλήρωση της δήλωσης έρχεται από τις persona της επαφής (ποτέ δήλωση από τρίτον)', async () => {
    await invite(await openCase());
    expect(invitationDocs()[0]?.data.credentialHint).toEqual({ number: '1234', chapter: 'Αθηνών' });
  });
});

describe('Α — οι άγκυρες του ADR-901 §7', () => {
  it('Α1 — η αποδοχή γράφει ΜΟΝΟ πρόσκληση + συμμετοχή (+ σήμα όψεων): κανένα μέλος χώρου, κανένα claim', async () => {
    const record = await openCase();
    const token = await invite(record);
    const before = fake.writeLog().length;
    await accept(token);
    const touched = new Set(fake.writeLog().slice(before).map((w) => w.collection));
    // §14.8 — το σήμα όψεων (αριθμός, χωρίς περιεχόμενο) γράφεται στην ΙΔΙΑ συναλλαγή· δεν δίνει πρόσβαση πουθενά.
    expect([...touched].sort()).toEqual([INVITATIONS, `companies/comp_a/projects/proj_1/engagements`, COLLECTIONS.CONVEYANCE_VIEW_SIGNALS].sort());
  });

  it('Α2 — άλλο email στο Auth ⇒ `wrong-recipient`, ΚΑΜΙΑ συμμετοχή, η πρόσκληση μένει `pending`', async () => {
    const token = await invite(await openCase());
    expect(await accept(token, notary({ email: 'forwarded@x.gr' }))).toEqual({ kind: 'refused', reason: 'wrong-recipient' });
    expect(engagementWrites()).toHaveLength(0);
    expect(invitationStates()).toEqual(['pending']);
  });

  it('Α3 — συμβολαιογράφος ΧΩΡΙΣ δηλωμένη δεύτερη συναίνεση ⇒ ΚΑΜΙΑ πρόσκληση, κανένα email', async () => {
    const record = await openCase();
    const outcome = await offerCaseEngagement(db(), host, record, { role: 'notary', attestedBasis: null, nowMs: Date.now() });
    expect(outcome).toEqual({ ok: false, rejection: 'consent-basis-required' });
    expect(invitationDocs()).toHaveLength(0);
    expect(sentTokens).toHaveLength(0);
  });
});

describe('Ι — ιδεμποτησία', () => {
  it('δεύτερη αποδοχή του ίδιου συνδέσμου ⇒ `already-used`, ΜΙΑ συμμετοχή', async () => {
    const token = await invite(await openCase());
    await accept(token);
    expect(await accept(token)).toEqual({ kind: 'refused', reason: 'already-used' });
    expect(engagementWrites().filter((w) => w.kind === 'set')).toHaveLength(1);
  });

  it('επαναποστολή ⇒ η παλιά ανακαλείται, ο παλιός σύνδεσμος αρνείται `revoked`', async () => {
    const record = await openCase();
    const first = await invite(record);
    const second = await invite(record);
    expect(await accept(first)).toEqual({ kind: 'refused', reason: 'revoked' });
    expect((await accept(second)).kind).toBe('accepted');
  });

  it('ακύρωση από τον οικοδεσπότη ⇒ ο σύνδεσμος αρνείται `revoked`', async () => {
    const record = await openCase();
    const token = await invite(record);
    await cancelCaseInvitation(db(), host, record, 'notary', Date.now());
    expect(await accept(token)).toEqual({ kind: 'refused', reason: 'revoked' });
    expect(engagementWrites()).toHaveLength(0);
  });
});

describe('Θ — αρνήσεις του είδους: καμία γραφή, η πρόσκληση μένει `pending`', () => {
  it('υπόθεση ακυρώθηκε ⇒ η εκκρεμής πρόσκληση ΑΝΑΚΑΛΕΙΤΑΙ μαζί της', async () => {
    const { applyConveyanceCaseCommand } = await import('@/services/conveyance/conveyance-case.service');
    const record = await openCase();
    const token = await invite(record);
    await applyConveyanceCaseCommand(db(), host, record, { expectedVersion: record.version, command: { type: 'cancel', reason: 'ακύρωση' } });
    expect(await accept(token)).toEqual({ kind: 'refused', reason: 'revoked' });
    expect(engagementWrites()).toHaveLength(0);
  });

  it('ΑΓΩΝΑΣ — η υπόθεση ακυρώνεται ΑΝΑΜΕΣΑ στον προέλεγχο και στη συναλλαγή ⇒ `case-closed`, καμία γραφή', async () => {
    const record = await openCase();
    const token = await invite(record);
    // Ο «συνάδελφος» χτυπά μετά την πρώτη ανάγνωση της συναλλαγής — ο προέλεγχος είδε ανοιχτή υπόθεση.
    fake.interfere = () => fake.seed(COLLECTIONS.CONVEYANCE_CASES, record.id, { ...record, storedState: 'cancelled' });
    expect(await accept(token)).toEqual({ kind: 'refused', reason: 'case-closed' });
    expect(engagementWrites()).toHaveLength(0);
    expect(invitationStates()).toEqual(['pending']);
  });

  it('υπόθεση κλειστή χωρίς ανάκληση (ζώνη-και-τιράντες) ⇒ `case-closed`', async () => {
    const record = await openCase();
    const token = await invite(record);
    fake.seed(COLLECTIONS.CONVEYANCE_CASES, record.id, { ...record, storedState: 'cancelled' });
    expect(await accept(token)).toEqual({ kind: 'refused', reason: 'case-closed' });
    expect(engagementWrites()).toHaveLength(0);
    expect(invitationStates()).toEqual(['pending']);
  });
});

describe('άρνηση («Δεν αναλαμβάνω»)', () => {
  it('γράφει `declined`, καμία συμμετοχή, και ο προσκαλών ΕΙΔΟΠΟΙΕΙΤΑΙ (Ε-5)', async () => {
    const token = await invite(await openCase());
    const outcome = await respondToEngagementInvitation(db(), { action: 'decline', token, identity: notary() });
    expect(outcome.kind).toBe('declined');
    expect(engagementWrites()).toHaveLength(0);
    expect(announced.declined).toHaveBeenCalledTimes(1);
  });
});

describe('Υ — υπενθύμιση 3 ημερών (Ε-5)', () => {
  it('οφειλόμενη ⇒ ΜΙΑ υπενθύμιση· δεύτερο πέρασμα ⇒ καμία', async () => {
    const record = await openCase();
    await invite(record);
    const [doc] = invitationDocs();
    fake.seed(INVITATIONS, doc!.id, { ...doc!.data, reminderDueAt: '2000-01-01T00:00:00.000Z' });
    expect(await sweepEngagementInvitationReminders(db())).toMatchObject({ considered: 1, reminded: 1, failed: 0 });
    expect(await sweepEngagementInvitationReminders(db())).toMatchObject({ considered: 0, reminded: 0 });
    expect(announced.unanswered).toHaveBeenCalledTimes(1);
  });

  it('η κρίση: ληγμένη ⇒ κλείνει · μη οφειλόμενη ⇒ τίποτα · ήδη υπενθυμισμένη ⇒ τίποτα', () => {
    const base = { state: 'pending' as const, reminderSentAt: null, reminderDueAt: '2026-10-06T00:00:00.000Z', expiresAt: '2026-10-17T00:00:00.000Z' };
    const at = (iso: string, extra = {}) => reminderVerdict({ ...base, ...extra } as Parameters<typeof reminderVerdict>[0], iso);
    expect(at('2026-10-05T00:00:00.000Z')).toBe('skip');
    expect(at('2026-10-07T00:00:00.000Z')).toBe('remind');
    expect(at('2026-10-18T00:00:00.000Z')).toBe('expire');
    expect(at('2026-10-07T00:00:00.000Z', { reminderSentAt: '2026-10-06T09:13:00.000Z' })).toBe('skip');
  });
});

describe('§14.8 — κάθε αλλαγή πρόσκλησης ενημερώνει ΖΩΝΤΑΝΑ τις θέσεις του οικοδεσπότη (Α36)', () => {
  const HOST_VIEW = { kind: 'host', propertyId: 'prop_1', companyId: 'comp_a' } as const;
  const hostRevision = () => readViewRevision(db(), HOST_VIEW);

  it('έκδοση · επαναποστολή · ακύρωση · άρνηση · υπενθύμιση ⇒ +1 στην όψη του οικοδεσπότη, η καθεμία', async () => {
    const record = await openCase();
    let last = await hostRevision();
    const step = async (act: () => Promise<unknown>) => {
      await act();
      const now = await hostRevision();
      const moved = now - last;
      last = now;
      return moved;
    };

    expect(await step(() => invite(record))).toBe(1);
    expect(await step(() => invite(record))).toBe(1);
    expect(await step(() => cancelCaseInvitation(db(), host, record, 'notary', Date.now()))).toBe(1);
    const token = await invite(record);
    last = await hostRevision();
    expect(await step(() => respondToEngagementInvitation(db(), { action: 'decline', token, identity: notary() }))).toBe(1);
    await invite(record);
    last = await hostRevision();
    const pending = invitationDocs().find((doc) => doc.data.state === 'pending');
    fake.seed(INVITATIONS, pending!.id, { ...pending!.data, reminderDueAt: '2000-01-01T00:00:00.000Z' });
    expect(await step(() => sweepEngagementInvitationReminders(db()))).toBe(1);
    // Τίποτα δεν άλλαξε ⇒ κανένα σήμα (ιδεμποτία: δεύτερο πέρασμα, ακύρωση χωρίς εκκρεμή).
    expect(await step(() => sweepEngagementInvitationReminders(db()))).toBe(0);
  });

  it('«ανοίχτηκε» ⇒ +1 στην πρώτη ανάγνωση του συνδέσμου, 0 στη δεύτερη (το «ανοίχτηκε» γράφεται μία φορά)', async () => {
    const token = await invite(await openCase());
    const preview = await previewEngagementInvitation(db(), { token, viewerEmail: null });
    if (preview.kind !== 'preview') throw new Error(preview.kind);
    const before = await hostRevision();
    await preview.markOpened();
    expect(await hostRevision()).toBe(before + 1);
    await preview.markOpened();
    expect(await hostRevision()).toBe(before + 1);
  });
});

describe('ADR-901 §15 (Γ1) — η αποδοχή από email γράφει «για λογαριασμό ποιου γραφείου»', () => {
  /** Τα γραφεία όπου ΑΝΗΚΕΙ ο αποδεχόμενος — ό,τι θα απαντούσε ο `listOwnWorkspaces`. */
  const belongsTo = (...companyIds: string[]) =>
    mockOwnWorkspaces.mockImplementation(async () => ({ outcome: 'ok', reachable: companyIds, belonging: companyIds }));

  beforeEach(() => { belongsTo(); });
  afterAll(() => { belongsTo(); });

  it('ο νεογραμμένος δεν έχει γραφείο ⇒ προσωρινά ο ΔΙΚΟΣ του προσωπικός χώρος', async () => {
    const outcome = await accept(await invite(await openCase()));
    expect(outcome.kind === 'accepted' && outcome.effect.actingFor).toEqual({ kind: 'personal', userId: 'u_notary' });
  });

  it('ο ΥΠΑΡΧΩΝ λογαριασμός με ένα γραφείο ⇒ εκεί, αυτόματα — ίδιος κριτής με το «Αναλαμβάνω»', async () => {
    // Μετάλλαξη: η πόρτα του email γράφει πάντα προσωπικό χώρο ⇒ δύο πόρτες, δύο απαντήσεις.
    belongsTo('comp_notary');
    const outcome = await accept(await invite(await openCase()));
    expect(outcome.kind === 'accepted' && outcome.effect.actingFor).toEqual({ kind: 'org', companyId: 'comp_notary' });
    expect(mockOwnWorkspaces).toHaveBeenCalledWith('u_notary', null);
  });

  it('Α41 — 2 γραφεία χωρίς επιλογή ⇒ άρνηση, η πρόσκληση ΜΕΝΕΙ `pending`, καμία συμμετοχή· με επιλογή περνά', async () => {
    belongsTo('comp_notary', 'comp_partners');
    const token = await invite(await openCase());
    expect(await accept(token)).toEqual({ kind: 'refused', reason: 'acting-choice-required' });
    expect(invitationStates()).toEqual(['pending']);
    expect(engagementWrites()).toHaveLength(0);
    const outcome = await accept(token, notary(), { active: null, requested: { kind: 'org', companyId: 'comp_partners' } });
    expect(outcome.kind === 'accepted' && outcome.effect.actingFor).toEqual({ kind: 'org', companyId: 'comp_partners' });
  });

  it('Α40 · Α42 — «προσωπικά» ενώ έχει γραφείο, ή ξένο γραφείο ⇒ `acting-refused`, η πρόσκληση μένει `pending`', async () => {
    belongsTo('comp_notary');
    const token = await invite(await openCase());
    expect(await accept(token, notary(), { active: null, requested: { kind: 'personal' } })).toEqual({ kind: 'refused', reason: 'acting-refused' });
    expect(await accept(token, notary(), { active: null, requested: { kind: 'org', companyId: 'comp_a' } })).toEqual({ kind: 'refused', reason: 'acting-refused' });
    expect(invitationStates()).toEqual(['pending']);
    expect(engagementWrites()).toHaveLength(0);
  });

  it('Α43 — «δεν μπόρεσα να ρωτήσω τα γραφεία» ⇒ `unavailable`, ΠΟΤΕ σιωπηλά προσωπικός χώρος', async () => {
    mockOwnWorkspaces.mockImplementation(async () => ({ outcome: 'unknown', reason: 'query-failed' }));
    const token = await invite(await openCase());
    expect(await accept(token)).toEqual({ kind: 'unavailable', reason: 'offices-unknown' });
    expect(invitationStates()).toEqual(['pending']);
    expect(engagementWrites()).toHaveLength(0);
  });

  it('η άρνηση της πρόσκλησης ΔΕΝ ρωτά γραφεία', async () => {
    const token = await invite(await openCase());
    mockOwnWorkspaces.mockClear();
    await respondToEngagementInvitation(db(), { action: 'decline', token, identity: notary() });
    expect(mockOwnWorkspaces).not.toHaveBeenCalled();
  });
});
