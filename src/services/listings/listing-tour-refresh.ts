import 'server-only';

/**
 * @fileoverview **Η ΠΕΡΙΗΓΗΣΗ ΑΛΛΑΞΕ — ΞΑΝΑΠΡΟΒΑΛΕ ΤΗΝ ΑΓΓΕΛΙΑ ΤΗΣ, ΑΝ ΑΛΛΑΞΕ Η ΑΠΑΝΤΗΣΗ.**
 * @related ADR-884 · ADR-777 §8.88 · `listing-publication-facts.ts` (`listedTourOf`, ο δέτης) ·
 *   `server/spatial-tour/tour-presence.ts` (η αυθεντία) · `agency-name-refresh.ts` (ίδιο σχήμα) · CHECK 3.104
 * @module services/listings/listing-tour-refresh
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔑 Ο ΕΝΑΣ ΔΡΟΜΟΣ ΠΟΥ ΚΡΑΤΑ ΦΡΕΣΚΟ ΤΟ `PublicListing.tour`
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Το πεδίο είναι **αντίγραφο** της απάντησης του `readTourPresence`. Η απάντηση αλλάζει από γεγονότα της **περιήγησης**
 * (ορατότητα · κύκλος ζωής · τοποθέτηση λήψης · έτοιμο ή αποσυρμένο tileset) — πράξεις που **δεν** αγγίζουν το ακίνητο,
 * άρα κανένας υπάρχων δρόμος επαναδημοσίευσης δεν θα τις έβλεπε. Κάθε γραφέας που αλλάζει την απάντηση καλεί **εδώ**,
 * μετά το commit της συναλλαγής του: «η πράξη που αλλάζει το Χ κατέχει τη συνέπειά της» (ADR-749 — όχι δεύτερη μηχανή
 * που γράφει `public_listings`). Το ποιοι είναι οι γραφείς το δηλώνει το `.tour-presence-authority.json` και το φυλά η
 * πύλη· το νυχτερινό δίχτυ (`listing-media-reconciliation`) κλείνει ό,τι χάθηκε.
 *
 * 🔑 **ΠΡΩΙΜΗ ΑΠΟΚΟΠΗ**: οι περισσότερες εγγραφές του γράφου **δεν** αλλάζουν την απάντηση (ένας προσανατολισμός, μια
 * δεύτερη έτοιμη στάση). Η πλήρης επαναδημοσίευση συμφιλιώνει ράφια — δεν πληρώνεται για να ξαναγραφτεί το ίδιο
 * έγγραφο. Ίσο ⇒ καμία εγγραφή ⇒ η πράξη είναι ιδεμποτική (N.7.2 #3).
 *
 * ⚠️ **ΔΕΝ ΠΕΤΑ ΠΟΤΕ.** Η αλλαγή της περιήγησης **έγινε** ήδη· μια εξαίρεση εδώ θα γύριζε 500 σε πράξη που πέτυχε.
 */

