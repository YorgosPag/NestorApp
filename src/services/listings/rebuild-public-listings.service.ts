/**
 * @fileoverview **ΕΠΑΝΑΣΥΝΘΕΣΗ ΔΗΜΟΣΙΩΝ ΠΡΟΒΟΛΩΝ** — η λογιστική, χωρίς HTTP.
 * @related ADR-777 Α3/Α5/Α14 · app/api/admin/rebuild-public-listings/route.ts
 * @module services/listings/rebuild-public-listings.service
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΓΙΑΤΙ ΕΞΗΧΘΗ ΑΠΟ ΤΗ ΔΙΑΔΡΟΜΗ (2026-08-27)
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Όσο ζούσε μέσα στο `route.ts` καλούσε **η ίδια** το `getAdminFirestore()`, άρα
 * **δεν υπήρχε τρόπος να δοκιμαστεί** — και η μόνη απόδειξη ήταν χειροκίνητη
 * εκτέλεση σε ζωντανό emulator. Ακριβώς εκεί κρύφτηκε η βλάβη που περιγράφεται
 * παρακάτω: **δεν την είδε καμία άγκυρα, γιατί καμία δεν μπορούσε.**
 *
 * 🔑 Η βάση **περνιέται**, δεν ζητιέται: η διαδρομή κρατά το HTTP και την
 * εξουσιοδότηση· εδώ ζει **μόνο** το «τι σαρώνω, τι ξαναγράφω, τι σβήνω».
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ ΔΥΟ ΟΙΚΟΓΕΝΕΙΕΣ ΓΡΑΦΟΥΝ ΣΤΟ `public_listings` — ΚΑΙ ΞΕΡΑΜΕ ΜΟΝΟ ΤΗ ΜΙΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Ο **επαγγελματίας** γράφει από `properties/{prop_*}` (ο τόπος λύνεται
 * ανεβαίνοντας ακίνητο → κτίριο → έργο)· ο **ιδιώτης** από
 * `owner_properties/{ownp_*}` (ο τόπος είναι η **δήλωσή** του). Μέχρι τις
 * 2026-08-27 αυτή η πράξη σάρωνε **μόνο** το `properties`.
 *
 * 🔴 **Και δεν ήταν ελλιπής — ήταν ΚΑΤΑΣΤΡΟΦΙΚΗ**, μετρημένο ζωντανά στον
 * emulator με τον κώδικα του `699e88b1`:
 *
 * ```
 * { "scannedProperties": 3, "published": 0, "withdrawn": 3,
 *   "orphansRemoved": 3, "balanced": true }        ← αγγελίες ιδιώτη που έμειναν: 0
 * ```
 *
 * Καμία ταυτότητα `ownp_*` δεν έμπαινε ποτέ στο `liveIds`, άρα **κάθε** αγγελία
 * ιδιώτη ήταν «ορφανή» — και η αναφορά το είπε **`balanced: true`**, δηλαδή
 * καθαρή επιτυχία. Η λογιστική έκλεινε επειδή μετρούσε **λάθος σύμπαν**: το
 * ακριβές σχήμα «*0 = κανείς δεν κοίταξε*» που η ίδια η πράξη υπάρχει για να
 * αποκλείει.
 *
 * 🔑 **Η θεραπεία ΔΕΝ είναι δεύτερος γραφέας.** Κάθε οικογένεια επανασυντίθεται
 * από τη **δική της** υπάρχουσα διαδρομή —{@link republishListing} ⇄
 * {@link republishOwnerProperty}— τις ίδιες που τρέχουν στη γραφή. Ένας
 * «ενοποιημένος» γραφέας εδώ θα ήταν **τρίτος** και θα απέκλινε από αμφότερους
 * (ADR-749).
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { nowISO } from '@/lib/date-local';
import { createAgencyIdentityResolver } from '@/services/company/company-public-name.reader';
import { projectableFromOwnerProperty } from '@/lib/owner-property/owner-property-projection';
import { isPubliclyListed } from '@/services/listings/public-listing-projection';
import {
  republishListing,
  type ListingSourceProperty,
  type PublishOutcome,
} from '@/services/listings/publish-public-listing';
import { republishOwnerProperty } from '@/services/owner-property/owner-property-publication.service';
import type { OwnerProperty } from '@/types/owner-property';

/**
 * Ό,τι διαβάζει η επανασύνθεση από ένα έγγραφο `properties`.
 *
 * 🔑 **Δεν ξαναγράφεται εδώ**: είναι ο **ίδιος** τύπος που δηλώνει ο γραφέας
 * ({@link ListingSourceProperty}). Μια δεύτερη διατύπωση θα ήταν ελεύθερη να αποκλίνει
 * την πρώτη φορά που ο γραφέας μάθαινε να διαβάζει ένα ακόμη πεδίο — που είναι ακριβώς
 * τι συνέβη με το `companyId` της **ADR-841 §7 Α1**.
 */
