/**
 * **Ο ΓΡΑΦΕΑΣ ΠΟΥ ΞΕΡΕΙ ΤΙ ΕΙΚΟΝΕΣ ΕΧΕΙ** — η συμφιλίωση του δημόσιου ραφιού και η
 * γραφή που εξαρτάται από αυτήν, μαζί.
 *
 * 🔑 **ΓΙΑΤΙ ΕΦΥΓΕ ΑΠΟ ΤΟ `publish-public-listing.ts`** *(N.7.1)*: εκείνο το αρχείο
 * απαντά *«ποια ακίνητα ξαναγράφονται και με ποια σειρά;»* — αλληλουχία. Αυτό εδώ
 * απαντά *«τι συμβαίνει στα bytes όταν το `set` πέσει;»* — αντιστάθμιση. Δύο
 * ερωτήσεις, δύο αρχεία· το πρώτο είχε περάσει τις 500 γραμμές ακριβώς επειδή
 * κουβαλούσε και τις δύο.
 *
 * ⚠️ **Η σειρά «συμφιλίωση ΠΡΙΝ το `set`» ταξίδεψε αυτούσια** — δεν είναι στιλιστική:
 * το κλειδί κάθε παραγώγου είναι το sha256 των καθαρισμένων bytes, άρα τα URL **δεν
 * υπάρχουν** πριν τρέξει η συμφιλίωση. Το σκεπτικό ζει στο {@link writeWithShelf}.
 */

import type { DocumentReference } from 'firebase-admin/firestore';
import { createModuleLogger } from '@/lib/telemetry';
import { PUBLIC_LISTING_SCHEMA_VERSION } from '@/lib/listings/public-listing-schema';
import { withPublishedGallery, type ProjectedShelfImage } from './public-listing-projection';
import type { PublicListing } from '@/types/public-listing';
import type { ListingMaterial } from '@/lib/listings/listing-material';
import type { PublicShelfSource } from '@/services/upload/utils/storage-path-public-shelf';
import { LISTING_SHELF } from '@/services/upload/utils/public-shelf-kinds';
import { reconcilePublicShelf, type PublicShelfImage } from './public-shelf.service';

const logger = createModuleLogger('publish-public-listing-shelf');

/**
 * Συμφιλιώνει το δημόσιο ράφι **χωρίς ποτέ να ρίξει τη δημοσίευση**.
 *
 * 🔑 **Η αστοχία του ραφιού δεν ακυρώνει την αγγελία** — ίδιο συμβόλαιο με τον γραφέα
 * της προβολής. Αλλά **ονομάζεται**: το `reconcilePublicShelf` επιστρέφει `'failed'`
 * αντί να πετάξει, και η επόμενη επανασύνθεση το διορθώνει. Η διαφορά ανάμεσα σε
 * «σιωπηλά μπαγιάτικο» και «γνωστά εκκρεμές».
 */
export async function reconcileShelfSafely(
  listingId: string,
  sources: readonly PublicShelfSource[]
): Promise<void> {
  const report = await reconcilePublicShelf(LISTING_SHELF, listingId, sources);

  if (report.outcome === 'failed') {
    logger.error('Το δημόσιο ράφι δεν συμφιλιώθηκε — η αγγελία γράφτηκε, τα αρχεία ΟΧΙ', {
      propertyId: listingId,
    });
  }
}

/**
 * **Η ΓΡΑΦΗ ΠΟΥ ΞΕΡΕΙ ΤΙ ΕΙΚΟΝΕΣ ΕΧΕΙ** — συμφιλίωση, δέσιμο, `set`, αντιστάθμιση.
 *
 *
 * 🔴 **Η Φ2 έγραφε ρητά «ΜΕΤΑ το `set`, όχι πριν», και η Φ3 το ανέτρεψε — με λόγο.**
 *    Το κλειδί κάθε παραγώγου είναι το **sha256 των καθαρισμένων bytes**, δηλαδή τα
 *    URL **δεν υπάρχουν** πριν τρέξει η συμφιλίωση. Με την παλιά σειρά το έγγραφο
 *    δεν θα μπορούσε ποτέ να ξέρει τι URL έχει.
 *
 * 🏆 **ΚΑΙ Η ΝΕΑ ΣΕΙΡΑ ΕΙΝΑΙ ΑΥΣΤΗΡΑ ΚΑΛΥΤΕΡΗ, ΟΧΙ ΑΠΛΩΣ ΑΝΑΓΚΑΙΑ**: η συλλογή
 *    χτίζεται **ΑΠΟ ΤΗΝ ΑΝΑΦΟΡΑ** του ραφιού, άρα το έγγραφο είναι **δομικά ανίκανο**
 *    να διαφημίσει εικόνα που δεν κάθεται στον κάδο. Μια φωτογραφία που απορρίφθηκε
 *    στον καθαρισμό (`rejected`) απλώς **δεν μπαίνει** — κανείς δεν χρειάζεται να το
 *    θυμηθεί.
 *
 * ⚠️ **Ο παλιός φόβος ονομάζεται και αντισταθμίζεται**: bytes δημοσιευμένα για
 *    αγγελία που δεν γράφτηκε ποτέ. Αν το `set` αποτύχει, το `catch` **αδειάζει το
 *    ράφι** ({@link withdrawShelfAfterFailure}) — αντισταθμιστική πράξη, το ίδιο
 *    ιδίωμα με την απόσυρση. Και ακόμη κι αν χαθεί κι εκείνη (κατάρρευση διεργασίας),
 *    η **επόμενη** συμφιλίωση της ίδιας αγγελίας τα σβήνει: το `deleteExtra` τρέχει
 *    **πάντα**, ανεξάρτητα από το τι έγινε πριν.
 */
