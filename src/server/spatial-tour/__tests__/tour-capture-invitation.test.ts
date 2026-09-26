/**
 * @jest-environment node
 *
 * @fileoverview **Η ΠΡΟΣΚΛΗΣΗ ΦΩΤΟΓΡΑΦΟΥ** (ADR-884 Φ0.5 · Κ2β) — άγκυρες, πάνω στον **κοινό πυρήνα** πρόσκλησης.
 *
 * - **Π** — ο παρονομαστής: έκδοση → αποδοχή ⇒ άδεια γράφτηκε **και** ο κριτής ανεβάσματος τη δέχεται.
 * - **Φ** — ο φωτογράφος: λάθος παραλήπτης · άρνηση · δεύτερη αποδοχή · άλλο κλειδί · αλλοιωμένο έγγραφο.
 * - **Υ** — ο υπεύθυνος: πόρτα `mayManageTour` · λήξη άδειας υποχρεωτική · λόγος · supersede · ανακλήσεις.
 * - **Κ** — ο κάτοχος: η περιήγηση ξαναβρίσκεται **από τη ρίζα** — άλλαξε κάτοχο ⇒ η πρόσκληση δεν βρίσκεται.
 *
 * 🔑 Κάθε άρνηση ελέγχει **και** τι **δεν** γράφτηκε — «επέστρεψε άρνηση» χωρίς «δεν έδωσε άδεια» δεν αποδεικνύει
 * τίποτα. Κάθε κύκλος εκδίδει **πραγματικό** token και τον περνά από την **πραγματική** εξαργύρωση (μάθημα ADR-777 §8.33).
 * ⚠️ Ο κοινός mock εκτελεί τις συναλλαγές **σειριακά** — η «δεύτερη αποδοχή» είναι διαδοχική· την ταυτόχρονη
 * (Τ3) την αποδεικνύει η σουίτα χώρου πάνω στον **ίδιο** πυρήνα.
 */

jest.mock('server-only', () => ({}));

const settleMock = jest.fn();
jest.mock('@/server/auth/mailbox-proof-custody', () => ({
  settleProvenMailbox: (...args: unknown[]) => settleMock(...args),
}));

import type { Firestore } from 'firebase-admin/firestore';

import { COLLECTIONS, SUBCOLLECTIONS } from '@/config/firestore-collections';
import { tourCaptureGrantFromDocument } from '@/lib/spatial-tour/spatial-tour-from-document';
import { mayUploadTourCapture, type TourActor } from '@/lib/spatial-tour/tour-authority';
import { enterpriseIdService } from '@/services/enterprise-id.service';
import { createMockFirestore, type MockFirestoreKit } from '@/test-utils/mock-firestore';
import type { TourSubject } from '@/types/spatial-tour';

import {
  issueTourCaptureInvitation,
  listPendingTourCaptureInvitations,
  listTourCaptureGrants,
  revokeTourCaptureGrant,
  revokeTourCaptureInvitation,
  type IssueTourCaptureInvitationInput,
} from '../tour-capture-invitation';
import { acceptTourCaptureInvitation, declineTourCaptureInvitation } from '../tour-capture-invitation-redeem';

process.env.TOUR_CAPTURE_INVITE_SECRET ??= 'δοκιμαστικό-μυστικό-πρόσκλησης-φωτογράφου';

const AGENCY = 'comp_agency';
const SUBJECT: TourSubject = { kind: 'company-property', id: 'prop_1' };
const TOUR_ID = enterpriseIdService.generateDeterministicSpatialTourId('company-property', 'prop_1');
const TOURS = COLLECTIONS.SPATIAL_TOURS;
const INVITATIONS = `${TOURS}/${TOUR_ID}/${SUBCOLLECTIONS.TOUR_CAPTURE_INVITATIONS}`;
const GRANTS = `${TOURS}/${TOUR_ID}/${SUBCOLLECTIONS.TOUR_CAPTURE_GRANTS}`;
const EMAIL = 'photo@example.com';
const PHOTOGRAPHER_UID = 'uid_photo';
const DAY_MS = 24 * 60 * 60 * 1000;

