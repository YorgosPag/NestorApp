/**
 * @jest-environment node
 *
 * @fileoverview ADR-916 §7 Ζ45–Ζ51 — **η «Ανάκληση παράδοσης» από την πώληση ως τον φάκελο του αγοραστή** (Φ-Δ.5), πάνω στο
 *   fake Firestore χωρίς mocks βάσης: κράτηση → αποδοχή → ολοκλήρωση → η πώληση πέφτει (Ο4) → ανάκληση από τον ΕΝΑ γραφέα →
 *   προβολή στον φάκελο · email χωρίς αιτιολογία · δίχτυ · τερματικό. Mocks: μόνο το email, το ίχνος, το Auth και οι
 *   αναγνώστες ονομάτων. Όλα τα δεδομένα συνθετικά.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { HANDOVER_WITHDRAWAL_NOTICE_CAP } from '@/config/property-handover-withdrawal-policy';
import type { InvitationRedeemer } from '@/server/invitations/invitation-redeem';
import { respondToHandoverInvitation } from '@/server/property-handover-invitations/handover-invitation-redeem';
import { recordHandoverWithdrawalNotice } from '@/services/property-handover/property-handover-progress-write';
import { syncPropertyHandovers } from '@/services/property-handover/property-handover-write.service';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';

jest.mock('@/lib/telemetry', () => {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  return { createModuleLogger: () => logger, sharedLogger: logger };
});
jest.mock('@/services/entity-audit-tracked-write', () => ({ recordTrackedEntityWrite: jest.fn(async () => undefined) }));
jest.mock('@/lib/workspace/workspace-catalog', () => ({ readWorkspaceName: jest.fn(async () => 'Κατασκευαστική Άλφα') }));
jest.mock('@/services/conveyance/conveyance-subject.server', () => ({
  loadConveyanceSubject: jest.fn(async (_db: unknown, _companyId: string, propertyId: string) => ({
    propertyName: 'Διαμέρισμα Α1',
    subject: { kind: 'property', propertyId, buildingId: null, projectId: null, appurtenances: [] },
  })),
}));
jest.mock('@/server/invitations/invitation-notice', () => ({ deliverInvitationEmail: jest.fn() }));
jest.mock('@/server/notifications/notification-orchestrator', () => ({
  ...jest.requireActual('@/server/notifications/notification-orchestrator'),
  dispatchNotification: jest.fn(async () => ({ success: true, dedupeKey: 'k', skipped: false })),
}));
jest.mock('@/lib/workspace/workspace-administrators', () => ({ activeWorkspaceAdministrators: jest.fn(async () => []) }));
jest.mock('@/lib/firebaseAdmin', () => ({
  ...jest.requireActual('@/lib/firebaseAdmin'),
  getAdminAuth: () => ({ getUser: mockGetUser }),
}));

const mockGetUser = jest.fn();

/* eslint-disable @typescript-eslint/no-require-imports */
const { deliverInvitationEmail } = require('@/server/invitations/invitation-notice') as { deliverInvitationEmail: jest.Mock };
const { recordTrackedEntityWrite } = require('@/services/entity-audit-tracked-write') as { recordTrackedEntityWrite: jest.Mock };
/* eslint-enable @typescript-eslint/no-require-imports */

interface Sent { readonly kind: string; readonly to: string; readonly subject: string; readonly text: string }

const COMPANY = 'comp_alfa';
const PROPERTY = 'prop_1';
const REASON = 'Η πώληση ακυρώθηκε με δικαστική απόφαση — εσωτερικό σημείωμα.';
const ANNA: InvitationRedeemer = { uid: 'uid_anna', email: 'anna@example.test', emailVerified: true, secondFactorEnrolled: false };
const OWNER = { contactId: 'cont_anna', ownershipPct: 100, role: 'buyer' };

let fake: FakeFirestore;
let sent: Sent[];
let provider: 'accepted' | 'failed';
const db = (): AdminFirestore => fake as unknown as AdminFirestore;
const docs = (collection: string) => Object.entries(fake.getAllDocs(collection)) as Array<[string, Record<string, unknown>]>;
const handover = () => docs(COLLECTIONS.PROPERTY_HANDOVERS)[0]?.[1] ?? {};
const handoverId = () => docs(COLLECTIONS.PROPERTY_HANDOVERS)[0]?.[0] ?? '';
const dossier = () => docs(COLLECTIONS.PROPERTY_DOSSIERS)[0]?.[1] ?? {};
const notices = () => sent.filter((message) => message.kind === 'property-handover-withdrawal');

