/**
 * @fileoverview **Το ωμό έγγραφο και ο κρίκος της αλυσίδας** — τύποι-φύλλα, χωρίς εισαγωγές.
 * @module lib/listings/public-listing-schema-types
 * @related ./public-listing-schema.ts
 */

/**
 * **Ό,τι γυρίζει η Firestore** — και τίποτα παραπάνω δεν είναι γνωστό.
 *
 * 🔑 Ο τύπος είναι σκόπιμα ασθενής: αν ήταν `Partial<PublicListing>` θα υποσχόταν
 * ότι τα πεδία που **υπάρχουν** έχουν τον σωστό τύπο — υπόσχεση που η βάση δεν
 * δίνει σε κανέναν.
 */
export type StoredListingDocument = Readonly<Record<string, unknown>>;

/** Ο **ένας** κρίκος: μια αλλαγή που συνέβη, με το έγγραφο που την τεκμηριώνει. */
export interface ListingMigration {
  /** Η έκδοση **στην οποία** ανεβάζει. Ο πρώτος κρίκος ανεβάζει στο `2`. */
  readonly to: number;
  /** Ποιο ADR εισήγαγε τα πεδία — ώστε το «γιατί» να μη χαθεί. */
  readonly adr: string;
  /**
   * Τα κλειδιά που εισάγει, σε μορφή διαδρομής (`commercial.nightlyRate`).
   *
   * ⚠️ **Δηλωμένη πρόθεση, ΟΧΙ αυθεντία.** Η αυθεντία είναι το {@link apply}, και
   * μια άγκυρα το **εκτελεί** για να επιβεβαιώσει ότι τα δύο συμφωνούν. Χωρίς
   * αυτόν τον έλεγχο η λίστα θα ήταν σχόλιο που πάλιωσε.
   */
  readonly adds: readonly string[];
  /** Η πράξη. Δέχεται έγγραφο έκδοσης `to - 1`, επιστρέφει έκδοσης `to`. */
  readonly apply: (doc: StoredListingDocument) => StoredListingDocument;
}
