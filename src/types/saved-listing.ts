/**
 * @fileoverview **«ΤΗΝ ΚΡΑΤΗΣΑ»** — η αποθήκευση μιας δημόσιας αγγελίας από έναν άνθρωπο.
 * @related ADR-777 §8.74 · services/listings/saved-listing.service.ts · lib/listings/saved-listing.ts
 * @module types/saved-listing
 *
 * 🔑 **Ένα έγγραφο ανά (άνθρωπο, αγγελία)**, με ντετερμινιστική ταυτότητα (`svls_*`). Δεν έχει
 * κατάσταση «αφαιρέθηκε»: η αφαίρεση **σβήνει** το έγγραφο — ό,τι δεν χρειάζεται, δεν κρατιέται.
 *
 * 🔴 **Κανένα αντίγραφο της αγγελίας εδώ** (τίτλος, εικόνα, διεύθυνση): η λίστα διαβάζει την
 * **τρέχουσα** δημόσια αγγελία. Αντίγραφο θα έδειχνε τιμή που δεν ισχύει ή αγγελία που αποσύρθηκε
 * σαν να ήταν ακόμη στην αγορά. Η **μόνη** μνήμη είναι η τιμή τη στιγμή της αποθήκευσης — είναι
 * γεγονός εκείνης της στιγμής, όχι αντίγραφο.
 */

import type { PriceObservation } from '@/types/price-history';
import type { PublicListing } from '@/types/public-listing';

/** Η τιμή που **έβλεπε** ο άνθρωπος όταν πάτησε «αποθήκευση» — `null` = αγγελία χωρίς τιμή. */
export type PriceAtSave = PriceObservation['price'];

/** Το αποθηκευμένο έγγραφο — ό,τι γράφει ο **ένας** γραφέας. */
export interface SavedListing {
  readonly id: string;
  /** Ο άξονας απομόνωσης (`tenant-config` → `mode: 'userId'`). */
  readonly saverUserId: string;
  /** Η δημόσια αγγελία — ίδια ταυτότητα με το ακίνητο (`public_listings/{id}`). */
  readonly listingId: string;
  /** ISO στιγμή. */
  readonly savedAt: string;
  readonly priceAtSave: PriceAtSave;
}

/**
 * **Τι έγινε η τιμή από τότε που την κράτησες.** Ονομασμένο, ποτέ πρόσημο αριθμού.
 * `not-comparable` = άλλαξε ο ρόλος (π.χ. από πώληση σε ενοικίαση) ή λείπει μία από τις δύο.
 */
export type PriceSinceSave =
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'reduced'; readonly from: number; readonly to: number }
  | { readonly kind: 'raised'; readonly from: number; readonly to: number }
  | { readonly kind: 'not-comparable' };

/** Μία γραμμή της λίστας «Αποθηκευμένα» — η **τρέχουσα** αγγελία, ή ότι δεν είναι πια στην αγορά. */
export type SavedListingRow =
  | {
      readonly kind: 'in-market';
      readonly listingId: string;
      readonly savedAt: string;
      readonly listing: PublicListing;
      readonly priceSinceSave: PriceSinceSave;
    }
  | { readonly kind: 'withdrawn'; readonly listingId: string; readonly savedAt: string };

/** Η απάντηση του `GET` — οι γραμμές, νεότερη πρώτα. */
export interface SavedListingsResponse {
  readonly rows: readonly SavedListingRow[];
  /** Η ανάγνωση άγγιξε τον φράχτη (`SAVED_LISTINGS_READ_LIMIT`) — λέγεται, δεν σιωπά. */
  readonly truncated: boolean;
}

/** Η απάντηση του `PUT` / `DELETE` — η κατάσταση **μετά** την πράξη. */
export interface SaveToggleResponse {
  readonly saved: boolean;
}

/** Γιατί ο γραφέας αρνήθηκε — ονομασμένο (`409`), ποτέ γενικό σφάλμα. */
export type SaveRefusal = 'not-in-market' | 'own-listing';
