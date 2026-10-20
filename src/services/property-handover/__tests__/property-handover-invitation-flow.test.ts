/**
 * @jest-environment node
 *
 * @fileoverview ADR-916 §7 Β11–Β20 — **η πρόσκληση του αγοραστή, από την πώληση ως τον φάκελο**, πάνω στο fake Firestore
 *   χωρίς mocks βάσης: ο ΕΝΑΣ γραφέας (κράτηση → πρόσκληση + email) → η αποδοχή του κοινού πυρήνα (δέσιμο + φάκελος) →
 *   ολοκλήρωση (προβολή στον φάκελο) → ακύρωση / αλλαγή email / άρνηση / αποτυχία παρόχου. Mocks: μόνο το email, το ίχνος
 *   και οι αναγνώστες ονομάτων. Όλα τα δεδομένα συνθετικά.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { InvitationRedeemer } from '@/server/invitations/invitation-redeem';
import { mintHandoverInvitation } from '@/server/property-handover-invitations/handover-invitation-kind';
import { previewHandoverInvitation } from '@/server/property-handover-invitations/handover-invitation-preview';
import { respondToHandoverInvitation } from '@/server/property-handover-invitations/handover-invitation-redeem';
import { syncPropertyHandovers } from '@/services/property-handover/property-handover-write.service';
import { FakeFirestore } from '@/test-utils/fake-firestore/fake-firestore';

jest.mock('@/lib/telemetry', () => {
  const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
  return { createModuleLogger: () => logger, sharedLogger: logger };
});
jest.mock('@/services/entity-audit-tracked-write', () => ({ recordTrackedEntityWrite: jest.fn(async () => undefined) }));
jest.mock('@/lib/workspace/workspace-catalog', () => ({ readWorkspaceName: jest.fn(async () => 'Κατασκευαστική Άλφα') }));
jest.mock('@/services/conveyance/conveyance-subject.server', () => ({
  loadConveyanceSubject: jest.fn(async () => ({ propertyName: 'Διαμέρισμα Α1' })),
}));
jest.mock('@/server/invitations/invitation-notice', () => ({ deliverInvitationEmail: jest.fn() }));

/* eslint-disable @typescript-eslint/no-require-imports */
const { deliverInvitationEmail } = require('@/server/invitations/invitation-notice') as { deliverInvitationEmail: jest.Mock };
const { sharedLogger: mockLogger } = require('@/lib/telemetry') as { sharedLogger: Record<'info' | 'warn' | 'error' | 'debug', jest.Mock> };
/* eslint-enable @typescript-eslint/no-require-imports */

interface Sent { readonly to: string; readonly subject: string; readonly text: string }

const COMPANY = 'comp_alfa';
const PROPERTY = 'prop_1';
const ANNA: InvitationRedeemer = { uid: 'uid_anna', email: 'anna@example.test', emailVerified: true, secondFactorEnrolled: false };

let fake: FakeFirestore;
let sent: Sent[];
let provider: 'accepted' | 'failed';
const db = (): AdminFirestore => fake as unknown as AdminFirestore;
const docs = (collection: string) => Object.entries(fake.getAllDocs(collection)) as Array<[string, Record<string, unknown>]>;
const handovers = () => docs(COLLECTIONS.PROPERTY_HANDOVERS).map(([, doc]) => doc);
const invitations = () => docs(COLLECTIONS.PROPERTY_HANDOVER_INVITATIONS).map(([, doc]) => doc);
const dossiers = () => docs(COLLECTIONS.PROPERTY_DOSSIERS);
const live = () => invitations().filter((invitation) => invitation.state === 'pending');

function tokenOf(message: Sent | undefined): string {
  const match = message === undefined ? null : /\/handover-invite\/([^\s]+)/.exec(message.text);
  if (match === null) throw new Error('no link in message');
  return decodeURIComponent(match[1]);
}

function setProperty(patch: Record<string, unknown>): void {
  const current = fake.getAllDocs(COLLECTIONS.PROPERTIES)[PROPERTY] ?? {};
  fake.seed(COLLECTIONS.PROPERTIES, PROPERTY, { ...current, ...patch });
}

function setEmail(email: string | null): void {
  fake.seed(COLLECTIONS.CONTACTS, 'cont_anna', {
    companyId: COMPANY, type: 'individual', firstName: 'Άννα', lastName: 'Συνθετική',
    emails: email === null ? [] : [{ email, isPrimary: true, type: 'personal' }],
  });
}

const sync = (cause: 'property-write' | 'reconcile' = 'property-write') =>
  syncPropertyHandovers(db(), PROPERTY, { cause, performedBy: cause === 'reconcile' ? 'system' : 'uid_agent' });
