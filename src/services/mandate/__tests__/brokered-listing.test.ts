/**
 * @jest-environment node
 *
 * @fileoverview **Η ΚΑΤΑΧΩΡΗΣΗ ΓΙΑ ΠΕΛΑΤΗ** — οι άγκυρες της πράξης του μεσίτη (§8.33).
 * @related services/mandate/brokered-listing.service.ts
 *
 * ⚠️ **Ο ταχυδρόμος είναι ο ΜΟΝΟΣ που αντικαθίσταται.** Όλα τα υπόλοιπα — η γέννηση
 * της εντολής, η υπογραφή του συνδέσμου, η γραφή, η δημόσια προβολή — τρέχουν
 * **αληθινά** πάνω σε ψεύτικη βάση. Ένα test που έπλαθε και την πύλη γραφής θα
 * αποδείκνυε ότι ο κώδικας καλεί ό,τι νομίζουμε, όχι ότι **συμβαίνει** ό,τι θέλουμε.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { validDraft } from '@/lib/owner-property/__tests__/owner-property-fixtures';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import type { OwnerProperty } from '@/types/owner-property';
import { DEFAULT_LISTING_AGREEMENT } from '@/types/listing-agreement';
import {
  AGENCY_ATTESTATION,
  CUSTOMARY_COMMISSION_PERCENTAGE,
  OWNER_CONSENT,
  type MandateCompensation,
} from '@/types/owner-property-mandate';
import { requireBrokerageCapability } from '@/lib/auth/brokerage-authority';

process.env.MANDATE_CONSENT_SECRET ??= 'δοκιμαστικό-μυστικό-συγκατάθεσης';

const enqueued: Record<string, unknown>[] = [];
let enqueueSucceeds = true;

jest.mock('@/server/comms/orchestrator', () => ({
  enqueueMessage: jest.fn(async (params: Record<string, unknown>) => {
    enqueued.push(params);
    return { success: enqueueSucceeds, messageIds: ['msg_1'] };
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
  agencyAttestation,
  createBrokeredListing,
  OWNER_CONSENT_PROOF,
} = require('@/services/mandate/brokered-listing.service') as typeof import('@/services/mandate/brokered-listing.service');

const LISTING_ID = 'ownp_a';
const CLIENT = 'cont_kostas';
const IDENTITY = {
  id: LISTING_ID,
  authorUserId: 'user_maria',
  agencyName: 'ΑΛΦΑ ΜΕΣΙΤΙΚΗ',
};

/**
 * 🔑 **Η ΑΠΟΔΕΙΞΗ ΚΑΤΑΣΚΕΥΑΖΕΤΑΙ ΑΠΟ ΤΟΝ ΚΡΙΤΗ, ΠΟΤΕ ΜΕ LITERAL** (ADR-824 §6).
 *
 * Το `__brand` είναι `unique symbol` που **δεν εξάγεται**, άρα καμία σουίτα δεν
 * μπορεί να φτιάξει `{} as BrokerageAuthority` χωρίς να το δει αναθεωρητής. Εδώ
 * περνάμε από τον **ίδιο** κριτή που τρέχει στην παραγωγή — δηλαδή αυτές οι άγκυρες
 * κρίνουν και τη διέλευσή του, όχι μόνο τη γραφή.
 */
const AUTHORITY = (() => {
  const verdict = requireBrokerageCapability('comp_alfa', {
    brokerage_listings: {
      status: 'active',
      requirements: [],
      declaration: null,
      decidedByUserId: 'user_super',
      decidedAt: '2026-08-27T10:00:00.000Z',
      revocationReason: null,
    },
  });
  if ('denied' in verdict) throw new Error('ο παρονομαστής έσπασε: ενεργή ικανότητα κρίθηκε άρνηση');
  return verdict;
})();
// 🔴 **ΗΤΑΝ `2027-08-20` — δώδεκα μήνες σε ΑΠΟΚΛΕΙΣΤΙΚΗ εντολή**, που το άρθρο 200 §4
//    Ν.4072/2012 απαγορεύει (ανώτατο 8). Δεύτερο αντίγραφο του ίδιου άκυρου fixture
//    (ADR-827 §8.9 α) — και τα δύο πέρασαν από τη Φάση Α χωρίς να τα δει κανείς.
const FUTURE = '2027-02-20T12:00:00.000Z';
/** Η έναρξη της εντολής στα σενάρια — ADR-832. */
const NOW = '2026-08-20T09:00:00.000Z';

