/**
 * @jest-environment node
 *
 * @fileoverview **ΟΙ ΑΓΚΥΡΕΣ ΤΗΣ ΠΡΟΣΚΛΗΣΗΣ ΧΩΡΟΥ** — ADR-853 §9.
 * @related server/auth/workspace-invitation.ts · server/auth/workspace-invitation-redeem.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΚΑΘΕ ΑΓΚΥΡΑ ΤΡΕΧΕΙ ΤΟΝ **ΠΛΗΡΗ ΚΥΚΛΟ** ΕΚΔΟΣΗ→ΕΞΑΡΓΥΡΩΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 * Το ADR-777 §8.33 κατέγραψε **ζωντανό** ελάττωμα: ο σύνδεσμος της πύλης προμηθευτή ήταν
 * **νεκρός από την πρώτη μέρα** *(ISO αντί για χιλιοστά ⇒ το `:` έσπαγε τον διαχωριστή)*
 * και **καμία** δοκιμή δεν το έπιασε, γιατί καμία δεν εκτελούσε τον κύκλο
 * γέννηση→επαλήθευση — όλες έλεγχαν ενδιάμεσα.
 *
 * ⇒ Εδώ καμία άγκυρα δεν κοιτά ενδιάμεσο: κάθε μία **εκδίδει πραγματική πρόσκληση** και
 * την περνά από την **πραγματική** εξαργύρωση, πάνω σε ψεύτικη βάση.
 *
 * ⚠️ **Κάθε άρνηση δοκιμάζεται με τον ΠΑΡΟΝΟΜΑΣΤΗ της**: πρώτα ότι η ίδια ακριβώς
 * πρόσκληση **γίνεται δεκτή** όταν αλλάζει **μόνο** το κρίσιμο. Χωρίς αυτό, μια άρνηση
 * μπορεί να είναι πράσινη επειδή κάτι **άσχετο** έσπασε.
 *
 * 🔒 Οι υποσυλλογές (`companies/{id}/workspace_members/{uid}`) **δεν** υπάρχουν στον
 * πλαστό — γι' αυτό ο γραφέας μέλους και ο κριτής ιδιότητας είναι **mocked**. Για το
 * **Μ2** αυτό δεν είναι παράκαμψη: το ερώτημα *είναι* «καλείται ο ΙΔΙΟΣ γραφέας;».
 */

jest.mock('server-only', () => ({}));

import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';

const fake = new FakeFirestore();

jest.mock('@/lib/firebaseAdmin', () => ({
  // ⚠️ Το εργοστάσιο κλείνει πάνω σε **ΜΙΑ** μεταβλητή (ADR-841 §7 Α21.12) — γι' αυτό
  //    `fake.reset()` σε κάθε test, αλλιώς έγγραφο προηγούμενου test κάνει το επόμενο να
  //    περνά ή να κόβει για **λάθος λόγο**.
  getAdminFirestore: () => fake,
  isFirebaseAdminAvailable: () => true,
}));

const grantInTx = jest.fn();
const grantStandalone = jest.fn().mockResolvedValue(true);
jest.mock('@/lib/workspace/grant-membership', () => ({
  grantWorkspaceMembershipInTx: (...args: unknown[]) => grantInTx(...args),
  grantWorkspaceMembership: (...args: unknown[]) => grantStandalone(...args),
  recordMembershipGrantAudit: jest.fn().mockResolvedValue(undefined),
}));

const decideMembershipMock = jest.fn();
jest.mock('@/lib/auth/workspace-membership', () => ({
  decideMembership: (...args: unknown[]) => decideMembershipMock(...args),
}));

// 🔑 ADR-853 Φ4 — ο ΕΝΑΣ αναγνώστης ονόματος χώρου. Mocked επειδή το ερώτημα των αγκυρών
//    είναι *«ζητήθηκε το όνομα από ΑΥΤΟΝ;»*, όχι «τι γράφει το `companies/{id}`» — εκείνο
//    το κρίνει η δική του άγκυρα (Ο3), με πραγματικό έγγραφο στον πλαστό.
const readWorkspaceNameMock = jest.fn().mockResolvedValue('Παγώνης Τεχνική');
jest.mock('@/lib/workspace/workspace-catalog', () => ({
  readWorkspaceName: (...args: unknown[]) => readWorkspaceNameMock(...args),
}));