const accept = (token: string, identity: InvitationRedeemer = ANNA) =>
  respondToHandoverInvitation(db(), { action: 'accept', token, identity });
const preview = (token: string, viewerEmail: string | null = null) => previewHandoverInvitation(db(), { token, viewerEmail });

beforeEach(() => {
  process.env.PROPERTY_HANDOVER_INVITE_SECRET = 'test-secret-handover-0123456789abcdef';
  process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.test';
  Object.values(mockLogger).forEach((fn) => fn.mockClear());
  fake = new FakeFirestore();
  sent = [];
  provider = 'accepted';
  deliverInvitationEmail.mockReset().mockImplementation(async (d: { inviteeEmail: string; compose: (l: string) => Promise<{ subject: string; text: string } | null> }) => {
    const email = await d.compose('el');
    if (email !== null) sent.push({ to: d.inviteeEmail, subject: email.subject, text: email.text });
    return provider;
  });
  setProperty({
    companyId: COMPANY, name: 'Διαμέρισμα Α1', commercialStatus: 'reserved',
    commercial: { owners: [{ contactId: 'cont_anna', ownershipPct: 100, role: 'buyer' }], legalPhase: 'preliminary_signed' },
  });
  setEmail(ANNA.email);
});

describe('Β11–Β13 — ο γραφέας: κράτηση ⇒ πρόσκληση, μία φορά', () => {
  it('Β11 — κράτηση ⇒ παράδοση + ΜΙΑ ζωντανή πρόσκληση + ΕΝΑ email με σύνδεσμο αγοραστή· έκβαση στο κάτοπτρο', async () => {
    await sync();
    expect(live()).toHaveLength(1);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.to).toBe(ANNA.email);
    expect(sent[0]?.subject).not.toContain('έτοιμος');
    expect(handovers()[0]?.invitation).toMatchObject({ status: 'issued', delivery: 'accepted', deliveryAttempts: 1, occasion: 'reservation' });
  });

  it('Β12 — ιδεμπότητα: δεύτερη συμφιλίωση (και το δίχτυ) ⇒ κανένα νέο email, καμία νέα πρόσκληση', async () => {
    await sync();
    await sync();
    await sync('reconcile');
    expect(invitations()).toHaveLength(1);
    expect(sent).toHaveLength(1);
  });

  it('Β13 — η επαφή άλλαξε email ⇒ το δίχτυ ανακαλεί την παλιά και στέλνει νέα· ο παλιός σύνδεσμος ΠΕΘΑΙΝΕΙ', async () => {
    await sync();
    const oldToken = tokenOf(sent[0]);
    setEmail('anna.new@example.test');
    await sync('reconcile');
    expect(live()).toHaveLength(1);
    expect(sent.at(-1)?.to).toBe('anna.new@example.test');
    expect(await accept(oldToken)).toEqual({ kind: 'refused', reason: 'revoked' });
  });

  it('Β14 — χωρίς email ⇒ σήμα `no-address` στο γραφείο, καμία πρόσκληση, κανένα email', async () => {
    setEmail(null);
    await sync();
    expect(invitations()).toHaveLength(0);
    expect(sent).toHaveLength(0);
    expect(handovers()[0]?.invitation).toMatchObject({ status: 'no-address' });
  });
});

describe('Β15–Β17 — η αποδοχή: δέσιμο + φάκελος, αδιαίρετα', () => {
  it('Β15 — αποδοχή ⇒ ο λογαριασμός δένεται ΚΑΙ γεννιέται ο φάκελος με προέλευση· δεύτερο κλικ ⇒ `already-used`, ΕΝΑΣ φάκελος', async () => {
    await sync();
    const token = tokenOf(sent[0]);
    const outcome = await accept(token);
    expect(outcome.kind).toBe('accepted');
    expect(handovers()[0]?.recipient).toMatchObject({ userId: ANNA.uid });
    const [[dossierId, dossier] = ['', {}]] = dossiers();
    expect(dossier).toMatchObject({
      userId: ANNA.uid, label: 'Διαμέρισμα Α1', lifecycle: 'active',
      origin: { kind: 'handover', issuerCompanyId: COMPANY, issuerName: 'Κατασκευαστική Άλφα', handoverLifecycle: 'awaiting-completion' },
    });
    expect((handovers()[0]?.recipient as { dossierId: string }).dossierId).toBe(dossierId);
    expect(await accept(token)).toEqual({ kind: 'refused', reason: 'already-used' });
    expect(dossiers()).toHaveLength(1);
  });

  it('Β16 — 🔴 άλλος λογαριασμός με τον σύνδεσμο ⇒ `wrong-recipient`, ΚΑΝΕΝΑΣ φάκελος (εδώ σπάει το «Claim this home»)', async () => {
    await sync();
    const intruder: InvitationRedeemer = { ...ANNA, uid: 'uid_mallory', email: 'mallory@example.test' };
    expect(await accept(tokenOf(sent[0]), intruder)).toEqual({ kind: 'refused', reason: 'wrong-recipient' });
    expect(dossiers()).toHaveLength(0);
    expect(handovers()[0]?.recipient).toBeNull();
  });

  it('Β17 — η ολοκλήρωση μετά την αποδοχή ⇒ ο φάκελος δείχνει «έτοιμος», ΚΑΝΕΝΑ νέο email', async () => {
    await sync();
    await accept(tokenOf(sent[0]));
    setProperty({ commercialStatus: 'sold', commercial: { owners: [{ contactId: 'cont_anna', ownershipPct: 100, role: 'buyer' }], legalPhase: 'final_signed' } });
    await sync();
    expect(dossiers()[0]?.[1]).toMatchObject({ origin: { handoverLifecycle: 'ready' } });
    expect(sent).toHaveLength(1);
  });
});

