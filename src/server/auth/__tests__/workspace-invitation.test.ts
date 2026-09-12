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

import { COLLECTIONS } from '@/config/firestore-collections';
import { issueWorkspaceInvitation, revokeWorkspaceInvitation } from '../workspace-invitation';
import { acceptWorkspaceInvitation, declineWorkspaceInvitation } from '../workspace-invitation-redeem';
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
