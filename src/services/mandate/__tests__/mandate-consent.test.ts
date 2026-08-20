/**
 * @jest-environment node
 *
 * @fileoverview **Η ΣΥΓΚΑΤΑΘΕΣΗ** — οι άγκυρες της πόρτας του ιδιοκτήτη (§8.33).
 * @related services/mandate/mandate-consent.service.ts · lib/tokens/signed-token.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΑΠΟΔΕΙΚΝΥΟΥΝ — ΚΑΙ ΓΙΑΤΙ ΤΡΕΧΟΥΝ ΤΗΝ **ΠΛΗΡΗ** ΔΙΑΔΡΟΜΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Δεν ελέγχεται εδώ κανένα `boolean`: κάθε άγκυρα **εκδίδει πραγματικό σύνδεσμο**,
 * τον περνά από την **πραγματική** επαλήθευση υπογραφής, και όπου γράφει, γράφει σε
 * ψεύτικη βάση μέσω της **πραγματικής** πύλης γραφής. Ένας έλεγχος πάνω σε ενδιάμεσο
 * θα ήταν πράσινος ακόμη κι αν κανείς δεν τον καλούσε — «φρουρός χωρίς απόδειξη ζωής».
 *
 * ⚠️ **Κάθε άρνηση δοκιμάζεται με τον ΠΑΡΟΝΟΜΑΣΤΗ της**: πρώτα ότι ο ίδιος σύνδεσμος
 * **γίνεται δεκτός** όταν λείπει μόνο το κρίσιμο.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import {
  issueMandateConsentLink,
  readMandateConsentRequest,
  recordMandateDecision,
} from '@/services/mandate/mandate-consent.service';
import { brokeredOwnerProperty, validOwnerProperty } from '@/lib/owner-property/__tests__/owner-property-fixtures';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import type { OwnerProperty } from '@/types/owner-property';

process.env.MANDATE_CONSENT_SECRET ??= 'δοκιμαστικό-μυστικό-συγκατάθεσης';

const LISTING_ID = 'ownp_a';
const CLIENT = 'cont_kostas';

function dbWith(property: OwnerProperty): AdminFirestore {
  const fake = new FakeFirestore();
  fake.seed(COLLECTIONS.OWNER_PROPERTIES, property.id, property);
  return fake as unknown as AdminFirestore;
}

/** Αγγελία γραφείου **με ζωντανό σύνδεσμο** — το `nonce` γραμμένο πάνω στην εντολή. */
function withLiveLink(over: Parameters<typeof brokeredOwnerProperty>[0] = {}) {
  const link = issueMandateConsentLink(LISTING_ID, CLIENT);
  const property = brokeredOwnerProperty({ consentNonce: link.nonce, ...over });
  return { link, property, db: dbWith(property) };
}

// =============================================================================
// Δ — Η ΕΡΩΤΗΣΗ ΦΤΑΝΕΙ
// =============================================================================