describe('Β23–Β25 — η όψη της σελίδας `/handover-invite/[token]` (ADR-916 Φ-Β2)', () => {
  it('Β23 — η όψη ΔΕΝ καίει την πρόσκληση· λέει εταιρεία + σπίτι + αφορμή, και ΠΟΙΟΝ αφορά (υπόδειξη)', async () => {
    await sync();
    const token = tokenOf(sent[0]);
    const seen = await preview(token, ANNA.email);
    expect(seen).toMatchObject({
      kind: 'preview', addressedToViewer: true,
      preview: { issuerName: 'Κατασκευαστική Άλφα', propertyLabel: 'Διαμέρισμα Α1', occasion: 'reservation' },
    });
    expect(await preview(token, 'mallory@example.test')).toMatchObject({ addressedToViewer: false });
    expect(await preview(token)).toMatchObject({ addressedToViewer: null });
    // 🔒 Κανένα email παραλήπτη, κανένα όνομα μέρους στην όψη (ADR-742).
    expect(JSON.stringify(seen.kind === 'preview' ? seen.preview : null)).not.toContain(ANNA.email);
    expect((await accept(token)).kind).toBe('accepted');
  });

  it('Β24 — «ανοίχτηκε» γράφεται ΜΙΑ φορά· ποτέ μετά την αποδοχή', async () => {
    await sync();
    const token = tokenOf(sent[0]);
    const first = await preview(token);
    if (first.kind !== 'preview') throw new Error('expected preview');
    await first.markOpened();
    const openedAt = live()[0]?.openedAt;
    expect(openedAt).toEqual(expect.any(String));
    await first.markOpened();
    expect(live()[0]?.openedAt).toBe(openedAt);
  });

  it('Β25 — μετά την αποδοχή ⇒ `already-used` · παλιός σύνδεσμος μετά από αλλαγή email ⇒ `revoked` (όχι 404)', async () => {
    await sync();
    const oldToken = tokenOf(sent[0]);
    setEmail('anna.new@example.test');
    await sync('reconcile');
    expect(await preview(oldToken)).toEqual({ kind: 'refused', reason: 'revoked' });
    const token = tokenOf(sent.at(-1));
    await accept(token, { ...ANNA, email: 'anna.new@example.test' });
    expect(await preview(token, 'anna.new@example.test')).toEqual({ kind: 'refused', reason: 'already-used' });
  });
});

