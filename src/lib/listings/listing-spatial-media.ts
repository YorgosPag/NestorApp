/**
 * @fileoverview **ΤΑ ΧΩΡΙΚΑ ΜΕΣΑ ΜΙΑΣ ΑΓΓΕΛΙΑΣ** — «έχει μοντέλο;», «έχει περιήγηση;», «έχει ανάγλυφο;», και **ποιο ΕΝΑ
 * σήμα** δείχνει η κάρτα.
 * @related ADR-777 §8.88 · ADR-845 Φ4.3 · ADR-884 Κ3β · ADR-920 Β6.6β · components/listings/ListingSpatialBadge
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
import type { ListingModel, ListingTerrain, PublicListing } from '@/types/public-listing';

/**
 * **Τα μοντέλα που φτάνουν στον αγοραστή** — ο κριτής του ADR-842 Α7, μία φορά: μοντέλο που μάντεψε μηχανή και δεν
 * ενέκρινε άνθρωπος δεν δείχνεται, άρα ούτε **διαφημίζεται** στην κάρτα.
 */
export function presentableModels(listing: Pick<PublicListing, 'models'>): readonly ListingModel[] {
  return listing.models.filter(isPubliclyPresentable);
}

/**
 * **Το ανάγλυφο που φτάνει στον αγοραστή** (ADR-920 Β6.6) — ο ΙΔΙΟΣ κριτής του Α7 με τα μοντέλα. Τον ρωτούν η καρτέλα
 * «Ανάγλυφο», η σκηνή της **και** το σήμα «3D» (Β6.6β): ό,τι διαφημίζει η κάρτα, το δείχνει η σελίδα.
 */
export function presentableTerrain(listing: Pick<PublicListing, 'terrain'>): ListingTerrain | null {
  const { terrain } = listing;
  return terrain !== null && isPubliclyPresentable(terrain) ? terrain.value : null;
}

/**
 * **Έχει περιήγηση που φαίνεται;** — διαβάζει την προβολή, που αντιγράφει την απάντηση του `readTourPresence`.
 * `on-request` μετρά ως «έχει»: η αγγελία τη δείχνει (με αίτημα πρόσβασης), όπως και η σελίδα της.
 */
export function hasListedTour(listing: Pick<PublicListing, 'tour'>): boolean {
  return listing.tour !== null;
}

/** Το κλειστό σύνολο του σήματος — πλήρες `Record` στον καταναλωτή, ώστε νέα τιμή να σπάει τη μεταγλώττιση. */
export const LISTING_SPATIAL_BADGES = ['tour', 'model', 'tour-and-model', 'terrain'] as const;
export type ListingSpatialBadgeKind = (typeof LISTING_SPATIAL_BADGES)[number];

/** Ό,τι ρωτά το σήμα — τα τρία χωρικά μέσα. */
export type ListingSpatialMediaSubject = Pick<PublicListing, 'models' | 'tour' | 'terrain'>;

/**
 * **Το ΕΝΑ σήμα χωρικών μέσων της κάρτας**, ή `null` όταν δεν υπάρχει τίποτα να ειπωθεί.
 *
 * 🏔️ **Το ανάγλυφο είναι το τρίτο χωρικό μέσο** (ADR-920 Β6.6β · ADR-777 §8.88.5): στην αγορά γης το «3D tour» είναι η
 * τρισδιάστατη πτήση πάνω από το έδαφος (Land id: *«slopes, boundaries, and terrain features»*), και εδώ είναι **μετρημένο
 * από τοπογράφο**. ⚠️ **Τελευταίο κατά σειρά, ποτέ στοίβα**: περιήγηση ή μοντέλο, όταν υπάρχουν, εξηγούν ήδη γιατί η
 * αγγελία περνά το φίλτρο «3D» — μια τέταρτη/πέμπτη τιμή-ένωση θα έφερνε επτά συνδυασμούς για μία θέση.
 */
export function listingSpatialBadge(listing: ListingSpatialMediaSubject): ListingSpatialBadgeKind | null {
  const tour = hasListedTour(listing);
  const model = presentableModels(listing).length > 0;
  if (tour && model) return 'tour-and-model';
  if (tour) return 'tour';
  if (model) return 'model';
  return presentableTerrain(listing) !== null ? 'terrain' : null;
}

/**
 * **Έχει χωρικά μέσα;** — η ερώτηση του φίλτρου «Μόνο με 3D» (ADR-777 §8.89).
 *
 * 🔑 **Ορίζεται ΜΕΣΩ του σήματος, όχι δίπλα του.** Το φίλτρο περνά μια αγγελία **ακριβώς** όταν η κάρτα της δείχνει
 * σήμα — δεύτερη διατύπωση (`hasListedTour(l) || presentableModels(l).length > 0`) θα ήταν σήμερα ισοδύναμη και αύριο
 * όχι: ένα τρίτο χωρικό μέσο θα έμπαινε στο ένα και θα ξεχνιόταν στο άλλο.
 *
 * 🏆 **Πέρα από τη Zillow** (μετρημένο 2026-10-13, Austin, φίλτρο `3d` ενεργό): 6 από τις 9 πρώτες κάρτες έδειχναν
 * «Showcase» και όχι «3D Tour» — η μία θέση μοιράζεται, άρα το αποτέλεσμα δεν λέει **γιατί** πέρασε. Εδώ κάθε
 * αγγελία που περνά το φίλτρο φορά το σήμα της, εκ κατασκευής.
 */
export function hasSpatialMedia(listing: ListingSpatialMediaSubject): boolean {
  return listingSpatialBadge(listing) !== null;
}
