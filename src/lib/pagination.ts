/**
 * @fileoverview **ΤΟ ΣΥΜΒΟΛΑΙΟ ΜΙΑΣ ΣΕΛΙΔΑΣ** — αίτημα και απάντηση, κοινά για διακομιστή και πελάτη.
 * @related Google AIP-158 · Stripe `starting_after` / `has_more` · `lib/api/page-token.ts` · `lib/admin-keyset-page.ts`
 * @module lib/pagination
 *
 * 🔑 **Δρομέας, όχι offset**: το `nextCursor` είναι **αδιαφανές** token (ο πελάτης το μεταφέρει αυτούσιο, δεν το
 * αναλύει) και δείχνει τη **θέση** της τελευταίας γραμμής (τιμή ταξινόμησης + id εγγράφου). Ένα offset θα
 * μετακινούσε σελίδες όταν μπαίνει νέα εγγραφή και θα χρέωνε κάθε παραλειπόμενο έγγραφο.
 *
 * ⚠️ **Σελίδα ≠ σύνολο**: μια σελίδα είναι για την **οθόνη**· άθροισμα πάνω της είναι άθροισμα **μέρους**
 * (ADR-ACC-010 §2.1.1). Για υπολογισμό υπάρχουν οι πλήρεις σαρώσεις.
 *
 * **Layering**: leaf — μόνο τύποι και σταθερές, χωρίς SDK· εισάγεται και από τον browser.
 */

/** Προεπιλεγμένο μέγεθος σελίδας — όσα χωρούν σε μια οθόνη πίνακα. */
export const PAGE_SIZE_DEFAULT = 50;

/** Ανώτατο μέγεθος σελίδας — πάνω από αυτό ο πελάτης ζητά **επόμενη** σελίδα, όχι μεγαλύτερη (AIP-158). */
export const PAGE_SIZE_MAX = 200;

/** Ποια σελίδα ζητείται. `cursor: null` ⇒ η πρώτη. */
export interface PageRequest {
  readonly pageSize: number;
  readonly cursor: string | null;
}

/** Η πρώτη σελίδα με το προεπιλεγμένο μέγεθος. */
export const FIRST_PAGE: PageRequest = { pageSize: PAGE_SIZE_DEFAULT, cursor: null };

export interface PaginatedResult<T> {
  readonly items: T[];
  /** Υπάρχει επόμενη σελίδα — μετρημένο με `limit + 1`, όχι μαντεμένο από «γέμισε η σελίδα». */
  readonly hasNext: boolean;
  /** Αδιαφανές token της επόμενης σελίδας· `null` ⇔ `hasNext === false`. */
  readonly nextCursor: string | null;
  readonly pageSize: number;
}
