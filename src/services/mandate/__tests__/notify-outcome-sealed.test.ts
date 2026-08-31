/**
 * @jest-environment node
 *
 * @fileoverview 🔴 **Η ΑΙΤΙΑ ΑΠΟΘΗΚΕΥΕΤΑΙ** — το πέμπτο μέλος της κλάσης του §9.
 * @related ADR-834 §6.5.δ · services/mandate/brokered-listing.service.ts · mandate-actions.service.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΓΕΝΝΗΘΗΚΕ: ΕΝΑ BIT ΓΙΑ ΤΡΕΙΣ ΚΟΣΜΟΥΣ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο γραφέας επέστρεφε **τρεις ονομαστικές** εκβάσεις (`sent` · `no-address` ·
 * `failed`) και **καμία δεν αποθηκευόταν**: στη βάση έμενε `notifiedAt: null` — **ένα
 * bit** — για τρεις εντελώς διαφορετικούς κόσμους. Η οθόνη **υποχρεωνόταν** να
 * μαντέψει, μάντεψε τον έναν, και έστελνε τον μεσίτη να συμπληρώσει email που
 * **υπήρχε** (μετρημένο ζωντανά 2026-08-31, ADR-834 §6.5.α #14).
 *
 * ⚠️ **ΟΙ ΥΠΑΡΧΟΥΣΕΣ ΑΓΚΥΡΕΣ ΗΤΑΝ ΠΡΑΣΙΝΕΣ ΚΑΙ ΣΩΣΤΕΣ.** Τα `Ε1`/`Ε2` του
 * `brokered-listing.test.ts` ρωτούσαν *«μένει κενό το `notifiedAt`;»* — και έμενε. Το
 * ερώτημα που **κανείς δεν έθετε** είναι *«ΚΑΤΑΓΡΑΦΕΤΑΙ ΤΟ ΓΙΑΤΙ;»*. Αυτό το αρχείο
 * το θέτει, και το θέτει **πάνω στην αποθηκευμένη κατάσταση** — όχι στην επιστροφή
 * της συνάρτησης, που ζει μόνο όσο η οθόνη που την κάλεσε.
 *
 * ⚠️ **Ο ταχυδρόμος είναι ο ΜΟΝΟΣ που αντικαθίσταται** — ίδιο συμβόλαιο με τα §8.33 /
 * §8.34. Η γέννηση της εντολής, η υπογραφή, ο κριτής γραφής και η δημόσια προβολή
 * τρέχουν **αληθινά** πάνω σε ψεύτικη βάση.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import { validDraft } from '@/lib/owner-property/__tests__/owner-property-fixtures';
import { requireBrokerageCapability } from '@/lib/auth/brokerage-authority';
import { DEFAULT_LISTING_AGREEMENT } from '@/types/listing-agreement';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import type { OwnerProperty } from '@/types/owner-property';
import {
  CUSTOMARY_COMMISSION_PERCENTAGE,
  isMandateNotifyOutcome,
  MANDATE_NOTIFY_OUTCOMES,
  NOTIFY_FAILED,
  NOTIFY_NO_ADDRESS,
  NOTIFY_SENT,
  notifyOutcomeOf,
  OWNER_CONSENT,
  type BrokeredListingMandate,
  type MandateCompensation,
} from '@/types/owner-property-mandate';

process.env.MANDATE_CONSENT_SECRET ??= 'δοκιμαστικό-μυστικό-συγκατάθεσης';

let enqueueSucceeds = true;

jest.mock('@/server/comms/orchestrator', () => ({
  enqueueMessage: jest.fn(async () => ({
    success: enqueueSucceeds,
    messageIds: ['msg_1'],
  })),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createBrokeredListing, OWNER_CONSENT_PROOF } =
  require('@/services/mandate/brokered-listing.service') as typeof import('@/services/mandate/brokered-listing.service');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { resendMandateInvitation } =
  require('@/services/mandate/mandate-actions.service') as typeof import('@/services/mandate/mandate-actions.service');

const NOW = '2026-08-21T10:00:00.000Z';
const OFFICE = 'comp_alfa';
const LISTING = 'ownp_a';
const CLIENT = 'cont_kostas';
const AGENCY = 'ΑΛΦΑ ΜΕΣΙΤΙΚΗ';
const HAS_EMAIL = [{ email: 'kostas@example.gr', isPrimary: true }];
const OLD_NONCE = 'nonce-palio';

const COMPENSATION: MandateCompensation = {
  type: 'percentage',
  percentage: CUSTOMARY_COMMISSION_PERCENTAGE,
  vatIncluded: false,
};

/** Ο κριτής ικανότητας τρέχει **αληθινά** — δες `brokered-listing.test.ts` για το γιατί. */
const AUTHORITY = (() => {
  const verdict = requireBrokerageCapability(OFFICE, {
    brokerage_listings: {
      status: 'active',
      requirements: [],
      declaration: null,
      decidedByUserId: 'user_super',
      decidedAt: '2026-08-20T10:00:00.000Z',
      revocationReason: null,
    },
  });
  if ('denied' in verdict) throw new Error('ο παρονομαστής έσπασε: ενεργή ικανότητα κρίθηκε άρνηση');
  return verdict;
})();

