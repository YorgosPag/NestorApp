/**
 * ADR-777 §8.74 — ο ΕΝΑΣ γραφέας της αποθήκευσης: «στην αγορά;» · «δική σου;» · μία φορά · σβήνεται.
 *
 * 🔑 Κάθε άγκυρα μετρά την **παρενέργεια** (τι έμεινε στη συλλογή), όχι μόνο το αποτέλεσμα: ένας
 * γραφέας που απαντούσε `own-listing` αλλά έγραφε έγγραφο θα ήταν πράσινος σε άγκυρα αποτελέσματος.
 */

import { COLLECTIONS } from '@/config/firestore-collections';
import type { AdminFirestore } from '@/lib/api/guarded-route';
import type { ListingResolution } from '@/services/listings/listing-resolver';
import { FakeFirestore } from '@/services/places/__tests__/fake-firestore';
import type { SavedListing } from '@/types/saved-listing';

const mockResolveListing = jest.fn<Promise<ListingResolution>, [unknown, string, string]>();
jest.mock('@/services/listings/listing-resolver', () => ({
  resolveListing: (...args: [unknown, string, string]) => mockResolveListing(...args),
}));
// Ο γραφέας δεν κρίνει ΣΧΗΜΑ αγγελίας — εκείνο έχει δικές του άγκυρες. Εδώ αρκεί «υπάρχει, με τιμή».
jest.mock('@/lib/listings/public-listing-from-document', () => ({
  publicListingFromDocument: (raw: unknown) =>
    typeof raw === 'object' && raw !== null && 'commercial' in raw ? raw : null,
}));

import {
  readSavedListingRows,
  readSavesOfListings,
  saveListing,
  unsaveListing,
} from '../saved-listing.service';

const LISTING = 'ownp_listing_0001';
const OTHER = 'ownp_listing_0002';
const OWNER_UID = 'uid-owner';
const SAVER = { uid: 'uid-saver', companyId: null } as const;
const NOW = Date.parse('2026-10-10T09:00:00Z');

const fake = new FakeFirestore();
const db = fake as unknown as AdminFirestore;

function listingDoc(id: string, askingPrice: number, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    commercialStatus: 'for-sale',
    commercial: { askingPrice, finalPrice: null, rentPrice: null, nightlyRate: null },
    offerKinds: ['sell'],
    title: id,
    ...over,
  };
}

function saves(): SavedListing[] {
  return fake.all<SavedListing>(COLLECTIONS.SAVED_LISTINGS);
}

beforeEach(() => {
  fake.reset();
  fake.seed(COLLECTIONS.PUBLIC_LISTINGS, LISTING, listingDoc(LISTING, 200_000));
  mockResolveListing.mockReset();
  mockResolveListing.mockResolvedValue({
    family: 'owner', custody: { kind: 'personal', userId: OWNER_UID }, facts: null,
  } as unknown as ListingResolution);
});

describe('Α1 — κράτα: ΕΝΑ έγγραφο, με την τιμή που είδε', () => {
  it('γράφει έγγραφο με τον αποθηκεύοντα και την τιμή της στιγμής', async () => {
    expect(await saveListing(db, SAVER, LISTING, NOW)).toBe('saved');
    expect(saves()).toEqual([
      expect.objectContaining({
        saverUserId: SAVER.uid,
        listingId: LISTING,
        savedAt: new Date(NOW).toISOString(),
        priceAtSave: { role: 'sale', amount: 200_000 },
      }),
    ]);
  });

  it('δεύτερο κλικ ⇒ «saved», ΚΑΝΕΝΑ δεύτερο έγγραφο, η πρώτη τιμή ΔΕΝ ξαναγράφεται', async () => {
    await saveListing(db, SAVER, LISTING, NOW);
    fake.seed(COLLECTIONS.PUBLIC_LISTINGS, LISTING, listingDoc(LISTING, 180_000));
    expect(await saveListing(db, SAVER, LISTING, NOW + 60_000)).toBe('saved');
    expect(saves()).toHaveLength(1);
    expect(saves()[0]?.priceAtSave).toEqual({ role: 'sale', amount: 200_000 });
  });

  it('δύο ΤΑΥΤΟΧΡΟΝΑ κλικ ⇒ ακριβώς ένα έγγραφο', async () => {
    const outcomes = await Promise.all([saveListing(db, SAVER, LISTING, NOW), saveListing(db, SAVER, LISTING, NOW)]);
    expect(outcomes).toEqual(['saved', 'saved']);
    expect(saves()).toHaveLength(1);
  });
});