type ProjectableDoc = ListingSourceProperty;

/** Οι κάδοι της λογιστικής. Άγνωστη κατάσταση ⇒ δεν υπάρχει: ο τύπος τη σβήνει. */
export interface RebuildReport {
  readonly scannedProperties: number;
  /**
   * Πόσες **αγγελίες ιδιώτη** σαρώθηκαν — **χωριστός** αριθμός, επίτηδες.
   *
   * ⚠️ Ένα κοινό `scanned` θα έκρυβε ακριβώς το ελάττωμα που διορθώθηκε: με
   * **μηδέν** αγγελίες ιδιώτη σαρωμένες, το άθροισμα εξακολουθούσε να **κλείνει**.
   */
  readonly scannedOwnerProperties: number;
  readonly published: number;
  readonly withdrawn: number;
  readonly failed: number;
  readonly orphansRemoved: number;
  /** Κλείνει το άθροισμα; **Πεδίο**, ώστε να μη το υπολογίζει ο αναγνώστης. */
  readonly balanced: boolean;
}

function buildReport(
  tally: Record<PublishOutcome, number>,
  scanned: number,
  scannedOwner: number,
  orphansRemoved: number,
): RebuildReport {
  return {
    scannedProperties: scanned,
    scannedOwnerProperties: scannedOwner,
    published: tally.published,
    withdrawn: tally.withdrawn,
    failed: tally.failed,
    orphansRemoved,
    // 🔑 Το άθροισμα κλείνει πάνω στο **σύνολο** των δύο οικογενειών — αλλιώς θα
    //    έκλεινε ψευδώς αγνοώντας τη μία, όπως έκλεινε μέχρι τις 2026-08-27.
    balanced: tally.published + tally.withdrawn + tally.failed === scanned + scannedOwner,
  };
}

/**
 * Προβολές **χωρίς υποκείμενο** — δημόσια ορατές αγγελίες που δεν αντιστοιχούν σε τίποτα.
 *
 * 🔴 **ΤΟ `liveIds` ΔΕΝ ΕΙΝΑΙ ΛΟΓΙΣΤΙΚΗ — ΕΙΝΑΙ Η ΛΙΣΤΑ ΕΠΙΖΩΝΤΩΝ.** Ό,τι λείπει
 * από εκεί **διαγράφεται**. Άρα το σύνολο πρέπει να είναι η **ΕΝΩΣΗ κάθε
 * οικογένειας** που γράφει στο `public_listings` — ποτέ μιας από αυτές.
 */
async function removeOrphanListings(
  adminDb: AdminFirestore,
  liveIds: ReadonlySet<string>,
  dryRun: boolean,
): Promise<number> {
  const listings = await adminDb.collection(COLLECTIONS.PUBLIC_LISTINGS).get();
  const orphans = listings.docs.filter((doc) => !liveIds.has(doc.id));

  if (!dryRun) {
    for (const orphan of orphans) await orphan.ref.delete();
  }
  return orphans.length;
}

/**
 * **Ξαναχτίζει από την αρχή το `public_listings`** — και για τις δύο οικογένειες.
 *
 * @param dryRun `true` ⇒ **μηδέν** εγγραφές, μόνο μέτρηση.
 */
