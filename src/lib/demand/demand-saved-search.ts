/**
 * 🔖 **Είναι ήδη αποθηκευμένη αυτή η αναζήτηση;** (ADR-888) — Zillow/Redfin: «Save search» → «✓ Saved».
 *
 * 🔑 **Σύγκριση στην ΚΑΝΟΝΙΚΗ μορφή της διεύθυνσης, μέσω των ΙΔΙΩΝ προβολών**: η αναζήτηση περνά από
 * `parseListingFilters → serializeListingFilters`, κάθε ζήτηση από `listingFiltersFromDemand → serializeListingFilters`.
 * Καμία δεύτερη λογική «ίδιο;» — δύο κριτές ισότητας θα διαφωνούσαν στην πρώτη νέα παράμετρο.
 *
 * ⚠️ Μετρά μόνο **ενεργές** ζητήσεις: μια αποσυρμένη δεν ειδοποιεί, άρα η αναζήτηση **δεν** είναι αποθηκευμένη.
 * Αναζήτηση με όριο περιοχής (που η ζήτηση δεν κρατά) δεν ταυτίζεται ποτέ — σωστά: ο άνθρωπος βλέπει
 * «Αποθήκευση», και το παράθυρο του λέει τι δεν κρατιέται.
 */

import { parseListingFilters, serializeListingFilters } from '@/lib/listings/listing-filters';
import { LIVE_DEMAND_LIFECYCLES, type PropertyDemand } from '@/types/property-demand';
import { listingFiltersFromDemand } from './demand-listing-filters';

/** Η κανονική μορφή μιας αναζήτησης — ό,τι δεν είναι φίλτρο (επιλογή, ταξινόμηση, `save`) πέφτει. */
function canonicalSearch(searchQuery: string): string {
  return serializeListingFilters(parseListingFilters(new URLSearchParams(searchQuery))).toString();
}

/** Η ενεργή ζήτηση που **είναι** αυτή η αναζήτηση, ή `null`. */
export function savedDemandForSearch(
  demands: readonly PropertyDemand[],
  searchQuery: string,
): PropertyDemand | null {
  const wanted = canonicalSearch(searchQuery);
  return (
    demands.find(
      (demand) =>
        (LIVE_DEMAND_LIFECYCLES as readonly string[]).includes(demand.lifecycle) &&
        serializeListingFilters(listingFiltersFromDemand(demand)).toString() === wanted,
    ) ?? null
  );
}