export async function writeWithShelf(
  ref: DocumentReference,
  listingId: string,
  listing: PublicListing,
  sources: readonly PublicShelfSource[]
): Promise<void> {
  const shelf = await reconcilePublicShelf(LISTING_SHELF, listingId, sources);

  if (shelf.outcome === 'failed') {
    logger.error('Το δημόσιο ράφι δεν συμφιλιώθηκε — η αγγελία γράφεται ΧΩΡΙΣ εικόνες', {
      propertyId: listingId,
    });
  }

  try {
    await ref.set({
      ...withPublishedGallery(listing, shelf.published.map(toProjectedImage)),
      schemaVersion: PUBLIC_LISTING_SCHEMA_VERSION,
    });
  } catch (error) {
    await withdrawShelfAfterFailure(listingId, shelf.published.length);
    throw error;
  }
}

/**
 * **Ό,τι είδε το ράφι, στη γλώσσα της ΚΑΘΑΡΗΣ προβολής** — μία γραμμή μετάφρασης.
 *
 * 🔑 Υπάρχει ώστε το `public-listing-projection.ts` να μη χρειαστεί ποτέ να εισαγάγει
 * τον τύπο της υπηρεσίας: εκείνο το αρχείο δηλώνει ρητά ότι είναι **καθαρό**, και η
 * υπηρεσία σέρνει `firebase-admin` **και** `sharp`.
 *
 * ⚠️ Το `sources` παίρνει **όλα** τα παράγωγα, όχι μόνο το κανονικό: αυτό ακριβώς είναι
 * το `srcset`, και είναι ο λόγος που η αναφορά τα κρατά **ομαδοποιημένα** (Α2.2).
 */
function toProjectedImage(image: PublicShelfImage<ListingMaterial>): ProjectedShelfImage {
  return {
    url: image.canonical.url,
    width: image.canonical.width,
    height: image.canonical.height,
    sources: image.variants.map((variant) => ({ url: variant.url, width: variant.width })),
    // 🔑 **Ταξιδεύει αυτούσιο, καμία κρίση εδώ** (ADR-841 §7 Α17.4): αυτή η γραμμή είναι
    //    μετάφραση τύπων, όχι σημασιολογία. Ο **ένας** τόπος που ρωτά «κάτοψη ή
    //    φωτογραφία;» είναι το `withPublishedGallery`.
    material: image.material,
  };
}

/**
 * **Η ΑΝΤΙΣΤΑΘΜΙΣΗ**: το `set` απέτυχε αφού τα bytes είχαν ήδη δημοσιευτεί.
 *
 * 🔑 **Δεν είναι «καθάρισμα», είναι η ίδια πράξη με άλλη τιμή**: κενό σύνολο ⇒ το
 * πρόθεμα αδειάζει. Ο γραφέας εξακολουθεί να έχει **μία** συμπεριφορά.
 *
 * ⚠️ **Δεν πετά ποτέ, και δεν καταπίνει το αρχικό σφάλμα**: ο καλών ξαναρίχνει εκείνο.
 * Μια αποτυχία εδώ θα έκρυβε την αιτία πίσω από το σύμπτωμα.
 */
async function withdrawShelfAfterFailure(listingId: string, published: number): Promise<void> {
  if (published === 0) return;

  logger.warn('Η προβολή δεν γράφτηκε — αποσύρονται τα bytes που είχαν ήδη δημοσιευτεί', {
    propertyId: listingId,
    published,
  });
  await reconcileShelfSafely(listingId, []);
}