import { COLLECTIONS } from '@/config/firestore-collections';
import {
  issueWorkspaceInvitation,
  listPendingWorkspaceInvitations,
  revokeWorkspaceInvitation,
} from '../workspace-invitation';
import {
  acceptWorkspaceInvitation,
  declineWorkspaceInvitation,
  markWorkspaceInvitationOpened,
  previewWorkspaceInvitation,
} from '../workspace-invitation-redeem';
import type { WorkspaceInvitationDocument } from '@/types/workspace-invitation';

process.env.WORKSPACE_INVITE_SECRET ??= 'δοκιμαστικό-μυστικό-πρόσκλησης-χώρου';

const NOW = '2026-09-12T10:00:00.000Z';
const LATER = '2026-09-17T10:00:00.000Z';
const TOO_LATE = '2026-09-20T10:00:00.000Z';

const COMPANY = 'comp_pagonis';
const EMAIL = 'nikos@example.com';
const INVITER = 'uid_admin';
const INVITEE = 'uid_nikos';

/** Ο προσκεκλημένος, **σωστός σε όλα** — κάθε άρνηση αλλάζει ΕΝΑ πεδίο αυτού. */
function identity(overrides: Record<string, unknown> = {}) {
  return {
    uid: INVITEE,
    email: EMAIL,
    emailVerified: true,
    claimCompanyId: '',
    globalRole: 'external_user',
    ...overrides,
  } as Parameters<typeof acceptWorkspaceInvitation>[0]['identity'];
}

async function issue(overrides: Record<string, unknown> = {}) {
  const outcome = await issueWorkspaceInvitation({
    companyId: COMPANY,
    inviteeEmailRaw: EMAIL,
    role: 'internal_user',
    inviterUid: INVITER,
    inviterRole: 'company_admin',
    nowISOValue: NOW,
    ...overrides,
  });
  if (outcome.kind !== 'issued') throw new Error(`αναμενόταν έκδοση, ήρθε ${outcome.kind}`);
  return outcome;
}

async function stored(id: string): Promise<WorkspaceInvitationDocument> {
  const snap = await fake.collection(COLLECTIONS.WORKSPACE_INVITATIONS).doc(id).get();
  return snap.data() as WorkspaceInvitationDocument;
}

beforeEach(() => {
  fake.reset();
  grantInTx.mockClear();
  grantStandalone.mockClear();
  // Προεπιλογή: **δεν** είναι μέλος πουθενά — κάθε άγκυρα αλλάζει μόνο ό,τι δοκιμάζει.
  decideMembershipMock.mockReset().mockResolvedValue({ verdict: 'not-a-member' });
  readWorkspaceNameMock.mockClear().mockResolvedValue('Παγώνης Τεχνική');
});

// =============================================================================
// Π — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: χωρίς αυτόν, κάθε άρνηση παρακάτω μπορεί να είναι ψεύτικη
// =============================================================================

describe('Π — ο παρονομαστής: ο σωστός άνθρωπος ΜΠΑΙΝΕΙ', () => {
  it('Π1 — έκδοση → αποδοχή ⇒ `accepted`, και γράφεται μέλος ΜΙΑ φορά', async () => {
    const { token, invitation } = await issue();

    const outcome = await acceptWorkspaceInvitation({
      token,
      identity: identity(),
      nowISOValue: LATER,
    });

    expect(outcome.kind).toBe('accepted');
    expect(grantInTx).toHaveBeenCalledTimes(1);
    expect((await stored(invitation.id)).state).toBe('accepted');
  });
});

// =============================================================================
// Τ — ΤΟ TOKEN ΚΑΙ Η ΤΑΥΤΟΤΗΤΑ
// =============================================================================

