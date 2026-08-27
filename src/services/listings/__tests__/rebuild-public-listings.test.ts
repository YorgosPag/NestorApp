/**
 * @fileoverview **Η ΛΙΣΤΑ ΕΠΙΖΩΝΤΩΝ** — ποιος γλιτώνει τη σάρωση ορφανών.
 * @related ADR-777 Α3/Α5/Α14 · services/listings/rebuild-public-listings.service.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΥΛΑΕΙ, ΚΑΙ ΓΙΑΤΙ ΚΑΜΙΑ ΑΓΚΥΡΑ ΔΕΝ ΤΟ ΦΥΛΑΓΕ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `public_listings` δέχεται προβολές από **δύο** οικογένειες: `properties`
 * (επαγγελματίας) και `owner_properties` (ιδιώτης). Η επανασύνθεση σάρωνε **μόνο**
 * την πρώτη, και μετά **σβήνει** κάθε προβολή που δεν συνάντησε.
 *
 * Μετρημένο ζωντανά στον emulator με τον κώδικα του `699e88b1`:
 *
 * ```
 * { "scannedProperties": 3, "orphansRemoved": 3, "balanced": true }
 * αγγελίες ιδιώτη που έμειναν: 0
 * ```
 *
 * **Έσβησε και τις τρεις, και το ανέφερε `balanced: true`.**
 *
 * ⚠️ **Η βλάβη ήταν αδοκίμαστη ΕΞ ΟΡΙΣΜΟΥ**: η λογική ζούσε μέσα στη διαδρομή και
 * καλούσε η ίδια το `getAdminFirestore()`. Η εξαγωγή στην υπηρεσία **είναι** η
 * προϋπόθεση αυτού του αρχείου — γι' αυτό έγινε.
 *
 * 🔑 **Ο ψεύτικος Firestore είναι σκόπιμα ΧΑΖΟΣ**: τρεις συλλογές, `get()`,
 * `ref.delete()`. Δεν προσομοιώνει ερωτήματα, γιατί η ερώτηση δεν είναι «*δουλεύει
 * το Firestore;*» αλλά «*ποιον θεωρεί ζωντανό αυτή η πράξη;*».
 */

import { COLLECTIONS } from '@/config/firestore-collections';

import { rebuildAllPublicListings } from '../rebuild-public-listings.service';

// ⚠️ Οι δύο πραγματικοί γραφείς **δεν** τρέχουν εδώ: η ερώτηση είναι η **σάρωση**,
//    όχι η προβολή. Αν έτρεχαν, το test θα χρειαζόταν βάση — δηλαδή θα ξαναγινόταν
//    αδοκίμαστο, ακριβώς όπως ήταν.
jest.mock('@/services/listings/publish-public-listing', () => ({
  republishListing: jest.fn(async () => 'published'),
}));
jest.mock('@/services/owner-property/owner-property-publication.service', () => ({
  republishOwnerProperty: jest.fn(async () => ({ publish: 'published', property: {} })),
}));

const PRO = 'prop_epaggelmatias';
const OWNER = 'ownp_idiotis';
const GHOST = 'prop_diagrammeno';

interface FakeDoc {
  readonly id: string;
  data(): unknown;
  readonly ref: { delete: jest.Mock };
}

function docOf(id: string, data: unknown): FakeDoc {
  return { id, data: () => data, ref: { delete: jest.fn(async () => undefined) } };
}

/** Ένα ακίνητο που **δικαιούται** δημοσίευση — αλλιώς δεν υπάρχει τι να σωθεί. */
const LISTABLE = {
  name: 'Διαμέρισμα',
  type: 'apartment',
  commercialStatus: 'for-sale',
  offerKinds: ['sell'],
  commercial: { askingPrice: 200_000 },
  areas: { gross: 90 },
};