/** Οι όροι αμοιβής — **ιδιωτικοί**· καμία άγκυρα δεν τους περιμένει στη δημόσια προβολή. */
const COMPENSATION: MandateCompensation = {
  type: 'percentage',
  percentage: CUSTOMARY_COMMISSION_PERCENTAGE,
  vatIncluded: false,
};

function dbWithContact(emails: unknown): AdminFirestore {
  const fake = new FakeFirestore();
  fake.seed(COLLECTIONS.CONTACTS, CLIENT, { emails });
  return fake as unknown as AdminFirestore;
}

async function storedProperty(db: AdminFirestore): Promise<OwnerProperty> {
  const snap = await db.collection(COLLECTIONS.OWNER_PROPERTIES).doc(LISTING_ID).get();
  return snap.data() as OwnerProperty;
}

async function isPublished(db: AdminFirestore): Promise<boolean> {
  const snap = await db.collection(COLLECTIONS.PUBLIC_LISTINGS).doc(LISTING_ID).get();
  return snap.exists;
}

beforeEach(() => {
  enqueued.length = 0;
  enqueueSucceeds = true;
});

// =============================================================================
// Β — Ο ΔΡΟΜΟΣ ΤΗΣ ΣΥΓΚΑΤΑΘΕΣΗΣ
// =============================================================================

describe('🔴 Β — «ρώτα τον πελάτη»: τίποτα δημόσιο πριν απαντήσει', () => {
  it('🔑 Β1 — γεννιέται ΣΕ ΑΝΑΜΟΝΗ και ΔΕΝ δημοσιεύεται', async () => {
    const db = dbWithContact([{ email: 'kostas@example.gr', isPrimary: true }]);
    const result = await createBrokeredListing(db, AUTHORITY, IDENTITY, validDraft(), {
      clientContactId: CLIENT,
      agreement: DEFAULT_LISTING_AGREEMENT,
      compensation: COMPENSATION,
      expiresAt: FUTURE,
      scope: ['sell'],
      startsAt: NOW,
      proof: OWNER_CONSENT_PROOF,
    });

    expect(result.write.kind).toBe('saved');
    const mandate = (await storedProperty(db)).mandates[0]!;
    expect(mandate.confirmation).toBe('pending');
    expect(mandate.proof.via).toBe(OWNER_CONSENT);
    expect(await isPublished(db)).toBe(false);
  });

  it('Β2 — ο σύνδεσμος υπάρχει ΣΤΗΝ ΕΝΤΟΛΗ τη στιγμή που φεύγει το μήνυμα', async () => {
    const db = dbWithContact([{ email: 'kostas@example.gr', isPrimary: true }]);
    await createBrokeredListing(db, AUTHORITY, IDENTITY, validDraft(), {
      clientContactId: CLIENT,
      agreement: DEFAULT_LISTING_AGREEMENT,
      compensation: COMPENSATION,
      expiresAt: FUTURE,
      scope: ['sell'],
      startsAt: NOW,
      proof: OWNER_CONSENT_PROOF,
    });

    const mandate = (await storedProperty(db)).mandates[0]!;
    expect(mandate.consentNonce).toEqual(expect.any(String));
    // Το κλειδί anti-spam **είναι** το nonce ⇒ ο σύνδεσμος στο μήνυμα ανήκει σε αυτή
    // ακριβώς την πρόσκληση, και όχι σε κάποια προηγούμενη.
    expect(enqueued[0]?.idempotencyKey).toBe(
      `mandate-consent:${mandate.kind === 'brokered' ? mandate.consentNonce : ''}`,
    );
  });

  it('🔴 Β3 — ο σύνδεσμος ΔΕΝ δείχνει στο νεκρό vercel', async () => {
    const db = dbWithContact([{ email: 'kostas@example.gr', isPrimary: true }]);
    await createBrokeredListing(db, AUTHORITY, IDENTITY, validDraft(), {
      clientContactId: CLIENT,
      agreement: DEFAULT_LISTING_AGREEMENT,
      compensation: COMPENSATION,
      expiresAt: FUTURE,
      scope: ['sell'],
      startsAt: NOW,
      proof: OWNER_CONSENT_PROOF,
    });

    const body = String(enqueued[0]?.content ?? '');
    expect(body).not.toContain('vercel.app');
    expect(body).toContain('/mandate/');
  });
});