describe('Τ — το token', () => {
  it('🔴 Τ1 — σωστή ΥΠΟΓΡΑΦΗ αλλά ΑΛΛΟΣ παραλήπτης ⇒ `wrong-recipient` (εδώ σπάει το προωθημένο email)', async () => {
    const { token } = await issue();

    const outcome = await acceptWorkspaceInvitation({
      token,
      identity: identity({ email: 'allos@example.com' }),
      nowISOValue: LATER,
    });

    expect(outcome).toEqual({ kind: 'refused', reason: 'wrong-recipient' });
    expect(grantInTx).not.toHaveBeenCalled();
  });

  it('🔑 Τ1β — ο ΣΩΣΤΟΣ άνθρωπος με ΑΝΕΠΑΛΗΘΕΥΤΟ email ⇒ `email-unverified`, ΟΧΙ «λάθος παραλήπτης»', async () => {
    const { token } = await issue();

    const outcome = await acceptWorkspaceInvitation({
      token,
      identity: identity({ emailVerified: false }),
      nowISOValue: LATER,
    });

    // ⚠️ Η διάκριση ΕΙΝΑΙ η αξία: «δεν είσαι ο παραλήπτης» θα έστελνε άνθρωπο που ΕΙΝΑΙ
    //    ο παραλήπτης να ψάξει άλλον λογαριασμό, αντί να επιβεβαιώσει το email του.
    expect(outcome).toEqual({ kind: 'refused', reason: 'email-unverified' });
  });

  it('🔴 Τ2 — ληγμένο ⇒ `expired`, ΚΑΙ όταν το έγγραφο λέει ακόμη `pending`', async () => {
    const { token, invitation } = await issue();

    // Ο χρόνος ζει σε ΔΥΟ μέρη: στο token και στο έγγραφο. Κανείς δεν «σκουπίζει» τις
    // ληγμένες σε πραγματικό χρόνο, άρα το έγγραφο **παραμένει** `pending`.
    expect((await stored(invitation.id)).state).toBe('pending');

    const outcome = await acceptWorkspaceInvitation({
      token,
      identity: identity(),
      nowISOValue: TOO_LATE,
    });

    expect(outcome).toEqual({ kind: 'refused', reason: 'expired' });
    expect(grantInTx).not.toHaveBeenCalled();
  });

  it('🔴 Τ4 — στη βάση ΔΕΝ υπάρχει το ωμό nonce (διαρροή βάσης ≠ χρησιμοποιήσιμη πρόσκληση)', async () => {
    const { token, invitation } = await issue();
    const doc = await stored(invitation.id);

    // 🔑 ΠΑΡΟΝΟΜΑΣΤΗΣ: αν το αποτύπωμα λείπει, το «δεν βρήκα nonce» δεν σημαίνει τίποτα.
    expect(doc.nonceHash).toMatch(/^[0-9a-f]{64}$/);

    const serialised = JSON.stringify(doc);
    const nonce = Buffer.from(token, 'base64url').toString('utf-8').split(':')[1];
    expect(nonce).toMatch(/^[0-9a-f]{32}$/);
    expect(serialised).not.toContain(nonce);
  });
});

// =============================================================================
// Ρ — Ο ΡΟΛΟΣ: ΔΥΟ ΑΝΕΞΑΡΤΗΤΟΙ ΦΡΟΥΡΟΙ, ΠΟΤΕ ΕΝΑΣ ΜΕ «Ή»
// =============================================================================

describe('Ρ — ο ρόλος', () => {
  it('🔴 Ρ1 — ρόλος ΠΑΝΩ από τον προσκαλούντα ⇒ `role-above-inviter`', async () => {
    const outcome = await issueWorkspaceInvitation({
      companyId: COMPANY,
      inviteeEmailRaw: EMAIL,
      role: 'company_admin',
      inviterUid: INVITER,
      inviterRole: 'internal_user',
      nowISOValue: NOW,
    });

    expect(outcome).toEqual({ kind: 'refused', reason: 'role-above-inviter' });
  });

  it('🔑 Ρ1β — ο ΙΔΙΟΣ ρόλος επιτρέπεται (ταβάνι, όχι απαγόρευση ισοτιμίας)', async () => {
    const outcome = await issueWorkspaceInvitation({
      companyId: COMPANY,
      inviteeEmailRaw: EMAIL,
      role: 'internal_user',
      inviterUid: INVITER,
      inviterRole: 'internal_user',
      nowISOValue: NOW,
    });

    expect(outcome.kind).toBe('issued');
  });

  it('🔴 Ρ2 — `super_admin` ⇒ άρνηση ΠΑΝΤΑ, ακόμη και από `super_admin`', async () => {
    const outcome = await issueWorkspaceInvitation({
      companyId: COMPANY,
      inviteeEmailRaw: EMAIL,
      role: 'super_admin',
      inviterUid: INVITER,
      inviterRole: 'super_admin',
      nowISOValue: NOW,
    });

    // ⚠️ Ο έλεγχος ΔΕΝ είναι το ταβάνι: ο `super_admin` είναι `level: 0`, άρα θα περνούσε
    //    το ταβάνι όταν προσκαλεί `super_admin`. Τον κόβει το κλειστό σύνολο.
    expect(outcome).toEqual({ kind: 'refused', reason: 'role-not-invitable' });
  });
});