const MANAGER: TourActor = {
  listing: { uid: 'boris', companyId: AGENCY },
  capability: { globalRole: 'internal_user', permissions: ['listings:listings:publish'] },
};
const STRANGER: TourActor = {
  listing: { uid: 'carl', companyId: 'comp_rival' },
  capability: { globalRole: 'internal_user', permissions: ['listings:listings:publish'] },
};
/** Ο φωτογράφος ως δράστης ανεβάσματος — κανένα δικαίωμα ρόλου, κανένας χώρος. */
const PHOTOGRAPHER_ACTOR: TourActor = {
  listing: { uid: PHOTOGRAPHER_UID, companyId: null },
  capability: { globalRole: 'external_user', permissions: [] },
};

const inDays = (days: number) => new Date(Date.now() + days * DAY_MS).toISOString();

/** Ο φωτογράφος, **σωστός σε όλα** — κάθε άρνηση αλλάζει ΕΝΑ πεδίο. */
const photographer = (overrides: Record<string, unknown> = {}) => ({
  uid: PHOTOGRAPHER_UID,
  email: EMAIL,
  emailVerified: true,
  secondFactorEnrolled: false,
  ...overrides,
});

let kit: MockFirestoreKit;
let db: Firestore;

function seed() {
  kit.seedCollection(COLLECTIONS.PROPERTIES, { prop_1: { companyId: AGENCY } });
  kit.seedCollection(TOURS, {
    [TOUR_ID]: {
      companyId: AGENCY, subject: SUBJECT, visibility: 'on-request', lifecycle: 'published', levels: [], nodes: [],
      revision: 0, createdAt: '2026-09-01T10:00:00.000Z', createdBy: 'boris', updatedAt: '2026-09-01T10:00:00.000Z',
      updatedBy: 'boris',
    },
  });
}

async function issue(overrides: Partial<IssueTourCaptureInvitationInput> = {}) {
  const outcome = await issueTourCaptureInvitation(db, {
    subject: SUBJECT, actor: MANAGER, inviteeEmailRaw: EMAIL, grantExpiresAt: inDays(30),
    reason: 'λήψη πριν κλείσουν οι τοίχοι', ...overrides,
  });
  if (outcome.kind !== 'issued') throw new Error(`αναμενόταν έκδοση, ήρθε ${JSON.stringify(outcome)}`);
  return outcome;
}

const grantWrites = () => kit.writes().filter((w) => w.collection === GRANTS);

beforeEach(() => {
  kit = createMockFirestore();
  db = kit.instance as unknown as Firestore;
  settleMock.mockReset();
  seed();
});

describe('Π — ο παρονομαστής', () => {
  it('Π1 — έκδοση → αποδοχή ⇒ άδεια στην ΙΔΙΑ συναλλαγή, και ο κριτής ανεβάσματος τη ΔΕΧΕΤΑΙ', async () => {
    const { token, invitation } = await issue();
    const outcome = await acceptTourCaptureInvitation(db, { token, identity: photographer() });

    expect(outcome).toMatchObject({ kind: 'accepted', invitation: { id: invitation.id, state: 'accepted' } });
    const grant = tourCaptureGrantFromDocument(kit.getData(GRANTS, PHOTOGRAPHER_UID), PHOTOGRAPHER_UID);
    expect(grant).toMatchObject({
      scopes: ['tour:capture:upload'], expiresAt: invitation.grantExpiresAt, createdBy: 'boris',
      invitationId: invitation.id, revokedAt: null,
    });
    const record = { kind: 'company-property', property: { companyId: AGENCY } } as const;
    expect(mayUploadTourCapture(record, PHOTOGRAPHER_ACTOR, grant, Date.now())).toBe('granted-by-capture-grant');
  });

  it('Π2 — στη βάση ΔΕΝ υπάρχει ούτε το token ούτε το ωμό nonce, μόνο `nonceHash`', async () => {
    const { token, invitation } = await issue();
    const stored = JSON.stringify(kit.getData(INVITATIONS, invitation.id));
    const nonce = Buffer.from(token.split('.').pop() ?? token, 'base64url').toString('utf-8').split(':')[1] ?? '';
    expect(stored).not.toContain(token);
    // 🔑 ΠΑΡΟΝΟΜΑΣΤΗΣ: ο locator (είδος, ρίζα) ακολουθεί — το nonce μένει στη θέση 1, όπως στις προσκλήσεις χώρου.
    expect(nonce).toMatch(/^[0-9a-f]{32}$/);
    expect(stored).not.toContain(nonce);
  });
});

