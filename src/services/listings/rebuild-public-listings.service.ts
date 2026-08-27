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
import { projectableFromOwnerProperty } from '@/lib/owner-property/owner-property-projection';
import {
  isPubliclyListed,
  type ProjectableProperty,
} from '@/services/listings/public-listing-projection';
import {
  republishListing,
  type PublishOutcome,
} from '@/services/listings/publish-public-listing';
import { republishOwnerProperty } from '@/services/owner-property/owner-property-publication.service';
import type { OwnerProperty } from '@/types/owner-property';

/** Ό,τι διαβάζει η επανασύνθεση από ένα έγγραφο `properties`. */
type ProjectableDoc = ProjectableProperty & {
  readonly buildingId?: string | null;
  readonly projectId?: string | null;
};

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

    tally[await republishListing(adminDb, doc.id, data)] += 1;
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