// =============================================================================
// Γ — Ο ΔΡΟΜΟΣ ΤΗΣ ΒΕΒΑΙΩΣΗΣ
// =============================================================================

describe('🔴 Γ — «έχω υπογεγραμμένο χαρτί»: δημοσιεύεται, ΚΑΙ ο ιδιοκτήτης ειδοποιείται', () => {
  it('🔑 Γ1 — γεννιέται ΕΓΚΕΚΡΙΜΕΝΗ και δημοσιεύεται ΑΜΕΣΩΣ', async () => {
    const db = dbWithContact([{ email: 'kostas@example.gr', isPrimary: true }]);
    await createBrokeredListing(db, AUTHORITY, IDENTITY, validDraft(), {
      clientContactId: CLIENT,
      agreement: DEFAULT_LISTING_AGREEMENT,
      compensation: COMPENSATION,
      expiresAt: FUTURE,
      scope: ['sell'],
      startsAt: NOW,
      proof: agencyAttestation('user_maria'),
    });

    const mandate = (await storedProperty(db)).mandates[0]!;
    expect(mandate.confirmation).toBe('confirmed');
    expect(mandate.proof.via).toBe(AGENCY_ATTESTATION);
    expect(await isPublished(db)).toBe(true);
  });

  it('🔑 Γ2 — η βεβαίωση κρατά ΠΟΙΟΣ την έδωσε — και δεν είναι ο πελάτης', async () => {
    const db = dbWithContact([{ email: 'kostas@example.gr', isPrimary: true }]);
    await createBrokeredListing(db, AUTHORITY, IDENTITY, validDraft(), {
      clientContactId: CLIENT,
      agreement: DEFAULT_LISTING_AGREEMENT,
      compensation: COMPENSATION,
      expiresAt: FUTURE,
      scope: ['sell'],
      startsAt: NOW,
      proof: agencyAttestation('user_maria', 'entoles/kostas.pdf'),
    });

    const mandate = (await storedProperty(db)).mandates[0]!;
    if (mandate.proof.via === AGENCY_ATTESTATION) {
      expect(mandate.proof.attestedByUserId).toBe('user_maria');
      expect(mandate.proof.documentPath).toBe('entoles/kostas.pdf');
      expect(mandate.proof.attestedAt).toEqual(expect.any(String));
    } else {
      throw new Error('η βεβαίωση χάθηκε');
    }
    // Και ο **πελάτης** δεν έχει «αποφασίσει» τίποτα: το χαρτί το βεβαιώνει το γραφείο.
    expect(mandate.decidedAt).toBeNull();
  });

  it('🏆 Γ3 — το μήνυμα είναι ΑΛΛΟ: ενημέρωση με δικαίωμα αντίρρησης, όχι ερώτηση', async () => {
    const db = dbWithContact([{ email: 'kostas@example.gr', isPrimary: true }]);
    await createBrokeredListing(db, AUTHORITY, IDENTITY, validDraft(), {
      clientContactId: CLIENT,
      agreement: DEFAULT_LISTING_AGREEMENT,
      compensation: COMPENSATION,
      expiresAt: FUTURE,
      scope: ['sell'],
      startsAt: NOW,
      proof: agencyAttestation('user_maria'),
    });
    const attestationBody = String(enqueued[0]?.content ?? '');

    enqueued.length = 0;
    const db2 = dbWithContact([{ email: 'kostas@example.gr', isPrimary: true }]);
    await createBrokeredListing(db2, AUTHORITY, IDENTITY, validDraft(), {
      clientContactId: CLIENT,
      agreement: DEFAULT_LISTING_AGREEMENT,
      compensation: COMPENSATION,
      expiresAt: FUTURE,
      scope: ['sell'],
      startsAt: NOW,
      proof: OWNER_CONSENT_PROOF,
    });
    const consentBody = String(enqueued[0]?.content ?? '');

    // Ο παρονομαστής: και τα δύο μηνύματα υπάρχουν και έχουν σύνδεσμο…
    expect(attestationBody).toContain('/mandate/');
    expect(consentBody).toContain('/mandate/');
    // …και λένε **αντίθετα πράγματα** για το αν η αγγελία είναι ζωντανή.
    expect(consentBody).toContain('ΔΕΝ έχει δημοσιευτεί');
    expect(attestationBody).toContain('ήδη δημοσιευμένη');
    expect(attestationBody).not.toBe(consentBody);
  });
});

