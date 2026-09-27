'use client';

/**
 * @fileoverview **ΜΙΑ ΚΑΤΟΨΗ, ΠΑΝΤΟΥ ΤΟ ΙΔΙΟ `<img>`** — κάρτα ακινήτου και πλήρης-παραθύρου σελίδα (ADR-841 §7
 * Α17 · ADR-884 Φ2στ · §4.12 Μέρος Δ).
 * @related `ListingFloorplans.tsx` (η κάρτα) · `media/ListingFloorplanPageContent.tsx` (η πλήρης σελίδα)
 * @module components/listing-detail/ListingFloorplanImage
 *
 * 🔑 **ΕΞΗΧΘΗ ΓΙΑΤΙ ΤΟ jscpd ΤΟ ΕΠΙΑΣΕ ΣΤΟ ΙΔΙΟ COMMIT** (N.18, CHECK 3.28 `--diff`): οι δύο καταναλωτές
 * ζωγραφίζουν την ΙΔΙΑ εικόνα, με το ΙΔΙΟ `alt`/`srcSet`/`className` — διαφέρουν **μόνο** στο `sizes`, που ο
 * καθένας δίνει από τη δική του διάταξη (πλέγμα δύο-τριών στηλών ⟂ στήλη πλήρους πλάτους). Το `sizes` είναι το
 * **μόνο** πράγμα που ένας καταναλωτής δικαιούται να αποφασίσει· ό,τι άλλο (χωρίς `priority`, `object-contain`
 * ΠΟΤΕ `object-cover`) ζει **εδώ**, μία φορά — δες τα δύο σχόλια πιο κάτω για το γιατί.
 */

import { useTranslation } from '@/i18n/hooks/useTranslation';
import { listingImageSrcSet } from '@/lib/listings/listing-images';
import type { ListingFloorplan } from '@/types/public-listing';

export interface ListingFloorplanImageProps {
  readonly floorplan: ListingFloorplan;
  /** Τα `sizes` — αποφασίζονται από τη διάταξη του καταναλωτή (πλέγμα ⟂ στήλη πλήρους πλάτους). */
  readonly sizes: string;
}

/**
 * ⚠️ **ΠΟΤΕ `priority`**: το στοιχείο **LCP** της σελίδας ακινήτου είναι η κορυφαία φωτογραφία *(Α2.4)*, και
 * **μόνο μία** εικόνα επιτρέπεται να πάρει `fetchpriority="high"` — πολλές «υψηλής» ακυρώνουν η μία την άλλη.
 * Μια κάτοψη που θα το διεκδικούσε θα **χειροτέρευε** μετρήσιμα τη σελίδα για να εμφανιστεί νωρίτερα κάτι που ο
 * επισκέπτης κοιτάζει **δεύτερο**.
 *
 * ⚠️ **`object-contain` και όχι `object-cover`**: μια φωτογραφία αντέχει κόψιμο, ένα **σχέδιο όχι** — κομμένη
 * κάτοψη χάνει δωμάτια, δηλαδή λέει ψέματα για το ακίνητο.
 */
export function ListingFloorplanImage({ floorplan, sizes }: ListingFloorplanImageProps) {
  const { t } = useTranslation(['search-results']);
  const image = floorplan.value;

  return (
    /*
      eslint-disable-next-line @next/next/no-img-element -- η πηγή είναι το δημόσιο
      ράφι (content-addressed, εκτός optimizer)· βλ. ADR-777 §8.11 και ADR-841 Α12.
    */
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image.url}
      srcSet={listingImageSrcSet(image)}
      sizes={sizes}
      width={image.width}
      height={image.height}
      alt={t(image.altKey)}
      loading="lazy"
      decoding="async"
      className="w-full rounded-lg border border-border bg-card object-contain"
    />
  );
}
