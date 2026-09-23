/**
 * @fileoverview **Οι διαδρομές της αποθήκευσης αγγελίας** — API, σελίδα, πρόθεση μετά τη σύνδεση.
 * @related ADR-777 §8.74 · lib/listings/saved-listing.ts · lib/demand/demand-routes.ts (ίδιο σχήμα)
 * @module lib/listings/saved-listing-routes
 *
 * 🔑 **Ένα σημείο για route, hook, σελίδα ΚΑΙ πλαϊνή μπάρα** — γι' αυτό χωρίς καμία βαριά εξάρτηση.
 */

/** Η λίστα του ανθρώπου (`GET`). */
export const SAVED_LISTINGS_API_PATH = '/api/saved-listings';

/** Η αποθήκευση **μιας** αγγελίας (`PUT` = κράτα · `DELETE` = άφησε). */
export function savedListingApiPath(listingId: string): string {
  return `${SAVED_LISTINGS_API_PATH}/${encodeURIComponent(listingId)}`;
}

/**
 * Η σελίδα «Αποθηκευμένα» στον ιδιωτικό χώρο (`(me)`).
 * 🔑 Η λέξη είναι **ίδια** με το API και τη συλλογή (`saved_listings`) — μάθημα του `first-contacts`
 * (`workspace-scope.ts`): τμήμα που συγκρούεται με σελίδα γραφείου βγάζει και αυτήν από τον χώρο.
 */
export const MY_SAVED_LISTINGS_ROUTE = '/saved-listings' as const;

/**
 * **Η πρόθεση που επιβιώνει της σύνδεσης.** Ο ανώνυμος πατά «αποθήκευση» ⇒ σύνδεση με
 * `?next=<σελίδα>?save=<id>` ⇒ στην επιστροφή η αποθήκευση **ολοκληρώνεται μόνη της**, μία φορά.
 */
export const SAVE_INTENT_PARAM = 'save' as const;

/**
 * Η σελίδα επιστροφής με την πρόθεση — διατηρεί ό,τι άλλο είχε ήδη το URL (φίλτρα αναζήτησης).
 * Η **κατανάλωση** της πρόθεσης γίνεται με το `replaceUrlSearchParams` (`url-query-state`), το ένα
 * σημείο που γράφει query string — όχι με δεύτερο βοηθό εδώ.
 */
export function withSaveIntent(pathname: string, search: string, listingId: string): string {
  const params = new URLSearchParams(search);
  params.set(SAVE_INTENT_PARAM, listingId);
  return `${pathname}?${params.toString()}`;
}