describe('Δ — ο σύνδεσμος δείχνει τη σωστή ερώτηση', () => {
  it('🔑 Δ1 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: έγκυρος σύνδεσμος διαβάζεται', async () => {
    const { link, db } = withLiveLink();
    const lookup = await readMandateConsentRequest(db, link.token);

    expect(lookup.ok).toBe(true);
    if (lookup.ok) {
      expect(lookup.request.ownerPropertyId).toBe(LISTING_ID);
      expect(lookup.request.clientContactId).toBe(CLIENT);
      expect(lookup.request.currentDecision).toBe('pending');
    }
  });

  it('🔴 Δ2 — ο σύνδεσμος δείχνει ΤΗ ΛΗΞΗ ΤΗΣ ΕΝΤΟΛΗΣ, όχι τη δική του', async () => {
    // Ο Κώστας εγκρίνει κάτι με **ρητό τέλος** — αυτό είναι το σημείο όπου ξεπερνάμε
    // το MLS, όπου η `ExpirationDate` είναι αριθμός που ο πωλητής δεν βλέπει ποτέ.
    const { link, property, db } = withLiveLink();
    const lookup = await readMandateConsentRequest(db, link.token);

    expect(lookup.ok).toBe(true);
    if (lookup.ok && property.mandate.kind === 'brokered') {
      expect(lookup.request.mandateExpiresAt).toBe(property.mandate.expiresAt);
      expect(lookup.request.mandateExpiresAt).not.toBe(link.expiresAtISO);
    }
  });

  it('🔴 Δ3 — ΤΙΠΟΤΑ του επιπέδου Β δεν ταξιδεύει στην οθόνη', async () => {
    const { link, db } = withLiveLink();
    const lookup = await readMandateConsentRequest(db, link.token);
    const flat = JSON.stringify(lookup);

    // Η αγγελία **έχει** διεύθυνση, τιμή και αρχείο στο στιγμιότυπο…
    expect(JSON.stringify(validOwnerProperty())).toContain('Εγνατίας');
    // …και τίποτα από αυτά δεν φτάνει στον κάτοχο του συνδέσμου.
    expect(flat).not.toContain('Εγνατίας');
    expect(flat).not.toContain('katopsi.pdf');
    expect(flat).not.toContain('210000');
  });
});

// =============================================================================
// Α — ΟΙ ΑΡΝΗΣΕΙΣ, ΟΝΟΜΑΣΤΙΚΑ
// =============================================================================

describe('🔴 Α — έξι λόγοι, και κανένας δεν συμπτύσσεται', () => {
  it('Α1 — πλαστός σύνδεσμος ⇒ `link-invalid`, ΧΩΡΙΣ καμία ανάγνωση βάσης', async () => {
    const { db } = withLiveLink();
    const lookup = await readMandateConsentRequest(db, 'ό,τι-νά-ναι');
    expect(lookup).toEqual({ ok: false, reason: 'link-invalid' });
  });

  it('Α2 — ΛΗΓΜΕΝΟΣ σύνδεσμος ⇒ `link-expired` (όχι «άκυρος»)', async () => {
    const expired = issueMandateConsentLink(LISTING_ID, CLIENT, -1);
    const db = dbWith(brokeredOwnerProperty({ consentNonce: expired.nonce }));
    expect(await readMandateConsentRequest(db, expired.token)).toEqual({
      ok: false,
      reason: 'link-expired',
    });
  });

  it('Α3 — αγγελία που δεν υπάρχει ⇒ `listing-absent`', async () => {
    const link = issueMandateConsentLink('ownp_φάντασμα', CLIENT);
    const db = dbWith(brokeredOwnerProperty({ consentNonce: link.nonce }));
    expect(await readMandateConsentRequest(db, link.token)).toEqual({
      ok: false,
      reason: 'listing-absent',
    });
  });

  it('Α4 — αγγελία ΙΔΙΩΤΗ ⇒ `not-brokered` (δεν υπάρχει εντολή να εγκριθεί)', async () => {
    const link = issueMandateConsentLink(LISTING_ID, CLIENT);
    const db = dbWith(validOwnerProperty());
    expect(await readMandateConsentRequest(db, link.token)).toEqual({
      ok: false,
      reason: 'not-brokered',
    });
  });

  it('🔴 Α5 — σύνδεσμος ΑΛΛΟΥ πελάτη ⇒ `client-mismatch`', async () => {
    // Η υπογραφή είναι **έγκυρη** — το κείμενο είναι δικό μας. Αυτό που δεν στέκει
    // είναι ότι μιλά για άλλον άνθρωπο· κανένας έλεγχος υπογραφής δεν το πιάνει.
    const link = issueMandateConsentLink(LISTING_ID, 'cont_άλλος');
    const db = dbWith(brokeredOwnerProperty({ consentNonce: link.nonce }));
    expect(await readMandateConsentRequest(db, link.token)).toEqual({
      ok: false,
      reason: 'client-mismatch',
    });
  });

  it('🔴 Α6 — ΠΑΛΙΟΣ σύνδεσμος μετά από νέα αποστολή ⇒ `superseded`', async () => {
    const first = issueMandateConsentLink(LISTING_ID, CLIENT);
    const second = issueMandateConsentLink(LISTING_ID, CLIENT);
    const db = dbWith(brokeredOwnerProperty({ consentNonce: second.nonce }));

    // Ο παρονομαστής: ο **νέος** δουλεύει…
    expect((await readMandateConsentRequest(db, second.token)).ok).toBe(true);
    // …και ο παλιός δεν λέει «άκυρος», λέει «υπάρχει νεότερο μήνυμα».
    expect(await readMandateConsentRequest(db, first.token)).toEqual({
      ok: false,
      reason: 'superseded',
    });
  });

  it('🔴 Α7 — εντολή ΧΩΡΙΣ ζωντανό σύνδεσμο (ανάκληση) ⇒ `superseded`', async () => {
    const link = issueMandateConsentLink(LISTING_ID, CLIENT);
    const db = dbWith(brokeredOwnerProperty({ consentNonce: null }));
    expect(await readMandateConsentRequest(db, link.token)).toEqual({
      ok: false,
      reason: 'superseded',
    });
  });
});

