/**
 * @jest-environment node
 *
 * @fileoverview ADR-916 §7 Β11–Β20 — **η πρόσκληση του αγοραστή, από την πώληση ως τον φάκελο**, πάνω στο fake Firestore
 *   χωρίς mocks βάσης: ο ΕΝΑΣ γραφέας (κράτηση → πρόσκληση + email) → η αποδοχή του κοινού πυρήνα (δέσιμο + φάκελος) →
 *   ολοκλήρωση (προβολή στον φάκελο) → ακύρωση / αλλαγή email / άρνηση / αποτυχία παρόχου. Mocks: μόνο το email, το ίχνος
 *   και οι αναγνώστες ονομάτων. Όλα τα δεδομένα συνθετικά.
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { PROPERTY_HANDOVER_TRACKED_FIELDS } from '@/config/audit-tracked-fields';
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
  loadConveyanceSubject: jest.fn(async (_db: unknown, _companyId: string, propertyId: string) => ({
    propertyName: 'Διαμέρισμα Α1',
    subject: { kind: 'property', propertyId, buildingId: null, projectId: null, appurtenances: [] },
  })),
}));
jest.mock('@/server/invitations/invitation-notice', () => ({ deliverInvitationEmail: jest.fn() }));
// ADR-916 Φ-Δ.2 — ο αγωγός ειδοποιήσεων καταγράφει (ο ΚΑΛΩΝ ελέγχεται, όχι ο orchestrator)· οι διαχειριστές ως σταθερά.
jest.mock('@/server/notifications/notification-orchestrator', () => ({
  ...jest.requireActual('@/server/notifications/notification-orchestrator'),
  dispatchNotification: jest.fn(),
}));
jest.mock('@/lib/workspace/workspace-administrators', () => ({ activeWorkspaceAdministrators: jest.fn() }));

/* eslint-disable @typescript-eslint/no-require-imports */
const { deliverInvitationEmail } = require('@/server/invitations/invitation-notice') as { deliverInvitationEmail: jest.Mock };
const { sharedLogger: mockLogger } = require('@/lib/telemetry') as { sharedLogger: Record<'info' | 'warn' | 'error' | 'debug', jest.Mock> };
const { dispatchNotification } = require('@/server/notifications/notification-orchestrator') as { dispatchNotification: jest.Mock };
const { activeWorkspaceAdministrators } = require('@/lib/workspace/workspace-administrators') as { activeWorkspaceAdministrators: jest.Mock };
const { recordTrackedEntityWrite } = require('@/services/entity-audit-tracked-write') as { recordTrackedEntityWrite: jest.Mock };
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
  dispatchNotification.mockReset().mockImplementation(async () => ({ success: true, dedupeKey: 'k', skipped: false }));
  activeWorkspaceAdministrators.mockReset().mockResolvedValue(['uid_admin', 'uid_agent']);
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

  it('Γ7β — 🔴 Ο12: ολοκλήρωση ΠΡΙΝ την αποδοχή ⇒ καμία αντιγραφή· η αποδοχή την κάνει οφειλόμενη και ο γραφέας την τρέχει', async () => {
    await sync();
    setProperty({ commercialStatus: 'sold', commercial: { owners: [{ contactId: 'cont_anna', ownershipPct: 100, role: 'buyer' }], legalPhase: 'final_signed' } });
    await sync();
    expect(handovers()[0]).toMatchObject({ lifecycle: 'ready', fileDeliveryState: null });
    expect((await accept(tokenOf(sent.at(-1)))).kind).toBe('accepted');
    expect(handovers()[0]).toMatchObject({ fileDeliveryState: 'pending' });
    await syncPropertyHandovers(db(), PROPERTY, { cause: 'acceptance', performedBy: ANNA.uid });
    expect(handovers()[0]).toMatchObject({ fileDeliveryState: 'delivered', fileDelivery: { state: 'delivered', delivered: 0, total: 0 } });
    expect(dossiers()[0]?.[1]).toMatchObject({ origin: { fileDelivery: { state: 'delivered', delivered: 0, total: 0 } } });
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
      email: ANNA.email, occasion: 'reservation', supersedesInvitationId: null, actorUid: 'uid_agent', nowValue: new Date().toISOString(),
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
    expect(await sync()).toEqual({ kind: 'synced', writes: 1, invitationWrites: 0, invitationsAwaitingConfiguration: 1, renewal: null });
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

/** Οι ειδοποιήσεις «απάντησε ο αγοραστής» που έφυγαν — ό,τι ζήτησε ο καλών από τον αγωγό. */
const answered = () => dispatchNotification.mock.calls
  .map(([request]) => request as Record<string, unknown>)
  .filter((request) => request.eventType === 'properties.handoverInvitationAnswered');
const decline = (token: string) => respondToHandoverInvitation(db(), { action: 'decline', token, identity: ANNA });

describe('Ζ10–Ζ15 — ADR-916 Φ-Δ.2 (Ο7): το γραφείο μαθαίνει την απάντηση του αγοραστή', () => {
  it('Ζ10 — αποδοχή ⇒ ΜΙΑ ειδοποίηση ανά άνθρωπο (αποστολέας + διαχειριστής, χωρίς διπλά), καρτέλα «Παράδοση», επόμενη κίνηση = η πώληση', async () => {
    await sync();
    expect((await accept(tokenOf(sent[0]))).kind).toBe('accepted');
    const invitationId = String(invitations()[0]?.id);
    expect(answered().map((request) => request.recipientId).sort()).toEqual(['uid_admin', 'uid_agent']);
    for (const request of answered()) {
      expect(request).toMatchObject({
        tenantId: COMPANY, entityId: PROPERTY, entityType: 'property', severity: 'info',
        eventId: `handover-invitation:${invitationId}:accepted`,
        titleKey: 'handoverInvitationAnswered.accepted', titleParams: { title: 'Διαμέρισμα Α1' },
        // Η κρίση της καρτέλας: κράτηση, όχι ολοκλήρωση ⇒ η επόμενη κίνηση είναι της πώλησης.
        bodyKey: 'handoverInvitationAnswered.body.sale', bodyParams: { name: 'Άννα Συνθετική' },
        workspace: { kind: 'org', companyId: COMPANY },
      });
      expect(JSON.stringify(request.actions)).toContain(`/properties/${PROPERTY}?tab=handover`);
    }
  });

  it('Ζ11 — άρνηση ⇒ ΠΡΟΕΙΔΟΠΟΙΗΣΗ με «η επόμενη κίνηση είναι του γραφείου» — ίδια λέξη με την καρτέλα (`declined ⇒ office`)', async () => {
    await sync();
    expect((await decline(tokenOf(sent[0]))).kind).toBe('declined');
    expect(answered()).toHaveLength(2);
    expect(answered()[0]).toMatchObject({
      severity: 'warning', titleKey: 'handoverInvitationAnswered.declined', bodyKey: 'handoverInvitationAnswered.body.office',
      eventId: `handover-invitation:${String(invitations()[0]?.id)}:declined`,
    });
  });

  it('Ζ12 — 🔴 πρόσκληση της νυχτερινής συμφιλίωσης (`system`) ⇒ μόνο άνθρωποι· ποτέ στη μηχανή, ποτέ στον ίδιο τον αγοραστή', async () => {
    activeWorkspaceAdministrators.mockResolvedValue(['uid_admin', ANNA.uid]);
    await sync('reconcile');
    await accept(tokenOf(sent[0]));
    expect(answered().map((request) => request.recipientId)).toEqual(['uid_admin']);
  });

  it('Ζ13 — δεύτερο κλικ ⇒ `already-used` και ΚΑΜΙΑ νέα ειδοποίηση· το `eventId` είναι ντετερμινιστικό (αποδίπλωση στον αγωγό)', async () => {
    await sync();
    const token = tokenOf(sent[0]);
    await accept(token);
    const first = answered().map((request) => request.eventId);
    expect((await accept(token)).kind).toBe('refused');
    expect(answered().map((request) => request.eventId)).toEqual(first);
    expect(new Set(first).size).toBe(1);
  });

  it('Ζ14 — 🔴 ο αγωγός πέφτει ⇒ η αποδοχή ΜΕΝΕΙ πετυχημένη (δέσιμο + φάκελος) και η βλάβη καταγράφεται', async () => {
    dispatchNotification.mockRejectedValue(new Error('notifications down'));
    await sync();
    expect((await accept(tokenOf(sent[0]))).kind).toBe('accepted');
    expect(handovers()[0]?.recipient).toMatchObject({ userId: ANNA.uid });
    expect(dossiers()).toHaveLength(1);
    expect(mockLogger.error).toHaveBeenCalledWith('Η ειδοποίηση απάντησης αγοραστή δεν στάλθηκε', expect.objectContaining({ answer: 'accepted' }));
  });

  it('Ζ14γ — 🔴 βλάβη σε ΕΝΑΝ παραλήπτη ⇒ οι άλλοι την παίρνουν κανονικά, και η βλάβη λέγεται με το ΣΩΣΤΟ όνομα (όχι «δεν βρέθηκαν αποδέκτες»)', async () => {
    dispatchNotification.mockImplementation(async (request: { recipientId: string }) => {
      if (request.recipientId === 'uid_admin') throw new Error('one recipient down');
      return { success: true, dedupeKey: 'k', skipped: false };
    });
    await sync();
    expect((await accept(tokenOf(sent[0]))).kind).toBe('accepted');
    expect(answered().map((request) => request.recipientId).sort()).toEqual(['uid_admin', 'uid_agent']);
    expect(mockLogger.error).toHaveBeenCalledTimes(1);
    expect(mockLogger.error).toHaveBeenCalledWith('Η ειδοποίηση απάντησης αγοραστή δεν στάλθηκε', expect.objectContaining({ answer: 'accepted' }));
  });

  it('Ζ14β — 🔴 ούτε οι αποδέκτες διαβάζονται ⇒ η άρνηση ΜΕΝΕΙ καταγεγραμμένη, καμία ειδοποίηση, η βλάβη λέγεται', async () => {
    activeWorkspaceAdministrators.mockRejectedValue(new Error('members unreadable'));
    await sync();
    expect((await decline(tokenOf(sent[0]))).kind).toBe('declined');
    expect(handovers()[0]?.invitation).toMatchObject({ declinedAt: expect.any(String) });
    expect(answered()).toHaveLength(0);
    expect(mockLogger.error).toHaveBeenCalledWith('Οι αποδέκτες της απάντησης αγοραστή δεν βρέθηκαν', expect.objectContaining({ answer: 'declined' }));
  });

  it('Ζ15 — 🔒 καμία PII: ούτε email, ούτε τηλέφωνο, ούτε ΑΦΜ του αγοραστή στην ειδοποίηση — μόνο ονοματεπώνυμο', async () => {
    fake.seed(COLLECTIONS.CONTACTS, 'cont_anna', {
      ...fake.getAllDocs(COLLECTIONS.CONTACTS).cont_anna,
      phones: [{ number: '+306900000001', isPrimary: true, type: 'mobile' }], vatNumber: '999999999',
    });
    await sync();
    await accept(tokenOf(sent[0]));
    const payload = JSON.stringify(answered());
    expect(payload).toContain('Άννα Συνθετική');
    for (const secret of [ANNA.email, '+306900000001', '6900000001', '999999999']) expect(payload).not.toContain(secret);
  });
});

/** Η πρόθεση του γραφείου — ο άνθρωπος είναι ο δρων (Φ-Δ.3). */
const OFFICE = 'uid_office';
const renew = (confirmDeclined = false) => syncPropertyHandovers(db(), PROPERTY, {
  cause: 'office-renewal', performedBy: OFFICE, renewal: { handoverId: String(docs(COLLECTIONS.PROPERTY_HANDOVERS)[0]?.[0]), confirmDeclined },
});
const renewalOf = async (confirmDeclined = false) => {
  const outcome = await renew(confirmDeclined);
  return outcome.kind === 'synced' ? outcome.renewal : outcome;
};
/** Η πρόσκληση λήγει — στο κάτοπτρο, όπου κοιτούν η κρίση και η καρτέλα (ο σύνδεσμος του email μένει έγκυρος ως υπογραφή). */
function expireMirror(): void {
  const [[id, doc] = ['', {}]] = docs(COLLECTIONS.PROPERTY_HANDOVERS);
  const invitation = doc.invitation as Record<string, unknown>;
  fake.seed(COLLECTIONS.PROPERTY_HANDOVERS, id, { ...doc, invitation: { ...invitation, expiresAt: '2020-01-01T00:00:00.000Z' } });
}
/** Οι γραμμές ίχνους που ζήτησε ο γραφέας. */
const auditCalls = () => (recordTrackedEntityWrite as jest.Mock).mock.calls.map(([write]) => write as Record<string, unknown>);

describe('Ζ18–Ζ21 — ADR-916 Φ-Δ.3 (Ο9): «Νέα πρόσκληση» από το γραφείο, από τον ΙΔΙΟ γραφέα', () => {
  beforeEach(() => (recordTrackedEntityWrite as jest.Mock).mockClear());

  it('Ζ18 — ληγμένη ⇒ ΝΕΑ πρόσκληση + ΕΝΑ email· η παλιά ανακαλείται ατομικά και ο σύνδεσμός της ΠΕΘΑΙΝΕΙ· αλυσίδα `supersedes`', async () => {
    await sync();
    const oldId = String(invitations()[0]?.id);
    const oldToken = tokenOf(sent[0]);
    expireMirror();
    const renewal = await renewalOf();
    expect(renewal).toMatchObject({ kind: 'renewed' });
    expect(live()).toHaveLength(1);
    expect(live()[0]).toMatchObject({ supersedesInvitationId: oldId, invitedByUid: OFFICE });
    expect(invitations().find((invitation) => invitation.id === oldId)).toMatchObject({ state: 'revoked', resolvedByUid: OFFICE });
    expect(sent).toHaveLength(2);
    expect(sent[1]?.to).toBe(ANNA.email);
    expect(await accept(oldToken)).toEqual({ kind: 'refused', reason: 'revoked' });
    expect((await accept(tokenOf(sent[1]))).kind).toBe('accepted');
  });

  it('Ζ19 — αρνημένη ΧΩΡΙΣ επιβεβαίωση ⇒ `declined-unconfirmed`, καμία εγγραφή, κανένα email· ΜΕ επιβεβαίωση ⇒ νέα', async () => {
    await sync();
    expect((await decline(tokenOf(sent[0]))).kind).toBe('declined');
    const before = JSON.stringify(handovers());
    expect(await renewalOf(false)).toEqual({ kind: 'refused', reason: 'declined-unconfirmed' });
    expect(JSON.stringify(handovers())).toBe(before);
    expect(sent).toHaveLength(1);
    expect(await renewalOf(true)).toMatchObject({ kind: 'renewed' });
    expect(live()).toHaveLength(1);
    expect(sent).toHaveLength(2);
    expect(handovers()[0]?.invitation).toMatchObject({ status: 'issued', declinedAt: null });
  });

  it('Ζ20 — ενεργή ⇒ `not-renewable`· δεύτερο αίτημα αμέσως μετά (άλλο κλειδί ιδεμποτίας) ⇒ ΜΙΑ νέα πρόσκληση, ΕΝΑ email', async () => {
    await sync();
    expect(await renewalOf()).toEqual({ kind: 'refused', reason: 'not-renewable' });
    expireMirror();
    expect(await renewalOf()).toMatchObject({ kind: 'renewed' });
    expect(await renewalOf()).toEqual({ kind: 'refused', reason: 'not-renewable' });
    expect(invitations()).toHaveLength(2);
    expect(sent).toHaveLength(2);
  });

  it('Ζ20β — αποδεκτή ⇒ `not-renewable` · άγνωστη παράδοση ⇒ `handover-unknown` · η επαφή έχασε το email ⇒ `no-address`', async () => {
    await sync();
    expireMirror();
    setEmail(null);
    expect(await renewalOf()).toEqual({ kind: 'refused', reason: 'no-address' });
    const unknown = await syncPropertyHandovers(db(), PROPERTY, {
      cause: 'office-renewal', performedBy: OFFICE, renewal: { handoverId: 'phov_foreign', confirmDeclined: true },
    });
    expect(unknown).toMatchObject({ kind: 'synced', renewal: { kind: 'refused', reason: 'handover-unknown' } });
  });

  it('Ζ20γ — λείπει το μυστικό των συνδέσμων ⇒ `awaiting-configuration`, ποτέ πρόσκληση χωρίς σύνδεσμο', async () => {
    await sync();
    expireMirror();
    delete process.env.PROPERTY_HANDOVER_INVITE_SECRET;
    expect(await renewalOf()).toEqual({ kind: 'refused', reason: 'awaiting-configuration' });
    expect(invitations()).toHaveLength(1);
  });

  it('Ζ21 — ίχνος: ο ΑΝΘΡΩΠΟΣ ως δρων, η νέα ταυτότητα στο `after` — και 🔒 καμία τιμή ίχνους δεν είναι email', async () => {
    await sync();
    expireMirror();
    await renew();
    const write = auditCalls().find((call) => call.performedBy === OFFICE);
    expect(write).toMatchObject({ entityType: 'property_handover' });
    const after = (write?.after as { invitation: { invitationId: string } }).invitation.invitationId;
    expect(after).toBe(String(live()[0]?.id));
    const def = PROPERTY_HANDOVER_TRACKED_FIELDS.invitation;
    const formatted = def?.kind === 'scalar' ? def.value?.((write?.after as { invitation: unknown }).invitation) : undefined;
    expect(formatted).toBe(after);
    expect(JSON.stringify(formatted)).not.toContain(ANNA.email);
  });
});
