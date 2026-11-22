/**
 * @fileoverview **ΣΕ ΠΟΙΟ ΡΑΦΙ ΔΗΜΟΣΙΕΥΕΤΑΙ ΚΑΘΕ ΥΛΙΚΟ — ΚΑΙ ΜΕ ΠΟΙΑ ΣΥΝΤΑΓΗ** (ADR-845 Φ4.2β · ADR-920 §14.9 Γ)
 * @related services/listings/publish-public-listing-shelf (`partitionListingSources`, ο γραφέας) ·
 *   services/listings/listing-media-fingerprint-stamp (το αποτύπωμα) · services/upload/utils/public-shelf-kinds
 * @module services/listings/listing-shelf-routing
 *
 * 🔑 **ΕΝΑΣ διακόπτης, δύο ερωτήσεις.** Ο γραφέας ρωτά *«σε ποιο ράφι πάει αυτή η πηγή;»* και το αποτύπωμα ρωτά *«με ποια
 * συνταγή θα ψηνόταν σήμερα;»*. Δύο χωριστοί `switch` θα μπορούσαν να διαφωνήσουν: ένα νέο υλικό σε ένα ράφι, με
 * συνταγή άλλου στο αποτύπωμα. Το βραδινό πέρασμα θα έβλεπε τότε για πάντα «συμφωνεί» σε αγγελία που ψήθηκε με άλλη
 * συνταγή, ή «παλιά» σε σωστή. Εδώ η απάντηση δίνεται **μία** φορά.
 *
 * 🔑 **Η συνταγή είναι η ΙΔΙΑ συμβολοσειρά που γράφει το ράφι** (`shelfRecipe` πάνω στην `encoding` της **ίδιας** γραμμής
 * του `PUBLIC_SHELF_KINDS`, με το ίδιο `framingOf`). Δεν υπάρχει δεύτερη περιγραφή να παλιώσει.
 */

import type { ListingMaterial } from '@/lib/listings/listing-material';
import {
  LISTING_MODEL_SHELF,
  LISTING_SHELF,
  LISTING_TERRAIN_SHELF,
  LISTING_VIDEO_SHELF,
  shelfRecipe,
} from '@/services/upload/utils/public-shelf-kinds';
import type { PublicShelfSource } from '@/services/upload/utils/storage-path-public-shelf';

/** Τα τέσσερα ράφια μιας αγγελίας (μία ρίζα, τέσσερις καταλήξεις — άγκυρα Α-1ε). */
export type ListingShelfLane = 'raster' | 'model' | 'video' | 'terrain';

/**
 * **Ο ΦΡΟΥΡΟΣ ΤΟΥ ΛΕΞΙΛΟΓΙΟΥ** — τοπικός και **με όνομα**, όπως όλοι οι αδελφοί του.
 *
 * ⚠️ Το ιδίωμα του σπιτιού είναι **ΤΟΠΙΚΟ + ΟΝΟΜΑΣΜΕΝΟ** *(μετρημένο στη Φ4.1: τέσσερις τέτοιοι,
 * **κανένας κεντρικός**)*. ⛔ **Μην γεννήσεις κεντρικό `assertNever`**: η αξία δεν είναι το
 * `throw`, είναι το **μήνυμα** — αυτό λέει *ποια* ερώτηση έμεινε αναπάντητη.
 */
function assertNeverShelfMaterial(material: never): never {
  throw new Error(
    `listingShelfLaneOf: άγνωστο είδος υλικού — ${JSON.stringify(material)}. ` +
      'Νέα τιμή στο LISTING_MATERIAL_KINDS χωρίς απάντηση στο «σε ποιο ΡΑΦΙ ' +
      'δημοσιεύεται;» (ADR-845 Φ4.2β).',
  );
}

/**
 * 🏆 **ΣΕ ΠΟΙΟ ΡΑΦΙ ΚΑΘΕΤΑΙ ΑΥΤΟ ΤΟ ΥΛΙΚΟ** — `switch`, εξαντλητικός, καμία άρνηση.
 *
 * ⛔ **ΠΟΤΕ δύο `filter` με άρνηση.** Δύο ανεξάρτητα κατηγορήματα μπορούν να αφήσουν **κενό** ή να **διπλογράψουν**·
 * ένας `switch` δεν μπορεί ούτε το ένα ούτε το άλλο (η μετρημένη κλάση σφάλματος της Φ4.1).
 */
export function listingShelfLaneOf(material: ListingMaterial): ListingShelfLane {
  switch (material.kind) {
    case 'photo':
    case 'floorplan':
      return 'raster';

    case 'floorPlate':
      // ADR-907 §11.5 — raster όπως η κάτοψη του ακινήτου: **ίδιο** ράφι, ίδια κατάληξη, ίδια συμφιλίωση. Το αν φεύγει
      //    το κρίνει το `withinFloorPlateAdmission`, πριν από το ράφι.
      return 'raster';

    case 'model':
      return 'model';

    case 'video':
      return 'video';

    case 'terrain':
      return 'terrain';

    default:
      return assertNeverShelfMaterial(material);
  }
}

/** Η συνταγή του raster ραφιού για αυτό το υλικό — ίδιο `framingOf` με τη συμφιλίωση (`public-shelf.service`). */
function rasterRecipeOf(material: ListingMaterial): string {
  return shelfRecipe(LISTING_SHELF.encoding, LISTING_SHELF.framingOf(material));
}

/**
 * **Οι συνταγές με τις οποίες θα ψηνόταν ΣΗΜΕΡΑ αυτή η πηγή** — μία ανά ράφι που την ψήνει.
 *
 * 🔑 Το βίντεο ψήνεται **δύο φορές**: MP4 στο ράφι βίντεο **και** εξώφυλλο στο raster ράφι, με υλικό την raster όψη του
 * (`VIDEO_MATERIAL`, `listing-video-poster`). Αλλαγή σε **οποιαδήποτε** από τις δύο ⇒ η αγγελία ξαναψήνεται.
 */
export function listingShelfRecipesOf(source: PublicShelfSource<ListingMaterial>): readonly string[] {
  const material = source.material;
  switch (listingShelfLaneOf(material)) {
    case 'raster':
      return [rasterRecipeOf(material)];
    case 'model':
      return [shelfRecipe(LISTING_MODEL_SHELF.encoding)];
    case 'video':
      return [shelfRecipe(LISTING_VIDEO_SHELF.encoding), rasterRecipeOf(material)];
    case 'terrain':
      return [shelfRecipe(LISTING_TERRAIN_SHELF.encoding)];
  }
}