function fakeDb(listingIds: readonly string[]) {
  const listings = listingIds.map((id) => docOf(id, {}));

  const collections: Record<string, readonly FakeDoc[]> = {
    [COLLECTIONS.PROPERTIES]: [docOf(PRO, LISTABLE)],
    [COLLECTIONS.OWNER_PROPERTIES]: [
      docOf(OWNER, {
        id: OWNER,
        title: 'Το διαμέρισμά μου',
        type: 'apartment',
        areaSqm: 90,
        floor: 1,
        bedrooms: 2,
        offers: [{ id: 'offr_a', kind: 'sell', lifecycle: 'active', askingPrice: 200_000 }],
        place: { kind: 'declared', point: { lat: 40, lng: 22 }, label: 'Οδός', accuracy: 'exact', link: null },
        media: [],
        lifecycle: 'listed',
        mandate: { kind: 'self' },
        authorUserId: 'u1',
        authorCompanyId: null,
        createdAt: '2026-08-27T00:00:00.000Z',
        updatedAt: '2026-08-27T00:00:00.000Z',
      }),
    ],
    [COLLECTIONS.PUBLIC_LISTINGS]: listings,
  };

  const db = {
    collection: (name: string) => ({
      get: async () => {
        const docs = collections[name] ?? [];
        return { docs, size: docs.length };
      },
    }),
  };

  return { db, listings };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- ψεύτικος Firestore· ο τύπος του SDK δεν είναι το υπό δοκιμή
const asDb = (db: unknown) => db as any;

function deleted(listings: readonly FakeDoc[]): readonly string[] {
  return listings.filter((d) => d.ref.delete.mock.calls.length > 0).map((d) => d.id);
}

// =============================================================================
// Κ1 — Η ΑΓΓΕΛΙΑ ΤΟΥ ΙΔΙΩΤΗ ΕΠΙΖΕΙ ΤΗΣ ΣΑΡΩΣΗΣ
// =============================================================================

describe('Κ1 — και οι δύο οικογένειες είναι στη λίστα επιζώντων', () => {
  /**
   * 🔴 **Η ΑΓΚΥΡΑ ΤΟΥ ΠΕΡΙΣΤΑΤΙΚΟΥ.**
   *
   * ⛔ ΜΕΤΑΛΛΑΞΗ: βγάλε τον βρόχο του `owner_properties` (ή μόνο το
   * `liveIds.add(doc.id)` μέσα του) ⇒ **κόκκινο**: η αγγελία του ιδιώτη
   * διαγράφεται ως «ορφανή».
   */
  it('πραγματική εκτέλεση — καμία αγγελία ιδιώτη δεν διαγράφεται', async () => {
    const { db, listings } = fakeDb([PRO, OWNER]);

    const report = await rebuildAllPublicListings(asDb(db), false);

    expect(deleted(listings)).toEqual([]);
    expect(report.orphansRemoved).toBe(0);
    expect(report.scannedOwnerProperties).toBe(1);
  });

  /**
   * ⚠️ **Και στη ΣΤΕΓΝΗ εκτέλεση** — εκεί κρίνεται τι θα *έλεγε* στον άνθρωπο.
   * Μια στεγνή εκτέλεση που αναφέρει «3 ορφανές» τον πείθει να τρέξει το `POST`.
   */
  it('στεγνή εκτέλεση — δεν αναφέρει τον ιδιώτη ως ορφανό', async () => {
    const { db, listings } = fakeDb([PRO, OWNER]);

    const report = await rebuildAllPublicListings(asDb(db), true);

    expect(report.orphansRemoved).toBe(0);
    expect(deleted(listings)).toEqual([]);
  });

  /**
   * ✅ **Ο ΠΑΡΟΝΟΜΑΣΤΗΣ — η σάρωση ΕΞΑΚΟΛΟΥΘΕΙ να σβήνει ό,τι πρέπει.**
   *
   * Χωρίς αυτόν, τα δύο από πάνω θα ήταν πράσινα και αν η σάρωση **δεν έσβηνε
   * ποτέ τίποτα** — δηλαδή αν είχαμε «διορθώσει» τη ζημιά καταργώντας τον σκοπό
   * της πράξης. Μια προβολή χωρίς υποκείμενο σε **καμία** από τις δύο οικογένειες
   * είναι δημόσια ορατή αγγελία που δεν αντιστοιχεί σε τίποτα.
   */
  it('προβολή χωρίς υποκείμενο ΔΙΑΓΡΑΦΕΤΑΙ — η σάρωση δεν αχρηστεύτηκε', async () => {
    const { db, listings } = fakeDb([PRO, OWNER, GHOST]);

    const report = await rebuildAllPublicListings(asDb(db), false);

    expect(deleted(listings)).toEqual([GHOST]);
    expect(report.orphansRemoved).toBe(1);
  });
});

// =============================================================================
// Κ2 — Η ΛΟΓΙΣΤΙΚΗ ΚΛΕΙΝΕΙ ΠΑΝΩ ΣΤΟ ΣΩΣΤΟ ΣΥΜΠΑΝ
// =============================================================================

describe('Κ2 — το `balanced` μετρά ΚΑΙ τις δύο οικογένειες', () => {
  /**
   * 🔑 **Το ελάττωμα δεν φαινόταν στη λογιστική — ΓΙ' ΑΥΤΟ επέζησε.** Με μηδέν
   * αγγελίες ιδιώτη σαρωμένες, το άθροισμα εξακολουθούσε να κλείνει: `balanced:
   * true` πάνω σε πράξη που μόλις είχε σβήσει τη μισή δημόσια αγορά.
   *
   * ⛔ ΜΕΤΑΛΛΑΞΗ: γύρνα το `balanced` σε `… === scanned` (χωρίς το `scannedOwner`)
   * ⇒ **κόκκινο**.
   */
  it('το άθροισμα κλείνει μόνο όταν μετρηθούν και οι δύο', async () => {
    const { db } = fakeDb([PRO, OWNER]);

    const report = await rebuildAllPublicListings(asDb(db), false);

    expect(report.scannedProperties).toBe(1);
    expect(report.scannedOwnerProperties).toBe(1);
    expect(report.published + report.withdrawn + report.failed).toBe(2);
    expect(report.balanced).toBe(true);
  });
});