// =============================================================================
// Ι — ΙΔΕΜΠΟΤΗΣΙΑ: ΕΝΑ ζωντανό ανά (χώρος, email) — §7.3
// =============================================================================

describe('Ι — ένα ζωντανό ανά (χώρος, κανονικοποιημένο email)', () => {
  it('🔴 Ι1 — δεύτερη πρόσκληση ΑΝΑΚΑΛΕΙ την πρώτη, στην ΙΔΙΑ συναλλαγή', async () => {
    const first = await issue();
    const second = await issue();

    expect(second.supersededCount).toBe(1);
    expect((await stored(first.invitation.id)).state).toBe('revoked');
    expect((await stored(second.invitation.id)).state).toBe('pending');
  });

  it('🔴 Ι2 — ο ΠΑΛΙΟΣ σύνδεσμος λέει «ανακλήθηκε», ΟΧΙ «άκυρος»', async () => {
    const first = await issue();
    await issue();

    const outcome = await acceptWorkspaceInvitation({
      token: first.token,
      identity: identity(),
      nowISOValue: LATER,
    });

    // 🔑 Δύο εντελώς διαφορετικά επόμενα βήματα για τον άνθρωπο: «ψάξε το νεότερο μήνυμα»
    //    αντί για «κάποιος σε εξαπατά».
    expect(outcome).toEqual({ kind: 'refused', reason: 'revoked' });
  });

  it('🔑 Ι3 — το email κανονικοποιείται: ` Nikos@EXAMPLE.com ` είναι ο ΙΔΙΟΣ άνθρωπος', async () => {
    await issue();
    const second = await issue({ inviteeEmailRaw: '  Nikos@EXAMPLE.com  ' });

    expect(second.supersededCount).toBe(1);
    expect(second.invitation.inviteeEmail).toBe(EMAIL);
  });

  it('🔑 Ι4 — ΑΛΛΟΣ χώρος ΔΕΝ ακυρώνεται (η ιδεμποτησία είναι ανά ζεύγος, όχι ανά email)', async () => {
    const first = await issue();
    const other = await issue({ companyId: 'comp_allo' });

    expect(other.supersededCount).toBe(0);
    expect((await stored(first.invitation.id)).state).toBe('pending');
  });
});

// =============================================================================
// Μ — Η ΙΔΙΟΤΗΤΑ ΜΕΛΟΥΣ
// =============================================================================

