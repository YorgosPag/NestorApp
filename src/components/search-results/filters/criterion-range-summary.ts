/**
 * **Η σύνοψη ενός εύρους, όπως τη διαβάζει ο άνθρωπος στο τσιπ** — «150 χιλ. € – 250 χιλ. €», «Υπνοδωμάτια: από 2».
 *
 * @related ADR-777 §8.80 · CriterionRangePopover · criteria-filter-groups (isPriceCriterionKey)
 * @module components/search-results/filters/criterion-range-summary
 *
 * 🔑 **Καθαρή συνάρτηση, δικό της αρχείο**: το «τι γράφει το κουμπί» είναι απόφαση με
 * άγκυρα, όχι λεπτομέρεια απόδοσης — και ελέγχεται χωρίς DOM.
 *
 * ⚠️ **Η τιμή ΔΕΝ χρειάζεται όνομα άξονα, οι υπόλοιποι ΝΑΙ.** Το «€» λέει ήδη ποια ερώτηση
 * απαντά (Zillow: «$300K–$500K»)· ένα σκέτο «από 2» όμως δεν λέει αν είναι υπνοδωμάτια ή
 * μπάνια, άρα ο άξονας μπαίνει μπροστά.
 *
 * ⚠️ **Συμπαγής σημειογραφία ΜΟΝΟ για ποσά** (`notation: 'compact'`): «150 χιλ. €» χωράει σε
 * τσιπ, «150.000,00 €» όχι. Οι μετρήσεις (υπνοδωμάτια, τ.μ.) μένουν ακέραιες.
 */
import type { TFunction } from 'i18next';

import { NO_RANGE, type CriterionRange } from '@/lib/criteria/criterion-vocabulary';
import type { RangeCriterionKey } from '@/lib/criteria/listing-criterion-asking';
import { criterionLabel } from '@/lib/criteria/listing-criterion-labels';
import { formatCurrency, formatNumber } from '@/lib/intl-formatting';

import { isPriceCriterionKey } from './criteria-filter-groups';

function formatBound(key: RangeCriterionKey, value: number): string {
  return isPriceCriterionKey(key)
    ? formatCurrency(value, 'EUR', { notation: 'compact', maximumFractionDigits: 1 })
    : formatNumber(value);
}

/** Το εύρος χωρίς όνομα άξονα — ή `null` όταν ο άξονας δεν ρωτά. */
function rangeText(t: TFunction, key: RangeCriterionKey, range: CriterionRange): string | null {
  const { min, max } = range;
  if (min !== null && max !== null) {
    return t('search-filters:filters.range.summaryBoth', { min: formatBound(key, min), max: formatBound(key, max) });
  }
  if (min !== null) return t('search-filters:filters.range.summaryMin', { min: formatBound(key, min) });
  if (max !== null) return t('search-filters:filters.range.summaryMax', { max: formatBound(key, max) });
  return null;
}

/**
 * Χωρίς ερώτηση ⇒ **σκέτο το όνομα του άξονα** — ποτέ «Τιμή: όλες», που θα διαβαζόταν ως
 * ενεργό φίλτρο (ίδιος κανόνας με το `CriterionValueSetPopover`).
 */
export function criterionRangeSummary(
  t: TFunction,
  key: RangeCriterionKey,
  range: CriterionRange = NO_RANGE,
): string {
  const axis = criterionLabel(t, key);
  const text = rangeText(t, key, range);
  if (text === null) return axis;
  return isPriceCriterionKey(key) ? text : t('search-filters:filters.range.summaryAxis', { axis, range: text });
}
