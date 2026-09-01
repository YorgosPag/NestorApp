/**
 * @fileoverview **Η ΚΛΗΣΗ ΠΟΥ ΕΛΕΙΠΕ** — ρωτά ο γραφέας των έργων ποιος δημοσιεύει;
 * @related ADR-841 §7 (Α1) · services/listings/publish-public-listing.ts
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΙ ΦΥΛΑΕΙ, ΚΑΙ ΓΙΑΤΙ 494 ΠΡΑΣΙΝΑ ΔΕΝ ΤΟ ΕΒΛΕΠΑΝ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Μέχρι τις 2026-09-01 **κάθε** αγγελία έργου έγραφε `agencyName: null` και η δημόσια
 * κάρτα έλεγε *«Από μεσιτικό γραφείο»* — χωρίς επωνυμία. Και **δεν έλειπε μηχανή**:
 *
 *   είσοδος ✅ · μεταφορά ✅ · αναγνώστης ✅ · οθόνη ✅ · **η κλήση** 🔴
 *
 * Οι υπάρχουσες άγκυρες δοκίμαζαν τη **μεταφορά** (*«αν σου δώσω επωνυμία, τη
 * γράφεις;»*) — και ήταν πράσινες, σωστά. **Καμία** δεν ρωτούσε το μόνο που είχε
 * σημασία: *«**ρωτάει** κανείς;»*. Αυτό το αρχείο ρωτά **αυτό**, και μόνο αυτό.
 *
 * ⚠️ **Μετάλλαξη που πρέπει να κοκκινίζει**: σβήσε το `resolveAgency(property.companyId)`
 * από το `republishListing` ⇒ Α1 · Α3 · Γ1 · Γ2 πέφτουν. Σβήσε τον **κοινό** επιλυτή
 * από τον βρόχο του έργου ⇒ πέφτει **μόνο** το Β1 *(η μέτρηση κόστους)*, που είναι
 * ακριβώς η διάκριση που θέλουμε: «σωστό» και «μία φορά» είναι δύο ερωτήσεις.
 *
 * 🔑 **Ο ψεύτικος Firestore είναι σκόπιμα ΧΑΖΟΣ** — ίδιο ιδίωμα με το
 * `rebuild-public-listings.test.ts`: μετράει **ποιος ρωτήθηκε** και κρατά **τι
 * γράφτηκε**. Δεν προσομοιώνει τη βάση, γιατί η ερώτηση δεν είναι «δουλεύει το
 * Firestore;».
 */

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import type { OwnerProperty } from '@/types/owner-property';
import type { PublicListing } from '@/types/public-listing';
import { brokeredOwnerProperty } from '@/lib/owner-property/__tests__/owner-property-fixtures';
import {
  republishListing,
  republishListingsForProject,
  type ListingSourceProperty,
} from '../publish-public-listing';
import { republishListingsForCompany } from '../rebuild-public-listings.service';

// ============================================================================
// Ο ΨΕΥΤΙΚΟΣ FIRESTORE — μετράει αναγνώσεις, κρατά γραφές
// ============================================================================

const AT = '2026-09-01T12:00:00.000Z';
/** Η ίδια ταυτότητα που δηλώνει το `brokeredOwnerProperty` — μία αλήθεια, όχι δύο. */
const ALFA = 'comp_alfa';
const PROJECT = 'proj_ena';

type Row = Record<string, unknown>;
type Seed = Record<string, Record<string, Row>>;

interface FakeStore {
  readonly db: AdminFirestore;
  /** Κάθε **σημειακή** ανάγνωση, ως `συλλογή/ταυτότητα` — ο μετρητής του κόστους. */
  readonly reads: string[];
  /** Ό,τι γράφτηκε στο `public_listings`, κατά ταυτότητα. */
  readonly written: Map<string, PublicListing>;
  readonly deleted: string[];
}

function fakeStore(seed: Seed): FakeStore {
  const reads: string[] = [];
  const written = new Map<string, PublicListing>();
  const deleted: string[] = [];

  const rowsOf = (name: string): Record<string, Row> => seed[name] ?? {};

  const docsOf = (name: string, rows: Record<string, Row>) =>
    Object.entries(rows).map(([id, data]) => ({
      id,
      data: () => data,
      ref: { delete: async () => void deleted.push(`${name}/${id}`) },
    }));

  const collection = (name: string) => ({
    doc: (id: string) => ({
      get: async () => {
        reads.push(`${name}/${id}`);
        const row = rowsOf(name)[id];
        return { exists: row !== undefined, data: () => row };
      },
      set: async (value: unknown) => {
        written.set(id, value as PublicListing);
      },
      update: async () => undefined,
      delete: async () => void deleted.push(`${name}/${id}`),
    }),
    where: (field: string, _op: string, value: unknown) => ({
      get: async () => {
        const rows = Object.fromEntries(
          Object.entries(rowsOf(name)).filter(([, row]) => row[field] === value),
        );
        const docs = docsOf(name, rows);
        return { docs, size: docs.length };
      },
    }),
    get: async () => {
      const docs = docsOf(name, rowsOf(name));
      return { docs, size: docs.length };
    },
  });

  return { db: { collection } as unknown as AdminFirestore, reads, written, deleted };
}