export async function rebuildAllPublicListings(
  adminDb: AdminFirestore,
  dryRun: boolean,
): Promise<RebuildReport> {
  const tally: Record<PublishOutcome, number> = { published: 0, withdrawn: 0, failed: 0 };
  const liveIds = new Set<string>();

  // 🔑 **ΕΝΑΣ επιλυτής για ΟΛΗ τη σάρωση** (ADR-841 §7 Α1). Εδώ —σε αντίθεση με τον
  //    βρόχο του έργου— οι εταιρείες είναι **πολλές**, οπότε δεν αρκεί «μία ανάγνωση»:
  //    χρειάζεται **χάρτης** `companyId → ταυτότητα`. Είναι ο **ίδιος** επιλυτής, και
  //    αυτό είναι το νόημα — μία μηχανή, δύο σχήματα κόστους.
  const resolveAgency = createAgencyIdentityResolver(adminDb);

  // ── ΟΙΚΟΓΕΝΕΙΑ Α: ο επαγγελματίας ────────────────────────────────────────
  const properties = await adminDb.collection(COLLECTIONS.PROPERTIES).get();

  for (const doc of properties.docs) {
    liveIds.add(doc.id);
    const data = doc.data() as ProjectableDoc;

    if (dryRun) {
      // ⚠️ Η στεγνή εκτέλεση ρωτά ΜΟΝΟ «θα δημοσιευόταν;» — δεν λύνει θέση, γιατί η
      // θέση δεν αλλάζει την **απάντηση**, μόνο το περιεχόμενο. Έτσι μένει ένα
      // ερώτημα ανά ακίνητο αντί για τρία, και εξακολουθεί να λέει την αλήθεια.
      tally[isPubliclyListed({ ...data, id: doc.id }) ? 'published' : 'withdrawn'] += 1;
      continue;
    }

    tally[await republishListing(adminDb, doc.id, data, resolveAgency)] += 1;
  }

  // ── ΟΙΚΟΓΕΝΕΙΑ Β: ο ιδιώτης (ADR-777 Α14) ────────────────────────────────
  //
  // ⚠️ **Ο ίδιος βρόχος, ΑΛΛΗ διαδρομή**: ο ιδιώτης δεν έχει αλυσίδα να ανέβει —
  //    ο τόπος του είναι η δήλωσή του — και η `republishOwnerProperty`
  //    **καταγράφει** επιπλέον την έκβαση στο έγγραφο, ώστε μια διορθωμένη
  //    αγγελία να πάψει να εμφανίζεται «εκκρεμής» στην οθόνη του κατόχου.
  const ownerProperties = await adminDb.collection(COLLECTIONS.OWNER_PROPERTIES).get();

  for (const doc of ownerProperties.docs) {
    // 🔴 **ΚΑΙ ΣΤΗ ΣΤΕΓΝΗ ΕΚΤΕΛΕΣΗ.** Το `liveIds` είναι η λίστα επιζώντων, όχι
    //    λογιστική: παράλειψή του εδώ θα σήμαινε ότι ένα **`GET`** αναφέρει κάθε
    //    αγγελία ιδιώτη ως «ορφανή προς διαγραφή» — δηλαδή θα έλεγε στον άνθρωπο
    //    ότι το `POST` πρόκειται να κάνει ακριβώς τη ζημιά που έκανε.
    liveIds.add(doc.id);
    const owner = doc.data() as OwnerProperty;

    if (dryRun) {
      tally[
        isPubliclyListed(projectableFromOwnerProperty(owner, nowISO())) ? 'published' : 'withdrawn'
      ] += 1;
      continue;
    }

    tally[(await republishOwnerProperty(adminDb, { ...owner, id: doc.id })).publish] += 1;
  }

  const orphansRemoved = await removeOrphanListings(adminDb, liveIds, dryRun);
  return buildReport(tally, properties.size, ownerProperties.size, orphansRemoved);
}

// ============================================================================
// ΕΠΑΝΑΣΥΝΘΕΣΗ ΕΝΟΣ ΟΡΓΑΝΙΣΜΟΥ — η συνέπεια της μετονομασίας (ADR-841 §7 Α1)
// ============================================================================