function setProperty(patch: Record<string, unknown>): void {
  const current = fake.getAllDocs(COLLECTIONS.PROPERTIES)[PROPERTY] ?? {};
  fake.seed(COLLECTIONS.PROPERTIES, PROPERTY, { ...current, ...patch });
}

const sync = (cause: 'property-write' | 'reconcile' = 'property-write') =>
  syncPropertyHandovers(db(), PROPERTY, { cause, performedBy: cause === 'reconcile' ? 'system' : 'uid_agent' });
const withdraw = (id: string = handoverId(), reason: string = REASON) =>
  syncPropertyHandovers(db(), PROPERTY, { cause: 'office-withdrawal', performedBy: 'uid_office', withdrawal: { handoverId: id, reason } });
const withdrawalOf = (outcome: Awaited<ReturnType<typeof withdraw>>) => (outcome.kind === 'synced' ? outcome.withdrawal : 'failed');

function tokenOfFirstInvitation(): string {
  const match = /\/handover-invite\/([^\s]+)/.exec(sent.find((message) => message.kind !== 'property-handover-withdrawal')?.text ?? '');
  if (match === null) throw new Error('no invitation link');
  return decodeURIComponent(match[1]);
}

/** Κράτηση → αποδοχή → ολοκλήρωση → η πώληση πέφτει μετά την ολοκλήρωση (Ο4). */
async function completedThenReverted(): Promise<void> {
  await sync();
  expect((await respondToHandoverInvitation(db(), { action: 'accept', token: tokenOfFirstInvitation(), identity: ANNA })).kind).toBe('accepted');
  setProperty({ commercialStatus: 'sold', commercial: { owners: [OWNER], legalPhase: 'final_signed' } });
  await sync();
  setProperty({ commercialStatus: 'for-sale', commercial: { owners: [], legalPhase: 'final_signed' } });
  await sync();
  expect(handover()).toMatchObject({ lifecycle: 'ready' });
}

beforeEach(() => {
  process.env.PROPERTY_HANDOVER_INVITE_SECRET = 'test-secret-handover-0123456789abcdef';
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.test';
  fake = new FakeFirestore();
  sent = [];
  provider = 'accepted';
  recordTrackedEntityWrite.mockClear();
  mockGetUser.mockReset().mockResolvedValue({ uid: ANNA.uid, email: 'Anna@Example.test' });
  deliverInvitationEmail.mockReset().mockImplementation(async (d: { kind: string; inviteeEmail: string; compose: (l: string) => Promise<{ subject: string; text: string } | null> }) => {
    const email = await d.compose('el');
    if (email !== null) sent.push({ kind: d.kind, to: d.inviteeEmail, subject: email.subject, text: email.text });
    return provider;
  });
  setProperty({ companyId: COMPANY, name: 'Διαμέρισμα Α1', commercialStatus: 'reserved', commercial: { owners: [OWNER], legalPhase: 'preliminary_signed' } });
  fake.seed(COLLECTIONS.CONTACTS, 'cont_anna', {
    companyId: COMPANY, type: 'individual', firstName: 'Άννα', lastName: 'Συνθετική', emails: [{ email: ANNA.email, isPrimary: true, type: 'personal' }],
  });
});

describe('Ζ45 — η ανάκληση στον ΕΝΑ γραφέα', () => {
  it('Ο4 ⇒ withdrawn, με αιτιολογία · δρώντα · ειδοποίηση· ο φάκελος του αγοραστή το βλέπει στην ΙΔΙΑ συναλλαγή', async () => {
    await completedThenReverted();
    expect(withdrawalOf(await withdraw())).toEqual({ kind: 'withdrawn' });
    expect(handover()).toMatchObject({
      lifecycle: 'withdrawn', fileDeliveryState: null, withdrawalNoticeState: null,
      withdrawal: { reason: REASON, withdrawnBy: 'uid_office', notice: { delivery: 'accepted', attempts: 1 } },
    });
    expect(dossier()).toMatchObject({ origin: { handoverLifecycle: 'withdrawn' } });
  });

  it('τίποτα δεν σβήνεται: ο φάκελος μένει ενεργός, ο παραλήπτης μένει, η πρόοδος μένει', async () => {
    await completedThenReverted();
    const before = handover();
    await withdraw();
    expect(dossier()).toMatchObject({ lifecycle: 'active', userId: ANNA.uid });
    expect(handover()).toMatchObject({ recipient: before.recipient, fileDelivery: before.fileDelivery });
  });

  it('ίχνος: μετάβαση κύκλου ζωής από τον ΑΝΘΡΩΠΟ', async () => {
    await completedThenReverted();
    recordTrackedEntityWrite.mockClear();
    await withdraw();
    expect(recordTrackedEntityWrite).toHaveBeenCalledWith(expect.objectContaining({
      entityType: 'property_handover', performedBy: 'uid_office',
      before: expect.objectContaining({ lifecycle: 'ready' }), after: expect.objectContaining({ lifecycle: 'withdrawn' }),
    }));
  });
});