/** Ένα ακίνητο έργου που **δικαιούται** δημοσίευση — αλλιώς δεν υπάρχει τι να δούμε. */
function listableProperty(over: Row = {}): Row {
  return {
    name: 'Διαμέρισμα',
    type: 'apartment',
    commercialStatus: 'for-sale',
    offerKinds: ['sell'],
    commercial: { askingPrice: 200_000 },
    areas: { gross: 90 },
    companyId: ALFA,
    projectId: PROJECT,
    ...over,
  };
}

/**
 * Μια αγγελία ιδιώτη **με ενεργή εντολή** στο γραφείο — η **δεύτερη** οικογένεια.
 *
 * 🔑 **Το fixture ΔΕΝ ξαναγράφεται εδώ**: χρησιμοποιείται το ζωντανό
 * `owner-property-fixtures`, το ίδιο που φυλάει τις άγκυρες της εντολής. Ένα δικό μας
 * αντίγραφο θα ήταν ελεύθερο να αποκλίνει — και θα «περνούσε» με έγγραφο που ο
 * πραγματικός κριτής (`isOwnerPropertyOnTheMarket`) δεν θα δεχόταν ποτέ.
 */
function brokeredListedByAlfa(): OwnerProperty {
  return brokeredOwnerProperty({ confirmation: 'confirmed', decidedAt: AT });
}

const COMPANY_ALFA = { name: 'ΑΛΦΑ ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ Α.Ε.' };

// ============================================================================
// Α — Ο ΓΡΑΦΕΑΣ ΤΩΝ ΕΡΓΩΝ **ΡΩΤΑΕΙ**
// ============================================================================

describe('🔴 Α — ο γραφέας των έργων ρωτάει ΠΟΙΟΣ δημοσιεύει', () => {
  it('🔑 Α1 — αγγελία έργου κουβαλά ΕΠΩΝΥΜΙΑ και ΤΑΥΤΟΤΗΤΑ, όχι «Από μεσιτικό γραφείο»', async () => {
    const store = fakeStore({
      [COLLECTIONS.COMPANIES]: { [ALFA]: COMPANY_ALFA },
    });

    const outcome = await republishListing(
      store.db,
      'prop_ena',
      listableProperty() as ListingSourceProperty,
    );

    expect(outcome).toBe('published');
    const listing = store.written.get('prop_ena')!;
    expect(listing.agencyName).toBe('ΑΛΦΑ ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ Α.Ε.');
    expect(listing.agencyId).toBe(ALFA);
    // Ο παρονομαστής: η κλάση μένει `agency`, όπως ήταν και πριν.
    expect(listing.authorship).toBe('agency');
  });

  it('🔴 Α2 — ακίνητο ΧΩΡΙΣ `companyId`: `null` και στα δύο, καμία ανάγνωση εταιρείας', async () => {
    const store = fakeStore({ [COLLECTIONS.COMPANIES]: { [ALFA]: COMPANY_ALFA } });

    await republishListing(
      store.db,
      'prop_orfano',
      listableProperty({ companyId: null }) as ListingSourceProperty,
    );

    const listing = store.written.get('prop_orfano')!;
    expect(listing.agencyName).toBeNull();
    expect(listing.agencyId).toBeNull();
    // 🔑 Και **δεν πληρώνεται**: ο επιλυτής γυρίζει αμέσως, χωρίς να ρωτήσει.
    expect(store.reads.filter((r) => r.startsWith(COLLECTIONS.COMPANIES))).toEqual([]);
  });

  it('🔑 Α3 — εταιρεία ΧΩΡΙΣ επωνυμία: `name` κενό, ΤΑΥΤΟΤΗΤΑ ζωντανή, καμία κατάρρευση', async () => {
    const store = fakeStore({
      [COLLECTIONS.COMPANIES]: { [ALFA]: { name: '   ' } },
    });

    const outcome = await republishListing(
      store.db,
      'prop_anonymo',
      listableProperty() as ListingSourceProperty,
    );

    expect(outcome).toBe('published');
    const listing = store.written.get('prop_anonymo')!;
    expect(listing.agencyName).toBeNull();
    // 🔴 Χωρίς την ταυτότητα δεν θα ξέραμε **ποιον** να ξαναρωτήσουμε στην επισκευή.
    expect(listing.agencyId).toBe(ALFA);
  });

  it('🔑 Α4 — εταιρεία ΠΟΥ ΔΕΝ ΥΠΑΡΧΕΙ: η αγγελία δημοσιεύεται, δεν πετά', async () => {
    const store = fakeStore({ [COLLECTIONS.COMPANIES]: {} });

    const outcome = await republishListing(
      store.db,
      'prop_fantasma',
      listableProperty() as ListingSourceProperty,
    );

    expect(outcome).toBe('published');
    expect(store.written.get('prop_fantasma')!.agencyName).toBeNull();
  });
});

// ============================================================================
// Β — ΤΟ ΚΟΣΤΟΣ: **ΜΙΑ** ΑΝΑΓΝΩΣΗ ΑΝΑ ΠΕΡΑΣΜΑ, ΟΧΙ ΜΙΑ ΑΝΑ ΑΚΙΝΗΤΟ
// ============================================================================

