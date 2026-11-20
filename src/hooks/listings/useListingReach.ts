'use client';

/**
 * @fileoverview **ΕΦΤΑΣΕ Η ΑΓΓΕΛΙΑ ΕΚΕΙ ΠΟΥ ΛΕΕΙ ΤΟ ΣΗΜΑ;** — ο αναγνώστης της κεφαλίδας ακινήτου (ADR-777 §8.103.2).
 * @related lib/listings/listing-presence (ο κριτής) · services/realtime/hooks/usePublicListings (ο αναγνώστης) ·
 *   hooks/listings/usePublishedMediaAgreement (το ίδιο ιδίωμα: μεταφορά, όχι κρίση)
 * @module hooks/listings/useListingReach
 *
 * ⛔ **Η ΚΡΙΣΗ ΔΕΝ ΖΕΙ ΕΔΩ.** Πρόθεση = `listingPresenceOf` · ετυμηγορία = `listingReachOf` — και τα δύο στο SSoT.
 * Αυτό το hook **μεταφέρει** την παρατήρηση και **χρονίζει** την καθίζηση.
 *
 * 🔑 **Ένας ακροατής ανά ανοιχτή κεφαλίδα, κανένας στη λίστα**: η κάρτα δείχνει την πρόθεση· ένας ακροατής ανά
 * κάρτα θα ήταν Ν ζωντανές συνδέσεις για μια ερώτηση που αφορά το **ένα** ακίνητο που κοιτάζει ο άνθρωπος.
 *
 * 🔑 **Ο αναγνώστης είναι ο ΥΠΑΡΧΩΝ** (`usePublicListing`, σύνορο CHECK 3.74, `read: if true`) — ο ίδιος που
 * σερβίρει την οθόνη 3. Καμία δεύτερη ανάγνωση του `public_listings`.
 *
 * ⚠️ **Καθίζηση** ({@link LISTING_REACH_SETTLE_MS}): απόκλιση δηλώνεται μόνο αν **επιμείνει** — αλλιώς κάθε
 * αποθήκευση θα αναβόσβηνε ψευδή προειδοποίηση. Το «όλα καλά» δηλώνεται **αμέσως**.
 */

import * as React from 'react';

import {
  LISTING_REACH_SETTLE_MS,
  listingPresenceOf,
  listingReachOf,
  type ListingObservation,
  type ListingReach,
} from '@/lib/listings/listing-presence';
import type { OfferedAudienceFacts } from '@/services/listings/public-listing-projection';
import { usePublicListing, type PublicListingLookup } from '@/services/realtime/hooks/usePublicListings';

export interface ListingReachState {
  /** Η ετυμηγορία **μετά την καθίζηση** — `aligned` όσο μια απόκλιση είναι ακόμη νέα. */
  readonly reach: ListingReach;
  /** Τι υπάρχει **τώρα** στον κόσμο — χωρίς καθίζηση: ο σύνδεσμος δείχνει μόνο σελίδα που υπάρχει. */
  readonly observed: ListingObservation;
}

/** Η αναζήτηση του αναγνώστη → παρατήρηση. Φόρτωση ή σφάλμα ⇒ «δεν ξέρω». */
function observationOf(lookup: PublicListingLookup): ListingObservation {
  if (lookup.state === 'found') return 'present';
  if (lookup.state === 'absent') return 'absent';
  return 'unknown';
}

export function useListingReach(property: (OfferedAudienceFacts & { readonly id: string }) | null): ListingReachState {
  // Χωρίς ακίνητο ⇒ κενή ταυτότητα: ο αναγνώστης απαντά χωρίς ανάγνωση, και η παρατήρηση γίνεται ρητά `unknown`.
  const lookup = usePublicListing(property?.id ?? '');
  const observed: ListingObservation = property === null ? 'unknown' : observationOf(lookup);
  const raw: ListingReach = property === null ? 'aligned' : listingReachOf(listingPresenceOf(property), observed);

  // ⚠️ Η καθίζηση κρατά **ποια** απόκλιση **ποιου** ακινήτου επέζησε: απόκλιση που καταλάγιασε στο ακίνητο Α
  //    δεν επιτρέπεται να εμφανιστεί αμέσως στο Β, ούτε το `missing` να επιζήσει ως `lingering`.
  const id = property?.id ?? '';
  const [settled, setSettled] = React.useState<string | null>(null);
  const key = `${id}:${raw}`;

  React.useEffect(() => {
    if (raw === 'aligned') {
      // Η ευθυγράμμιση «ξεχνά»: επόμενη απόκλιση ξαναπερνά από ολόκληρο το παράθυρο.
      setSettled(null);
      return;
    }
    const timer = setTimeout(() => setSettled(key), LISTING_REACH_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [key, raw]);

  // Ευθυγράμμιση ⇒ αμέσως. Απόκλιση ⇒ μόνο αν ζήσει όλο το παράθυρο· κάθε αλλαγή της ξαναμετρά από την αρχή.
  return { reach: raw !== 'aligned' && settled === key ? raw : 'aligned', observed };
}