describe('Φ — ο φωτογράφος', () => {
  it('🔴 Φ1 — άλλος λογαριασμός (προωθημένο email) ⇒ `wrong-recipient`, ΚΑΜΙΑ άδεια', async () => {
    const { token, invitation } = await issue();
    const outcome = await acceptTourCaptureInvitation(db, { token, identity: photographer({ email: 'else@example.com' }) });
    expect(outcome).toEqual({ kind: 'refused', reason: 'wrong-recipient' });
    expect(grantWrites()).toHaveLength(0);
    expect(kit.getData(INVITATIONS, invitation.id)).toMatchObject({ state: 'pending' });
  });

  it('Φ2 — ρητή άρνηση ⇒ `declined`, ΚΑΜΙΑ άδεια', async () => {
    const { token } = await issue();
    expect(await declineTourCaptureInvitation(db, { token, identity: photographer() })).toMatchObject({ kind: 'declined' });
    expect(grantWrites()).toHaveLength(0);
  });

  it('🔴 Φ3 — δεύτερη αποδοχή ⇒ `already-used`, η άδεια γράφτηκε ΜΙΑ φορά', async () => {
    const { token } = await issue();
    await acceptTourCaptureInvitation(db, { token, identity: photographer() });
    expect(await acceptTourCaptureInvitation(db, { token, identity: photographer() }))
      .toEqual({ kind: 'refused', reason: 'already-used' });
    expect(grantWrites()).toHaveLength(1);
  });

  it('🔴 Φ4 — σύνδεσμος ΑΛΛΟΥ κλειδιού ⇒ `link-foreign`, όχι «άκυρος»', async () => {
    const { token } = await issue();
    const own = process.env.TOUR_CAPTURE_INVITE_SECRET;
    process.env.TOUR_CAPTURE_INVITE_SECRET = 'μυστικό-άλλου-περιβάλλοντος';
    try {
      expect(await acceptTourCaptureInvitation(db, { token, identity: photographer() }))
        .toEqual({ kind: 'refused', reason: 'link-foreign' });
    } finally {
      process.env.TOUR_CAPTURE_INVITE_SECRET = own;
    }
    expect(grantWrites()).toHaveLength(0);
  });

  it('🔴 Φ5 — αλλοιωμένο έγγραφο (χωρίς λήξη άδειας) ⇒ `invitation-corrupt`, ΚΑΜΙΑ γραφή', async () => {
    const { token, invitation } = await issue();
    const { grantExpiresAt: _dropped, ...corrupt } = kit.getData(INVITATIONS, invitation.id) ?? {};
    void _dropped;
    kit.seedCollection(INVITATIONS, { [invitation.id]: corrupt });
    kit.clearWrites();
    expect(await acceptTourCaptureInvitation(db, { token, identity: photographer() }))
      .toEqual({ kind: 'unavailable', reason: 'invitation-corrupt' });
    expect(kit.writes()).toHaveLength(0);
  });

  it('🔑 Φ6 — ανεπιβεβαίωτο email του ΣΩΣΤΟΥ ανθρώπου ⇒ μπαίνει, και η πρόσκληση το επιβεβαιώνει (ADR-853 §15)', async () => {
    settleMock.mockResolvedValue({ verdict: 'verified-by-holder', removedProviders: [] });
    const { token, invitation } = await issue();
    const outcome = await acceptTourCaptureInvitation(db, { token, identity: photographer({ emailVerified: false }) });
    expect(outcome.kind).toBe('accepted');
    expect(settleMock).toHaveBeenCalledTimes(1);
    expect(kit.getData(INVITATIONS, invitation.id)?.mailboxProvenAt).toEqual(expect.any(String));
  });
});