import type { DocumentReference, Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { spatialTourFromDocument } from '@/lib/spatial-tour/spatial-tour-from-document';
import { tourSubjectOfListing } from '@/lib/spatial-tour/tour-subject-of-listing';
import { readStoredListing } from '@/lib/listings/public-listing-from-document';
import { ownerPropertyFromDocument } from '@/lib/owner-property/owner-property-from-document';
import { createModuleLogger } from '@/lib/telemetry';
import { TOUR_SUBJECT_COLLECTION } from '@/server/spatial-tour/tour-locate';
import { readTourPresence } from '@/server/spatial-tour/tour-presence';
import { republishOwnerProperty } from '@/services/owner-property/owner-property-publication.service';
import type { ListingTourPresence } from '@/types/public-listing';
import type { TourSubject } from '@/types/spatial-tour';

import { listedTourFromPresence } from './listing-publication-facts';
import { republishListing, type ListingSourceProperty, type PublishOutcome } from './publish-public-listing';

const logger = createModuleLogger('listings/listing-tour-refresh');

/**
 * Τι έγινε — κλειστό σύνολο, ώστε ο καλών (και το log) να ξέρει **γιατί** δεν γράφτηκε κάτι:
 * - `unlisted`  — δεν υπάρχει δημόσια αγγελία· όταν δημοσιευτεί, ο γραφέας θα δέσει το γεγονός μόνος του
 * - `unchanged` — η αγγελία λέει ήδη την τρέχουσα απάντηση (πρώιμη αποκοπή)
 * - `absent`    — η αγγελία υπάρχει αλλά η ρίζα της δεν διαβάζεται· το κλείνει η επανασύνθεση
 */
export type ListingTourRefreshOutcome = PublishOutcome | 'unlisted' | 'unchanged' | 'absent';

/** Δύο παρουσίες λένε το ίδιο στον κόσμο; — η **μόνη** πληροφορία του πεδίου είναι η ορατότητα. */
export function sameListedTour(a: ListingTourPresence | null, b: ListingTourPresence | null): boolean {
  return (a?.visibility ?? null) === (b?.visibility ?? null);
}

/** Η επαναδημοσίευση της ρίζας, ανά είδος — ο **υπάρχων** γραφέας κάθε οικογένειας, ποτέ τρίτος. */
async function republishSubject(adminDb: AdminFirestore, subject: TourSubject): Promise<PublishOutcome | 'absent'> {
  const snapshot = await adminDb.collection(TOUR_SUBJECT_COLLECTION[subject.kind]).doc(subject.id).get();

  if (subject.kind === 'owner-property') {
    const property = ownerPropertyFromDocument(snapshot.data(), subject.id);
    return property === null ? 'absent' : (await republishOwnerProperty(adminDb, property)).publish;
  }

  const data = snapshot.data() as ListingSourceProperty | undefined;
  // Το `id` δεν ζει μέσα στο έγγραφο — η προβολή το θέλει ως ταυτότητα της αγγελίας.
  return data === undefined ? 'absent' : republishListing(adminDb, subject.id, { ...data, id: subject.id });
}

/** Η λογιστική του βραδινού διχτυού: πόσες αγγελίες κοιτάχτηκαν και πόσες βρέθηκαν να λένε **παλιά** απάντηση. */
export interface TourReconciliationReport {
  readonly scanned: number;
  /** Έλεγαν ήδη την τρέχουσα απάντηση — το αναμενόμενο για **όλες** όταν κάθε γραφέας καλεί τον δρόμο. */
  readonly agreed: number;
  /** 🔴 Γραφέας που ξέφυγε: η αγγελία έλεγε άλλο από τον κριτή, και διορθώθηκε τώρα. */
  readonly healed: number;
  readonly failed: number;
}

/**
 * **Το δίχτυ ασφαλείας** (N.7.2 #4) — κάθε δημοσιευμένη αγγελία ξαναρωτά τον κριτή, από τον **ίδιο** δρόμο.
 *
 * 🔑 Με κάθε γραφέα να καλεί το {@link refreshListingAfterTourChange}, το `healed` είναι **μηδέν**. Μη μηδενικό =
 * γραφέας που ξέφυγε (ή αλλαγή θεματοφυλακής χωρίς επαναδημοσίευση) — φαίνεται στα μεγέθη της εκτέλεσης.
 * ⚠️ **Σειριακά**, ίδια πολιτική κόστους με τη συμφιλίωση μέσων· ιδεμποτικό: δεύτερο πέρασμα βρίσκει τα πάντα `agreed`.
 */
export async function reconcileListingTours(adminDb: AdminFirestore): Promise<TourReconciliationReport> {
  const tally = { scanned: 0, agreed: 0, healed: 0, failed: 0 };
  const listings = await adminDb.collection(COLLECTIONS.PUBLIC_LISTINGS).select().get();

  for (const doc of listings.docs) {
    const subject = tourSubjectOfListing(doc.id);
    if (subject === null) continue;
    tally.scanned += 1;

    const outcome = await refreshListingAfterTourChange(adminDb, subject);
    if (outcome === 'unchanged' || outcome === 'unlisted') tally.agreed += 1;
    else if (outcome === 'published' || outcome === 'withdrawn') tally.healed += 1;
    else tally.failed += 1;
  }

  if (tally.healed > 0 || tally.failed > 0) logger.error('ΓΡΑΦΕΑΣ ΠΟΥ ΞΕΦΥΓΕ — αγγελίες με παλιά παρουσία περιήγησης', tally);
  else logger.info('Συμφιλίωση παρουσίας περιήγησης', tally);
  return tally;
}

/**
 * **Το ίδιο, για γραφέα που κρατά μόνο το έγγραφο της περιήγησης** (ο ψήστης και η σάρωση προσώπων δουλεύουν πάνω σε
 * `captureRef`, χωρίς ρίζα στα χέρια τους). Η ρίζα διαβάζεται από την **ίδια** την περιήγηση (`SpatialTour.subject`) —
 * ποτέ από το id του εγγράφου, που είναι ντετερμινιστικό αλλά μονόδρομο.
 */
export async function refreshListingOfTour(
  adminDb: AdminFirestore,
  tourRef: DocumentReference,
): Promise<ListingTourRefreshOutcome> {
  try {
    const snapshot = await tourRef.get();
    const tour = snapshot.exists ? spatialTourFromDocument(snapshot.data(), tourRef.id) : null;
    if (tour === null) return 'absent';
    return await refreshListingAfterTourChange(adminDb, tour.subject);
  } catch (error) {
    logger.error('Η παρουσία περιήγησης άλλαξε — δεν διαβάστηκε η περιήγηση για επαναπροβολή', {
      tourId: tourRef.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return 'failed';
  }
}

/**
 * **Ξαναπρόβαλε την αγγελία αυτής της ρίζας, αν η παρουσία της περιήγησής της άλλαξε.**
 *
 * ⚠️ **Awaited από τον καλούντα** (N.7.2 #6): είναι **τι βλέπει ο κόσμος**. Όποιος πάτησε «Δημοσίευση περιήγησης» και
 * είδε επιτυχία δικαιούται η κάρτα να δείχνει ήδη το σήμα.
 */
export async function refreshListingAfterTourChange(
  adminDb: AdminFirestore,
  subject: TourSubject,
): Promise<ListingTourRefreshOutcome> {
  try {
    const listingSnapshot = await adminDb.collection(COLLECTIONS.PUBLIC_LISTINGS).doc(subject.id).get();
    const stored = listingSnapshot.exists ? readStoredListing(listingSnapshot.data(), subject.id) : null;
    if (stored === null) return 'unlisted';

    // ⚠️ Ο κριτής ρωτιέται **γυμνός**, όχι μέσα από το `listedTourOf`: εκείνο μετατρέπει αποτυχία ανάγνωσης σε `null`
    //    (σωστό για τον γραφέα), και εδώ ένα τέτοιο `null` θα **έσβηνε** το σήμα μιας αγγελίας που έχει περιήγηση.
    //    Αποτυχία ⇒ `catch` ⇒ `failed`, η αγγελία μένει όπως ήταν.
    const current = listedTourFromPresence(await readTourPresence(adminDb, subject.id));
    if (sameListedTour(stored.listing.tour, current)) return 'unchanged';

    const outcome = await republishSubject(adminDb, subject);
    if (outcome === 'published' || outcome === 'withdrawn') {
      logger.info('Η παρουσία περιήγησης άλλαξε — η αγγελία ξαναπροβλήθηκε', { subject, tour: current, outcome });
    } else {
      logger.error('Η παρουσία περιήγησης άλλαξε — η αγγελία ΕΜΕΙΝΕ ΜΠΑΓΙΑΤΙΚΗ', { subject, tour: current, outcome });
    }
    return outcome;
  } catch (error) {
    logger.error('Η παρουσία περιήγησης άλλαξε — η επαναπροβολή απέτυχε', {
      subject,
      error: error instanceof Error ? error.message : String(error),
    });
    return 'failed';
  }
}