function daysFromNow(days: number): string {
  return new Date(Date.parse(NOW) + days * 24 * 60 * 60 * 1000).toISOString();
}

/** Βάση με **μόνο** την επαφή — η αγγελία θα γεννηθεί από τον αληθινό γραφέα. */
function dbForCreation(emails: unknown): AdminFirestore {
  const fake = new FakeFirestore();
  fake.seed(COLLECTIONS.CONTACTS, CLIENT, {
    type: 'individual',
    firstName: 'Κώστας',
    lastName: 'Παπαδόπουλος',
    emails,
  });
  return fake as unknown as AdminFirestore;
}

/** Βάση με **υπάρχουσα** εντολή — η αφετηρία του «ξαναστείλτε». */
function dbForResend(
  emails: unknown,
  over: Partial<BrokeredListingMandate> = {},
): AdminFirestore {
  const fake = new FakeFirestore();
  fake.seed(COLLECTIONS.CONTACTS, CLIENT, {
    type: 'individual',
    firstName: 'Κώστας',
    lastName: 'Παπαδόπουλος',
    emails,
  });
  const mandate: BrokeredListingMandate = {
    kind: 'brokered',
    clientContactId: CLIENT,
    confirmation: 'pending',
    confirmedByUserId: null,
    proof: { via: OWNER_CONSENT },
    agreement: DEFAULT_LISTING_AGREEMENT,
    compensation: COMPENSATION,
    decidedAt: null,
    notifiedAt: null,
    notifyOutcome: null,
    viewedAt: null,
    consentNonce: OLD_NONCE,
    expiresAt: daysFromNow(120),
    agencyRevokedAt: null,
    agencyCompanyId: OFFICE,
    startsAt: '2026-08-01T09:00:00.000Z',
    scope: ['sell'],
    ...over,
  };
  fake.seed(COLLECTIONS.OWNER_PROPERTIES, LISTING, {
    id: LISTING,
    authorUserId: 'user_maria',
    authorCompanyId: OFFICE,
    mandates: [mandate],
    mandatesExpireAt: mandate.expiresAt,
    title: 'Οικόπεδο Κώστα',
    type: 'plot',
    areaSqm: 1000,
    floor: null,
    bedrooms: null,
    offers: [],
    place: { kind: 'declined' },
    media: [],
    lifecycle: 'listed',
    createdAt: NOW,
    updatedAt: NOW,
  });
  return fake as unknown as AdminFirestore;
}

/** Η **αποθηκευμένη** εντολή — ποτέ η επιστροφή της συνάρτησης. */
async function storedMandate(db: AdminFirestore): Promise<BrokeredListingMandate> {
  const snap = await db.collection(COLLECTIONS.OWNER_PROPERTIES).doc(LISTING).get();
  return (snap.data() as OwnerProperty).mandates[0] as BrokeredListingMandate;
}

async function createWith(db: AdminFirestore): Promise<void> {
  await createBrokeredListing(
    db,
    AUTHORITY,
    { id: LISTING, authorUserId: 'user_maria', agencyName: AGENCY },
    validDraft(),
    {
      clientContactId: CLIENT,
      agreement: DEFAULT_LISTING_AGREEMENT,
      compensation: COMPENSATION,
      expiresAt: daysFromNow(120),
      scope: ['sell'],
      startsAt: '2026-08-01T09:00:00.000Z',
      proof: OWNER_CONSENT_PROOF,
    },
  );
}

beforeEach(() => {
  enqueueSucceeds = true;
});

// ============================================================================
// Δ0 — Ο ΠΑΡΟΝΟΜΑΣΤΗΣ: υπάρχουν τρεις κόσμοι, και ο αναγνώστης τους βλέπει
// ============================================================================