describe('Μ — μέλος', () => {
  it('🔴 Τ3 — ΔΥΟ ταυτόχρονες αποδοχές ⇒ ΕΝΑ μέλος, ΜΙΑ `accepted`', async () => {
    const { token, invitation } = await issue();

    // 🔴 Ο ανταγωνιστής χτυπά ΑΝΑΜΕΣΑ στην ανάγνωση και στο commit — το μόνο σενάριο
    //    που το CAS υπάρχει για να πιάσει. Χωρίς αυτό η άγκυρα θα δοκίμαζε τον απλό
    //    φρουρό και θα ήταν ΨΕΥΔΗΣ (πράσινο test για μηχανισμό που δεν εκτελέστηκε).
    fake.interfere = () => {
      fake.seed(COLLECTIONS.WORKSPACE_INVITATIONS, invitation.id, {
        ...invitation,
        state: 'accepted',
        resolvedAt: LATER,
        resolvedByUid: 'kapoios_allos',
      });
    };

    const outcome = await acceptWorkspaceInvitation({
      token,
      identity: identity(),
      nowISOValue: LATER,
    });

    expect(outcome).toEqual({ kind: 'refused', reason: 'already-used' });

    // 🔴 **ΤΟ ΚΡΙΣΙΜΟ ΕΙΝΑΙ ΤΙ ΔΕΣΜΕΥΤΗΚΕ, ΟΧΙ ΤΙ ΚΛΗΘΗΚΕ — ΜΕΤΡΗΜΕΝΟ 2026-09-12.**
    //
    // Η πρώτη γραφή αυτής της άγκυρας έλεγε `expect(grantInTx).not.toHaveBeenCalled()`
    // και **κοκκίνιζε**: το σώμα της συναλλαγής **ξανατρέχει** σε σύγκρουση (όπως και στο
    // αληθινό Firestore), οπότε η **καταδικασμένη** πρώτη προσπάθεια πρόλαβε να καλέσει
    // τον γραφέα πριν το `readsAreStillValid()` βγει ψευδές.
    //
    // 🔑 Αυτό **δεν** είναι βλάβη: ο γραφέας κάνει **μόνο** `tx.set`, που είναι
    // **αναβαλλόμενο** — το `tx` της χαμένης προσπάθειας πεθαίνει με την ουρά του και
    // **τίποτα δεν δεσμεύεται**. Η υπόσχεση του Τ3 είναι «**ΕΝΑ** μέλος», όχι «η
    // συνάρτηση δεν κλήθηκε ποτέ»· μια άγκυρα στο πλήθος κλήσεων μετρά **εσωτερικό
    // μηχανισμό επανάληψης** αντί για το συμβόλαιο.
    //
    // ⇒ Ο έλεγχος είναι η **δεσμευμένη κατάσταση**: νικητής ο ανταγωνιστής, και η δική
    //   μας γραφή δεν άφησε ίχνος.
    const doc = await stored(invitation.id);
    expect(doc.state).toBe('accepted');
    expect(doc.resolvedByUid).toBe('kapoios_allos');
    expect(doc.resolvedByUid).not.toBe(INVITEE);
  });

  it('🔴 Μ1 — ήδη μέλος ⇒ `already-member`, καμία γραφή', async () => {
    decideMembershipMock.mockResolvedValue({ verdict: 'member' });
    const { token } = await issue();

    const outcome = await acceptWorkspaceInvitation({
      token,
      identity: identity({ claimCompanyId: COMPANY }),
      nowISOValue: LATER,
    });

    expect(outcome).toEqual({ kind: 'refused', reason: 'already-member' });
    expect(grantInTx).not.toHaveBeenCalled();
  });

  it('🔴 Μ1β — `platform-bypass` ΔΕΝ είναι «ήδη μέλος» (ο υπερδιαχειριστής δεν έχει έγγραφο μέλους)', async () => {
    decideMembershipMock.mockResolvedValue({ verdict: 'platform-bypass' });
    const { token } = await issue();

    const outcome = await acceptWorkspaceInvitation({
      token,
      identity: identity({ globalRole: 'super_admin' }),
      nowISOValue: LATER,
    });

    // ⚠️ Με `isAllowed(verdict)` αντί για `'home' | 'member'`, αυτό θα ήταν `already-member`
    //    και το έγγραφο που του λείπει δεν θα γραφόταν ΠΟΤΕ.
    expect(outcome.kind).toBe('accepted');
    expect(grantInTx).toHaveBeenCalledTimes(1);
  });

  it('🔴 Μ1γ — «δεν μπόρεσα να ρωτήσω» ⇒ `unavailable`, ΠΟΤΕ ονομασμένη άρνηση', async () => {
    decideMembershipMock.mockResolvedValue({ verdict: 'unknown' });
    const { token } = await issue();

    const outcome = await acceptWorkspaceInvitation({
      token,
      identity: identity(),
      nowISOValue: LATER,
    });

    // «Δεν είσαι μέλος» εδώ θα ήταν ψέμα· «είσαι» θα ήταν διαρροή (ADR-787 Ε-5 §4 #3).
    expect(outcome).toEqual({ kind: 'unavailable', reason: 'membership-unknown' });
    expect(grantInTx).not.toHaveBeenCalled();
  });

  it('🔴 Μ3 — ρόλος ΕΚΤΟΣ λεξιλογίου στο έγγραφο ⇒ `invitation-corrupt`, καμία ένταξη', async () => {
    const { token, invitation } = await issue();

    // Αλλοιωμένο έγγραφο: ο έλεγχος Ρ2 έτρεξε στην ΕΚΔΟΣΗ· εδώ η τιμή έρχεται από τη βάση.
    fake.seed(COLLECTIONS.WORKSPACE_INVITATIONS, invitation.id, {
      ...invitation,
      role: 'super_admin',
    });

    const outcome = await acceptWorkspaceInvitation({
      token,
      identity: identity(),
      nowISOValue: LATER,
    });

    expect(outcome).toEqual({ kind: 'unavailable', reason: 'invitation-corrupt' });
    expect(grantInTx).not.toHaveBeenCalled();
  });
});