describe('Ζ46 — όρια της πόρτας: η κρίση ξανατρέχει ΜΕΣΑ στη συναλλαγή', () => {
  it('η πώληση ισχύει ⇒ not-withdrawable, καμία εγγραφή, κανένα email', async () => {
    await sync();
    await respondToHandoverInvitation(db(), { action: 'accept', token: tokenOfFirstInvitation(), identity: ANNA });
    setProperty({ commercialStatus: 'sold', commercial: { owners: [OWNER], legalPhase: 'final_signed' } });
    await sync();
    expect(withdrawalOf(await withdraw())).toEqual({ kind: 'refused', reason: 'not-withdrawable' });
    expect(handover()).toMatchObject({ lifecycle: 'ready', withdrawal: null });
    expect(notices()).toHaveLength(0);
  });

  it('άγνωστη παράδοση ⇒ handover-unknown', async () => {
    await completedThenReverted();
    expect(withdrawalOf(await withdraw('phov_foreign'))).toEqual({ kind: 'refused', reason: 'handover-unknown' });
  });

  it('ιδεμπότητα: δεύτερη ανάκληση ⇒ unchanged, ΕΝΑ email', async () => {
    await completedThenReverted();
    await withdraw();
    expect(withdrawalOf(await withdraw())).toEqual({ kind: 'unchanged' });
    expect(notices()).toHaveLength(1);
  });
});

