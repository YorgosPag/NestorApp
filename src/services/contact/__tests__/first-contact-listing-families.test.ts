/**
 * @fileoverview 🔴 **ΡΩΤΑ Ο ΚΡΙΤΗΣ ΤΗΣ ΠΡΩΤΗΣ ΕΠΑΦΗΣ **ΚΑΘΕ** ΟΙΚΟΓΕΝΕΙΑ ΑΓΓΕΛΙΩΝ;**
 * @related ADR-843 §10.15 *(το εύρημα)* · §10.16 *(η θεραπεία)* · ADR-841 §7 · ADR-777 Α14
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΓΕΓΟΝΟΣ ΠΟΥ ΓΕΝΝΗΣΕ ΤΟ ΑΡΧΕΙΟ — ΜΕΤΡΗΜΕΝΟ ΣΤΗ ΒΑΣΗ 2026-09-04
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο δημόσιος κατάλογος (`public_listings`) τροφοδοτείται από **ΔΥΟ** πηγές, που ο
 * ίδιος ο ανακατασκευαστής ονομάζει ρητά:
 *
 * | | Συλλογή | Πρόθεμα | `authorship` |
 * |---|---|---|---|
 * | **ΟΙΚΟΓΕΝΕΙΑ Α** — ο επαγγελματίας | `properties` | `prop_*` | `agency` |
 * | **ΟΙΚΟΓΕΝΕΙΑ Β** — ο ιδιώτης | `owner_properties` | `ownp_*` | `owner-declared` |
 *
 * Ο κριτής ρωτούσε **ΜΟΝΟ ΤΗ Β**, σε **δύο** σημεία ⇒ κάθε πράξη προς αγγελία
 * γραφείου απορριπτόταν με *«η αγγελία δεν υπάρχει»* — για αγγελία που ο άνθρωπος
 * **έβλεπε μπροστά του**. 📊 **6 από 8 ζωντανές αγγελίες (75%).**
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🏆 ΓΙΑΤΙ Η ΑΓΚΥΡΑ ΕΓΙΝΕ **ΕΚΤΕΛΟΥΜΕΝΗ** — ΚΑΙ ΓΙΑΤΙ ΑΥΤΟ ΔΕΝ ΕΙΝΑΙ ΧΑΛΑΡΩΣΗ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η πρώτη γραφή αυτού του αρχείου *(κόκκινη επίτηδες)* έκανε **grep σε δύο ονομαστικά
 * αρχεία**. Αυτό ήταν σωστό για να **καταγράψει** το σφάλμα, αλλά θα γινόταν **λάθος
 * κριτήριο** μετά τη θεραπεία, για δύο λόγους:
 *
 * 1. Ο φρουρός **αναθέτει** πλέον σε επιλυτή ⇒ το όνομα της συλλογής δεν είναι πια
 *    εκεί. Ένα «πρόσθεσε κι αυτό το αρχείο στη λίστα» θα ήταν **χαλάρωση**.
 * 2. Τα εισερχόμενα **έπαψαν να ρωτούν οικογένειες** *(ρωτούν τον καταγεγραμμένο
 *    παραλήπτη)* ⇒ μια λίστα αρχείων θα μετρούσε **απουσία** ως αποτυχία, ενώ είναι
 *    η **ισχυρότερη** μορφή επιτυχίας: το αρχείο δεν μπορεί πια να ξεχάσει οικογένεια.
 *
 * ⇒ Το κριτήριο **δεν χαλάρωσε — εκτελείται**. Ο **πραγματικός** επιλυτής τρέχει
 * πάνω σε ψεύτικη βάση που **καταγράφει ποια συλλογή άνοιξε**, μία φορά ανά
 * οικογένεια, και ελέγχεται ότι επιστρέφει **σωστό παραλήπτη**. Δεν ρωτάμε πια «τι
 * γράφει το αρχείο;» αλλά «**τι κάνει ο κώδικας;**» — και το αντι-παράδειγμα του
 * ΜΕΡΟΥΣ Γ **εκτελεί το ίδιο κριτήριο** σε επιλυτή που ξέρει μόνο τη μία οικογένεια,
 * και πέφτει.
 *
 * ⚠️ **Το στατικό σκέλος ΜΕΝΕΙ, στενότερο**: ο **ανακατασκευαστής** είναι ο
 * παρονομαστής *(«τι φτάνει στον δημόσιο κατάλογο»)* και συγκρίνεται με το **κλειστό
 * μητρώο**. Έτσι μια τρίτη οικογένεια δεν μπορεί να μπει στον κατάλογο χωρίς να
 * δηλωθεί — και, μόλις δηλωθεί, ο **μεταγλωττιστής** απαιτεί αναγνώστη γι' αυτήν.
 */