describe('Υ — ο υπεύθυνος', () => {
  it('🔴 Υ1 — όποιος ΔΕΝ διαχειρίζεται την περιήγηση ⇒ `not-manager`, ΚΑΜΙΑ γραφή', async () => {
    const outcome = await issueTourCaptureInvitation(db, {
      subject: SUBJECT, actor: STRANGER, inviteeEmailRaw: EMAIL, grantExpiresAt: inDays(30), reason: 'x',
    });
    expect(outcome).toEqual({ kind: 'refused', reason: 'not-manager' });
    expect(kit.writes()).toHaveLength(0);
  });

  it.each([
    ['χωρίς λήξη', null, 'expiry-required'],
    ['παρελθόν', new Date(Date.now() - DAY_MS).toISOString(), 'expiry-past'],
    ['πέρα από τον ορίζοντα', inDays(400), 'expiry-too-far'],
  ] as const)('🔴 Υ2 — λήξη άδειας %s ⇒ `%s`, ΚΑΜΙΑ γραφή', async (_label, grantExpiresAt, reason) => {
    const outcome = await issueTourCaptureInvitation(db, {
      subject: SUBJECT, actor: MANAGER, inviteeEmailRaw: EMAIL, grantExpiresAt, reason: 'x',
    });
    expect(outcome).toEqual({ kind: 'refused', reason });
    expect(kit.writes()).toHaveLength(0);
  });

  it('Υ3 — κενός λόγος ⇒ `reason-required`', async () => {
    expect(await issueTourCaptureInvitation(db, {
      subject: SUBJECT, actor: MANAGER, inviteeEmailRaw: EMAIL, grantExpiresAt: inDays(30), reason: '   ',
    })).toEqual({ kind: 'refused', reason: 'reason-required' });
  });

  it('🏆 Υ4 — η πρόσκληση λήγει το ΑΡΓΟΤΕΡΟ όταν θα έληγε η άδεια — ποτέ «ναι» που γεννά νεκρή άδεια', async () => {
    const short = await issue({ grantExpiresAt: inDays(2) });
    expect(short.invitation.expiresAt).toBe(short.invitation.grantExpiresAt);
    const long = await issue({ inviteeEmailRaw: 'other@example.com', grantExpiresAt: inDays(60) });
    expect(Date.parse(long.invitation.expiresAt)).toBeLessThan(Date.parse(long.invitation.grantExpiresAt));
    expect(Date.parse(long.invitation.expiresAt) - Date.now()).toBeLessThanOrEqual(7 * DAY_MS + 1000);
  });

  it('🔴 Υ5 — επαναποστολή ⇒ η παλιά ανακαλείται στην ΙΔΙΑ συναλλαγή, και ο παλιός σύνδεσμος λέει «ανακλήθηκε»', async () => {
    const first = await issue();
    const second = await issue({ inviteeEmailRaw: '  Photo@EXAMPLE.com ' });
    expect(second.supersededCount).toBe(1);
    expect(kit.getData(INVITATIONS, first.invitation.id)).toMatchObject({ state: 'revoked', resolvedByUid: 'boris' });
    expect(await acceptTourCaptureInvitation(db, { token: first.token, identity: photographer() }))
      .toEqual({ kind: 'refused', reason: 'revoked' });
    expect((await acceptTourCaptureInvitation(db, { token: second.token, identity: photographer() })).kind).toBe('accepted');
  });

  it('Υ6 — ανάκληση πρόσκλησης ⇒ ο σύνδεσμος λέει «ανακλήθηκε»· ξανά ⇒ `already` χωρίς γραφή', async () => {
    const { token, invitation } = await issue();
    const input = { subject: SUBJECT, actor: MANAGER, invitationId: invitation.id };
    expect(await revokeTourCaptureInvitation(db, input)).toEqual({ kind: 'revoked' });
    kit.clearWrites();
    expect(await revokeTourCaptureInvitation(db, input)).toEqual({ kind: 'already', state: 'revoked' });
    expect(kit.writes()).toHaveLength(0);
    expect(await acceptTourCaptureInvitation(db, { token, identity: photographer() }))
      .toEqual({ kind: 'refused', reason: 'revoked' });
    expect(await revokeTourCaptureInvitation(db, { ...input, actor: STRANGER }))
      .toEqual({ kind: 'refused', reason: 'not-manager' });
  });

  it('🔴 Υ7 — ανάκληση άδειας ⇒ ο κριτής ανεβάσματος λέει `revoked`· ξανά ⇒ `not-active`· ανύπαρκτη ⇒ `grant-absent`', async () => {
    const { token } = await issue();
    await acceptTourCaptureInvitation(db, { token, identity: photographer() });
    const input = { subject: SUBJECT, actor: MANAGER, granteeUid: PHOTOGRAPHER_UID };

    expect(await revokeTourCaptureGrant(db, input)).toEqual({ kind: 'revoked' });
    const grant = tourCaptureGrantFromDocument(kit.getData(GRANTS, PHOTOGRAPHER_UID), PHOTOGRAPHER_UID);
    const record = { kind: 'company-property', property: { companyId: AGENCY } } as const;
    expect(mayUploadTourCapture(record, PHOTOGRAPHER_ACTOR, grant, Date.now())).toBe('revoked');
    expect(grant?.revokedBy).toBe('boris');

    expect(await revokeTourCaptureGrant(db, input)).toEqual({ kind: 'refused', reason: 'not-active' });
    expect(await revokeTourCaptureGrant(db, { ...input, granteeUid: 'nobody' }))
      .toEqual({ kind: 'refused', reason: 'grant-absent' });
  });

  it('Υ8 — η λίστα: μόνο οι ζωντανές, και η ληγμένη ταξιδεύει ως `expired` χωρίς εγγραφή', async () => {
    const live = await issue();
    const stale = await issue({ inviteeEmailRaw: 'late@example.com' });
    const accepted = await issue({ inviteeEmailRaw: 'done@example.com' });
    await acceptTourCaptureInvitation(db, { token: accepted.token, identity: photographer({ email: 'done@example.com', uid: 'u2' }) });
    kit.seedCollection(INVITATIONS, {
      ...Object.fromEntries([live, stale, accepted].map((i) => [i.invitation.id, kit.getData(INVITATIONS, i.invitation.id)])),
      [stale.invitation.id]: { ...kit.getData(INVITATIONS, stale.invitation.id), expiresAt: new Date(Date.now() - 1000).toISOString() },
    });
    kit.clearWrites();

    const listed = await listPendingTourCaptureInvitations(db, { subject: SUBJECT, actor: MANAGER });
    if (listed.kind !== 'listed') throw new Error('αναμενόταν λίστα');
    const states = Object.fromEntries(listed.invitations.map((i) => [i.id, i.state]));
    expect(states).toEqual({ [live.invitation.id]: 'pending', [stale.invitation.id]: 'expired' });
    expect(kit.writes()).toHaveLength(0);
  });

  it('Υ9 — λίστα αδειών: ενεργή ⇒ `active`, ανακλημένη ⇒ `revoked` (ορατή για ξαναπρόσκληση)· ξένος ⇒ `not-manager`', async () => {
    const first = await issue();
    await acceptTourCaptureInvitation(db, { token: first.token, identity: photographer() });
    const second = await issue({ inviteeEmailRaw: 'b@example.com' });
    await acceptTourCaptureInvitation(db, { token: second.token, identity: photographer({ email: 'b@example.com', uid: 'u2' }) });
    await revokeTourCaptureGrant(db, { subject: SUBJECT, actor: MANAGER, granteeUid: 'u2' });

    const listed = await listTourCaptureGrants(db, { subject: SUBJECT, actor: MANAGER });
    if (listed.kind !== 'listed') throw new Error('αναμενόταν λίστα');
    expect(Object.fromEntries(listed.grants.map((g) => [g.granteeUid, g.standing])))
      .toEqual({ [PHOTOGRAPHER_UID]: 'active', u2: 'revoked' });
    // Ο υπεύθυνος βλέπει ΑΝΘΡΩΠΟ (το email που έγραψε ο ίδιος), ποτέ ωμό uid.
    expect(Object.fromEntries(listed.grants.map((g) => [g.granteeUid, g.inviteeEmail])))
      .toEqual({ [PHOTOGRAPHER_UID]: EMAIL, u2: 'b@example.com' });
    expect(await listTourCaptureGrants(db, { subject: SUBJECT, actor: STRANGER })).toEqual({ kind: 'refused', reason: 'not-manager' });
  });
});

