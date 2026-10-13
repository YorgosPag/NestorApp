/**
 * @fileoverview **ΤΑ ΧΩΡΙΚΑ ΜΕΣΑ ΜΙΑΣ ΑΓΓΕΛΙΑΣ** — «έχει μοντέλο;», «έχει περιήγηση;», και **ποιο ΕΝΑ σήμα** δείχνει η κάρτα.
 * @related ADR-777 §8.88 · ADR-845 Φ4.3 · ADR-884 Κ3β · components/listings/ListingSpatialBadge
 * @module lib/listings/listing-spatial-media
 *
 * 🔑 **ΕΝΑ ΣΗΜΕΙΟ ΑΠΟΦΑΣΙΖΕΙ.** Η κάρτα της λίστας, η φούσκα του χάρτη και οι καρτέλες της σελίδας αγγελίας ρωτούν
 * **εδώ** — ποτέ `listing.models.length` ή `listing.tour !== null` σκόρπια στο JSX. Ο κριτής του μοντέλου ήταν ήδη
 * γραμμένος δύο φορές (`ListingMediaViewer` · `ListingModels`)· η τρίτη θα ήταν η κάρτα.
 *
 * ⚠️ **ΕΝΑ σήμα, ποτέ στοίβα** (απόφαση Giorgio 2026-10-13, μετρημένο: Zillow 28/28 κάρτες με ακριβώς ένα). Όταν
 * υπάρχουν και τα δύο, η απάντηση είναι **τρίτη τιμή** (`tour-and-model`) — μία πρόταση με ένωση, όχι δύο σήματα.
 *
 * **Layering**: leaf — καθαρές συναρτήσεις πάνω σε `PublicListing`. Καμία εξάρτηση από React/Firestore.
 */

import { isPubliclyPresentable } from '@/lib/property/attribute-provenance';
import type { ListingModel, PublicListing } from '@/types/public-listing';

/**
 * **Τα μοντέλα που φτάνουν στον αγοραστή** — ο κριτής του ADR-842 Α7, μία φορά: μοντέλο που μάντεψε μηχανή και δεν
 * ενέκρινε άνθρωπος δεν δείχνεται, άρα ούτε **διαφημίζεται** στην κάρτα.
 */
export function presentableModels(listing: Pick<PublicListing, 'models'>): readonly ListingModel[] {
  return listing.models.filter(isPubliclyPresentable);
}

/**
 * **Έχει περιήγηση που φαίνεται;** — διαβάζει την προβολή, που αντιγράφει την απάντηση του `readTourPresence`.
 * `on-request` μετρά ως «έχει»: η αγγελία τη δείχνει (με αίτημα πρόσβασης), όπως και η σελίδα της.
 */
export function hasListedTour(listing: Pick<PublicListing, 'tour'>): boolean {
  return listing.tour !== null;
}

/** Το κλειστό σύνολο του σήματος — πλήρες `Record` στον καταναλωτή, ώστε τέταρτη τιμή να σπάει τη μεταγλώττιση. */
export const LISTING_SPATIAL_BADGES = ['tour', 'model', 'tour-and-model'] as const;
export type ListingSpatialBadgeKind = (typeof LISTING_SPATIAL_BADGES)[number];

/** **Το ΕΝΑ σήμα χωρικών μέσων της κάρτας**, ή `null` όταν δεν υπάρχει τίποτα να ειπωθεί. */
export function listingSpatialBadge(listing: Pick<PublicListing, 'models' | 'tour'>): ListingSpatialBadgeKind | null {
  const tour = hasListedTour(listing);
  const model = presentableModels(listing).length > 0;
  if (tour && model) return 'tour-and-model';
  if (tour) return 'tour';
  return model ? 'model' : null;
}
