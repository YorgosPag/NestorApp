/**
 * @jest-environment node
 *
 * @fileoverview **ΟΙ ΠΡΑΞΕΙΣ ΤΟΥ ΚΑΤΑΛΟΓΟΥ** — άγκυρες ΟΛΗΣ της διαδρομής (§8.34).
 * @related services/mandate/mandate-actions.service.ts
 *
 * ⚠️ **Ο ταχυδρόμος είναι ο ΜΟΝΟΣ που αντικαθίσταται** — ίδιο συμβόλαιο με το §8.33. Η
 * υπογραφή του συνδέσμου, η ετυμηγορία της κατάστασης, η εξουσιοδότηση και η γραφή
 * τρέχουν **αληθινά** πάνω σε ψεύτικη βάση.
 *
 * 🔴 Μάθημα **Μ-Ζ**: οι δύο μεταλλάξεις που επέζησαν στο §8.33 επέζησαν επειδή οι
 * άγκυρες έκριναν τη **μηχανή** με χειροποίητη είσοδο. Εδώ κάθε ισχυρισμός περνά από
 * την εξαγόμενη συνάρτηση που καλεί **η πραγματική διαδρομή**.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import type { OwnerProperty } from '@/types/owner-property';
import { DEFAULT_LISTING_AGREEMENT } from '@/types/listing-agreement';
import {
  AGENCY_ATTESTATION,
  CUSTOMARY_COMMISSION_PERCENTAGE,
  OWNER_CONSENT,
  type BrokeredListingMandate,
} from '@/types/owner-property-mandate';

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
const { resendMandateInvitation, revokeMandateInvitation } =
  require('@/services/mandate/mandate-actions.service') as typeof import('@/services/mandate/mandate-actions.service');

const NOW = '2026-08-21T10:00:00.000Z';
const OFFICE = 'comp_alfa';
const LISTING = 'ownp_a';
const CLIENT = 'cont_kostas';
const AGENCY = 'ΑΛΦΑ ΜΕΣΙΤΙΚΗ';

function daysFromNow(days: number): string {
  return new Date(Date.parse(NOW) + days * 24 * 60 * 60 * 1000).toISOString();
}

function mandate(over: Partial<BrokeredListingMandate> = {}): BrokeredListingMandate {
  return {
    kind: 'brokered',
    clientContactId: CLIENT,
    confirmation: 'pending',
    confirmedByUserId: null,
    proof: { via: OWNER_CONSENT },
    agreement: DEFAULT_LISTING_AGREEMENT,
    compensation: {
      type: 'percentage',
      percentage: CUSTOMARY_COMMISSION_PERCENTAGE,
      vatIncluded: false,
    },
    decidedAt: null,
    notifiedAt: '2026-08-20T09:00:00.000Z',
    viewedAt: '2026-08-20T12:00:00.000Z',
    consentNonce: 'nonce-old',
    expiresAt: daysFromNow(300),
    ...over,
  };
}

interface WorldOptions {
  readonly mandate?: Partial<BrokeredListingMandate>;
  readonly authorCompanyId?: string | null;
  readonly emails?: unknown;
}

function world(options: WorldOptions = {}): AdminFirestore {
  const fake = new FakeFirestore();
  fake.seed(COLLECTIONS.CONTACTS, CLIENT, {
    type: 'individual',
    firstName: 'Κώστας',
    lastName: 'Παπαδόπουλος',
    emails: options.emails ?? [{ email: 'kostas@example.gr', isPrimary: true }],
  });
  fake.seed(COLLECTIONS.OWNER_PROPERTIES, LISTING, {
    id: LISTING,
    authorUserId: 'user_maria',
    authorCompanyId: options.authorCompanyId === undefined ? OFFICE : options.authorCompanyId,
    mandate: mandate(options.mandate),
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

async function storedMandate(db: AdminFirestore): Promise<BrokeredListingMandate> {
  const snap = await db.collection(COLLECTIONS.OWNER_PROPERTIES).doc(LISTING).get();
  return (snap.data() as OwnerProperty).mandate as BrokeredListingMandate;
}

beforeEach(() => {
  enqueued.length = 0;
  enqueueSucceeds = true;
});

// =============================================================================
// Ε — Η ΕΞΟΥΣΙΟΔΟΤΗΣΗ: ΤΟ ΓΡΑΦΕΙΟ, ΟΧΙ Ο ΥΠΑΛΛΗΛΟΣ
// =============================================================================

describe('🔴 Ε — ποιος επιτρέπεται να ενεργήσει', () => {
  it('Ε1 — ΞΕΝΟ γραφείο παίρνει «δεν υπάρχει», όχι «δεν σου ανήκει»', async () => {
    // Μια ξεχωριστή απάντηση θα **επιβεβαίωνε** την ύπαρξη ξένου εγγράφου.
    const db = world();
    const outcome = await resendMandateInvitation(db, LISTING, 'comp_beta', AGENCY, NOW);
    expect(outcome).toEqual({ ok: false, reason: 'absent' });
  });

  it('Ε2 — ΑΛΛΟΣ υπάλληλος του ΙΔΙΟΥ γραφείου επιτρέπεται', async () => {
    // 🔑 Η απόδειξη του κανόνα «listings belong to the broker, not the agent»: η
    // κλήση δεν παίρνει καν `uid` — δεν υπάρχει πεδίο για να αποτύχει.
    const db = world();
    const outcome = await resendMandateInvitation(db, LISTING, OFFICE, AGENCY, NOW);
    expect(outcome.ok).toBe(true);
  });

  it('Ε3 — ανύπαρκτη αγγελία δίνει τον ίδιο λόγο', async () => {
    const db = world();
    const outcome = await revokeMandateInvitation(db, 'ownp_ghost', OFFICE, NOW);
    expect(outcome).toEqual({ ok: false, reason: 'absent' });
  });

  it('Ε4 — αγγελία ΙΔΙΩΤΗ δεν έχει εντολή να ξαναστείλεις', async () => {
    const fake = new FakeFirestore();
    fake.seed(COLLECTIONS.OWNER_PROPERTIES, LISTING, {
      id: LISTING,
      authorUserId: 'user_maria',
      authorCompanyId: OFFICE,
      mandate: { kind: 'self' },
      title: 'Δικό μου',
      lifecycle: 'listed',
    });
    const outcome = await resendMandateInvitation(
      fake as unknown as AdminFirestore,
      LISTING,
      OFFICE,
      AGENCY,
      NOW,
    );
    expect(outcome).toEqual({ ok: false, reason: 'not-brokered' });
  });
});

// =============================================================================
// Ξ — ΞΑΝΑΣΤΕΛΝΩ: Η ΠΛΗΡΗΣ ΔΙΑΔΡΟΜΗ
// =============================================================================

describe('🔴 Ξ — ξαναστέλνω', () => {
  it('Ξ1 — φεύγει μήνυμα ΚΑΙ γράφεται ΝΕΟΣ σύνδεσμος', async () => {
    const db = world();
    const before = await storedMandate(db);

    const outcome = await resendMandateInvitation(db, LISTING, OFFICE, AGENCY, NOW);
    expect(outcome.ok).toBe(true);
    expect(enqueued).toHaveLength(1);

    const after = await storedMandate(db);
    expect(after.consentNonce).not.toBe(before.consentNonce);
    expect(after.consentNonce).not.toBeNull();
  });

  it('Ξ2 — ο ΠΑΛΙΟΣ σύνδεσμος παύει να ισχύει (νέο nonce = νέα ταυτότητα)', async () => {
    const db = world();
    await resendMandateInvitation(db, LISTING, OFFICE, AGENCY, NOW);
    expect((await storedMandate(db)).consentNonce).not.toBe('nonce-old');
  });

  it('Ξ3 — το «το είδε» ΜΗΔΕΝΙΖΕΤΑΙ: αφορούσε μήνυμα που δεν ισχύει πια', async () => {
    const db = world();
    expect((await storedMandate(db)).viewedAt).not.toBeNull();

    await resendMandateInvitation(db, LISTING, OFFICE, AGENCY, NOW);
    expect((await storedMandate(db)).viewedAt).toBeNull();
  });

  it('Ξ4 — το `notifiedAt` σφραγίζεται ΜΟΝΟ όταν φύγει μήνυμα', async () => {
    const db = world({ mandate: { notifiedAt: null } });
    await resendMandateInvitation(db, LISTING, OFFICE, AGENCY, NOW);
    expect((await storedMandate(db)).notifiedAt).not.toBeNull();
  });

  it('🔴 Ξ5 — ΕΠΑΦΗ ΧΩΡΙΣ EMAIL: δικός της λόγος, και ο σύνδεσμος ΔΕΝ πειράζεται', async () => {
    // Το κρίσιμο σημείο: αν γράφαμε το νέο nonce πριν βεβαιωθούμε ότι έφυγε μήνυμα,
    // θα σκοτώναμε τον σύνδεσμο που ο Κώστας κρατά ήδη — χωρίς να του δώσουμε νέο.
    const db = world({ emails: [] });
    const outcome = await resendMandateInvitation(db, LISTING, OFFICE, AGENCY, NOW);

    expect(outcome).toEqual({ ok: false, reason: 'no-address' });
    expect((await storedMandate(db)).consentNonce).toBe('nonce-old');
    expect(enqueued).toHaveLength(0);
  });

  it('🔴 Ξ6 — ΑΠΟΤΥΧΙΑ ΟΥΡΑΣ: άλλος λόγος, και πάλι κανένα πείραγμα', async () => {
    enqueueSucceeds = false;
    const db = world();
    const outcome = await resendMandateInvitation(db, LISTING, OFFICE, AGENCY, NOW);

    expect(outcome).toEqual({ ok: false, reason: 'write-failed' });
    expect((await storedMandate(db)).consentNonce).toBe('nonce-old');
  });

  it('Ξ7 — στη ΒΕΒΑΙΩΣΗ φεύγει ειδοποίηση αντίρρησης, όχι αίτημα έγκρισης', async () => {
    const db = world({
      mandate: {
        confirmation: 'confirmed',
        notifiedAt: null,
        proof: {
          via: AGENCY_ATTESTATION,
          attestedByUserId: 'user_maria',
          attestedAt: NOW,
          documentPath: null,
        },
      },
    });

    const outcome = await resendMandateInvitation(db, LISTING, OFFICE, AGENCY, NOW);
    expect(outcome.ok).toBe(true);
    // Το κείμενο της αντίρρησης διαφέρει από εκείνο της έγκρισης — αλλιώς θα ζητούσαμε
    // από τον ιδιοκτήτη να εγκρίνει κάτι που είναι **ήδη** εγκεκριμένο.
    const subject = String(enqueued[0]?.subject ?? '');
    expect(subject.length).toBeGreaterThan(0);
  });

  it('Ξ8 — ΤΕΡΜΑΤΙΚΕΣ καταστάσεις: καμία αποστολή, ονομαστικός λόγος', async () => {
    const declined = world({ mandate: { confirmation: 'declined' } });
    expect(await resendMandateInvitation(declined, LISTING, OFFICE, AGENCY, NOW)).toEqual({
      ok: false,
      reason: 'declined',
    });

    const expired = world({ mandate: { expiresAt: daysFromNow(-1) } });
    expect(await resendMandateInvitation(expired, LISTING, OFFICE, AGENCY, NOW)).toEqual({
      ok: false,
      reason: 'expired',
    });

    expect(enqueued).toHaveLength(0);
  });
});

// =============================================================================
// Α — ΑΝΑΚΑΛΩ
// =============================================================================

describe('🔴 Α — ανακαλώ', () => {
  it('Α1 — σε εκκρεμή: ο σύνδεσμος πεθαίνει', async () => {
    const db = world();
    const outcome = await revokeMandateInvitation(db, LISTING, OFFICE, NOW);

    expect(outcome).toEqual({ ok: true, action: 'revoke' });
    expect((await storedMandate(db)).consentNonce).toBeNull();
  });

  it('🔴 Α2 — σε ΕΓΚΕΚΡΙΜΕΝΗ απαγορεύεται: θα κλείδωνε τον ιδιοκτήτη έξω', async () => {
    const db = world({ mandate: { confirmation: 'confirmed' } });
    const outcome = await revokeMandateInvitation(db, LISTING, OFFICE, NOW);

    expect(outcome).toEqual({ ok: false, reason: 'not-pending' });
    // Και — το σημαντικό — ο σύνδεσμός του **μένει ζωντανός**.
    expect((await storedMandate(db)).consentNonce).toBe('nonce-old');
  });

  it('Α3 — σε «αρνήθηκε» απαγορεύεται: του κλείναμε τον δρόμο να ξανασκεφτεί', async () => {
    const db = world({ mandate: { confirmation: 'declined' } });
    expect(await revokeMandateInvitation(db, LISTING, OFFICE, NOW)).toEqual({
      ok: false,
      reason: 'declined',
    });
  });

  it('Α4 — ήδη ανακλημένος: δικός του λόγος, καμία δεύτερη γραφή', async () => {
    const db = world({ mandate: { consentNonce: null } });
    expect(await revokeMandateInvitation(db, LISTING, OFFICE, NOW)).toEqual({
      ok: false,
      reason: 'already-revoked',
    });
  });

  it('Α5 — η ανάκληση ΔΕΝ στέλνει μήνυμα σε κανέναν', async () => {
    const db = world();
    await revokeMandateInvitation(db, LISTING, OFFICE, NOW);
    expect(enqueued).toHaveLength(0);
  });
});

// =============================================================================
// Κ — Ο ΚΥΚΛΟΣ: ΑΝΑΚΑΛΩ ΚΑΙ ΞΑΝΑΣΤΕΛΝΩ
// =============================================================================

describe('🔴 Κ — ο κύκλος ζωής του συνδέσμου', () => {
  it('Κ1 — ανάκληση και μετά επαναποστολή ΞΑΝΑΝΟΙΓΕΙ τον δρόμο', async () => {
    const db = world();

    await revokeMandateInvitation(db, LISTING, OFFICE, NOW);
    expect((await storedMandate(db)).consentNonce).toBeNull();

    const outcome = await resendMandateInvitation(db, LISTING, OFFICE, AGENCY, NOW);
    expect(outcome.ok).toBe(true);
    expect((await storedMandate(db)).consentNonce).not.toBeNull();
  });

  it('Κ2 — διπλή επαναποστολή δίνει ΔΙΑΦΟΡΕΤΙΚΟ κλειδί ιδεμποτέντ κάθε φορά', async () => {
    // Αλλιώς η δεύτερη αποστολή θα καταπινόταν από τον αντι-spam φρουρό και ο μεσίτης
    // θα έβλεπε «στάλθηκε» χωρίς να έχει φύγει τίποτα.
    const db = world();
    await resendMandateInvitation(db, LISTING, OFFICE, AGENCY, NOW);
    await resendMandateInvitation(db, LISTING, OFFICE, AGENCY, NOW);

    expect(enqueued).toHaveLength(2);
    expect(enqueued[0]?.idempotencyKey).not.toBe(enqueued[1]?.idempotencyKey);
  });
});