// =============================================================================
// Ε — Η ΕΙΔΟΠΟΙΗΣΗ ΛΕΓΕΤΑΙ ΟΠΩΣ ΕΓΙΝΕ
// =============================================================================

describe('🔴 Ε — το γραφείο μαθαίνει ΑΝ έμαθε ο πελάτης', () => {
  it('🔑 Ε1 — επαφή ΧΩΡΙΣ email ⇒ `no-address`, και `notifiedAt` μένει κενό', async () => {
    const db = dbWithContact([]);
    const result = await createBrokeredListing(db, AUTHORITY, IDENTITY, validDraft(), {
      clientContactId: CLIENT,
      agreement: DEFAULT_LISTING_AGREEMENT,
      compensation: COMPENSATION,
      expiresAt: FUTURE,
      scope: ['sell'],
      startsAt: NOW,
      proof: OWNER_CONSENT_PROOF,
    });

    expect(result.notify).toEqual({ kind: 'no-address' });
    const mandate = (await storedProperty(db)).mandates[0]!;
    expect(mandate.notifiedAt).toBeNull();
    // Η καταχώρηση **έγινε** — η σιωπή του ταχυδρόμου δεν ακυρώνει τη δουλειά.
    expect(result.write.kind).toBe('saved');
  });

  it('🔴 Ε2 — αποτυχία αποστολής ⇒ `notifiedAt` ΠΑΡΑΜΕΝΕΙ κενό (υποτιμούμε, ποτέ υπερτιμούμε)', async () => {
    enqueueSucceeds = false;
    const db = dbWithContact([{ email: 'kostas@example.gr', isPrimary: true }]);
    const result = await createBrokeredListing(db, AUTHORITY, IDENTITY, validDraft(), {
      clientContactId: CLIENT,
      agreement: DEFAULT_LISTING_AGREEMENT,
      compensation: COMPENSATION,
      expiresAt: FUTURE,
      scope: ['sell'],
      startsAt: NOW,
      proof: OWNER_CONSENT_PROOF,
    });

    expect(result.notify).toEqual({ kind: 'failed' });
    const mandate = (await storedProperty(db)).mandates[0]!;
    expect(mandate.notifiedAt).toBeNull();
  });

  it('🔑 Ε3 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: όταν φύγει, το `notifiedAt` γράφεται', async () => {
    const db = dbWithContact([{ email: 'kostas@example.gr', isPrimary: true }]);
    const result = await createBrokeredListing(db, AUTHORITY, IDENTITY, validDraft(), {
      clientContactId: CLIENT,
      agreement: DEFAULT_LISTING_AGREEMENT,
      compensation: COMPENSATION,
      expiresAt: FUTURE,
      scope: ['sell'],
      startsAt: NOW,
      proof: OWNER_CONSENT_PROOF,
    });

    expect(result.notify).toEqual({ kind: 'sent', to: 'kostas@example.gr' });
    const mandate = (await storedProperty(db)).mandates[0]!;
    expect(mandate.notifiedAt).toEqual(expect.any(String));
  });

  it('🔴 Ε4 — στέλνει στο ΚΥΡΙΟ email, όχι στο πρώτο της λίστας', async () => {
    const db = dbWithContact([
      { email: 'palio@example.gr', isPrimary: false },
      { email: 'kostas@example.gr', isPrimary: true },
    ]);
    const result = await createBrokeredListing(db, AUTHORITY, IDENTITY, validDraft(), {
      clientContactId: CLIENT,
      agreement: DEFAULT_LISTING_AGREEMENT,
      compensation: COMPENSATION,
      expiresAt: FUTURE,
      scope: ['sell'],
      startsAt: NOW,
      proof: OWNER_CONSENT_PROOF,
    });

    expect(result.notify).toEqual({ kind: 'sent', to: 'kostas@example.gr' });
    expect(enqueued[0]?.to).toBe('kostas@example.gr');
  });
});