describe('🔑 Δ0 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ του §6.5.δ', () => {
  it('Δ0α — οι εκβάσεις είναι ΤΡΕΙΣ και ΔΙΑΚΡΙΤΕΣ', () => {
    // Χωρίς αυτό, «η αιτία αποθηκεύεται» θα ήταν κενή πρόταση: μία έκβαση δεν
    // ξεχωρίζει από τον εαυτό της, και κάθε ισχυρισμός παρακάτω θα περνούσε.
    expect(new Set<string>(MANDATE_NOTIFY_OUTCOMES).size).toBe(3);
  });

  it('Δ0β — ο αναγνώστης δέχεται και τις τρεις, και ΜΟΝΟ αυτές', () => {
    for (const outcome of MANDATE_NOTIFY_OUTCOMES) {
      expect(isMandateNotifyOutcome(outcome)).toBe(true);
    }
    // ⚠️ Αν ο φρουρός δεχόταν οτιδήποτε, το `Δ4` («η άγνωστη τιμή γίνεται άγνοια»)
    //    θα ήταν πράσινο πάνω σε τίποτα.
    expect(isMandateNotifyOutcome('δεν-εστάλη-ποτέ')).toBe(false);
    expect(isMandateNotifyOutcome(undefined)).toBe(false);
  });
});

// ============================================================================
// Δ1-Δ3 — Η ΓΕΝΝΗΣΗ ΤΗΣ ΕΝΤΟΛΗΣ ΣΦΡΑΓΙΖΕΙ ΤΗΝ ΕΚΒΑΣΗ
// ============================================================================

describe('🔴 Δ — ο γραφέας της καταχώρησης καταγράφει ΓΙΑΤΙ', () => {
  it('🔑 Δ1 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ της γραφής: η επιτυχία σφραγίζει `sent`', async () => {
    // 🔑 **Χωρίς αυτόν, τα Δ2/Δ3 θα ήταν πράσινα πάνω σε πεδίο που ΠΟΤΕ δεν γράφεται.**
    //    Μια υλοποίηση που αγνοεί εντελώς το `notifyOutcome` περνά κάθε
    //    «είναι `no-address`;» με `undefined !== 'failed'`… αν το ερώτημα ήταν
    //    ανισότητα. Εδώ ρωτιέται **ισότητα**, και η αφετηρία είναι αυτή η γραμμή.
    const db = dbForCreation(HAS_EMAIL);
    await createWith(db);

    const mandate = await storedMandate(db);
    expect(notifyOutcomeOf(mandate)).toBe(NOTIFY_SENT);
    expect(mandate.notifiedAt).toEqual(expect.any(String));
  });

  it('🔴 Δ2 — επαφή ΧΩΡΙΣ email ⇒ αποθηκεύεται `no-address`, το `notifiedAt` μένει κενό', async () => {
    const db = dbForCreation([]);
    await createWith(db);

    const mandate = await storedMandate(db);
    expect(notifyOutcomeOf(mandate)).toBe(NOTIFY_NO_ADDRESS);
    // ⚠️ Η αρχή «υποτιμούμε, ποτέ υπερτιμούμε» **δεν χαλάρωσε**: η έκβαση γράφεται,
    //    η σφραγίδα «τον ειδοποιήσαμε» **όχι**.
    expect(mandate.notifiedAt).toBeNull();
  });

  it('🔴 Δ3 — αποτυχία του ΓΡΑΦΕΑ ⇒ αποθηκεύεται `failed`, όχι `no-address`', async () => {
    enqueueSucceeds = false;
    const db = dbForCreation(HAS_EMAIL);
    await createWith(db);

    const mandate = await storedMandate(db);
    expect(notifyOutcomeOf(mandate)).toBe(NOTIFY_FAILED);
    expect(mandate.notifiedAt).toBeNull();
  });

  it('🔴 Δ4 — Η ΓΡΑΜΜΗ ΠΟΥ ΚΛΕΙΝΕΙ ΤΟ ΠΕΡΙΣΤΑΤΙΚΟ: οι δύο αποτυχίες ΔΕΝ είναι μία', async () => {
    // 🔴 **Αυτό ακριβώς ήταν αδύνατο να ρωτηθεί ως τις 2026-08-31.** Και στους δύο
    //    κόσμους η βάση έλεγε `notifiedAt: null` και **τίποτα άλλο** — δηλαδή η οθόνη
    //    δεν είχε τι να διαβάσει, και μάντεψε «δεν είχε email» για επαφή που είχε.
    const withoutEmail = dbForCreation([]);
    await createWith(withoutEmail);

    enqueueSucceeds = false;
    const writerBroke = dbForCreation(HAS_EMAIL);
    await createWith(writerBroke);

    const a = await storedMandate(withoutEmail);
    const b = await storedMandate(writerBroke);

    expect(a.notifiedAt).toEqual(b.notifiedAt);
    expect(notifyOutcomeOf(a)).not.toEqual(notifyOutcomeOf(b));
  });
});

