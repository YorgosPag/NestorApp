/**
 * ENTERPRISE ID GENERATION — Η ΑΠΟΘΗΚΕΥΣΗ ΑΓΓΕΛΙΑΣ (ADR-777 §8.74)
 *
 * Composition model — abstract base chain, not a mixin:
 *
 *   ListingStatsIdGenerators     (ADR-777 §8.72 — προβολές αγγελίας)
 *     ↑ extends
 *   SavedListingIdGenerators     (this file — «την κράτησα»)
 *     ↑ extends
 *   CompositeKeyIdGenerators     (composite keys + pure readers)
 *
 * 🔑 **Ξεχωριστό αρχείο, όχι προσθήκη στο `listing-stats-generators`**: εκείνο λέει «προβολές
 * αγγελίας». Η αποθήκευση είναι **πράξη ανθρώπου**, όχι μέτρηση — η κεφαλίδα του θα έλεγε ψέματα.
 *
 * 🔴 **ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΟ, ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ Ο ΣΚΟΠΟΣ**: ένα έγγραφο ανά (άνθρωπο, αγγελία). Το «την
 * έχω ήδη;» είναι `doc(id)`, όχι ερώτημα, και το δεύτερο κλικ είναι `create()` που βρίσκει
 * έγγραφο — **κανένα** διπλότυπο, όσα κι αν έρθουν ταυτόχρονα.
 *
 * ⚠️ **Διαχωριστής σπόρου `:`**: ούτε το Firebase uid ούτε το `ownp_*` περιέχουν `:`.
 *
 * @module services/enterprise-id-saved-listing-generators
 * @version 1.0.0
 */

import { ENTERPRISE_ID_PREFIXES } from './enterprise-id-prefixes';
import { ListingStatsIdGenerators } from './enterprise-id-listing-stats-generators';

const P = ENTERPRISE_ID_PREFIXES;

export abstract class SavedListingIdGenerators extends ListingStatsIdGenerators {
  /** Η αποθήκευση **μιας** αγγελίας από **έναν** άνθρωπο — μία για όσο την κρατά. */
  generateDeterministicSavedListingId(saverUserId: string, listingId: string): string {
    return this.mintDeterministicV4Id(P.SAVED_LISTING, `${saverUserId}:${listingId}`);
  }
}