// =============================================================================
// Α — ΑΡΝΗΣΗ ΚΑΙ ΑΝΑΚΛΗΣΗ
// =============================================================================

describe('Α — άρνηση και ανάκληση', () => {
  it('Α1 — ρητή άρνηση ⇒ `declined`, ΚΑΜΙΑ γραφή μέλους', async () => {
    const { token, invitation } = await issue();

    const outcome = await declineWorkspaceInvitation({
      token,
      identity: identity(),
      nowISOValue: LATER,
    });

    expect(outcome.kind).toBe('declined');
    expect(grantInTx).not.toHaveBeenCalled();
    expect((await stored(invitation.id)).state).toBe('declined');
  });

  it('🔒 Α2 — ανάκληση από ΞΕΝΟ χώρο ⇒ `absent` (ποτέ «υπάρχει αλλά δεν επιτρέπεσαι»)', async () => {
    const { invitation } = await issue();

    const outcome = await revokeWorkspaceInvitation({
      invitationId: invitation.id,
      companyId: 'comp_allo',
      revokedByUid: 'uid_kseno',
      nowISOValue: LATER,
    });

    expect(outcome).toEqual({ kind: 'absent' });
    expect((await stored(invitation.id)).state).toBe('pending');
  });

  it('🔒 Α3 — ανάκληση ΗΔΗ κλειστής ⇒ `already`, καμία γραφή (ιδεμποτησία)', async () => {
    const { invitation } = await issue();
    await revokeWorkspaceInvitation({
      invitationId: invitation.id,
      companyId: COMPANY,
      revokedByUid: INVITER,
      nowISOValue: LATER,
    });

    const again = await revokeWorkspaceInvitation({
      invitationId: invitation.id,
      companyId: COMPANY,
      revokedByUid: INVITER,
      nowISOValue: LATER,
    });

    expect(again).toEqual({ kind: 'already', state: 'revoked' });
  });

  it('Α4β — ΑΝΑΚΛΗΜΕΝΗ ΔΕΝ ΕΜΦΑΝΙΖΕΤΑΙ ΟΥΤΕ ΩΣ ΟΨΗ — και λέει «ανακλήθηκε», όχι «άκυρος»', async () => {
    const { token, invitation } = await issue();
    await revokeWorkspaceInvitation({
      invitationId: invitation.id,
      companyId: COMPANY,
      revokedByUid: INVITER,
      nowISOValue: NOW,
    });

    const outcome = await previewWorkspaceInvitation({ token, nowISOValue: NOW });

    // 🔑 Ο **παρονομαστής** ζει στο Ο1: η ίδια ακριβώς πρόσκληση δίνει όψη όταν δεν
    //    ανακληθεί. Χωρίς εκείνο, αυτό εδώ θα ήταν πράσινο και για λάθος λόγο.
    expect(outcome.kind).toBe('refused');
    if (outcome.kind === 'refused') expect(outcome.reason).toBe('revoked');
    // ⛔ Και **κανένα** όνομα γραφείου δεν ζητήθηκε: άρνηση δεν πληρώνει ανάγνωση.
    expect(readWorkspaceNameMock).not.toHaveBeenCalled();
  });

  it('Α4 — ανακλημένη ΔΕΝ εξαργυρώνεται', async () => {
    const { token, invitation } = await issue();
    await revokeWorkspaceInvitation({
      invitationId: invitation.id,
      companyId: COMPANY,
      revokedByUid: INVITER,
      nowISOValue: LATER,
    });

    const outcome = await acceptWorkspaceInvitation({
      token,
      identity: identity(),
      nowISOValue: LATER,
    });

    expect(outcome).toEqual({ kind: 'refused', reason: 'revoked' });
  });
});