import fs from 'node:fs';
import path from 'node:path';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { validOwnerProperty } from '@/lib/owner-property/__tests__/owner-property-fixtures';
import {
  LISTING_FAMILIES,
  LISTING_FAMILY,
  LISTING_FAMILY_COLLECTIONS,
  type ListingFamily,
} from '@/lib/listings/listing-families';
import {
  resolveListing,
  type ListingResolution,
  type ResolvedListing,
} from '@/services/listings/listing-resolver';

const ROOT = path.resolve(__dirname, '..', '..', '..', '..');
const NOW = '2026-09-04T10:00:00.000Z';

/** Η αυθεντία του *«τι φτάνει στον δημόσιο κατάλογο»* — μία, ονομασμένη. */
const REBUILDER = 'src/services/listings/rebuild-public-listings.service.ts';

/** Οι συλλογές **ακινήτων** — ό,τι άλλο (`FIRST_CONTACTS`, `DEMANDS`…) δεν αφορά. */
const PROPERTY_COLLECTIONS = ['PROPERTIES', 'OWNER_PROPERTIES'] as const;
type PropertyCollection = (typeof PROPERTY_COLLECTIONS)[number];

function read(relative: string): string {
  return fs.readFileSync(path.join(ROOT, relative), 'utf8');
}

/**
 * Ποιες οικογένειες ακινήτων ρωτά αυτό το αρχείο.
 *
 * 🔑 Ζητά `COLLECTIONS.X` **με το πρόθεμα**: μια σκέτη αναφορά της λέξης σε σχόλιο
 * *(και υπάρχουν — το ίδιο το 3.74 τις ονομάζει)* δεν είναι ερώτημα στη βάση.
 */
function propertyFamiliesAsked(source: string): ReadonlySet<PropertyCollection> {
  const found = new Set<PropertyCollection>();
  for (const name of PROPERTY_COLLECTIONS) {
    // ⚠️ `OWNER_PROPERTIES` περιέχει `PROPERTIES`· το όριο λέξης στην ΑΡΧΗ είναι
    //    απαραίτητο, αλλιώς κάθε αναφορά του πρώτου μετρά και ως δεύτερο.
    if (new RegExp(`COLLECTIONS\\.${name}\\b`).test(source)) found.add(name);
  }
  // Το `\b` δεν σώζει το `PROPERTIES` από το `OWNER_PROPERTIES` (το `_` είναι λέξη),
  // οπότε το αφαιρούμε ρητά όταν ΜΟΝΟ το δεύτερο εμφανίζεται.
  if (found.has('PROPERTIES') && !/COLLECTIONS\.PROPERTIES\b/.test(source.replace(/COLLECTIONS\.OWNER_PROPERTIES\b/g, ''))) {
    found.delete('PROPERTIES');
  }
  return found;
}

// =============================================================================
// Η ΨΕΥΤΙΚΗ ΒΑΣΗ — καταγράφει **ποια συλλογή άνοιξε**, γιατί αυτό είναι το ζητούμενο
// =============================================================================

/**
 * ⚠️ **Δεν μιμείται τη Firestore — μιμείται ΜΙΑ ερώτηση**: *«δώσε μου αυτό το έγγραφο
 * από αυτή τη συλλογή»*. Ό,τι δεν υπάρχει στον χάρτη απαντά **δεν υπάρχει**, που
 * είναι και η αληθινή συμπεριφορά για τα `buildings`/`projects` που δεν σπέρνουμε.
 */
function recordingDb(
  documents: Readonly<Record<string, Record<string, unknown>>>,
  opened: string[],
): AdminFirestore {
  const db = {
    collection(name: string) {
      opened.push(name);
      return {
        doc(id: string) {
          return {
            async get() {
              const data = documents[`${name}/${id}`];
              return { exists: data !== undefined, data: () => data };
            },
          };
        },
      };
    },
  };

  // Ο μοναδικός μετασχηματισμός τύπου του αρχείου: το ψεύτικο υλοποιεί **ακριβώς**
  // την επιφάνεια που αγγίζει ο επιλυτής, και τίποτε από τα υπόλοιπα 200 μέλη.
  return db as unknown as AdminFirestore;
}

