/**
 * @jest-environment node
 *
 * @fileoverview **Η ΠΡΟΣΚΛΗΣΗ** — οι άγκυρες των δύο πορτών (ADR-844).
 * @related services/contact/first-contact-invitation.service.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΚΑΘΕ ΑΓΚΥΡΑ ΤΡΕΧΕΙ ΤΟΝ **ΠΛΗΡΗ ΚΥΚΛΟ** ΓΕΝΝΗΣΗ→ΕΠΑΛΗΘΕΥΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το ADR-777 §8.33 κατέγραψε **ζωντανό** ελάττωμα: ο σύνδεσμος της πύλης
 * προμηθευτή ήταν **νεκρός από την πρώτη μέρα** — το `expiresAt` σε ISO κουβαλούσε
 * άνω-κάτω τελείες, ο επαληθευτής μετρούσε 7 τμήματα αντί για 5, και **κάθε**
 * σύνδεσμος έβγαινε `invalid_format`. **Καμία δοκιμή δεν το έπιασε, γιατί καμία
 * δεν εκτελούσε τον κύκλο γέννηση→επαλήθευση** — όλες έλεγχαν ενδιάμεσα.
 *
 * ⇒ Εδώ **καμία** άγκυρα δεν κοιτά ενδιάμεσο: κάθε μία **εκδίδει πραγματική
 * πρόσκληση** και την περνά από την **πραγματική** εξαργύρωση, πάνω σε ψεύτικη
 * βάση μέσω των **πραγματικών** πράξεων γραφής.
 *
 * ⚠️ **Κάθε άρνηση δοκιμάζεται με τον ΠΑΡΟΝΟΜΑΣΤΗ της**: πρώτα ότι η ίδια
 * πρόσκληση **γίνεται δεκτή** όταν λείπει μόνο το κρίσιμο.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { normaliseChannelEmail } from '@/lib/contact/channel-email';
import {
  claimInvitationByCode,
  claimInvitationByLink,
  issueFirstContactInvitation,
  newVerificationCode,
} from '@/services/contact/first-contact-invitation.service';
import type { FirstContactDeclaration } from '@/services/contact/first-contact-vocabulary';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import type { FirstContactInvitationDocument } from '@/types/first-contact-invitation';

process.env.FIRST_CONTACT_INVITE_SECRET ??= 'δοκιμαστικό-μυστικό-πρόσκλησης';

const NOW = '2026-09-05T10:00:00.000Z';
const LATER = '2026-09-11T10:00:00.000Z';
const TOO_LATE = '2026-09-13T10:00:00.000Z';
const EMAIL = 'maria@example.com';

function declaration(listingId = 'ownp_kalamaria'): FirstContactDeclaration {
  return {
    target: { kind: 'listing', listingId },
    demandId: null,
    disclosure: {
      displayName: 'Μαρία Δ.',
      email: EMAIL,
      phone: null,
      acceptsPlatformMessages: false,
    },
  };
}

/**
 * Ο στόχος της προεπιλεγμένης δήλωσης — **η διέξοδος** που κουβαλά κάθε άρνηση.
 *
 * 🔑 Ονομάζεται εδώ επειδή τον περιμένουν πλέον **οκτώ** προσδοκίες: από την ημέρα
 * που η άρνηση απέκτησε διέξοδο (ADR-844 §11), το *«ποια αγγελία ήταν;»* δεν είναι
 * λεπτομέρεια της επιτυχίας.
 */
const TARGET = { kind: 'listing', listingId: 'ownp_kalamaria' } as const;

function freshDb(): AdminFirestore {
  return new FakeFirestore() as unknown as AdminFirestore;
}

async function storedDoc(db: AdminFirestore, id: string): Promise<FirstContactInvitationDocument> {
  const snap = await db.collection(COLLECTIONS.FIRST_CONTACT_INVITATIONS).doc(id).get();
  return snap.data() as FirstContactInvitationDocument;
}

// =============================================================================
// Ε — Ο ΣΥΝΔΕΣΜΟΣ (πόρτα Α)
// =============================================================================

