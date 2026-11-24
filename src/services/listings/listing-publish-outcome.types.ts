/**
 * @fileoverview **ΟΙ ΕΚΒΑΣΕΙΣ ΤΗΣ ΠΡΟΒΟΛΗΣ ΣΤΟ ΣΥΡΜΑ** — το συμβόλαιο, χωριστά από τις μηχανές που το παράγουν.
 * @related ./publish-public-listing (ο γραφέας) · ./listing-media-refresh (η επαναπροβολή μετά από αλλαγή αρχείων) ·
 *   services/file-record/file-batch-act.types (η απάντηση δέσμης που διαβάζει ο πελάτης) · ADR-744 (shell slice)
 * @module services/listings/listing-publish-outcome.types
 *
 * 🔑 **ΓΙΑΤΙ ΧΩΡΙΣΤΟ ΑΡΧΕΙΟ (2026-11-24).** Τα τρία ονόματα ζούσαν μέσα στις μηχανές του διακομιστή, και τα διάβαζαν
 * αρχεία που φτάνουν στον **πελάτη** (`file-batch-act.types` · `types/owner-property`). Ένα `import type` σβήνεται στη
 * μεταγλώττιση, αλλά **όχι** στους περιπατητές κλειστότητας (CHECK 3.34): μετρήθηκε ότι η οθόνη των προσφορών έσερνε έτσι
 * όλο το ράφι και το έδαφος — ως το `lib/geo/greek-grid`, του οποίου το `description` σφραγίστηκε στο manifest του κελύφους.
 *
 * ⚠️ **ΚΑΜΙΑ εισαγωγή εδώ, ούτε τύπου.** Αυτό το αρχείο είναι φύλλο του γράφου· μόλις εισαγάγει μηχανή, η διαρροή
 * ξαναμπαίνει αθόρυβα. Το φυλά η άγκυρα `services/file-record/__tests__/file-batch-act-types-closure.test.ts`.
 * ⚠️ Τα ονόματα **επανεξάγονται** από τις μηχανές (`publish-public-listing` · `listing-media-refresh`), όπως στο
 * `public-listing-projection-types`: ο κώδικας του διακομιστή τα παίρνει από εκεί που παίρνει και τις συναρτήσεις.
 */

/** Τι έκανε ο γραφέας — ρητά, ώστε η επανασύνθεση να μπορεί να **μετρήσει**. */
export type PublishOutcome = 'published' | 'withdrawn' | 'failed';

/**
 * Τι έγινε — η έκβαση του γραφέα, ή **`absent`** όταν δεν υπήρχε ακίνητο να προβληθεί.
 *
 * 🔑 Το `absent` είναι **δηλωμένη** απάντηση και όχι `failed`: ακίνητο που δεν υπάρχει ή ανήκει
 * σε άλλον μισθωτή δεν είναι «εκκρεμής προβολή» που θα διορθώσει η επανασύνθεση.
 */
export type ListingMediaRefreshOutcome = PublishOutcome | 'absent';

/** Τι έγινε στην αγγελία **ενός** ακινήτου, μετά από αλλαγή αρχείων του. */
export interface ListingRefreshReport {
  readonly propertyId: string;
  readonly outcome: ListingMediaRefreshOutcome;
}
