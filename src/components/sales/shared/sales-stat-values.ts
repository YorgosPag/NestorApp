/**
 * =============================================================================
 * SALES STAT VALUES — SSoT για τη μορφοποίηση των τιμών του dashboard πωλήσεων
 * =============================================================================
 *
 * Και οι 4 σελίδες πωλήσεων υπολόγιζαν τα ίδια «μηδέν σημαίνει άγνωστο, όχι €0»
 * inline, 12 φορές συνολικά, μαζί με το ίδιο literal παύλας. Ο κανόνας είναι
 * ένας — ζει εδώ.
 *
 * Ο ΤΙΤΛΟΣ κάθε στατιστικού μένει δηλωτικά στη σελίδα: τα i18n κλειδιά δεν
 * παράγονται από prefix (`sales.sold.stats.totalSales` vs
 * `salesParking.stats.available`), και δεν είναι δουλειά ενός formatter.
 *
 * @module components/sales/shared/sales-stat-values
 * @see sales-list-page-shell.tsx — ο σκελετός που αποδίδει τα stats
 */

import { formatCurrencyCompact, formatCurrencyWhole } from '@/lib/intl-utils';

/**
 * Η ένδειξη «δεν υπάρχει τιμή». Δεν είναι μεταφράσιμο κείμενο (N.11): είναι
 * τυπογραφικό σύμβολο, ίδιο σε κάθε γλώσσα.
 */
export const SALES_STAT_EMPTY = '—';

/** Χρηματικό ποσό σε συμπτυγμένη μορφή (π.χ. «€1,2M») — παύλα όταν λείπει. */
export function salesMoneyValue(amount: number): string {
  return amount > 0 ? formatCurrencyCompact(amount) : SALES_STAT_EMPTY;
}

/** Τιμή ανά τ.μ. — στρογγυλοποιημένη σε ακέραιο, παύλα όταν λείπει. */
export function salesPerSqmValue(amountPerSqm: number): string {
  return amountPerSqm > 0 ? formatCurrencyWhole(Math.round(amountPerSqm)) : SALES_STAT_EMPTY;
}