/** Η λογιστική **ενός οργανισμού**. Ίδιοι κάδοι, στενότερος παρονομαστής. */
export interface CompanyRepublishReport {
  readonly companyId: string;
  readonly scannedProperties: number;
  readonly scannedOwnerProperties: number;
  readonly published: number;
  readonly withdrawn: number;
  readonly failed: number;
  /** Κλείνει το άθροισμα; **Πεδίο**, ίδιος λόγος με το {@link RebuildReport.balanced}. */
  readonly balanced: boolean;
}

/**
 * **Ξαναγράφει τις δημόσιες προβολές ΕΝΟΣ οργανισμού** — και τις δύο οικογένειές του.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 ΤΟ ΕΡΩΤΗΜΑ ΠΟΥ ΤΗ ΓΕΝΝΗΣΕ: **ΠΟΙΟΣ ΤΟ ΞΕΡΕΙ ΟΤΑΝ ΑΛΛΑΞΕΙ ΤΟ ΟΝΟΜΑ;**
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Η επωνυμία **αντιγράφεται** στη δημόσια προβολή. Ένα αντίγραφο είναι ή
 * **στιγμιότυπο** *(μπαγιάτικο = **σωστό**: η υπογραφή έγινε σε εκείνο το όνομα)* ή
 * **αναφορά** *(μπαγιάτικο = **λάθος**)*. Η επωνυμία σε αγγελία που είναι **στην αγορά
 * τώρα** είναι **αναφορά** — και μέχρι σήμερα **κανείς δεν την ανανέωνε ποτέ**:
 * μετρήθηκε ότι η **μία** ζωντανή διαδρομή μετονομασίας *(`repairCompanyDocument`)*
 * δεν καλούσε **καμία** επανασύνθεση.
 *
 * ⛔ **ΓΙΑΤΙ ΟΧΙ Cloud Function trigger στο `companies/{id}`** *(η συνήθης σύσταση)*:
 * θα ήταν **δεύτερη μηχανή** που γράφει στο `public_listings` — ακριβώς αυτό που
 * αρνείται η κεφαλίδα αυτού του αρχείου, και το ρητά ονομασμένο ελάττωμα του
 * **ADR-749**. ⛔ **Ούτε TTL** *(ρολόι που κανείς δεν διαβάζει)*, ⛔ **ούτε
 * read-through join** *(πληρώνεται σε **κάθε** ανάγνωση δημόσιας συλλογής)*.
 * ✅ Η **μία** μετονομασία **κατέχει** τη συνέπειά της, ρητά *(N.7.2 #7)*.
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ⛔ ΔΕΝ ΣΒΗΝΕΙ ΟΡΦΑΝΕΣ — ΚΑΙ ΕΙΝΑΙ ΤΟ ΠΙΟ ΣΗΜΑΝΤΙΚΟ ΠΟΥ ΛΕΕΙ ΑΥΤΟ ΤΟ ΑΡΧΕΙΟ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `liveIds` της {@link rebuildAllPublicListings} είναι **η λίστα επιζώντων**: ό,τι
 * λείπει **διαγράφεται**. Ένα τέτοιο σύνολο χτισμένο από **έναν** οργανισμό θα έκανε
 * *«ορφανή»* **κάθε αγγελία κάθε άλλης εταιρείας** — δηλαδή μια μετονομασία θα
 * **έσβηνε την αγορά**. Είναι το **ίδιο** σχήμα με τη βλάβη της 2026-08-27, μία βαθμίδα
 * πιο καταστροφικό.
 *
 * 🔑 Και δεν χρειάζεται: η μετονομασία **δεν δημιουργεί ορφανές**. Η σάρωση ορφανών
 * είναι ερώτηση για **ολόκληρη** τη συλλογή, και ζει εκεί που έχει τον παρονομαστή της.
 *
 * ⚠️ **ΤΙ ΠΕΤΑ ΚΑΙ ΤΙ ΟΧΙ — δηλωμένο, όχι υπονοούμενο.** Η αποτυχία **μιας** προβολής
 * **δεν** πετά: μετριέται ως `failed`, ίδιο συμβόλαιο με κάθε γραφέα εδώ. Η αποτυχία
 * **του ίδιου του ερωτήματος** *(δεν ξέρουμε καν ποια ακίνητα υπάρχουν)* **πετά** — ένα
 * `balanced: true` πάνω σε **μηδέν** σαρωμένα θα ήταν το ακριβές σχήμα *«0 = κανείς δεν
 * κοίταξε»* που αυτό το αρχείο υπάρχει για να αποκλείει.
 *
 * 🔑 Γι' αυτό ο **καλών** την τυλίγει: η μετονομασία **έγινε** και δεν ακυρώνεται από
 * αποτυχία παραγώγου — αλλά ο άνθρωπος **μαθαίνει** ότι οι αγγελίες έμειναν πίσω.
 */