describe('Α2 — οι δύο ερωτήσεις πριν από κάθε αποθήκευση', () => {
  it('εκτός αγοράς ⇒ not-in-market, κανένα έγγραφο', async () => {
    expect(await saveListing(db, SAVER, OTHER, NOW)).toBe('not-in-market');
    expect(saves()).toHaveLength(0);
  });

  it('🔴 ο ΚΑΤΟΧΟΣ ⇒ own-listing, κανένα έγγραφο (αλλιώς φουσκώνει τη δική του μετρική)', async () => {
    expect(await saveListing(db, { uid: OWNER_UID, companyId: null }, LISTING, NOW)).toBe('own-listing');
    expect(saves()).toHaveLength(0);
  });

  it('βλάβη του κριτή ⇒ unavailable, ΠΟΤΕ «αποθήκευσε για σιγουριά»', async () => {
    mockResolveListing.mockResolvedValue(null);
    expect(await saveListing(db, SAVER, LISTING, NOW)).toBe('unavailable');
    expect(saves()).toHaveLength(0);
  });
});

describe('Α3 — άφησε: το έγγραφο ΣΒΗΝΕΤΑΙ, ιδεμπότητα', () => {
  it('σβήνει το έγγραφο · δεύτερη αφαίρεση δεν πετά', async () => {
    await saveListing(db, SAVER, LISTING, NOW);
    await unsaveListing(db, SAVER.uid, LISTING);
    expect(saves()).toHaveLength(0);
    await expect(unsaveListing(db, SAVER.uid, LISTING)).resolves.toBeUndefined();
  });

  it('αφαίρεση αγγελίας που ΑΠΟΣΥΡΘΗΚΕ ⇒ επιτρέπεται (η έξοδος δεν κλειδώνεται)', async () => {
    await saveListing(db, SAVER, LISTING, NOW);
    fake.reset();
    await expect(unsaveListing(db, SAVER.uid, LISTING)).resolves.toBeUndefined();
  });
});

describe('Α4 — η λίστα: τρέχουσα αγγελία, «από τότε», εκτός αγοράς', () => {
  it('μείωση από την αποθήκευση · αποσυρμένη μένει ως withdrawn · νεότερη πρώτη', async () => {
    fake.seed(COLLECTIONS.PUBLIC_LISTINGS, OTHER, listingDoc(OTHER, 300_000));
    await saveListing(db, SAVER, LISTING, NOW);
    await saveListing(db, SAVER, OTHER, NOW + 1000);
    fake.seed(COLLECTIONS.PUBLIC_LISTINGS, LISTING, listingDoc(LISTING, 180_000));
    await fake.collection(COLLECTIONS.PUBLIC_LISTINGS).doc(OTHER).delete();

    const { rows, truncated } = await readSavedListingRows(db, SAVER.uid);
    expect(truncated).toBe(false);
    expect(rows.map((row) => [row.listingId, row.kind])).toEqual([[OTHER, 'withdrawn'], [LISTING, 'in-market']]);
    const kept = rows[1];
    expect(kept?.kind === 'in-market' && kept.priceSinceSave).toEqual({ kind: 'reduced', from: 200_000, to: 180_000 });
  });

  it('ξένες αποθηκεύσεις ΔΕΝ εμφανίζονται', async () => {
    await saveListing(db, { uid: 'uid-other', companyId: null }, LISTING, NOW);
    expect((await readSavedListingRows(db, SAVER.uid)).rows).toEqual([]);
  });
});

describe('Α5 — «πόσοι κράτησαν»: άγνωστο ≠ μηδέν', () => {
  it('μετρά όλους τους αποθηκεύοντες της αγγελίας', async () => {
    await saveListing(db, SAVER, LISTING, NOW);
    await saveListing(db, { uid: 'uid-b', companyId: null }, LISTING, NOW);
    expect(await readSavesOfListings(db, [LISTING])).toHaveLength(2);
  });

  it('βλάβη ανάγνωσης ⇒ null, ΠΟΤΕ []', async () => {
    fake.failReads = true;
    expect(await readSavesOfListings(db, [LISTING])).toBeNull();
  });
});