describe('Κ — ο κάτοχος παράγεται από τη ρίζα', () => {
  it('🔴 Κ1 — η αγγελία άλλαξε κάτοχο ⇒ η πρόσκληση του ΠΑΛΙΟΥ υπευθύνου δεν βρίσκεται, ΚΑΜΙΑ άδεια', async () => {
    const { token } = await issue();
    kit.seedCollection(COLLECTIONS.PROPERTIES, { prop_1: { companyId: 'comp_rival' } });
    expect(await acceptTourCaptureInvitation(db, { token, identity: photographer() }))
      .toEqual({ kind: 'refused', reason: 'invitation-unknown' });
    expect(grantWrites()).toHaveLength(0);
  });

  it('Κ2 — αγγελία ιδιώτη ⇒ πρόσκληση ΚΑΙ άδεια στο ΠΡΟΣΩΠΙΚΟ διαμέρισμα', async () => {
    const personal: TourSubject = { kind: 'owner-property', id: 'ownp_1' };
    const personalTourId = enterpriseIdService.generateDeterministicSpatialTourId('owner-property', 'ownp_1');
    const personalTours = COLLECTIONS.SPATIAL_TOURS_PERSONAL;
    kit.seedCollection(COLLECTIONS.OWNER_PROPERTIES, { ownp_1: { authorUserId: 'anna', authorCompanyId: null } });
    kit.seedCollection(personalTours, {
      [personalTourId]: {
        userId: 'anna', subject: personal, visibility: 'on-request', lifecycle: 'published', levels: [], nodes: [],
        revision: 0, createdAt: '2026-09-01T10:00:00.000Z', createdBy: 'anna', updatedAt: '2026-09-01T10:00:00.000Z',
        updatedBy: 'anna',
      },
    });
    const anna: TourActor = { listing: { uid: 'anna', companyId: null }, capability: { globalRole: 'external_user', permissions: [] } };

    const { token } = await issue({ subject: personal, actor: anna });
    expect((await acceptTourCaptureInvitation(db, { token, identity: photographer() })).kind).toBe('accepted');
    expect(kit.getData(`${personalTours}/${personalTourId}/${SUBCOLLECTIONS.TOUR_CAPTURE_GRANTS}`, PHOTOGRAPHER_UID))
      .toMatchObject({ createdBy: 'anna', scopes: ['tour:capture:upload'] });
    expect(grantWrites()).toHaveLength(0);
  });
});
