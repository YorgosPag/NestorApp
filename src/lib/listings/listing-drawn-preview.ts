/**
 * # «N ΑΓΓΕΛΙΕΣ ΜΕΣΑ» — ΠΡΙΝ ΤΗΝ ΕΦΑΡΜΟΓΗ (ADR-885)
 *
 * 🏆 **Η Zillow δεν το κάνει**: σχεδιάζεις, πατάς Apply, και **μετά** μαθαίνεις ότι το
 * σχήμα έπιασε μηδέν σπίτια. Εδώ ο αριθμός φαίνεται **όσο σχεδιάζεις**.
 *
 * 🔑 **Ο ΙΔΙΟΣ φιλτραριστής με τη λίστα** (`applyListingFilters`), με την προεπισκόπηση
 * στη θέση του `near` — ο αριθμός πριν την Εφαρμογή **είναι** ο αριθμός μετά, όχι
 * εκτίμηση από δεύτερο κριτή.
 *
 * ⚠️ **Τίμιος όταν δεν ξέρει**: μετράμε μόνο ό,τι έχει ήδη φορτωθεί. Αν το σχήμα βγαίνει
 * έξω από την περιοχή που διαβάστηκε, ή η ανάγνωση κόπηκε στο ταβάνι, ο αριθμός είναι
 * **κάτω φράγμα** και η οθόνη λέει «τουλάχιστον».
 */

import { areaRelation } from '@/lib/geo/geo-area';
import { applyListingFilters, type ListingFilters } from '@/lib/listings/listing-filters';
import { listingReadPlan, type ListingReadCoverage } from '@/lib/listings/listing-geo-query';
import { listingSearchArea } from '@/lib/listings/listing-map-shape';
import type { GeoDrawnArea } from '@/types/geo/coordinates';
import type { PublicListing } from '@/types/public-listing';

export interface DrawnPreviewCount {
  readonly count: number;
  /** `false` ⇒ ο αριθμός είναι «τουλάχιστον». */
  readonly exact: boolean;
}

/**
 * @param listings — ό,τι διαβάστηκε για την **τρέχουσα** περιοχή (`filters.near`)
 * @param coverage — ομολογία της ανάγνωσης: πλήρης ή κομμένη
 */
export function drawnPreviewCount(
  listings: readonly PublicListing[],
  filters: ListingFilters,
  preview: GeoDrawnArea,
  coverage: ListingReadCoverage
): DrawnPreviewCount {
  // 🔴 **Μόνο αγγελίες ΜΕ θέση** — επαληθεύτηκε ζωντανά (2026-09-25): η προεπισκόπηση έλεγε «5»
  //    και η λίστα μετά την Εφαρμογή «3». Οι 2 **χωρίς θέση** κρίνονται «ίσως» (δεν αποκλείονται
  //    από περιοχή που δεν ξέρουμε αν τους ανήκει), αλλά το ερώτημα-ορθογώνιο της εφαρμοσμένης
  //    περιοχής **δεν τις φέρνει ποτέ**. Ο αριθμός πριν πρέπει να είναι ο αριθμός μετά.
  const reachable = listings.filter((listing) => listingSearchArea(listing.position) !== null);
  const count = applyListingFilters(reachable, { ...filters, near: preview }).length;
  const plan = listingReadPlan(filters.near);
  const covered = plan.kind === 'everywhere' || areaRelation(preview.bbox, plan.box) === 'within';
  return { count, exact: covered && coverage.kind === 'complete' };
}