// ============================================================================
// Δ5-Δ6 — Η ΑΓΝΟΙΑ ΜΕΝΕΙ ΑΓΝΟΙΑ
// ============================================================================

describe('🔴 Δ — «δεν ξέρουμε» ΔΕΝ μεταμφιέζεται σε αιτία', () => {
  it('🔴 Δ5 — ΚΛΗΡΟΔΟΤΗΜΕΝΗ εντολή χωρίς το πεδίο ⇒ `null`, όχι σιωπηλή αιτία', () => {
    // ⚠️ Το Firestore δεν ξέρει τους τύπους μας: κάθε εντολή γραμμένη πριν από το
    //    §6.5.δ **δεν έχει καθόλου** το πεδίο. Ένας ισχυρισμός `as` θα έλεγε στην
    //    οθόνη *«η επαφή δεν είχε email»* για τιμή που **κανείς δεν έγραψε**.
    const legacy = { kind: 'brokered' } as unknown as BrokeredListingMandate;
    expect(notifyOutcomeOf(legacy)).toBeNull();
  });

  it('🔴 Δ6 — ΧΑΛΑΣΜΕΝΗ τιμή ⇒ `null` — η βλάβη δεν δικαιούται να ονομάσει αιτία', () => {
    const broken = {
      kind: 'brokered',
      notifyOutcome: 'ναι',
    } as unknown as BrokeredListingMandate;
    expect(notifyOutcomeOf(broken)).toBeNull();
  });
});

// ============================================================================
// Δ7-Δ9 — ΤΟ «ΞΑΝΑΣΤΕΙΛΤΕ» ΣΦΡΑΓΙΖΕΙ ΚΙ ΑΥΤΟ
// ============================================================================

describe('🔴 Δ — το «ξαναστείλτε» καταγράφει ΓΙΑΤΙ δεν ξαναστάλθηκε', () => {
  it('🔑 Δ7 — ο ΠΑΡΟΝΟΜΑΣΤΗΣ: η επιτυχία σφραγίζει `sent` ΚΑΙ ανανεώνει τον σύνδεσμο', async () => {
    const db = dbForResend(HAS_EMAIL);
    const outcome = await resendMandateInvitation(db, LISTING, OFFICE, AGENCY, NOW);

    expect(outcome).toMatchObject({ ok: true });
    const mandate = await storedMandate(db);
    expect(notifyOutcomeOf(mandate)).toBe(NOTIFY_SENT);
    expect(mandate.consentNonce).not.toBe(OLD_NONCE);
  });

  it('🔴 Δ8 — `no-address` σφραγίζεται, και ο ΠΑΛΙΟΣ ΣΥΝΔΕΣΜΟΣ ΜΕΝΕΙ ΖΩΝΤΑΝΟΣ', async () => {
    // 🔑 **Δύο ισχυρισμοί σε μία πράξη, και ο δεύτερος είναι ο κρίσιμος**: η νέα
    //    γραφή **δεν επιτρέπεται** να ακυρώσει τον σύνδεσμο που ο πελάτης κρατά ήδη
    //    στα χέρια του. Καταγράφουμε **μόνο** ό,τι μάθαμε.
    const db = dbForResend([]);
    const outcome = await resendMandateInvitation(db, LISTING, OFFICE, AGENCY, NOW);

    expect(outcome).toEqual({ ok: false, reason: 'no-address' });
    const mandate = await storedMandate(db);
    expect(notifyOutcomeOf(mandate)).toBe(NOTIFY_NO_ADDRESS);
    expect(mandate.consentNonce).toBe(OLD_NONCE);
    expect(mandate.notifiedAt).toBeNull();
  });

  it('🔴 Δ9 — αποτυχία γραφέα ⇒ `failed`, και πάλι χωρίς νέο σύνδεσμο', async () => {
    enqueueSucceeds = false;
    const db = dbForResend(HAS_EMAIL);
    const outcome = await resendMandateInvitation(db, LISTING, OFFICE, AGENCY, NOW);

    expect(outcome).toEqual({ ok: false, reason: 'write-failed' });
    const mandate = await storedMandate(db);
    expect(notifyOutcomeOf(mandate)).toBe(NOTIFY_FAILED);
    expect(mandate.consentNonce).toBe(OLD_NONCE);
  });
});