/** Μια αγγελία **γραφείου**, όπως ζει στο `properties` (μετρημένη από ζωντανό έγγραφο). */
const AGENCY_LISTING: Record<string, unknown> = {
  name: 'Μεζονέτα 95 τ.μ.',
  type: 'maisonette',
  companyId: 'comp_alfa',
  createdBy: 'user-employee',
  commercialStatus: 'for-sale',
  areas: { gross: 95 },
  layout: { bedrooms: 3 },
  floor: 1,
};

/** Το δοκιμαστικό έγγραφο κάθε οικογένειας, στη **δική της** συλλογή. */
const SEEDED: Readonly<Record<ListingFamily, { readonly id: string; readonly doc: Record<string, unknown> }>> = {
  agency: { id: 'prop_dokimi', doc: AGENCY_LISTING },
  owner: { id: 'ownp_dokimi', doc: validOwnerProperty({ id: 'ownp_dokimi' }) as unknown as Record<string, unknown> },
};

// =============================================================================
// ΤΟ ΚΡΙΤΗΡΙΟ — **ΜΙΑ** συνάρτηση, εκτελεσμένη δύο φορές (πρότυπο Σταδίου Δ)
// =============================================================================

/** Ένας επιλυτής αγγελίας, όποιος κι αν είναι — αληθινός ή αντι-παράδειγμα. */
type ListingLookup = (
  adminDb: AdminFirestore,
  listingId: string,
  nowISO: string,
) => Promise<ListingResolution>;

interface ReachabilityReport {
  /** Ποιες οικογένειες **απάντησαν** με αγγελία. */
  readonly answered: readonly ListingFamily[];
  /**
   * Ποιες κρίθηκαν **στην αγορά** — δηλαδή για ποιες πέρασε ολόκληρη η αλυσίδα
   * *(τόπος → προβολή → `buildPublicListing`)*, όχι μόνο η ανάγνωση.
   *
   * 🔑 **Χωρίς αυτό το σκέλος η άγκυρα θα ήταν μισή**: μια αγγελία που βρίσκεται αλλά
   * κρίνεται «εκτός αγοράς» δίνει στον άνθρωπο `target-not-live` — άλλο μήνυμα, ίδιο
   * αδιέξοδο.
   */
  readonly live: readonly ListingFamily[];
  /** Ποιες συλλογές **άνοιξε πραγματικά** ο επιλυτής. */
  readonly collectionsOpened: readonly string[];
  /** Ο παραλήπτης που επέστρεψε κάθε οικογένεια — `null` αν δεν απάντησε. */
  readonly custodyKinds: Readonly<Record<ListingFamily, string | null>>;
}

/**
 * **Τρέχει τον επιλυτή μία φορά ανά οικογένεια** και αναφέρει τι έκανε.
 *
 * 🔑 Το ίδιο σώμα κρίνει και τον **αληθινό** επιλυτή (ΜΕΡΟΣ Β) και το
 * **αντι-παράδειγμα** (ΜΕΡΟΣ Γ). Δύο διατυπώσεις του κριτηρίου θα επέτρεπαν στη μία
 * να είναι πιο επιεικής — και θα ήταν πάντα εκείνη που κρίνει τον αληθινό.
 */
async function reachabilityOf(resolve: ListingLookup): Promise<ReachabilityReport> {
  const documents: Record<string, Record<string, unknown>> = {};
  for (const family of LISTING_FAMILIES) {
    documents[`${LISTING_FAMILY[family].collection}/${SEEDED[family].id}`] = SEEDED[family].doc;
  }

  const opened: string[] = [];
  const answered: ListingFamily[] = [];
  const live: ListingFamily[] = [];
  const custodyKinds: Record<string, string | null> = {};

  for (const family of LISTING_FAMILIES) {
    const outcome = await resolve(recordingDb(documents, opened), SEEDED[family].id, NOW);
    const resolved = outcome !== null && outcome !== 'absent' ? outcome : null;

    if (resolved !== null) answered.push(family);
    if (resolved?.facts != null) live.push(family);
    custodyKinds[family] = resolved?.custody.kind ?? null;
  }

  return {
    answered,
    live,
    collectionsOpened: [...new Set(opened)],
    custodyKinds: custodyKinds as Readonly<Record<ListingFamily, string | null>>,
  };
}

// =============================================================================