// =============================================================================
// Φ — ΤΟ ΦΡΑΓΜΑ ΤΗΣ ΕΝΤΟΛΗΣ
// =============================================================================

describe('🔴 Φ — άκυρη εντολή δεν γεννά αγγελία', () => {
  it('Φ1 — λήξη ΣΤΟ ΠΑΡΕΛΘΟΝ ⇒ `invalid-mandate`, κανένα έγγραφο', async () => {
    const db = dbWithContact([{ email: 'kostas@example.gr', isPrimary: true }]);
    const result = await createBrokeredListing(db, AUTHORITY, IDENTITY, validDraft(), {
      clientContactId: CLIENT,
      agreement: DEFAULT_LISTING_AGREEMENT,
      compensation: COMPENSATION,
      expiresAt: '2020-01-01T00:00:00.000Z',
      scope: ['sell'],
      startsAt: NOW,
      proof: OWNER_CONSENT_PROOF,
    });

    expect(result.write.kind).toBe('invalid-mandate');
    const snap = await db.collection(COLLECTIONS.OWNER_PROPERTIES).doc(LISTING_ID).get();
    expect(snap.exists).toBe(false);
    // Και **κανένα μήνυμα δεν έφυγε** — ο πελάτης δεν ρωτιέται για εντολή που δεν έγινε.
    expect(enqueued).toHaveLength(0);
  });

  it('Φ2 — εντολή χωρίς πελάτη ⇒ `invalid-mandate`', async () => {
    const db = dbWithContact([{ email: 'kostas@example.gr', isPrimary: true }]);
    const result = await createBrokeredListing(db, AUTHORITY, IDENTITY, validDraft(), {
      clientContactId: '   ',
      expiresAt: FUTURE,
      // ⚠️ Η κατάληψη δηλώνεται **πάντα** (ADR-832) — η άγκυρα χαλάει ΕΝΑ πράγμα,
      //    τον πελάτη, και ένα δεύτερο κενό θα την έκανε να πρασινίζει για λάθος λόγο.
      scope: ['sell'],
      startsAt: NOW,
      proof: OWNER_CONSENT_PROOF,
    });

    expect(result.write.kind).toBe('invalid-mandate');
    expect(enqueued).toHaveLength(0);
  });
});
