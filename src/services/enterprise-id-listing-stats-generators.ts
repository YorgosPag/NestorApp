/**
 * ENTERPRISE ID GENERATION — ΟΙ ΤΑΥΤΟΤΗΤΕΣ ΤΩΝ ΣΤΑΤΙΣΤΙΚΩΝ ΑΓΓΕΛΙΑΣ (ADR-777 §8.72)
 *
 * Composition model — abstract base chain, not a mixin:
 *
 *   NetworkIdGenerators          (ADR-867 — νήματα ανάμεσα σε χώρους)
 *     ↑ extends
 *   ListingStatsIdGenerators     (this file — προβολές αγγελίας)
 *     ↑ extends
 *   CompositeKeyIdGenerators     (composite keys + pure readers)
 *
 * 🔑 **Ξεχωριστό αρχείο, όχι προσθήκη στο `network-generators`**: η κεφαλίδα εκείνου λέει
 * «νήματα ανάμεσα σε χώρους». Ένας μετρητής προβολών δεν είναι νήμα — θα την έκανε να λέει ψέματα.
 *
 * 🔴 **ΟΛΑ ΝΤΕΤΕΡΜΙΝΙΣΤΙΚΑ, ΚΑΙ ΑΥΤΟ ΕΙΝΑΙ Ο ΣΚΟΠΟΣ**: κάθε έγγραφο εδώ είναι «το ένα για
 * (ακίνητο, ημέρα…)». Η καταγραφή ξέρει ποιο έγγραφο αγγίζει **χωρίς ερώτημα**, και δύο
 * ταυτόχρονες προβολές δεν γεννούν ποτέ δύο κάδους για την ίδια μέρα.
 *
 * 🔴 **ΓΕΝΝΗΣΗ ΜΟΝΟ ΣΤΟΝ ΔΙΑΚΟΜΙΣΤΗ**: οι συλλογές είναι `read/write: false` στον πελάτη.
 *
 * ⚠️ **Διαχωριστής σπόρου `:`**: ούτε το `ownp_*`/`prop_*`, ούτε η ημέρα `YYYY-MM-DD`, ούτε το
 * hex hash περιέχουν `:` ⇒ ο σπόρος δεν είναι αμφίσημος.
 *
 * @module services/enterprise-id-listing-stats-generators
 * @version 1.0.0
 */

import { ENTERPRISE_ID_PREFIXES } from './enterprise-id-prefixes';
import { NetworkIdGenerators } from './enterprise-id-network-generators';

const P = ENTERPRISE_ID_PREFIXES;

export abstract class ListingStatsIdGenerators extends NetworkIdGenerators {
  // `mintDeterministicV4Id` + `generateId` κληρονομούνται ως protected abstract — η μηχανή μένει μία.

  /** Το αλάτι **μιας ημέρας** (`YYYY-MM-DD`) — ένα για όλες τις αγγελίες. */
  generateDeterministicListingViewSaltId(day: string): string {
    return this.mintDeterministicV4Id(P.LISTING_VIEW_SALT, day);
  }

  /**
   * «Αυτός ο επισκέπτης μετρήθηκε σήμερα σε αυτή την αγγελία».
   * @param visitorDayHash — hex sha256 που **ήδη** περιέχει ημέρα + ακίνητο + αλάτι.
   */
  generateDeterministicListingViewMarkId(visitorDayHash: string): string {
    return this.mintDeterministicV4Id(P.LISTING_VIEW_MARK, visitorDayHash);
  }

  /** Ο ζεστός κάδος **ενός shard** μιας ημέρας ενός ακινήτου. */
  generateDeterministicListingViewShardId(propertyId: string, day: string, shard: number): string {
    return this.mintDeterministicV4Id(P.LISTING_VIEW_SHARD, `${propertyId}:${day}:${shard}`);
  }

  /** Η ψυχρή σύνοψη **ενός ακινήτου** — μία για όλη του τη ζωή. */
  generateDeterministicListingStatsId(propertyId: string): string {
    return this.mintDeterministicV4Id(P.LISTING_STATS, propertyId);
  }
}