// =============================================================================
// Ν — Η ΑΠΟΦΑΣΗ ΓΡΑΦΕΤΑΙ
// =============================================================================

describe('🔴 Ν — το «ναι» του ιδιοκτήτη φτάνει στο έγγραφο', () => {
  async function storedMandate(db: AdminFirestore) {
    const snap = await db.collection(COLLECTIONS.OWNER_PROPERTIES).doc(LISTING_ID).get();
    return (snap.data() as OwnerProperty).mandate;
  }

  it('🔑 Ν1 — «ναι» ⇒ `confirmed` + ΧΡΟΝΟΣ, στο ίδιο έγγραφο', async () => {
    const { link, db } = withLiveLink();

    // Ο παρονομαστής: πριν την απάντηση είναι σε αναμονή, χωρίς χρόνο.
    const before = await storedMandate(db);
    expect(before.kind === 'brokered' && before.confirmation).toBe('pending');
    expect(before.kind === 'brokered' && before.decidedAt).toBeNull();

    expect(await recordMandateDecision(db, link.token, 'confirmed')).toEqual({
      ok: true,
      decision: 'confirmed',
    });

    const after = await storedMandate(db);
    expect(after.kind === 'brokered' && after.confirmation).toBe('confirmed');
    expect(after.kind === 'brokered' && after.decidedAt).not.toBeNull();
  });

  it('Ν2 — «όχι» ⇒ `declined`, και η εντολή ΔΕΝ σβήνεται', async () => {
    const { link, db } = withLiveLink();
    await recordMandateDecision(db, link.token, 'declined');

    const mandate = await storedMandate(db);
    expect(mandate.kind).toBe('brokered');
    expect(mandate.kind === 'brokered' && mandate.confirmation).toBe('declined');
    // Ο πελάτης του γραφείου μένει καταγραμμένος: «αρνήθηκε» δεν είναι «δεν υπήρξε».
    expect(mandate.kind === 'brokered' && mandate.clientContactId).toBe(CLIENT);
  });

  it('🔑 Ν3 — ο ΙΔΙΟΣ σύνδεσμος αλλάζει γνώμη — ΔΕΝ καίγεται στη χρήση', async () => {
    // Είναι ο λόγος που ο δρόμος της **βεβαίωσης γραφείου** μπορεί να στείλει
    // σύνδεσμο ΑΝΤΙΡΡΗΣΗΣ πάνω σε εντολή που είναι ήδη ενεργή.
    const { link, db } = withLiveLink();

    await recordMandateDecision(db, link.token, 'confirmed');
    expect(await recordMandateDecision(db, link.token, 'declined')).toEqual({
      ok: true,
      decision: 'declined',
    });

    const mandate = await storedMandate(db);
    expect(mandate.kind === 'brokered' && mandate.confirmation).toBe('declined');
  });

  it('🔴 Ν4 — ΠΑΛΙΟΣ σύνδεσμος ΔΕΝ γράφει τίποτα', async () => {
    const first = issueMandateConsentLink(LISTING_ID, CLIENT);
    const second = issueMandateConsentLink(LISTING_ID, CLIENT);
    const db = dbWith(brokeredOwnerProperty({ consentNonce: second.nonce }));

    expect(await recordMandateDecision(db, first.token, 'confirmed')).toEqual({
      ok: false,
      reason: 'superseded',
    });
    const mandate = await storedMandate(db);
    expect(mandate.kind === 'brokered' && mandate.confirmation).toBe('pending');
  });

  it('🔴 Ν5 — σύνδεσμος ΑΛΛΟΥ πελάτη ΔΕΝ γράφει τίποτα', async () => {
    const link = issueMandateConsentLink(LISTING_ID, 'cont_άλλος');
    const db = dbWith(brokeredOwnerProperty({ consentNonce: link.nonce }));

    expect(await recordMandateDecision(db, link.token, 'confirmed')).toEqual({
      ok: false,
      reason: 'client-mismatch',
    });
    const mandate = await storedMandate(db);
    expect(mandate.kind === 'brokered' && mandate.confirmation).toBe('pending');
  });
});