describe('🔴 Β — η απο-κανονικοποίηση πληρώνεται ΜΙΑ φορά', () => {
  it('🔑 Β1 — τρία ακίνητα του ΙΔΙΟΥ έργου ⇒ ΜΙΑ ανάγνωση εταιρείας', async () => {
    const store = fakeStore({
      [COLLECTIONS.COMPANIES]: { [ALFA]: COMPANY_ALFA },
      [COLLECTIONS.PROPERTIES]: {
        prop_a: listableProperty(),
        prop_b: listableProperty(),
        prop_c: listableProperty(),
      },
    });

    const tally = await republishListingsForProject(store.db, PROJECT);

    expect(tally.published).toBe(3);
    // Και οι τρεις έμαθαν την επωνυμία…
    for (const id of ['prop_a', 'prop_b', 'prop_c']) {
      expect(store.written.get(id)!.agencyName).toBe('ΑΛΦΑ ΚΑΤΑΣΚΕΥΑΣΤΙΚΗ Α.Ε.');
    }
    // …με **μία** ανάγνωση εταιρείας συνολικά. Το ίδιο το `publish-public-listing.ts`
    // το δηλώνει: ένα έργο ανήκει σε **ακριβώς μία** εταιρεία.
    expect(store.reads.filter((r) => r === `${COLLECTIONS.COMPANIES}/${ALFA}`)).toHaveLength(1);
  });
});

// ============================================================================
// Γ — Η ΜΕΤΟΝΟΜΑΣΙΑ ΚΑΤΕΧΕΙ ΤΗ ΣΥΝΕΠΕΙΑ ΤΗΣ (Α1.6)
// ============================================================================

describe('🔴 Γ — η επανασύνθεση ενός οργανισμού ρωτά ΚΑΙ ΤΙΣ ΔΥΟ οικογένειες', () => {
  it('🔑 Γ1 — τα ακίνητα των έργων του παίρνουν το ΝΕΟ όνομα', async () => {
    const store = fakeStore({
      [COLLECTIONS.COMPANIES]: { [ALFA]: { name: 'ΝΕΑ ΕΠΩΝΥΜΙΑ Α.Ε.' } },
      [COLLECTIONS.PROPERTIES]: {
        prop_a: listableProperty(),
        prop_ksenos: listableProperty({ companyId: 'comp_allos' }),
      },
    });

    const report = await republishListingsForCompany(store.db, ALFA);

    expect(report.scannedProperties).toBe(1);
    expect(report.balanced).toBe(true);
    expect(store.written.get('prop_a')!.agencyName).toBe('ΝΕΑ ΕΠΩΝΥΜΙΑ Α.Ε.');
    // 🔴 Ο παρονομαστής: το ακίνητο **άλλης** εταιρείας δεν αγγίχθηκε καν.
    expect(store.written.has('prop_ksenos')).toBe(false);
  });

  it('🔴 Γ2 — και οι BROKERED αγγελίες ιδιωτών, αλλιώς είναι το σφάλμα της 27/08 ξανά', async () => {
    const store = fakeStore({
      [COLLECTIONS.COMPANIES]: { [ALFA]: { name: 'ΝΕΑ ΕΠΩΝΥΜΙΑ Α.Ε.' } },
      [COLLECTIONS.PROPERTIES]: { prop_a: listableProperty() },
      [COLLECTIONS.OWNER_PROPERTIES]: { ownp_a: brokeredListedByAlfa() as unknown as Row },
    });

    const report = await republishListingsForCompany(store.db, ALFA);

    expect(report.scannedProperties).toBe(1);
    expect(report.scannedOwnerProperties).toBe(1);
    expect(report.balanced).toBe(true);
    // Η **ίδια** επωνυμία, από την **ίδια** εταιρεία, και στις δύο οικογένειες.
    expect(store.written.get('prop_a')!.agencyName).toBe('ΝΕΑ ΕΠΩΝΥΜΙΑ Α.Ε.');
    expect(store.written.get('ownp_a')!.agencyName).toBe('ΝΕΑ ΕΠΩΝΥΜΙΑ Α.Ε.');
    expect(store.written.get('ownp_a')!.agencyId).toBe(ALFA);
  });

  it('⛔ Γ3 — ΔΕΝ ΣΒΗΝΕΙ ΤΙΠΟΤΑ: η λίστα επιζώντων ενός οργανισμού θα έσβηνε την ΑΓΟΡΑ', async () => {
    const store = fakeStore({
      [COLLECTIONS.COMPANIES]: { [ALFA]: COMPANY_ALFA },
      [COLLECTIONS.PROPERTIES]: { prop_a: listableProperty() },
      // Μια αγγελία **άλλης** εταιρείας ζει ήδη στη δημόσια συλλογή.
      [COLLECTIONS.PUBLIC_LISTINGS]: { prop_ksenos: { id: 'prop_ksenos' } },
    });

    await republishListingsForCompany(store.db, ALFA);

    expect(store.deleted).toEqual([]);
  });
});