describe('Ζ47 — το email: μόνο στον λογαριασμό που αποδέχτηκε, ΧΩΡΙΣ την αιτιολογία', () => {
  it('ΕΝΑ email στη διεύθυνση του λογαριασμού (κανονικοποιημένη) — καμία λέξη της αιτιολογίας, κανένας σύνδεσμος', async () => {
    await completedThenReverted();
    await withdraw();
    expect(notices()).toHaveLength(1);
    expect(notices()[0]?.to).toBe('anna@example.test');
    expect(notices()[0]?.text).not.toContain('δικαστική');
    expect(notices()[0]?.text).not.toMatch(/https?:\/\//);
    expect(notices()[0]?.subject).toContain('Διαμέρισμα Α1');
  });

  it('λογαριασμός που δεν υπάρχει πια ⇒ no-address (σήμα), καμία επανάληψη από το δίχτυ', async () => {
    await completedThenReverted();
    mockGetUser.mockRejectedValue(Object.assign(new Error('gone'), { code: 'auth/user-not-found' }));
    await withdraw();
    expect(handover()).toMatchObject({ withdrawal: { notice: { delivery: 'no-address', attempts: 1 } }, withdrawalNoticeState: null });
    await sync('reconcile');
    expect(notices()).toHaveLength(0);
  });
});

describe('Ζ48 — το δίχτυ: ό,τι δεν έγινε δεκτό ξαναστέλνεται, ως το όριο', () => {
  it('ο πάροχος αρνήθηκε ⇒ due· το δίχτυ ξαναστέλνει· στο όριο σταματά', async () => {
    await completedThenReverted();
    provider = 'failed';
    await withdraw();
    expect(handover()).toMatchObject({ withdrawal: { notice: { delivery: 'failed', attempts: 1 } }, withdrawalNoticeState: 'due' });
    for (let run = 1; run < HANDOVER_WITHDRAWAL_NOTICE_CAP + 2; run += 1) await sync('reconcile');
    expect(notices()).toHaveLength(HANDOVER_WITHDRAWAL_NOTICE_CAP);
    expect(handover()).toMatchObject({ withdrawal: { notice: { attempts: HANDOVER_WITHDRAWAL_NOTICE_CAP } }, withdrawalNoticeState: null });
  });

  it('δεκτό στην επανάληψη ⇒ accepted, καμία άλλη αποστολή', async () => {
    await completedThenReverted();
    provider = 'failed';
    await withdraw();
    provider = 'accepted';
    await sync('reconcile');
    await sync('reconcile');
    expect(notices()).toHaveLength(2);
    expect(handover()).toMatchObject({ withdrawal: { notice: { delivery: 'accepted', attempts: 2 } }, withdrawalNoticeState: null });
  });

  it('μια απλή συμφιλίωση (PATCH ακινήτου) ΔΕΝ ξαναστέλνει — μόνο το δίχτυ', async () => {
    await completedThenReverted();
    provider = 'failed';
    await withdraw();
    await sync();
    expect(notices()).toHaveLength(1);
  });
});

describe('Ζ48β — CAS της έκβασης: γράφεται ΜΟΝΟ όσο η ειδοποίηση οφείλεται', () => {
  it('αργοπορημένη/διπλή έκβαση μετά το «δεκτό» ⇒ καμία αλλαγή (ούτε προσπάθεια, ούτε υποβάθμιση σε failed)', async () => {
    await completedThenReverted();
    await withdraw();
    const settled = handover();
    await recordHandoverWithdrawalNotice(db(), { handoverId: handoverId(), delivery: 'failed' });
    expect(handover()).toEqual(settled);
  });

  it('στο όριο ⇒ καμία νέα προσπάθεια μετριέται', async () => {
    await completedThenReverted();
    provider = 'failed';
    await withdraw();
    for (let run = 1; run < HANDOVER_WITHDRAWAL_NOTICE_CAP; run += 1) await sync('reconcile');
    const capped = handover();
    await recordHandoverWithdrawalNotice(db(), { handoverId: handoverId(), delivery: 'accepted' });
    expect(handover()).toEqual(capped);
  });

  it('παράδοση που ΔΕΝ είναι ανακλημένη ⇒ καμία εγγραφή', async () => {
    await completedThenReverted();
    const before = handover();
    await recordHandoverWithdrawalNotice(db(), { handoverId: handoverId(), delivery: 'accepted' });
    expect(handover()).toEqual(before);
  });
});

describe('Ζ49 — τερματικό: τίποτα δεν το ανασταίνει', () => {
  it('η ίδια επαφή ξαναγίνεται αγοραστής ⇒ μένει withdrawn, καμία νέα πρόσκληση, καμία αντιγραφή', async () => {
    await completedThenReverted();
    await withdraw();
    const invitationsBefore = docs(COLLECTIONS.PROPERTY_HANDOVER_INVITATIONS).length;
    setProperty({ commercialStatus: 'sold', commercial: { owners: [OWNER], legalPhase: 'final_signed' } });
    await sync();
    await sync('reconcile');
    expect(handover()).toMatchObject({ lifecycle: 'withdrawn', fileDeliveryState: null });
    expect(docs(COLLECTIONS.PROPERTY_HANDOVER_INVITATIONS)).toHaveLength(invitationsBefore);
    expect(dossier()).toMatchObject({ origin: { handoverLifecycle: 'withdrawn' } });
  });
});

describe('Ζ50 — ανάκληση πριν την αποδοχή: ο σύνδεσμος πεθαίνει, κανένα email ανάκλησης', () => {
  it('ολοκλήρωση χωρίς αποδοχή → η πώληση πέφτει → ανάκληση ⇒ η πρόσκληση ανακαλείται, η αποδοχή αρνείται', async () => {
    await sync();
    const token = tokenOfFirstInvitation();
    setProperty({ commercialStatus: 'sold', commercial: { owners: [OWNER], legalPhase: 'final_signed' } });
    await sync();
    setProperty({ commercialStatus: 'for-sale', commercial: { owners: [], legalPhase: 'final_signed' } });
    await sync();
    expect(withdrawalOf(await withdraw())).toEqual({ kind: 'withdrawn' });
    expect(handover()).toMatchObject({ lifecycle: 'withdrawn', invitation: null, withdrawal: { notice: null } });
    expect(docs(COLLECTIONS.PROPERTY_HANDOVER_INVITATIONS).filter(([, doc]) => doc.state === 'pending')).toHaveLength(0);
    expect((await respondToHandoverInvitation(db(), { action: 'accept', token, identity: ANNA })).kind).toBe('refused');
    expect(notices()).toHaveLength(0);
  });
});