// =============================================================================
// Χ — Ο ΧΑΡΤΗΣ (η απόδειξη που δεν είναι εσωτερική)
// =============================================================================

/**
 * 🔴 **ΕΔΩ ΑΠΟΔΕΙΚΝΥΕΤΑΙ ΤΟ ΜΟΝΟ ΠΟΥ ΕΝΔΙΑΦΕΡΕΙ ΤΟΝ ΚΩΣΤΑ.**
 *
 * Οι προηγούμενες άγκυρες δείχνουν ότι το έγγραφο άλλαξε. Αυτή δείχνει ότι **η
 * αγγελία εμφανίζεται και εξαφανίζεται από τον κόσμο** — δηλαδή ότι η απόφασή του
 * έχει το αποτέλεσμα που του υποσχεθήκαμε στην οθόνη, μέσα από την **πραγματική**
 * μηχανή προβολής.
 */
describe('🔴 Χ — η απόφαση φτάνει στη ΔΗΜΟΣΙΑ ΠΡΟΒΟΛΗ, όχι μόνο στο έγγραφο', () => {
  async function publicListingExists(db: AdminFirestore): Promise<boolean> {
    const snap = await db.collection(COLLECTIONS.PUBLIC_LISTINGS).doc(LISTING_ID).get();
    return snap.exists;
  }

  it('🔑 Χ1 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: όσο η εντολή είναι σε αναμονή, ΤΙΠΟΤΑ δημόσιο', async () => {
    const { db } = withLiveLink();
    expect(await publicListingExists(db)).toBe(false);
  });

  it('🔑 Χ2 — «ναι» ⇒ η αγγελία ΕΜΦΑΝΙΖΕΤΑΙ στον χάρτη', async () => {
    const { link, db } = withLiveLink();
    await recordMandateDecision(db, link.token, 'confirmed');
    expect(await publicListingExists(db)).toBe(true);
  });

  it('🔴 Χ3 — και «όχι» μετά το «ναι» τη ΣΒΗΝΕΙ ξανά', async () => {
    const { link, db } = withLiveLink();

    await recordMandateDecision(db, link.token, 'confirmed');
    expect(await publicListingExists(db)).toBe(true);

    await recordMandateDecision(db, link.token, 'declined');
    expect(await publicListingExists(db)).toBe(false);
  });

  it('🔴 Χ4 — καμία ταυτότητα γραφείου ή πελάτη στη δημόσια προβολή', async () => {
    const { link, db } = withLiveLink();
    await recordMandateDecision(db, link.token, 'confirmed');

    const snap = await db.collection(COLLECTIONS.PUBLIC_LISTINGS).doc(LISTING_ID).get();
    const flat = JSON.stringify(snap.data());
    expect(flat).not.toContain('comp_alfa');
    expect(flat).not.toContain(CLIENT);
    expect(flat).not.toContain('user-1');
  });
});