// =============================================================================
// Λ — Η ΛΙΣΤΑ ΤΟΥ ΧΩΡΟΥ (ADR-853 Φ4 · §5 #5 κατάσταση παράδοσης)
// =============================================================================

describe('Λ — η λίστα του χώρου', () => {
  it('🔴 Λ1 — ΜΟΝΟ οι ζωντανές: η αποδεκτή ΔΕΝ ταξιδεύει (είναι ήδη μέλος στη λίστα χρηστών)', async () => {
    const first = await issue();
    const second = await issue({ inviteeEmailRaw: 'maria@example.com' });

    const accepted = await acceptWorkspaceInvitation({
      token: first.token,
      identity: identity(),
      nowISOValue: NOW,
    });
    // 🔑 Ο παρονομαστής **μέσα** στην άγκυρα: αν η αποδοχή δεν είχε γίνει, το «λείπει από
    //    τη λίστα» θα ήταν πράσινο για **λάθος λόγο**.
    expect(accepted.kind).toBe('accepted');

    const live = await listPendingWorkspaceInvitations(COMPANY, NOW);

    expect(live.map((v) => v.id)).toEqual([second.invitation.id]);
  });

  it('🔴 Λ2 — `pending` με ΠΕΡΑΣΜΕΝΗ ώρα ταξιδεύει ως `expired`, και ο δίσκος μένει `pending`', async () => {
    const { invitation } = await issue();

    const early = await listPendingWorkspaceInvitations(COMPANY, NOW);
    const late = await listPendingWorkspaceInvitations(COMPANY, TOO_LATE);

    // ⚠️ Η **ίδια** πρόσκληση, δύο στιγμές: η κατάσταση **παράγεται**, δεν αντιγράφεται.
    //    Αλλιώς ο διαχειριστής βλέπει «σε αναμονή» για σύνδεσμο που ΔΕΝ δουλεύει.
    expect({ early: early[0]?.state, late: late[0]?.state })
      .toEqual({ early: 'pending', late: 'expired' });

    // ⛔ Και κανείς δεν «σκούπισε» τη ληγμένη: η λήξη είναι **ανάγνωση**, όχι μετάβαση.
    expect((await stored(invitation.id)).state).toBe('pending');
  });

  it('🔑 Λ3 — η ανάγνωση ΔΕΝ γράφει: το έγγραφο μένει ταυτόσημο', async () => {
    const { invitation } = await issue();
    const before = await stored(invitation.id);

    await listPendingWorkspaceInvitations(COMPANY, TOO_LATE);

    // 🔴 Σύγκριση **ολόκληρου** του εγγράφου, ποτέ ενός πεδίου: μια λίστα δεν επιτρέπεται
    //    να αλλάξει τον κόσμο επειδή κάποιος την κοίταξε.
    expect(await stored(invitation.id)).toEqual(before);
  });

  it('🔒 Λ4 — ΞΕΝΟΣ χώρος ΔΕΝ εμφανίζεται (απομόνωση μισθωτή, όχι φιλτράρισμα στην οθόνη)', async () => {
    const mine = await issue();
    await issue({ companyId: 'comp_allou', inviteeEmailRaw: 'xenos@example.com' });

    const live = await listPendingWorkspaceInvitations(COMPANY, NOW);

    // ⚠️ Ο **παρονομαστής**: υπάρχουν δύο ζωντανές στη βάση — αν το ερώτημα δεν είχε
    //    `companyId`, αυτό θα επέστρεφε **δύο**.
    expect(live.map((v) => v.id)).toEqual([mine.invitation.id]);
  });
});

// =============================================================================
// Ο — Η ΟΨΗ ΠΡΙΝ ΤΗΝ ΑΠΟΦΑΣΗ (ADR-853 §5 #4 — anti-phishing, όχι ευκολία)
// =============================================================================