export async function republishListingsForCompany(
  adminDb: AdminFirestore,
  companyId: string,
): Promise<CompanyRepublishReport> {
  const tally: Record<PublishOutcome, number> = { published: 0, withdrawn: 0, failed: 0 };

  // 🔑 **ΕΝΑΣ επιλυτής, ΜΙΑ ανάγνωση**: εξ ορισμού **μία** εταιρεία σε όλο το πέρασμα —
  //    και είναι η εταιρεία που **μόλις** μετονομάστηκε, οπότε η ανάγνωση επιστρέφει το
  //    **νέο** όνομα. Καθολικό cache εδώ θα ξανάγραφε το **παλιό** (δες τον επιλυτή).
  const resolveAgency = createAgencyIdentityResolver(adminDb);

  // ── ΟΙΚΟΓΕΝΕΙΑ Α: τα ακίνητα των έργων του ───────────────────────────────
  // tenant-scope-exempt: το φίλτρο **ΕΙΝΑΙ** το `companyId` — στενότερο δεν γίνεται.
  const properties = await adminDb
    .collection(COLLECTIONS.PROPERTIES)
    .where('companyId', '==', companyId)
    .get();

  for (const doc of properties.docs) {
    tally[
      await republishListing(adminDb, doc.id, doc.data() as ProjectableDoc, resolveAgency)
    ] += 1;
  }

  // ── ΟΙΚΟΓΕΝΕΙΑ Β: οι αγγελίες ιδιωτών που ΔΙΑΧΕΙΡΙΖΕΤΑΙ με εντολή ─────────
  //
  // 🔴 **ΧΩΡΙΣ ΑΥΤΟ ΤΟ ΣΚΕΛΟΣ Η ΠΡΑΞΗ ΘΑ ΗΤΑΝ ΤΟ ΙΔΙΟ ΣΦΑΛΜΑ ΤΗΣ 2026-08-27**: μια
  //    brokered αγγελία κουβαλά **την ίδια** επωνυμία, από **την ίδια** εταιρεία, και
  //    θα έμενε μπαγιάτικη ενώ η αναφορά θα έλεγε «έγινε». Δύο οικογένειες γράφουν
  //    στο `public_listings`· κάθε πράξη πάνω του οφείλει να ρωτά **και τις δύο**.
  //
  // tenant-scope-exempt: `authorCompanyId` = το πεδίο μισθωτή αυτής της οικογένειας
  // (ADR-777 §8.39) — ίδιο ιδίωμα με το `agency-listings-sweep.service.ts`.
  const ownerProperties = await adminDb
    .collection(COLLECTIONS.OWNER_PROPERTIES)
    .where('authorCompanyId', '==', companyId)
    .get();

  for (const doc of ownerProperties.docs) {
    const owner = { ...(doc.data() as OwnerProperty), id: doc.id };
    tally[(await republishOwnerProperty(adminDb, owner)).publish] += 1;
  }

  return {
    companyId,
    scannedProperties: properties.size,
    scannedOwnerProperties: ownerProperties.size,
    published: tally.published,
    withdrawn: tally.withdrawn,
    failed: tally.failed,
    balanced:
      tally.published + tally.withdrawn + tally.failed ===
      properties.size + ownerProperties.size,
  };
}