describe('ADR-843 — ο κριτής της πρώτης επαφής vs οι οικογένειες του δημόσιου καταλόγου', () => {
  describe('ΜΕΡΟΣ Α — ο παρονομαστής: τι φτάνει στον δημόσιο κατάλογο', () => {
    it('ο ανακατασκευαστής σαρώνει ΚΑΙ ΤΙΣ ΔΥΟ οικογένειες', () => {
      const families = propertyFamiliesAsked(read(REBUILDER));

      // Αν αυτό πέσει, ο παρονομαστής άλλαξε και κάθε ερώτηση παρακάτω είναι άκυρη.
      expect([...families].sort()).toEqual(['OWNER_PROPERTIES', 'PROPERTIES']);
    });

    it('🔴 ΚΑΘΕ συλλογή που σαρώνει ο ανακατασκευαστής είναι ΔΗΛΩΜΕΝΗ στο μητρώο', () => {
      // 🔑 Η γέφυρα ανάμεσα στα δύο σκέλη: το μητρώο είναι ό,τι **εκτελεί** το ΜΕΡΟΣ Β,
      //    άρα μια συλλογή που λείπει από εδώ είναι οικογένεια που **κανείς δεν ρωτά**.
      // ⚠️ Το όνομα λύνεται από το **ίδιο** `COLLECTIONS` που διαβάζει ο κώδικας —
      //    ποτέ χειρόγραφο `'properties'`: οι τιμές δέχονται υπέρβαση από `process.env`,
      //    και ένα σταθερό αλφαριθμητικό εδώ θα έκρινε **άλλη** βάση από την αληθινή.
      const scanned = [...propertyFamiliesAsked(read(REBUILDER))].map(
        (name) => COLLECTIONS[name],
      );

      const undeclared = scanned.filter((c) => !LISTING_FAMILY_COLLECTIONS.includes(c));

      expect({
        περιγραφή:
          'Συλλογές που φτάνουν στο public_listings αλλά ΔΕΝ έχουν γραμμή στο ' +
          'lib/listings/listing-families.ts ⇒ ο επιλυτής δεν μπορεί να τις ρωτήσει.',
        undeclared,
      }).toEqual({ περιγραφή: expect.any(String), undeclared: [] });
    });

    it('ο ανιχνευτής ΞΕΧΩΡΙΖΕΙ τις δύο συλλογές — αλλιώς η μέτρηση παραπάνω είναι ψεύτικη', () => {
      // 🔑 Χωρίς αυτό, το `OWNER_PROPERTIES` θα μετρούσε **και** ως `PROPERTIES`
      //    (υποσυμβολοσειρά) και η πύλη θα ήταν **μονίμως πράσινη με μηδέν αξία** —
      //    το σχήμα «0 = κανείς δεν κοίταξε» που το έργο έχει μετρήσει τέσσερις φορές.
      expect([...propertyFamiliesAsked('adminDb.collection(COLLECTIONS.OWNER_PROPERTIES)')]).toEqual([
        'OWNER_PROPERTIES',
      ]);
      expect([...propertyFamiliesAsked('adminDb.collection(COLLECTIONS.PROPERTIES)')]).toEqual([
        'PROPERTIES',
      ]);
      expect([
        ...propertyFamiliesAsked('COLLECTIONS.PROPERTIES + COLLECTIONS.OWNER_PROPERTIES'),
      ].sort()).toEqual(['OWNER_PROPERTIES', 'PROPERTIES']);
    });

    it('μια σκέτη αναφορά σε ΣΧΟΛΙΟ δεν μετρά ως ερώτημα στη βάση', () => {
      expect([...propertyFamiliesAsked('// τα properties και owner_properties είναι δύο')]).toEqual(
        [],
      );
    });
  });

  describe('ΜΕΡΟΣ Β — ο ΑΛΗΘΙΝΟΣ επιλυτής, εκτελεσμένος', () => {
    it('🔴 ΚΑΘΕ οικογένεια απαντά — και ανοίγει τη ΔΙΚΗ ΤΗΣ συλλογή', async () => {
      const report = await reachabilityOf(resolveListing);

      const unreachable = LISTING_FAMILIES.filter((f) => !report.answered.includes(f));

      expect({
        περιγραφή:
          'Οικογένειες που φτάνουν στο public_listings αλλά ο κριτής της πρώτης επαφής ' +
          'ΔΕΝ τις ρωτά ⇒ κάθε πράξη πάνω τους απορρίπτεται με «η αγγελία δεν υπάρχει».',
        unreachable,
      }).toEqual({ περιγραφή: expect.any(String), unreachable: [] });

      // ⚠️ Και η **απόδειξη ότι ρωτήθηκε η βάση**, όχι ότι απλώς επιστράφηκε κάτι:
      //    χωρίς αυτό, ένας επιλυτής που μαντεύει από το πρόθεμα θα περνούσε.
      for (const collection of LISTING_FAMILY_COLLECTIONS) {
        expect(report.collectionsOpened).toContain(collection);
      }
    });

    it('🔴 ΚΑΘΕ οικογένεια φτάνει ΩΣ ΤΟ ΤΕΛΟΣ — κρίνεται «στην αγορά»', async () => {
      const report = await reachabilityOf(resolveListing);

      // Δηλαδή: τόπος λύθηκε, προβολή χτίστηκε, ο **ΕΝΑΣ** κριτής δημοσίευσης είπε ναι.
      // Μια οικογένεια που «απαντά» αλλά ποτέ δεν είναι ζωντανή θα έδινε στον άνθρωπο
      // `target-not-live` — δεύτερο αδιέξοδο με άλλο όνομα.
      expect([...report.live].sort()).toEqual([...LISTING_FAMILIES].sort());
    });

    it('🏆 ο ΠΑΡΑΛΗΠΤΗΣ κάθε οικογένειας είναι ο σωστός χώρος', async () => {
      const report = await reachabilityOf(resolveListing);

      // Η αγγελία **γραφείου** ανήκει στο γραφείο («listings belong to the broker»),
      // η αγγελία **ιδιώτη** στον ίδιο. Αν αυτά αντιστραφούν, τα εισερχόμενα
      // δρομολογούν προσωπικά δεδομένα σε **λάθος άνθρωπο**.
      expect(report.custodyKinds).toEqual({ agency: 'company', owner: 'personal' });
    });

    it('ταυτότητα ΞΕΝΟΥ σύμπαντος απορρίπτεται ΧΩΡΙΣ ερώτημα στη βάση', async () => {
      const opened: string[] = [];
      const outcome = await resolveListing(recordingDb({}, opened), 'cont_kapoios', NOW);

      // 🏆 Το κέρδος του προθέματος (πρότυπο Stripe): η λάθος ταυτότητα δεν πληρώνει
      //    ανάγνωση. Ένα `expect(outcome).toBe('absent')` **μόνο** του θα περνούσε και
      //    με επιλυτή που σαρώνει και τις δύο συλλογές πρώτα.
      expect(outcome).toBe('absent');
      expect(opened).toEqual([]);
    });
  });

  describe('ΜΕΡΟΣ Γ — το ΑΝΤΙ-ΠΑΡΑΔΕΙΓΜΑ: ο κριτής όπως ήταν πριν τη θεραπεία', () => {
    /**
     * 🔴 **Ο ΚΩΔΙΚΑΣ ΤΟΥ §10.15, ΣΕ ΜΙΑ ΣΥΝΑΡΤΗΣΗ.** Ρωτά **μόνο** το
     * `owner_properties` — ακριβώς ό,τι έκανε το `readOwnerProperty`.
     *
     * ⚠️ Ζει **εδώ**, όχι ως μετάλλαξη του πραγματικού αρχείου: μετρήθηκε 2026-09-04
     * ότι παράλληλος πράκτορας **διάβασε** μετάλλαξη σε tracked αρχείο και την
     * ανέφερε ως εύρημα.
     */
    const ownerOnlyResolver: ListingLookup = async (adminDb, listingId) => {
      const snapshot = await adminDb
        .collection(LISTING_FAMILY.owner.collection)
        .doc(listingId)
        .get();
      if (!snapshot.exists) return 'absent';

      const resolved: ResolvedListing = {
        family: 'owner',
        custody: { kind: 'personal', userId: 'user-1' },
        facts: null,
      };
      return resolved;
    };

    it('🔴 ΠΕΦΤΕΙ στο ΙΔΙΟ κριτήριο — αλλιώς το ΜΕΡΟΣ Β δεν αποδεικνύει τίποτα', async () => {
      const report = await reachabilityOf(ownerOnlyResolver);

      // Η οικογένεια του **γραφείου** μένει αναπάντητη, και η συλλογή της δεν ανοίγει
      // ποτέ — τα **δύο** συμπτώματα του ευρήματος, μετρημένα σε εκτέλεση.
      expect(report.answered).toEqual(['owner']);
      expect(report.collectionsOpened).not.toContain(LISTING_FAMILY.agency.collection);
    });
  });
});