describe('Ο — η όψη πριν την απόφαση', () => {
  it('Ο1 — ΠΑΡΟΝΟΜΑΣΤΗΣ: ζωντανή πρόσκληση δίνει όνομα χώρου, ρόλο και λήξη', async () => {
    const { token, invitation } = await issue();

    const outcome = await previewWorkspaceInvitation({ token, nowISOValue: NOW });

    expect(outcome.kind).toBe('preview');
    if (outcome.kind !== 'preview') return;
    expect(outcome.preview).toEqual({
      workspaceName: 'Παγώνης Τεχνική',
      role: 'internal_user',
      expiresAt: invitation.expiresAt,
      identityAssurance: 'declared',
    });
    // 🔑 Το όνομα ζητήθηκε από τον **ΕΝΑ** αναγνώστη, με τον χώρο **της πρόσκλησης** —
    //    ποτέ από τον πελατικό `useCompanyDisplayName`, που ρωτά άλλη συλλογή.
    expect(readWorkspaceNameMock).toHaveBeenCalledWith(COMPANY);
  });

  it('🔒 Ο2 — η όψη ΔΕΝ κουβαλά email παραλήπτη, companyId ή nonceHash', async () => {
    const { token } = await issue();
    const outcome = await previewWorkspaceInvitation({ token, nowISOValue: NOW });
    if (outcome.kind !== 'preview') throw new Error(`αναμενόταν όψη, ήρθε ${outcome.kind}`);

    // 🔴 Ο έλεγχος είναι στο **ΣΥΝΟΛΟ ΚΛΕΙΔΙΩΝ**, όχι σε ονόματα που φαντάστηκα: πεδίο που
    //    προστίθεται αργότερα χωρίς σκέψη **κοκκινίζει εδώ**. Μια άγκυρα που ελέγχει μόνο
    //    ό,τι σκέφτηκε ο συγγραφέας φυλά μόνο τα λάθη που ήξερε.
    expect(Object.keys(outcome.preview).sort())
      .toEqual(['expiresAt', 'identityAssurance', 'role', 'workspaceName']);

    // ⚠️ Και το περιεχόμενο: η όψη δίνεται σε **όποιον κρατά τον σύνδεσμο**, χωρίς
    //    ταυτότητα — προωθημένο email δεν επιτρέπεται να αποκαλύψει διεύθυνση ανθρώπου.
    const wire = JSON.stringify(outcome.preview);
    expect(wire).not.toContain(EMAIL);
    expect(wire).not.toContain(COMPANY);
  });

  it('🔴 Ο3 — η όψη ΔΕΝ καταναλώνει: μετά από ΔΥΟ ανοίγματα η πρόσκληση εξαργυρώνεται κανονικά', async () => {
    const { token } = await issue();

    // ⚠️ Δύο φορές **επίτηδες**: οι πελάτες email προ-φορτώνουν συνδέσμους (§6 #3). Αν η
    //    ανάγνωση έκαιγε την πρόσκληση, ένας σαρωτής θα την κατανάλωνε πριν τη δει άνθρωπος.
    await previewWorkspaceInvitation({ token, nowISOValue: NOW });
    await previewWorkspaceInvitation({ token, nowISOValue: NOW });

    const accepted = await acceptWorkspaceInvitation({
      token,
      identity: identity(),
      nowISOValue: NOW,
    });

    expect(accepted.kind).toBe('accepted');
    expect(grantInTx).toHaveBeenCalledTimes(1);
  });

  it('🔑 Ο4 — το «ανοίχτηκε» γράφεται ΜΟΝΟ την πρώτη φορά (αλλιώς γίνεται «πότε ξαναφόρτωσε»)', async () => {
    const { invitation } = await issue();

    await markWorkspaceInvitationOpened(invitation.id, LATER);
    const first = (await stored(invitation.id)).openedAt;
    await markWorkspaceInvitationOpened(invitation.id, TOO_LATE);

    // 🔑 Η δεύτερη κλήση **δεν** μετακινεί τη σφραγίδα: το πεδίο απαντά *«πότε το είδε
    //    πρώτη φορά»*, και μια ανανέωση σελίδας δεν είναι νέο άνοιγμα.
    expect({ first, second: (await stored(invitation.id)).openedAt })
      .toEqual({ first: LATER, second: LATER });
  });
});
