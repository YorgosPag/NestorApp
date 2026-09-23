/**
 * @fileoverview **Τα χρώματα των σχημάτων αγγελίας στον χάρτη** — χωρίς καμία εξάρτηση χάρτη.
 * @related ADR-777 §8.70 (Φάση 2) · search-results/ResultsMap · listing-map-snapshot/*
 * @module components/search-results/listing-map-paint
 *
 * ⚠️ **Ξεχωριστό αρχείο επίτηδες**: η κάρτα «Τα ακίνητά μου» χρειάζεται τα χρώματα για το κλειδί
 * του στιγμιοτύπου **πριν** φορτωθεί η MapLibre. Αν ζούσαν στο `ResultsMapSources` (που εισάγει
 * το σύνορο `@/lib/maps/maplibre`), κάθε σελίδα με κάρτα θα κατέβαζε τη βιβλιοθήκη χάρτη.
 */

import { readRootCssVar } from '@/subapps/dxf-viewer/config/color-config';

/** Τα δύο χρώματα με τα οποία ο χάρτης βάφει κάθε σχήμα αγγελίας. */
export interface ListingMapPaint {
  readonly mark: string;
  readonly surface: string;
}

/**
 * **Τα χρώματα των σχημάτων, διαβασμένα ΤΩΡΑ από το θέμα** — ένας αναγνώστης για τον δημόσιο
 * χάρτη και για το στιγμιότυπο της κάρτας «Τα ακίνητά μου» (ADR-777 §8.70 Φάση 2).
 *
 * ⚠️ `hsl(var(--chart-1))` δεν το καταλαβαίνει το MapLibre — θέλει συγκεκριμένο χρώμα, άρα η
 * τιμή διαβάζεται τη στιγμή της απόδοσης και **αλλάζει με το θέμα**.
 */
export function readListingMapPaint(): ListingMapPaint {
  return {
    mark: `hsl(${readRootCssVar('--chart-1', '210 80% 50%')})`,
    surface: `hsl(${readRootCssVar('--card', '0 0% 100%')})`,
  };
}