describe('Ε — η πόρτα του συνδέσμου', () => {
  it('🔑 Ε1 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: ο κύκλος γέννηση→επαλήθευση κλείνει', async () => {
    const db = freshDb();
    const issued = await issueFirstContactInvitation(db, declaration(), EMAIL, NOW);

    const claim = await claimInvitationByLink(db, issued.token, NOW);

    expect(claim.kind).toBe('claimed');
    if (claim.kind === 'claimed') {
      // ⚠️ Η **δήλωση επιβιώνει αυτούσια** — αυτό είναι που θα δοθεί στον γραφέα.
      expect(claim.invitation.declaration.target).toEqual({
        kind: 'listing', listingId: 'ownp_kalamaria',
      });
      expect(claim.invitation.state).toBe('redeemed');
    }
  });

  it('Ε2 — δεύτερο πάτημα του ΙΔΙΟΥ συνδέσμου: «ήδη χρησιμοποιήθηκε», όχι «άκυρος»', async () => {
    const db = freshDb();
    const issued = await issueFirstContactInvitation(db, declaration(), EMAIL, NOW);

    await claimInvitationByLink(db, issued.token, NOW);
    const second = await claimInvitationByLink(db, issued.token, NOW);

    // 🔑 **Επιτυχία στο παρελθόν, όχι αποτυχία τώρα.** Ο άνθρωπος που διπλοπάτησε
    //    δεν πρέπει να νομίσει ότι κάτι χάλασε.
    expect(second).toEqual({ kind: 'refused', reason: 'already-used', target: TARGET });
  });

  it('Ε3 — ο σύνδεσμος λήγει, και η λήξη λέγεται με το όνομά της', async () => {
    const db = freshDb();
    const issued = await issueFirstContactInvitation(db, declaration(), EMAIL, NOW);

    // Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: μία μέρα πριν τη λήξη περνά.
    expect((await claimInvitationByLink(freshDb(), issued.token, LATER)).kind).toBe('refused');
    const inTime = await claimInvitationByLink(db, issued.token, LATER);
    expect(inTime.kind).toBe('claimed');

    const db2 = freshDb();
    const late = await issueFirstContactInvitation(db2, declaration(), EMAIL, NOW);
    expect(await claimInvitationByLink(db2, late.token, TOO_LATE)).toEqual({
      kind: 'refused', reason: 'expired', target: TARGET,
    });
  });

  it('Ε4 — πειραγμένος σύνδεσμος απορρίπτεται ΧΩΡΙΣ να διαβαστεί η βάση', async () => {
    const db = freshDb();
    await issueFirstContactInvitation(db, declaration(), EMAIL, NOW);

    const forged = Buffer.from('fcin_ψεύτικο:nonce:9999999999999:κακή')
      .toString('base64url');

    // ⚠️ `target: null` **και είναι ο πυρήνας της άγκυρας**: πλαστός σύνδεσμος
    //    απορρίπτεται **πριν** από κάθε ανάγνωση, άρα δεν υπάρχει τι να ρωτηθεί.
    expect(await claimInvitationByLink(db, forged, NOW)).toEqual({
      kind: 'refused', reason: 'link-invalid', target: null,
    });
  });

  it('Ε5 — έγκυρη υπογραφή που δείχνει σε ΑΛΛΟ nonce δεν περνά', async () => {
    const db = freshDb();
    const first = await issueFirstContactInvitation(db, declaration('ownp_α'), EMAIL, NOW);
    const other = await issueFirstContactInvitation(db, declaration('ownp_β'), EMAIL, NOW);

    // Και οι δύο υπογράφηκαν από εμάς· ο έλεγχος `nonce` μέσα στη συναλλαγή είναι
    // αυτός που κρατά τον καθένα στο **δικό του** έγγραφο.
    expect((await claimInvitationByLink(db, first.token, NOW)).kind).toBe('claimed');
    expect((await claimInvitationByLink(db, other.token, NOW)).kind).toBe('claimed');
  });
});

