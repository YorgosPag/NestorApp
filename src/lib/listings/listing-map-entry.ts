/**
 * @fileoverview **Πώς περιγράφεται μια αγγελία σε ΜΙΑ γραμμή** — τίτλος + τιμή όπως τη βλέπει ο κόσμος.
 * @related ADR-777 §8.76 (λίστα διαλέγματος) · §8.77 (δείκτης άκρης χαρτοφυλακίου · πινακίδες τιμής κατόχου)
 * @module lib/listings/listing-map-entry
 *
 * 🔑 **ΕΝΑΣ τύπος, πολλές επιφάνειες**: η λίστα διαλέγματος του χάρτη, ο δείκτης άκρης της λίστας
 * και οι πινακίδες τιμής ρωτούν την **ίδια** ερώτηση («ποια είναι, πόσο κάνει;») για δύο πηγές — τη
 * δημόσια αγγελία (`PublicListing`) και το ακίνητο του κατόχου (`ownerListingEntry`). Ζούσε μέσα σε
 * component (`ListingMapStackPopup`)· με καταναλωτή σε `lib/` ανέβηκε εδώ (ένα component δεν είναι
 * ποτέ εξάρτηση του `lib/`).
 */

import { resolveDisplayPrice, type DisplayPrice } from '@/lib/properties/price-resolver';
import type { PublicListing } from '@/types/public-listing';

export interface ListingMapEntry {
  readonly id: string;
  readonly title: string;
  /**
   * Η τιμή **όπως τη βλέπει ο κόσμος** — **ΟΧΙ** έτοιμη ετικέτα.
   *
   * 🔑 Η μορφοποίηση γίνεται στην επιφάνεια, με το **ίδιο** `displayPriceLabel` + `useStayTotal`
   * της φούσκας: με ημερομηνίες διαμονής η γραμμή λέει το **ίδιο σύνολο** με τη φούσκα και την
   * πινακίδα, αντί για δεύτερη τιμή για το ίδιο ακίνητο.
   */
  readonly price: DisplayPrice;
}

/** Η γραμμή της **δημόσιας** αγγελίας. Το ζευγάρι του κατόχου: `ownerListingEntry`. */
export function publicListingEntry(listing: PublicListing): ListingMapEntry {
  return { id: listing.id, title: listing.title, price: resolveDisplayPrice(listing) };
}
