/**
 * @jest-environment node
 *
 * @fileoverview **«ΤΟ ΕΙΔΕ» ΚΑΙ «ΑΠΑΝΤΗΣΕ»** — άγκυρες των δύο νέων γεγονότων (§8.34).
 * @related services/mandate/mandate-consent.service.ts · services/mandate/mandate-decision-notifier.service.ts
 *
 * 🔴 **Η ΔΙΑΔΡΟΜΗ, ΟΧΙ ΤΟ ΕΝΔΙΑΜΕΣΟ** (μάθημα Μ-Ζ): η ειδοποίηση δεν ελέγχεται
 * καλώντας τον ειδοποιητή με χειροποίητο γεγονός — ελέγχεται εκτελώντας το
 * `recordMandateDecision`, δηλαδή **ό,τι τρέχει όταν ο Κώστας πατά «Εγκρίνω»**. Μια
 * άγκυρα στον ειδοποιητή μόνο θα αποδείκνυε ότι ξέρει να στέλνει· **όχι** ότι κάποιος
 * του δίνει τα σωστά ορίσματα.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';
import type { OwnerProperty } from '@/types/owner-property';
import { DEFAULT_LISTING_AGREEMENT } from '@/types/listing-agreement';
import {
  CUSTOMARY_COMMISSION_PERCENTAGE,
  OWNER_CONSENT,
  type BrokeredListingMandate,
} from '@/types/owner-property-mandate';

process.env.MANDATE_CONSENT_SECRET ??= 'δοκιμαστικό-μυστικό-συγκατάθεσης';

const dispatched: Record<string, unknown>[] = [];

jest.mock('@/server/notifications/notification-orchestrator', () => ({
  dispatchNotification: jest.fn(async (request: Record<string, unknown>) => {
    dispatched.push(request);
    return { success: true, dedupeKey: 'k', skipped: false };
  }),
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { issueMandateConsentLink, markMandateViewed, recordMandateDecision } =
  require('@/services/mandate/mandate-consent.service') as typeof import('@/services/mandate/mandate-consent.service');

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { announceMandateDecision } =
  require('@/services/mandate/mandate-decision-notifier.service') as typeof import('@/services/mandate/mandate-decision-notifier.service');

const NOW = '2026-08-21T10:00:00.000Z';
const LISTING = 'ownp_a';
const CLIENT = 'cont_kostas';

function mandate(
  nonce: string | null,
  over: Partial<BrokeredListingMandate> = {},
): BrokeredListingMandate {
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
    viewedAt: null,
    consentNonce: nonce,
    expiresAt: '2027-08-20T12:00:00.000Z',
    ...over,
  };
}

function world(
  nonce: string | null,
  over: Partial<BrokeredListingMandate> = {},
  authorCompanyId: string | null = 'comp_alfa',
): AdminFirestore {
  const fake = new FakeFirestore();
  fake.seed(COLLECTIONS.CONTACTS, CLIENT, {
    type: 'individual',
    firstName: 'Κώστας',
    lastName: 'Παπαδόπουλος',
  });
  fake.seed(COLLECTIONS.OWNER_PROPERTIES, LISTING, {
    id: LISTING,
    authorUserId: 'user_maria',
    authorCompanyId,
    mandate: mandate(nonce, over),
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

async function stored(db: AdminFirestore): Promise<BrokeredListingMandate> {
  const snap = await db.collection(COLLECTIONS.OWNER_PROPERTIES).doc(LISTING).get();
  return (snap.data() as OwnerProperty).mandate as BrokeredListingMandate;
}

beforeEach(() => {
  dispatched.length = 0;
});

// =============================================================================
// Β — «ΤΟ ΕΙΔΕ»: το `Delivered` του DocuSign
// =============================================================================

describe('🔴 Β — η σφραγίδα «το άνοιξε»', () => {
  it('Β1 — γεννιέται ΚΕΝΗ και γεμίζει με την πρώτη ματιά', async () => {
    const db = world('nonce-1');
    expect((await stored(db)).viewedAt).toBeNull();

    await markMandateViewed(db, LISTING);
    expect((await stored(db)).viewedAt).not.toBeNull();
  });

  it('🔴 Β2 — ΙΔΕΜΠΟΤΕΝΤ: η δεύτερη ματιά ΔΕΝ ξαναγράφει', async () => {
    // Η **πρώτη** ματιά είναι το γεγονός. Αν κάθε φόρτωση ξανάγραφε, το πεδίο θα
    // έλεγε «πότε το είδε τελευταία» — άλλο πράγμα — και κάθε refresh θα ήταν εγγραφή.
    const db = world('nonce-1');
    await markMandateViewed(db, LISTING);
    const first = (await stored(db)).viewedAt;

    await markMandateViewed(db, LISTING);
    expect((await stored(db)).viewedAt).toBe(first);
  });

  it('Β3 — αγγελία ΙΔΙΩΤΗ αγνοείται σιωπηλά (δεν έχει εντολή να δει κανείς)', async () => {
    const fake = new FakeFirestore();
    fake.seed(COLLECTIONS.OWNER_PROPERTIES, LISTING, {
      id: LISTING,
      authorUserId: 'u',
      authorCompanyId: null,
      mandate: { kind: 'self' },
      title: 'Δικό μου',
      lifecycle: 'listed',
    });
    await expect(
      markMandateViewed(fake as unknown as AdminFirestore, LISTING),
    ).resolves.toBeUndefined();
  });

  it('🔴 Β4 — ΔΕΝ ΠΕΤΑ ΠΟΤΕ: μια αποτυχία δεν εμποδίζει τον ιδιοκτήτη να απαντήσει', async () => {
    const fake = new FakeFirestore();
    fake.failReads = true;
    await expect(
      markMandateViewed(fake as unknown as AdminFirestore, LISTING),
    ).resolves.toBeUndefined();
  });
});

// =============================================================================
// Ε — Η ΕΙΔΟΠΟΙΗΣΗ ΤΟΥ ΓΡΑΦΕΙΟΥ, ΜΕΣΑ ΑΠΟ ΤΗΝ ΠΡΑΓΜΑΤΙΚΗ ΔΙΑΔΡΟΜΗ
// =============================================================================

describe('🔴 Ε — «ο Κώστας απάντησε»', () => {
  it('Ε1 — η ΕΓΚΡΙΣΗ ειδοποιεί τον υπάλληλο που καταχώρησε', async () => {
    const link = issueMandateConsentLink(LISTING, CLIENT);
    const db = world(link.nonce);

    const outcome = await recordMandateDecision(db, link.token, 'confirmed');
    expect(outcome).toEqual({ ok: true, decision: 'confirmed' });

    expect(dispatched).toHaveLength(1);
    expect(dispatched[0]?.recipientId).toBe('user_maria');
    expect(dispatched[0]?.tenantId).toBe('comp_alfa');
    expect(dispatched[0]?.titleKey).toBe('mandateDecision.confirmedTitle');
  });

  it('Ε2 — η ΑΡΝΗΣΗ ειδοποιεί κι αυτή, με άλλο κείμενο', async () => {
    const link = issueMandateConsentLink(LISTING, CLIENT);
    const db = world(link.nonce);

    await recordMandateDecision(db, link.token, 'declined');
    expect(dispatched[0]?.titleKey).toBe('mandateDecision.declinedTitle');
  });

  it('🔴 Ε3 — Η ΙΔΙΑ ΑΠΑΝΤΗΣΗ ΞΑΝΑ: ΚΑΜΙΑ δεύτερη ειδοποίηση', async () => {
    // Ο σύνδεσμος δεν καίγεται μετά τη χρήση (§8.33), άρα ο Κώστας μπορεί να πατήσει
    // «Εγκρίνω» δέκα φορές. Ένας αφελής ειδοποιητής θα έστελνε δέκα μηνύματα.
    const link = issueMandateConsentLink(LISTING, CLIENT);
    const db = world(link.nonce);

    await recordMandateDecision(db, link.token, 'confirmed');
    await recordMandateDecision(db, link.token, 'confirmed');
    await recordMandateDecision(db, link.token, 'confirmed');

    expect(dispatched).toHaveLength(1);
  });

  it('🔴 Ε4 — Η ΑΛΛΑΓΗ ΓΝΩΜΗΣ ΦΤΑΝΕΙ: «ναι» και μετά «όχι» ειδοποιεί δύο φορές', async () => {
    // Το άλλο μισό του Ε3, και το πιο σημαντικό: ένας φρουρός που έκοβε **κάθε**
    // επανάληψη θα έκρυβε ακριβώς την ανάκληση που το §8.33 προστατεύει ρητά.
    const link = issueMandateConsentLink(LISTING, CLIENT);
    const db = world(link.nonce);

    await recordMandateDecision(db, link.token, 'confirmed');
    await recordMandateDecision(db, link.token, 'declined');

    expect(dispatched).toHaveLength(2);
    expect(dispatched[1]?.titleKey).toBe('mandateDecision.declinedTitle');
  });

  it('Ε5 — τα δύο μηνύματα έχουν ΔΙΑΦΟΡΕΤΙΚΟ κλειδί γεγονότος', async () => {
    // Αλλιώς το idempotency του αγωγού θα κατάπινε το δεύτερο.
    const link = issueMandateConsentLink(LISTING, CLIENT);
    const db = world(link.nonce);

    await recordMandateDecision(db, link.token, 'confirmed');
    await recordMandateDecision(db, link.token, 'declined');

    expect(dispatched[0]?.eventId).not.toBe(dispatched[1]?.eventId);
  });

  it('🔴 Ε5β — ΤΟ ΙΔΙΟ ΧΙΛΙΟΣΤΟ: δύο μεταβάσεις, δύο κλειδιά — ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΑ', async () => {
    // 🔴 **Αυτή η άγκυρα γεννήθηκε από ΑΣΤΑΘΕΙΑ, και η αστάθεια ήταν ΕΛΑΤΤΩΜΑ.** Το
    // `Ε5` κοκκίνιζε **δύο στις τέσσερις** εκτελέσεις: όταν οι δύο αποφάσεις έπεφταν
    // στο ίδιο χιλιοστό, το κλειδί γεγονότος —που κουβαλούσε **μόνο** το `decidedAt`—
    // ήταν ταυτόσημο, και το idempotency του αγωγού κατάπινε τη **δεύτερη**
    // ειδοποίηση. Το γραφείο **δεν θα μάθαινε ποτέ** ότι ο πελάτης άλλαξε γνώμη.
    //
    // Εδώ ο χρόνος είναι **καρφωμένος και ίδιος**, ώστε η περίπτωση να δοκιμάζεται
    // **πάντα** — όχι όταν τύχει να προλάβει το ρολόι.
    const db = world('nonce-1');
    const SAME_MS = '2026-08-21T10:00:00.000Z';

    const base = {
      ownerPropertyId: LISTING,
      listingTitle: 'Οικόπεδο Κώστα',
      clientContactId: CLIENT,
      recipientUserId: 'user_maria',
      tenantId: 'comp_alfa',
      decidedAt: SAME_MS,
    } as const;

    await announceMandateDecision(db, { ...base, previous: 'pending', next: 'confirmed' });
    await announceMandateDecision(db, { ...base, previous: 'confirmed', next: 'declined' });

    expect(dispatched).toHaveLength(2);
    expect(dispatched[0]?.eventId).not.toBe(dispatched[1]?.eventId);
  });

  it('Ε5γ — και ο φρουρός αλλαγής κάνει την ΤΑΥΤΟΣΗΜΗ μετάβαση αδύνατη', async () => {
    // Η άλλη μισή απόδειξη: το κλειδί δεν χρειάζεται να είναι μοναδικό για **κάθε**
    // ζεύγος (μετάβαση, χρόνος) — αρκεί να είναι, γιατί η ίδια μετάβαση δεν μπορεί να
    // ειδοποιήσει δύο φορές στη σειρά.
    const db = world('nonce-1');
    const event = {
      ownerPropertyId: LISTING,
      listingTitle: 'Οικόπεδο Κώστα',
      clientContactId: CLIENT,
      recipientUserId: 'user_maria',
      tenantId: 'comp_alfa',
      decidedAt: '2026-08-21T10:00:00.000Z',
      previous: 'confirmed',
      next: 'confirmed',
    } as const;

    expect(await announceMandateDecision(db, event)).toBe(false);
    expect(dispatched).toHaveLength(0);
  });

  it('Ε6 — αγγελία ΧΩΡΙΣ εταιρεία δεν στέλνει τίποτα, και δεν σκάει', async () => {
    const link = issueMandateConsentLink(LISTING, CLIENT);
    const db = world(link.nonce, {}, null);

    const outcome = await recordMandateDecision(db, link.token, 'confirmed');
    expect(outcome).toEqual({ ok: true, decision: 'confirmed' });
    expect(dispatched).toHaveLength(0);
  });

  it('🔴 Ε7 — ΑΠΟΡΡΙΦΘΕΝΤΑΣ σύνδεσμος: καμία γραφή, καμία ειδοποίηση', async () => {
    const stale = issueMandateConsentLink(LISTING, CLIENT);
    const db = world('nonce-κάποιο-άλλο');

    const outcome = await recordMandateDecision(db, stale.token, 'confirmed');
    expect(outcome.ok).toBe(false);
    expect(dispatched).toHaveLength(0);
    expect((await stored(db)).confirmation).toBe('pending');
  });
});