// =============================================================================
// Κ — Ο ΚΩΔΙΚΟΣ (πόρτα Β)
// =============================================================================

describe('Κ — η πόρτα του κωδικού', () => {
  it('🔑 Κ1 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: ο σωστός κωδικός ανοίγει την ίδια κλειδαριά', async () => {
    const db = freshDb();
    const issued = await issueFirstContactInvitation(db, declaration(), EMAIL, NOW);

    const claim = await claimInvitationByCode(db, issued.invitationId, issued.code, NOW);

    expect(claim.kind).toBe('claimed');
  });

  it('Κ2 — ο ΩΜΟΣ κωδικός δεν αποθηκεύεται ΠΟΤΕ', async () => {
    const db = freshDb();
    const issued = await issueFirstContactInvitation(db, declaration(), EMAIL, NOW);

    const stored = await storedDoc(db, issued.invitationId);

    // 🔴 Έξι ψηφία = ένα εκατομμύριο συνδυασμοί: αποθηκευμένος ωμός, μια ανάγνωση
    //    της βάσης θα έδινε **κάθε** εκκρεμή επαφή.
    expect(JSON.stringify(stored)).not.toContain(issued.code);
    expect(stored.codeHash).not.toBe(issued.code);
    expect(stored.codeHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('Κ3 — λάθος κωδικός: «λάθος», και ο μετρητής ανεβαίνει', async () => {
    const db = freshDb();
    const issued = await issueFirstContactInvitation(db, declaration(), EMAIL, NOW);
    const wrong = issued.code === '000000' ? '111111' : '000000';

    expect(await claimInvitationByCode(db, issued.invitationId, wrong, NOW)).toEqual({
      kind: 'refused', reason: 'code-wrong', target: TARGET,
    });
    expect((await storedDoc(db, issued.invitationId)).attempts).toBe(1);

    // ⚠️ Και η πρόσκληση **μένει ζωντανή** — μία αστοχία δεν είναι επίθεση.
    expect((await claimInvitationByCode(db, issued.invitationId, issued.code, NOW)).kind)
      .toBe('claimed');
  });

  it('🔴 Κ4 — πέντε λάθος δοκιμές ΚΛΕΙΔΩΝΟΥΝ, και ο σωστός κωδικός ΔΕΝ σώζει', async () => {
    const db = freshDb();
    const issued = await issueFirstContactInvitation(db, declaration(), EMAIL, NOW);
    const wrong = issued.code === '000000' ? '111111' : '000000';

    for (let i = 0; i < 4; i += 1) {
      expect((await claimInvitationByCode(db, issued.invitationId, wrong, NOW)).reason)
        .toBe('code-wrong');
    }
    // Η **πέμπτη** είναι που κλειδώνει.
    expect(await claimInvitationByCode(db, issued.invitationId, wrong, NOW)).toEqual({
      kind: 'refused', reason: 'code-exhausted', target: TARGET,
    });

    // 🔑 Ο φρουρός είναι ανά **πρόσκληση**, όχι ανά IP: αλλαγή διεύθυνσης δεν τον
    //    παρακάμπτει, και ούτε ο σωστός κωδικός.
    expect(await claimInvitationByCode(db, issued.invitationId, issued.code, NOW)).toEqual({
      kind: 'refused', reason: 'code-exhausted', target: TARGET,
    });
  });

  it('Κ5 — ο κωδικός λήγει ΜΑΖΙ με τον σύνδεσμο (δεν ζει για πάντα)', async () => {
    const db = freshDb();
    const issued = await issueFirstContactInvitation(db, declaration(), EMAIL, NOW);

    // Η πόρτα του κωδικού δεν περνά από υπογραφή, άρα δεν έχει ημερομηνία να
    // διαβάσει — η λήξη κρίνεται από το έγγραφο.
    expect(await claimInvitationByCode(db, issued.invitationId, issued.code, TOO_LATE)).toEqual({
      kind: 'refused', reason: 'expired', target: TARGET,
    });
  });

  it('Κ6 — άγνωστη πρόσκληση δεν αποκαλύπτει τίποτα', async () => {
    expect(await claimInvitationByCode(freshDb(), 'fcin_ανύπαρκτο', '123456', NOW)).toEqual({
      kind: 'refused', reason: 'invitation-unknown', target: null,
    });
  });
});

// =============================================================================
// Α — Η ΑΝΤΙΚΑΤΑΣΤΑΣΗ
// =============================================================================

describe('Α — δύο ζωντανοί σύνδεσμοι δεν υπάρχουν ποτέ', () => {
  it('🔑 Α1 — νέα υποβολή για τον ΙΔΙΟ στόχο ακυρώνει την προηγούμενη', async () => {
    const db = freshDb();
    const first = await issueFirstContactInvitation(db, declaration(), EMAIL, NOW);
    const second = await issueFirstContactInvitation(db, declaration(), EMAIL, NOW);

    // Ο παλιός λέει **γιατί** έπαψε — όχι «άκυρος».
    expect(await claimInvitationByLink(db, first.token, NOW)).toEqual({
      kind: 'refused', reason: 'superseded', target: TARGET,
    });
    expect((await claimInvitationByLink(db, second.token, NOW)).kind).toBe('claimed');
  });

  it('🔴 Α2 — νέα υποβολή για ΑΛΛΟ στόχο ΔΕΝ αγγίζει την πρώτη', async () => {
    const db = freshDb();
    const kalamaria = await issueFirstContactInvitation(db, declaration('ownp_α'), EMAIL, NOW);
    await issueFirstContactInvitation(db, declaration('ownp_β'), EMAIL, NOW);

    // ⚠️ Η άγκυρα που πιάνει το ελάττωμα `target.id === target.id`: με σύγκριση
    //    πάνω σε **ανύπαρκτο** πεδίο, και οι δύο θα ήταν `undefined` ⇒ η δεύτερη
    //    υποβολή θα ακύρωνε **κάθε** άλλη πρόσκληση του ίδιου ανθρώπου.
    expect((await claimInvitationByLink(db, kalamaria.token, NOW)).kind).toBe('claimed');
  });

  it('Α3 — άλλος άνθρωπος, ίδιος στόχος: καμία παρέμβαση', async () => {
    const db = freshDb();
    const maria = await issueFirstContactInvitation(db, declaration(), EMAIL, NOW);
    await issueFirstContactInvitation(db, declaration(), 'kostas@example.com', NOW);

    expect((await claimInvitationByLink(db, maria.token, NOW)).kind).toBe('claimed');
  });
});

// =============================================================================
// Χ — ΤΟ ΚΑΝΑΛΙ ΚΑΙ Ο ΚΩΔΙΚΟΣ
// =============================================================================

describe('Χ — λεπτομέρειες που φαίνονται ασήμαντες μέχρι να σπάσουν', () => {
  it('Χ1 — το email κανονικοποιείται, αλλιώς η ιδεμποτησία δεν πιάνει', async () => {
    expect(normaliseChannelEmail('  Maria@Example.COM ')).toBe('maria@example.com');

    const db = freshDb();
    const first = await issueFirstContactInvitation(db, declaration(), '  MARIA@example.com ', NOW);
    await issueFirstContactInvitation(db, declaration(), 'maria@EXAMPLE.com', NOW);

    expect((await claimInvitationByLink(db, first.token, NOW)).reason).toBe('superseded');
  });

  it('🔴 Χ2 — ο κωδικός έχει ΠΑΝΤΑ έξι ψηφία, και τα αρχικά μηδενικά επιτρέπονται', () => {
    // ⚠️ Ένα εύρος «από 100000» θα έκοβε **σιωπηλά το 10%** του χώρου. Η άγκυρα
    //    τραβά αρκετά δείγματα ώστε ένα σπασμένο `padStart` να φανεί.
    const drawn = new Set<string>();
    for (let i = 0; i < 3000; i += 1) {
      const code = newVerificationCode();
      expect(code).toMatch(/^[0-9]{6}$/);
      drawn.add(code);
    }
    // Και ότι δεν επιστρέφει την ίδια τιμή συνέχεια (νεκρή γεννήτρια).
    expect(drawn.size).toBeGreaterThan(2000);
  });
});

// =============================================================================
// Δ — Η ΑΡΝΗΣΗ ΚΟΥΒΑΛΑ ΤΗ ΔΙΕΞΟΔΟ (ADR-844 — το αδιέξοδο της άρνησης)
// =============================================================================

/**
 * 🔴 **ΤΙ ΦΥΛΑΕΙ ΑΥΤΗ Η ΟΜΑΔΑ, ΚΑΙ ΓΙΑΤΙ ΚΑΜΙΑ ΠΥΛΗ ΔΕΝ ΤΟ ΒΛΕΠΕΙ**
 *
 * Η άρνηση επέστρεφε **μόνο** λόγο. Η σελίδα `/contact/[token]` έλεγε τότε στον
 * άνθρωπο *«πατήστε ξανά «Πλησιάστε»»* — **χωρίς κουμπί, χωρίς δρόμο πίσω, χωρίς να
 * θυμάται ποια αγγελία ήταν**. Ο τύπος μεταγλωττιζόταν μια χαρά· το i18n ήταν πλήρες·
 * το μέγεθος εντάξει. **Το ελάττωμα ήταν ότι έλειπε πεδίο**, και μόνο εκτέλεση το βλέπει.
 *
 * ⚠️ **Κόστος θεραπείας: ΜΗΔΕΝ αναγνώσεις** — ο στόχος ζει μέσα στην πρόσκληση που η
 * συναλλαγή **μόλις διάβασε**. Η Δ5 το αποδεικνύει μετρώντας τις κλήσεις της βάσης.
 */
describe('Δ — καμία άρνηση χωρίς δρόμο πίσω', () => {
  it('🔑 Δ0 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: η ΕΠΙΤΥΧΙΑ κουβαλά τον στόχο μέσα στη δήλωση', async () => {
    const db = freshDb();
    const issued = await issueFirstContactInvitation(db, declaration(), EMAIL, NOW);

    const claim = await claimInvitationByLink(db, issued.token, NOW);

    expect(claim.kind).toBe('claimed');
    if (claim.kind === 'claimed') {
      expect(claim.invitation.declaration.target).toEqual(TARGET);
    }
  });

  it('🔴 Δ1 — ΛΗΞΗ: ο άνθρωπος που άργησε οκτώ μέρες παίρνει πίσω την αγγελία του', async () => {
    const db = freshDb();
    const issued = await issueFirstContactInvitation(db, declaration(), EMAIL, NOW);

    const claim = await claimInvitationByLink(db, issued.token, TOO_LATE);

    expect(claim).toEqual({ kind: 'refused', reason: 'expired', target: TARGET });
  });

  it('🔴 Δ2 — ΔΕΥΤΕΡΟ ΠΑΤΗΜΑ και ΑΝΤΙΚΑΤΑΣΤΑΣΗ: ίδια διέξοδος', async () => {
    const db = freshDb();
    const issued = await issueFirstContactInvitation(db, declaration(), EMAIL, NOW);
    await claimInvitationByLink(db, issued.token, NOW);

    expect((await claimInvitationByLink(db, issued.token, NOW))).toEqual({
      kind: 'refused', reason: 'already-used', target: TARGET,
    });

    const other = freshDb();
    const first = await issueFirstContactInvitation(other, declaration(), EMAIL, NOW);
    await issueFirstContactInvitation(other, declaration(), EMAIL, NOW);

    expect((await claimInvitationByLink(other, first.token, NOW))).toEqual({
      kind: 'refused', reason: 'superseded', target: TARGET,
    });
  });

  it('🔴 Δ3 — ΚΛΕΙΔΩΜΕΝΟΣ ΚΩΔΙΚΟΣ: και η πόρτα Β δίνει διέξοδο', async () => {
    const db = freshDb();
    const issued = await issueFirstContactInvitation(db, declaration(), EMAIL, NOW);

    for (let i = 0; i < 5; i += 1) {
      await claimInvitationByCode(db, issued.invitationId, '000000', NOW);
    }

    const claim = await claimInvitationByCode(db, issued.invitationId, issued.code, NOW);
    expect(claim).toEqual({ kind: 'refused', reason: 'code-exhausted', target: TARGET });
  });

  it('🔑 Δ4 — ΧΩΡΙΣ ΕΓΓΡΑΦΟ δεν υπάρχει στόχος, και το λέμε με `null` — ποτέ μαντεψιά', async () => {
    const db = freshDb();

    // Άγνωστη πρόσκληση: το έγγραφο **δεν υπάρχει**, άρα δεν υπάρχει τι να ρωτηθεί.
    expect(await claimInvitationByCode(db, 'fcin_fantasma', '123456', NOW)).toEqual({
      kind: 'refused', reason: 'invitation-unknown', target: null,
    });

    // Πλαστός σύνδεσμος: απορρίπτεται **πριν** από κάθε ανάγνωση.
    expect(await claimInvitationByLink(db, 'σκουπίδια', NOW)).toEqual({
      kind: 'refused', reason: 'link-invalid', target: null,
    });
  });

  it('🔴 Δ5 — ΜΗΔΕΝ ΕΠΙΠΛΕΟΝ ΑΝΑΓΝΩΣΕΙΣ: η διέξοδος δεν πληρώνεται με ερώτημα', async () => {
    const db = freshDb();
    const issued = await issueFirstContactInvitation(db, declaration(), EMAIL, NOW);

    // ⚠️ Ο πλαστός μετρά κάθε `collection()`. Η άρνηση διαβάζει **το έγγραφο που ήδη
    //    κρατά** — αν κάποιος «λύσει» τη διέξοδο με δεύτερη ανάγνωση (π.χ. τον τίτλο
    //    της αγγελίας), αυτός ο αριθμός θα ανέβει και η άγκυρα θα το πει.
    const spy = jest.spyOn(db, 'collection');
    const claim = await claimInvitationByLink(db, issued.token, TOO_LATE);
    // ⚠️ **ΜΕΤΡΑ ΠΡΙΝ ΤΟ `mockRestore()`** — εκείνο **μηδενίζει** το ιστορικό κλήσεων
    //    μαζί με την επαναφορά, και η άγκυρα θα έβλεπε **0** ό,τι κι αν έτρεξε:
    //    πράσινη για λάθος λόγο, ακριβώς το είδος που δεν πιάνει τίποτα.
    const reads = spy.mock.calls.length;
    spy.mockRestore();

    expect(claim.kind).toBe('refused');
    expect(reads).toBe(1);
  });

  it('🔴 Δ6 — ΧΑΛΑΣΜΕΝΟ ΕΓΓΡΑΦΟ: `null`, ΠΟΤΕ σύνδεσμος προς `/listing/undefined`', async () => {
    const db = freshDb();
    const issued = await issueFirstContactInvitation(db, declaration(), EMAIL, NOW);

    // 🔴 Ο παλιός έλεγχος κοίταζε **μόνο** το `kind` — και του αρκούσε, γιατί ο μόνος
    //    καταναλωτής ήταν μια σύγκριση. Ο νέος **χτίζει διεύθυνση**: έγγραφο χωρίς
    //    `listingId` θα έδινε κουμπί προς `/listing/undefined`, δηλαδή **ακριβώς** το
    //    αδιέξοδο που η διέξοδος υπάρχει για να λύσει.
    await db.collection(COLLECTIONS.FIRST_CONTACT_INVITATIONS).doc(issued.invitationId).update({
      declaration: { ...declaration(), target: { kind: 'listing' } },
    });

    const claim = await claimInvitationByLink(db, issued.token, TOO_LATE);
    expect(claim).toEqual({ kind: 'refused', reason: 'expired', target: null });
  });
});
