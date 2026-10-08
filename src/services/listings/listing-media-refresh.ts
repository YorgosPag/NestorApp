/**
 * @fileoverview **«ΑΛΛΑΞΕ ΥΛΙΚΟ ΤΗΣ ΑΓΓΕΛΙΑΣ ⇒ ΞΑΝΑΠΡΟΒΑΛΕ»** — η κλήση που έλειπε από τη ΔΕΥΤΕΡΗ πηγή.
 * @related ADR-845 §7.16 (Ο-35) · ADR-777 Α3/Α5 · services/listings/publish-public-listing
 * @module services/listings/listing-media-refresh
 *
 * ────────────────────────────────────────────────────────────────────────────
 * 🔴 Η ΠΡΟΒΟΛΗ ΕΧΕΙ **ΔΥΟ** ΠΗΓΕΣ, ΚΑΙ ΤΗΝ ΠΥΡΟΔΟΤΟΥΣΕ ΜΟΝΟ Η ΜΙΑ
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Το `public_listings/{id}` παράγεται από το **έγγραφο του ακινήτου** *και* από τα **αρχεία του**
 * *(`readPublishedAgencyMedia`)*. Κάθε γραφή στο πρώτο ξαναπροβάλλει *(PATCH, κύκλος ζωής, έργο)*·
 * **καμία** γραφή στο δεύτερο δεν το έκανε.
 *
 * Μετρημένο ζωντανά 2026-10-08: `POST …/model` → **200**, αρχείο `ready` · `public` · `active`, και
 * η αγγελία έμεινε με `models: []` και `projectedAt` **μιας εβδομάδας πριν**. Το §7.10 του ADR-845
 * είχε «επαληθεύσει» την αλυσίδα επειδή ο κρίκος 3 ήταν ένα **χειροκίνητο** PATCH του ακινήτου —
 * δηλαδή η δημοσίευση δούλευε όσο κάποιος τύχαινε να αγγίξει το ακίνητο αμέσως μετά.
 *
 * 🔑 **Δεν είναι νέος γραφέας.** Διαβάζει το έγγραφο του ακινήτου και καλεί τον **ΕΝΑ**
 * {@link republishListing}. Ό,τι αποφασίζει εκείνος *(δημοσιεύεται; αποσύρεται; τι ψήνεται;)*
 * μένει εκεί — εδώ ζει μόνο το *«ποιο ακίνητο, και είναι όντως δικό του;»*.
 *
 * ⚠️ **Το έγγραφο διαβάζεται ΤΩΡΑ, από τη βάση** — ποτέ από τον καλούντα: η πόρτα ενός αρχείου
 * δεν κρατά το ακίνητο στα χέρια της, και ένα στιγμιότυπο που θα ταξίδευε ως όρισμα θα μπορούσε
 * να ξαναγράψει την αγγελία με **παλιά** τιμή, σκεπάζοντας ένα PATCH που έτρεξε ανάμεσα.
 */

import 'server-only';

import type { Firestore as AdminFirestore } from 'firebase-admin/firestore';

import { COLLECTIONS } from '@/config/firestore-collections';
import { createModuleLogger } from '@/lib/telemetry';

import {
  republishListing,
  reportProjectionFailure,
  type ListingSourceProperty,
  type PublishOutcome,
} from './publish-public-listing';

const logger = createModuleLogger('listing-media-refresh');

/**
 * Τι έγινε — η έκβαση του γραφέα, ή **`absent`** όταν δεν υπήρχε ακίνητο να προβληθεί.
 *
 * 🔑 Το `absent` είναι **δηλωμένη** απάντηση και όχι `failed`: ακίνητο που δεν υπάρχει ή ανήκει
 * σε άλλον μισθωτή δεν είναι «εκκρεμής προβολή» που θα διορθώσει η επανασύνθεση.
 */
export type ListingMediaRefreshOutcome = PublishOutcome | 'absent';

/**
 * **Ξαναπρόβαλε την αγγελία ενός ακινήτου, επειδή άλλαξε αρχείο του.**
 *
 * ⚠️ **Awaited από τον καλούντα, ΟΧΙ fire-and-forget** — ίδια διάκριση με το
 * `republishPublicProjection` (N.7.2 #6): αυτό είναι **τι βλέπει ο κόσμος**. Όποιος πάτησε
 * «Δημοσίευση» και είδε επιτυχία δικαιούται η αγγελία να έχει ήδη αλλάξει.
 *
 * 🔑 **Δεν πετά ποτέ**: η αλλαγή του αρχείου **έγινε** ήδη. Η αποτυχία ονομάζεται
 * *(`failed`)* και την κλείνει η επανασύνθεση.
 *
 * 🔐 **Η κηδεμονία ξαναρωτιέται ΕΔΩ**, όχι μόνο στην πόρτα: το `companyId` είναι ο μισθωτής του
 * **αρχείου** που άλλαξε, και ακίνητο άλλου μισθωτή **δεν** ξαναπροβάλλεται εξαιτίας του.
 */
export async function refreshListingAfterMediaChange(
  adminDb: AdminFirestore,
  propertyId: string,
  companyId: string,
): Promise<ListingMediaRefreshOutcome> {
  try {
    const snapshot = await adminDb.collection(COLLECTIONS.PROPERTIES).doc(propertyId).get();
    const data = snapshot.data() as ListingSourceProperty | undefined;

    if (data === undefined || data.companyId !== companyId) {
      logger.warn('Υλικό άλλαξε, αλλά δεν υπάρχει ακίνητο αυτού του μισθωτή να προβληθεί', { propertyId });
      return 'absent';
    }

    // Το `id` δεν ζει μέσα στο έγγραφο — η προβολή το θέλει ως ταυτότητα της αγγελίας.
    return await republishListing(adminDb, propertyId, { ...data, id: propertyId });
  } catch (error) {
    return reportProjectionFailure(propertyId, error);
  }
}