describe('Β18–Β20 — ολοκλήρωση · ακύρωση · άρνηση · πάροχος', () => {
  it('Β18 — ολοκλήρωση ΧΩΡΙΣ αποδοχή ⇒ νέα πρόσκληση «ο φάκελος είναι έτοιμος», η παλιά ανακαλείται', async () => {
    await sync();
    setProperty({ commercialStatus: 'sold', commercial: { owners: [{ contactId: 'cont_anna', ownershipPct: 100, role: 'buyer' }], legalPhase: 'final_signed' } });
    await sync();
    expect(live()).toHaveLength(1);
    expect(sent).toHaveLength(2);
    expect(sent[1]?.subject).toContain('έτοιμος');
    expect(await accept(tokenOf(sent[0]))).toEqual({ kind: 'refused', reason: 'revoked' });
    expect((await accept(tokenOf(sent[1]))).kind).toBe('accepted');
  });

  it('Β19 — ακύρωση πριν την αποδοχή ⇒ ο σύνδεσμος ανακαλείται και η αποδοχή αρνείται· κανένας φάκελος', async () => {
    await sync();
    setProperty({ commercialStatus: 'for-sale' });
    await sync();
    expect(handovers()[0]).toMatchObject({ lifecycle: 'cancelled', invitation: null });
    expect(live()).toHaveLength(0);
    expect(await accept(tokenOf(sent[0]))).toEqual({ kind: 'refused', reason: 'revoked' });
    expect(dossiers()).toHaveLength(0);
  });

  it('Β20 — «Δεν το θέλω» ⇒ το κάτοπτρο το θυμάται· η ολοκλήρωση ΔΕΝ ξαναστέλνει στο ίδιο email', async () => {
    await sync();
    const declined = await respondToHandoverInvitation(db(), { action: 'decline', token: tokenOf(sent[0]), identity: ANNA });
    expect(declined.kind).toBe('declined');
    expect(handovers()[0]?.invitation).toMatchObject({ declinedAt: expect.any(String) });
    setProperty({ commercialStatus: 'sold', commercial: { owners: [{ contactId: 'cont_anna', ownershipPct: 100, role: 'buyer' }], legalPhase: 'final_signed' } });
    await sync('reconcile');
    expect(sent).toHaveLength(1);
  });

  it('Β22 — 🔴 ορφανή ζωντανή πρόσκληση (όχι η τρέχουσα του κατόπτρου) ⇒ `handover-closed`, κανένας φάκελος', async () => {
    await sync();
    const [[handoverId] = ['']] = docs(COLLECTIONS.PROPERTY_HANDOVERS);
    // Αλλοίωση που ο γραφέας δεν παράγει ποτέ: δεύτερη `pending` για την ίδια παράδοση, άγνωστη στο κάτοπτρο.
    const orphan = await mintHandoverInvitation({
      companyId: COMPANY, propertyId: PROPERTY, handoverId, contactId: 'cont_anna',
      email: ANNA.email, occasion: 'reservation', actorUid: 'uid_agent', nowValue: new Date().toISOString(),
    });
    fake.seed(COLLECTIONS.PROPERTY_HANDOVER_INVITATIONS, orphan.invitation.id, { ...orphan.invitation });
    expect(await accept(orphan.token)).toEqual({ kind: 'refused', reason: 'handover-closed' });
    expect(dossiers()).toHaveLength(0);
  });

  it('Β26 — 🔴 λείπει το μυστικό ⇒ η όψη λέει «δεν μπόρεσα» (`unavailable`), ποτέ 404 ή ψεύτικη άρνηση', async () => {
    await sync();
    const token = tokenOf(sent[0]);
    delete process.env.PROPERTY_HANDOVER_INVITE_SECRET;
    expect(await preview(token)).toEqual({ kind: 'unavailable' });
  });

  it('Β27 — 🔴 λείπει το μυστικό στην έκδοση ⇒ ΕΝΑ σήμα «σε αναμονή ρύθμισης», ΚΑΝΕΝΑ `error`· όταν ρυθμιστεί, το δίχτυ εκδίδει', async () => {
    delete process.env.PROPERTY_HANDOVER_INVITE_SECRET;
    expect(await sync()).toEqual({ kind: 'synced', writes: 1, invitationWrites: 0, invitationsAwaitingConfiguration: 1 });
    expect(invitations()).toHaveLength(0);
    expect(sent).toHaveLength(0);
    expect(handovers()[0]?.invitation).toBeNull();
    expect(mockLogger.error).not.toHaveBeenCalled();
    process.env.PROPERTY_HANDOVER_INVITE_SECRET = 'test-secret-handover-0123456789abcdef';
    expect(await sync('reconcile')).toMatchObject({ kind: 'synced', invitationWrites: 1, invitationsAwaitingConfiguration: 0 });
    expect(live()).toHaveLength(1);
    expect(sent).toHaveLength(1);
  });

  it('Β21 — ο πάροχος αρνήθηκε ⇒ `failed` στο κάτοπτρο· το δίχτυ ξαναστέλνει με ΝΕΟ σύνδεσμο της ΙΔΙΑΣ πρόσκλησης, που δουλεύει', async () => {
    provider = 'failed';
    await sync();
    expect(handovers()[0]?.invitation).toMatchObject({ delivery: 'failed', deliveryAttempts: 1 });
    provider = 'accepted';
    await sync('reconcile');
    expect(invitations()).toHaveLength(1);
    expect(sent).toHaveLength(2);
    expect(handovers()[0]?.invitation).toMatchObject({ delivery: 'accepted', deliveryAttempts: 2 });
    expect((await accept(tokenOf(sent[1]))).kind).toBe('accepted');
  });
});
